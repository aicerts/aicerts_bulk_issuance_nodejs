// aws-config.js

const AWS = require('aws-sdk');
require('dotenv').config();
try{
  // Check if required environment variables are set
  if (!process.env.ACCESS_KEY_ID || !process.env.SECRET_ACCESS_KEY || !process.env.REGION) {
    throw new Error("One or more required environment variables are missing.");
  }

  // Configure AWS SDK
  AWS.config.update({
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION
  });
} catch(error){
    console.error("Error in aws-config:", error.message);
    process.exit(1); // Exit the process with a non-zero status code to indicate failure
}

module.exports = AWS;

