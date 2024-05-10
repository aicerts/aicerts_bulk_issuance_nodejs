// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { validationResult } = require("express-validator");
// Import custom cryptoFunction module for encryption and decryption
const { decryptData } = require("../common/cryptoFunction");

const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;

// Import MongoDB models
const { Issues, BatchIssues } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

// Importing functions from a custom module
const {
  convertDateOnVerification,
  convertDateFormat,
  extractQRCodeDataFromPDF, // Function to extract QR code data from a PDF file
  cleanUploadFolder, // Function to clean up the upload folder
  isDBConnected // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

// Retrieve contract address from environment variable
const contractAddress = process.env.CONTRACT_ADDRESS;

// Define an array of providers to use as fallbacks
const providers = [
  new ethers.AlchemyProvider(process.env.RPC_NETWORK, process.env.ALCHEMY_API_KEY),
  new ethers.InfuraProvider(process.env.RPC_NETWORK, process.env.INFURA_API_KEY)
  // Add more providers as needed
];

// Create a new FallbackProvider instance
const fallbackProvider = new ethers.FallbackProvider(providers);

// Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const newContract = new ethers.Contract(contractAddress, abi, signer);

var messageCode = require("../common/codes");

/**
 * Verify Certification page with PDF QR - Blockchain URL.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verify = async (req, res) => {
  // Extracting file path from the request
  file = req.file.path;

  var fileBuffer = fs.readFileSync(file);
  var pdfDoc = await PDFDocument.load(fileBuffer);

  if (pdfDoc.getPageCount() > 1) {
    // Respond with success status and certificate details
    await cleanUploadFolder();
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf});
  }

  try {
    // Extract QR code data from the PDF file
    const certificateData = await extractQRCodeDataFromPDF(file);
    if (certificateData === false) {
      await cleanUploadFolder();
      return res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotValid });
    }

    // Extract blockchain URL from the certificate data
    const blockchainUrl = certificateData["Polygon URL"];

    // Check if a blockchain URL exists and is valid
    if (blockchainUrl && blockchainUrl.length > 0) {
      // Respond with success status and certificate details
      res.status(200).json({ status: "SUCCESS", message: messageCode.msgCertValid, Details: certificateData });
    } else {
      // Respond with failure status if no valid blockchain URL is found
      res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotValid });
    }
  } catch (error) {
    // If an error occurs during verification, respond with failure status
    const verificationResponse = {
      status: "FAILED",
      message: messageCode.msgCertNotValid
    };

    res.status(400).json(verificationResponse);
  }

  // Delete the uploaded file after verification
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }

  // Clean up the upload folder
  await cleanUploadFolder();
};

/**
 * Handles the decoding of a certificate from an encrypted link.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const decodeCertificate = async (req, res) => {
  try {
    // Extract encrypted link from the request body
    const encryptedData = req.body.encryptedData;
    const iv = req.body.iv;

    // Decrypt the link
    const decryptedData = decryptData(encryptedData, iv);

    const originalData = JSON.parse(decryptedData);
    let isValid = false;
    let parsedData;
    if (originalData !== null) {
      parsedData = {
        "Certificate Number": originalData.Certificate_Number || "",
        "Course Name": originalData.courseName || "",
        "Expiration Date": originalData.Expiration_Date || "",
        "Grant Date": originalData.Grant_Date || "",
        "Name": originalData.name || "",
        "Polygon URL": originalData.polygonLink || ""
      };
      isValid = true
    }


    // Respond with the verification status and decrypted data if valid
    if (isValid) {
      res.status(200).json({ status: "PASSED", message: "Verified", data: parsedData });
    } else {
      res.status(200).json({ status: "FAILED", message: "Not Verified" });
    }
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error(error);
    res.status(500).json({ message: messageCode.msgInternalError });
  }
};

/**
 * API call for Single / Batch Certificates verify with Certification ID.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verifyCertificationId = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid ,details: validResult.array() });
  }
  const inputId = req.body.id;
  try {
    var dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);

    const singleIssueExist = await Issues.findOne({ certificateNumber: inputId });
    const batchIssueExist = await BatchIssues.findOne({ certificateNumber: inputId });
    // Blockchain processing.
    const response = await newContract.verifyCertificateById(inputId);

    // Validation checks for request data
    if ([inputId].some(value => typeof value !== "string" || value == "string") || (!batchIssueExist && response === false)) {
      // res.status(400).json({ message: "Please provide valid details" });
      let errorMessage = messageCode.msgPlsEnterValid;

      // Check for specific error conditions and update the error message accordingly
      if (!batchIssueExist && response === false) {
        errorMessage = messageCode.msgCertNotValid;
      }

      // Respond with error message
      return res.status(400).json({ status: "FAILED", message: errorMessage });
    } else {

      if (response == true && singleIssueExist != null) {
        if (singleIssueExist == null) {
          const _verificationResponse = {
            status: "FAILED",
            message: messageCode.msgCertValidNoDetails,
            details: inputId
          };

          return res.status(400).json(_verificationResponse);
        }
        try {
          var _polygonLink = `https://${process.env.NETWORK}/tx/${singleIssueExist.transactionHash}`;

          var completeResponse = {
            'Certificate Number': singleIssueExist.certificateNumber,
            'Course Name': singleIssueExist.course,
            'Expiration Date': await convertDateFormat(singleIssueExist.expirationDate),
            'Grant Date': await convertDateFormat(singleIssueExist.grantDate),
            'Name': singleIssueExist.name,
            'Polygon URL': _polygonLink
          };

          const foundCertification = (singleIssueExist != null) ? completeResponse : inputId;

          const verificationResponse = {
            status: "SUCCESS",
            message: "Certification is valid",
            details: foundCertification
          };
          res.status(200).json(verificationResponse);

        } catch (error) {
          return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
        }

      } else if (batchIssueExist != null) {
        const batchNumber = (batchIssueExist.batchId) - 1;
        const dataHash = batchIssueExist.certificateHash;
        const proof = batchIssueExist.proofHash;

        // Blockchain processing.
        const val = await newContract.verifyCertificateInBatch(batchNumber, dataHash, proof);

        if (val === true) {
          try {

            var _polygonLink = `https://${process.env.NETWORK}/tx/${batchIssueExist.transactionHash}`;

            var completeResponse = {
              'Certificate Number': batchIssueExist.certificateNumber,
              'Course Name': batchIssueExist.course,
              'Expiration Date': await convertDateFormat(batchIssueExist.expirationDate),
              'Grant Date': await convertDateFormat(batchIssueExist.grantDate),
              'Name': batchIssueExist.name,
              'Polygon URL': _polygonLink
            };

            const _verificationResponse = {
              status: "SUCCESS",
              message: "Certification is valid",
              details: completeResponse
            };

            res.status(200).json(_verificationResponse);

          } catch (error) {
            return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
          }
        } else {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotExist });
        }
      }
    }
    } catch (error) {
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};


module.exports = {
  // Function to verify a certificate with a PDF QR code
  verify,
  
  // Function to verify a Single/Batch certification with an ID
  verifyCertificationId,

  // Function to decode a certificate
  decodeCertificate
};
