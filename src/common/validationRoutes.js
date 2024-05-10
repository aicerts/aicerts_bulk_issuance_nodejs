
const { body } = require('express-validator');
const messageCode = require("./codes");

const specialCharsRegex = /[!@#$%^&*(),.?":{}|<>]/; // Regular expression for special characters


const validationRoutes = {
    issuePdf: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).not().matches(specialCharsRegex).withMessage(messageCode.msgNoSpecialCharacters).isLength({ min: 12, max: 20 }).withMessage(messageCode.msgCertLength),
        body(["name", "course"]).notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 40 }).withMessage(messageCode.msgMaxLength),
        body(["grantDate, expirationDate"]).notEmpty().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    issue: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).not().matches(specialCharsRegex).withMessage(messageCode.msgNoSpecialCharacters).isLength({ min: 12, max: 20 }).withMessage(messageCode.msgCertLength),
        body("name").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 40 }).withMessage(messageCode.msgMaxLength),
        body("course").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 150 }).withMessage(messageCode.msgMaxLengthCourse),
        body(["grantDate, expirationDate"]).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    authIssue: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).not().matches(specialCharsRegex).withMessage(messageCode.msgNoSpecialCharacters).isLength({ min: 12, max: 20 }).withMessage(messageCode.msgCertLength),
        body("name").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 40 }).withMessage(messageCode.msgMaxLength),
        body("course").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 150 }).withMessage(messageCode.msgMaxLengthCourse),
        body(["grantDate, expirationDate"]).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    signUp: [
        body(["name"]).notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 30 }).withMessage(messageCode.msgMaxLength),
        body(["password"]).notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    login: [
        body("password").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    emailCheck: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    resetPassword: [
        body("password").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)  
    ],
    checkId: [
        body("id").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 20 }).withMessage(messageCode.msgCertLength)
    ],
    validateIssuer: [
        body("status").notEmpty().trim().isNumeric().withMessage(messageCode.msgNonEmpty).isIn([1, 2]).withMessage(messageCode.msgProvideValidStatus),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail)  
    ],
    checkAddress: [
        body("address").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength(42).withMessage(messageCode.msgInvalidEthereum)
    ]
  };
  
  module.exports = validationRoutes;