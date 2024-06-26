// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const path = require("path");
const fs = require("fs");
const AWS = require('../config/aws-config');
const { validationResult } = require("express-validator");
const { DateTime } = require('luxon');

// Import MongoDB models
const { User } = require("../config/schema");

// Importing functions from a custom module
const {
  isDBConnected, // Function to check if the database connection is established
  validateSearchDateFormat
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

var messageCode = require("../common/codes");
app.use("../../uploads", express.static(path.join(__dirname, "uploads")));

/**
 * API to search and fetch Files from AWS-S3 bucket
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getBulkBackupFiles = async (req, res) => {
  var _searchDate = req.body.search;
  const issueType = req.body.category;
  const searchDate = await validateSearchDateFormat(_searchDate);
  if (searchDate == null || searchDate == "string" || (issueType != 1 && issueType != 2)) {
    return res.status(400).send({ status: "FAILED", message: 'Invalid input provided', details: _searchDate });
  }

  // Split the input date string into month, day, and year
  const [month, day, year] = searchDate.split('-');

  // Create a new Date object using the provided values
  const dateObject = new Date(`${year}-${month}-${day}`);

  // Format the date using ISO 8601 format
  const searchDateFormated = dateObject.toISOString();

  const s3 = new AWS.S3();
  const bucketName = process.env.BUCKET_NAME;
  var fileData = [];

  if (issueType == 1) {
    var folderPath = 'bulkbackup/Single Issuance/';
  } else {
    var folderPath = 'bulkbackup/Batch Issuance/';
  }

  try {
    const params = {
      Bucket: bucketName,
      Prefix: folderPath
    };
    // List objects in the specified bucket and path
    const data = await listObjects(params);

    // Filter objects based on search date
    var filesToDownload = await filterObjectsByDate(data.Contents, searchDateFormated);
    if (filesToDownload.length > 0) {
      try {
        for (let i = 0; i < filesToDownload.length; i++) {
          var fileKey = filesToDownload[i];
          const downloadParams = {
            Bucket: bucketName, // Replace with your bucket name
            Key: fileKey,
            Expires: 3600,
          };
          try {
            const url = await s3.getSignedUrlPromise('getObject', downloadParams);
            fileData.push(url);
          } catch (error) {
            console.error(messageCode.msgErrorInUrl, error);
            res.status(400).send({ status: "FAILED", message: messageCode.msgErrorInUrl, details: searchDate });
          }
        }
        res.status(200).send({ status: "SUCCESS", message: messageCode.msgFilesFetchedSuccess, details: fileData });
        return;
      } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).send({ status: "FAILED", message: messageCode.msgErrorInFetching, details: error });
      }
    } else {
      res.status(400).send({ status: "FAILED", message: messageCode.msgNoMatchFoundInDates, details: searchDate });
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Function to list objects in S3 bucket
const listObjects = async (params) => {
  var s3 = new AWS.S3();
  return new Promise((resolve, reject) => {
    s3.listObjectsV2(params, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

// Function to filter objects based on date
const filterObjectsByDate = async (data, inputDate) => {
  const filteredData = [];
  const inputDateTime = await trimDate(inputDate);

  for (const item of data) {
    var lastModifiedDateTime = await trimDate(item.LastModified);
    if (lastModifiedDateTime === inputDateTime) {
      filteredData.push(item.Key);
    }
  }
  return filteredData;
}

const trimDate = async (dateString) => {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
  const day = ('0' + date.getUTCDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

module.exports = {

  // Function to search and fetch Files from AWS-S3 bucket
  getBulkBackupFiles

};
