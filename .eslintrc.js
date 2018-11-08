module.exports = {
    'extends': 'airbnb-base',
    'rules': {
        'semi': ['error', 'never'],
        'indent': ['error', 4],
        'no-use-before-define': ['error', { 'functions': false }],
        'comma-dangle': ['error', {
            arrays: 'always-multiline',
            objects: 'always-multiline',
            imports: 'always-multiline',
            exports: 'always-multiline',
            functions: 'never',
        }],
        'no-console': 'off'
    }
};