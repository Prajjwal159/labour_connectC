const fs = require("fs");

let content = fs.readFileSync("app.js", "utf8");

content = content.replace(
    /require\("dotenv"\)\.config\(\);\nconst express = require\("express"\);\nconst path = require\("path"\);\nconst bodyParser = require\("body-parser"\);\nconst session = require\("express-session"\);\nconst MongoStore = require\("connect-mongo"\);\nconst crypto = require\("crypto"\);/,
    `require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const admin = require("./config/firebaseAdmin");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const connectMongoDB = require("./config/mongodb");
connectMongoDB();
const translations = require("./locales/translations");
const os = require("os");
const crypto = require("crypto");`
);

fs.writeFileSync("app.js", content);
console.log("Imports fixed safely.");
