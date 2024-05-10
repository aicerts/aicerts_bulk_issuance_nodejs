const express = require('express');
const router = express.Router();

let issues = require("./issues");
let admin = require("./admin");
let verify = require("./verify");
let fetch = require("./fetch");
let blockchain = require("./blockchain");
let health = require("./health");


router.use(issues);
router.use(admin);
router.use(verify);
router.use(fetch);
router.use(blockchain);
router.use(health);

module.exports = router