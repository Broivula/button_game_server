
module.exports = { 
    "extends": "airbnb-base", 
    "env": {
        "commonjs": true,
        "node": true,
        "mocha": true
    },
    plugins: [
        'jsdoc',
    ],
    rules: {
        "jsdoc/check-alignment": 2, // Recommended
        "jsdoc/check-examples": 2,
        "jsdoc/check-indentation": 2,
        "jsdoc/check-param-names": 2, // Recommended
        "jsdoc/check-syntax": 2,
        "jsdoc/check-tag-names": 2, // Recommended
        "jsdoc/check-types": 2, // Recommended
        "jsdoc/implements-on-classes": 2, // Recommended
        "jsdoc/match-description": 2,
        "jsdoc/newline-after-description": 2, // Recommended
        "jsdoc/no-types": 0,
        "jsdoc/no-undefined-types": 2, // Recommended
        "jsdoc/require-description": 2,
        "jsdoc/require-description-complete-sentence": 2,
        "jsdoc/require-example": 0,
        "jsdoc/require-hyphen-before-param-description": 2,
        "jsdoc/require-jsdoc": 2, // Recommended
        "jsdoc/require-param": 2, // Recommended
        "jsdoc/require-param-description": 2, // Recommended
        "jsdoc/require-param-name": 2, // Recommended
        "jsdoc/require-param-type": 2, // Recommended
        "jsdoc/require-returns": 2, // Recommended
        "jsdoc/require-returns-check": 2, // Recommended
        "jsdoc/require-returns-description": 2, // Recommended
        "jsdoc/require-returns-type": 2, // Recommended
        "jsdoc/valid-types": 2 // Recommended
    }
};
