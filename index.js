const express = require('express')
const bodyParser = require('body-parser')
const serverless = require('serverless-http')
const rp = require('request-promise')
const AWS = require('aws-sdk')
AWS.config.update({ region: 'us-east-1' })
ddb = new AWS.DynamoDB({ apiVersion: '2012-10-08' })
require('dotenv').config()
const app = express()
app.use(bodyParser.json())
const PORT = 3001
const TABLE_NAME = 'ice-trae-bot'

app.get('/', (req, res) => res.send('Validator Bot Running'))

app.post('/', function (req, res) {
    const token = req.body.token
    const gameID = req.body.gameID
    const shots = req.body.shots
    if (token !== process.env.API_TOKEN) {
        res.status(401)
        res.send({ message: 'incorrect token' })
    } else {
        handleRequest(gameID, shots).then(function(response) {
            res.send({ message: 'Success' })
        }).catch(function(error) {
            res.send({ message: error })
        })
    }
})

function handleRequest(gameID, newShots) {
    return new Promise(function (resolve, reject) {
        getShots(gameID).then(function (oldShots) {
            newShots = Number(newShots)
            oldShots = Number(oldShots)
            const shotDiffArray = getShotDifferenceArray(newShots, oldShots)
            if (Array.isArray(shotDiffArray) && shotDiffArray.length) {
                let requests = []
                requests.push(putShotsInDatabase(gameID, shotDiffArray[shotDiffArray.length - 1]))
                requests.push(tweetArray(shotDiffArray))
                Promise.all(requests).then(function(response) {
                    resolve('Success handling the request')
                }).catch(function(error) {
                    reject('Error during DB/Twitter step')
                })
            } else {
                //No new info
                resolve(`Nothing new to update: ${oldShots}`)
            }
        }).catch(function (error) {
            console.log(error)
            console.log('Error getting shots in handleRequest')
        })
    })
}

function tweetArray(shotArray) {
    let requests = []
    shotArray.forEach(function (shot) {
        requests.push(tweet(shot))
    })
    return Promise.all(requests)
}

function tweet(amount) {
    const options = {
        method: 'POST',
        uri: process.env.TWITTER_API_URL,
        body: {
            amount: amount,
            token: process.env.API_TOKEN
        },
        json: true // Automatically stringifies the body to JSON
    };

    return new Promise(function (resolve, reject) {
        rp.post(options).then(function (response) {
            console.log('Success', response)
            resolve('Success posting tweet')
        }).catch(function (error) {
            console.log('Error', error)
            reject('Error posting tweet')
        })
    })
}

function getShotDifferenceArray(newShots, oldShots) {
    return Array(newShots).fill(oldShots).map((e, i) => i + 1).filter((x) => x > oldShots)
}

function putShotsInDatabase(gameID, shots) {
    gameID = gameID.toString()
    shots = shots.toString()
    var params = {
        TableName: TABLE_NAME,
        Item: {
            gameID: { S: gameID },
            shots: { S: shots },
        }
    }

    return new Promise(function (resolve, reject) {
        ddb.putItem(params, function (err, data) {
            if (err) {
                reject(err)
            } else {
                resolve(data)
            }
        })
    })
}

function getShots(gameID) {
    var params = {
        TableName: TABLE_NAME,
        Key: {
            gameID: { S: gameID },
        }
    }

    return new Promise(function (resolve, reject) {
        ddb.getItem(params, function (err, data) {
            if (err) {
                console.log('err')
                reject('Error getting shots')
            } else {
                console.log(data.Item)
                if (data.Item) {
                    resolve(data.Item.shots.S)
                } else {
                    resolve('0')
                }
            }
        })
    })
}
app.listen(PORT, () => console.log(`Tweet Bot app listening on port ${PORT}!`))
module.exports.handler = serverless(app)