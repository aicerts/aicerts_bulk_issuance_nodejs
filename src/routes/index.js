const express = require('express');
const router = express.Router();

let issues = require("./issues");
let verify = require("./verify");
let fetch = require("./fetch");
let health = require("./health");


router.use(issues);
router.use(verify);
router.use(fetch);
router.use(health);

module.exports = router