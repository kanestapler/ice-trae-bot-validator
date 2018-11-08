const express = require('express')
const bodyParser = require('body-parser')
const serverless = require('serverless-http')
const rp = require('request-promise')
const AWS = require('aws-sdk')
require('dotenv').config()

AWS.config.update({ region: 'us-east-1' })
const ddb = new AWS.DynamoDB({ apiVersion: '2012-10-08' })

const app = express()
app.use(bodyParser.json())
const PORT = 3001
const SHOT_MADE_ROUTE = '/emojis'
const GAME_START_ROUTE = '/gameStart'

app.get('/', (req, res) => res.send('Validator Bot Running'))

app.post('/', (req, res) => {
    const {
        token,
        gameID,
        shots,
        opponent,
    } = req.body

    if (token !== process.env.API_TOKEN) {
        res.status(401)
        res.send({ message: 'incorrect token' })
    } else {
        handleRequest(gameID, shots, opponent).then(() => {
            res.send({ message: 'Success' })
        }).catch((error) => {
            res.send({ message: error })
        })
    }
})

function handleRequest(gameID, newShots, opponent) {
    return new Promise((resolve, reject) => {
        getShots(gameID).then((oldShots) => {
            if (oldShots) {
                const newShotsNumber = Number(newShots)
                const oldShotsNumber = Number(oldShots)
                const shotDiffArray = getShotDifferenceArray(newShotsNumber, oldShotsNumber)
                if (Array.isArray(shotDiffArray) && shotDiffArray.length) {
                    const requests = []
                    requests.push(putShotsInDatabase(
                        gameID,
                        shotDiffArray[shotDiffArray.length - 1]
                    ))
                    requests.push(tweetArray(shotDiffArray))
                    Promise.all(requests).then(() => {
                        resolve('Success handling the request')
                    }).catch(() => {
                        reject(new Error('Error during DB/Twitter step'))
                    })
                } else {
                    // No new info
                    resolve(`Nothing new to update: ${oldShotsNumber}`)
                }
            } else {
                // Game just starting
                const requests = []
                requests.push(putShotsInDatabase(gameID, 0))
                requests.push(tweetGameStart(opponent))
                Promise.all(requests).then(() => {
                    resolve('Success game start')
                }).catch(() => {
                    reject(new Error('Error during DB/Twitter step'))
                })
            }
        }).catch((error) => {
            console.log(error)
            console.log('Error getting shots in handleRequest')
        })
    })
}

function tweetArray(shotArray) {
    const requests = []
    shotArray.forEach((shot) => {
        requests.push(tweetShotMade(shot))
    })
    return Promise.all(requests)
}

function tweetShotMade(amount) {
    const options = {
        method: 'POST',
        uri: process.env.TWITTER_API_URL + SHOT_MADE_ROUTE,
        body: {
            amount,
            slack: process.env.SLACK,
            token: process.env.API_TOKEN,
        },
        json: true,
    }
    return tweet(options)
}

function tweetGameStart(opponent) {
    const options = {
        method: 'POST',
        uri: process.env.TWITTER_API_URL + GAME_START_ROUTE,
        body: {
            opponent,
            slack: process.env.SLACK,
            token: process.env.API_TOKEN,
        },
        json: true,
    }
    return tweet(options)
}

function tweet(options) {
    return new Promise((resolve, reject) => {
        rp.post(options).then((response) => {
            console.log('Success', response)
            resolve('Success posting tweet')
        }).catch((error) => {
            console.log('Error', error)
            reject(new Error('Error posting tweet'))
        })
    })
}

function getShotDifferenceArray(newShots, oldShots) {
    return Array(newShots).fill(oldShots).map((e, i) => i + 1).filter(x => x > oldShots)
}

function putShotsInDatabase(gameID, shots) {
    const gameIDString = gameID.toString()
    const shotsString = shots.toString()
    const params = {
        TableName: process.env.TABLE_NAME,
        Item: {
            gameID: { S: gameIDString },
            shots: { S: shotsString },
        },
    }

    return new Promise((resolve, reject) => {
        ddb.putItem(params, (err, data) => {
            if (err) {
                reject(err)
            } else {
                resolve(data)
            }
        })
    })
}

function getShots(gameID) {
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: {
            gameID: { S: gameID },
        },
    }

    return new Promise((resolve, reject) => {
        ddb.getItem(params, (err, data) => {
            if (err) {
                console.log('err')
                reject(new Error('Error getting shots'))
            } else {
                console.log(data.Item)
                if (data.Item) {
                    resolve(data.Item.shots.S)
                } else {
                    resolve(null)
                }
            }
        })
    })
}
app.listen(PORT, () => console.log(`Tweet Bot app listening on port ${PORT}!`))
module.exports.handler = serverless(app)
