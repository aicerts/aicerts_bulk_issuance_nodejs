// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const QRCode = require("qrcode");
const path = require("path"); // Module for working with file paths
const fs = require("fs");
const _fs = require("fs-extra");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const keccak256 = require('keccak256');
const { validationResult } = require("express-validator");
const archiver = require('archiver');
const unzipper = require('unzipper');

const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../common/cryptoFunction");

const AWS = require('../config/aws-config');

// Import MongoDB models
const { User, Issues, BatchIssues } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

const specialCharsRegex = /[!@#$%^&*(),.?":{}|<>]/; // Regular expression for special characters

const extractionPath = './uploads';
app.use("../../uploads", express.static(path.join(__dirname, "uploads")));

// Importing functions from a custom module
const {
  cleanUploadFolder, // Function to clean up the upload folder
  flushUploadFolder,
  wipeUploadFolder,
  isDBConnected, // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { handleBulkExcelFile } = require('../model/handleExcel');
const { bulkIssueSingleCertificates, bulkIssueBatchCertificates } = require('../model/issue');
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

// const currentDir = __dirname;
// const parentDir = path.dirname(path.dirname(currentDir));
const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; // File type

const decodeKey = process.env.AUTH_KEY || 0;

/**
 * API call for Bulk Certificate issue (single) with pdf templates.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const bulkSingleIssueCertificates = async (req, res) => {
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ status: "FAILED", message: errorMessage });
    await cleanUploadFolder();
    return;
  }

  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];

  var today = new Date();
  var options = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: 'America/New_York' // Set the timezone to US Eastern Time
  };

  var formattedDateTime = today.toLocaleString('en-US', options).replace(/\//g, '-').replace(/,/g, '-').replace(/:/g, '-').replace(/\s/g, '');

  const resultDierectory = path.join(__dirname, '../../uploads/completed');

  try {
    await isDBConnected();

    var filePath = req.file.path;

    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);

    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: extractionPath }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });

    filesList = await fs.promises.readdir(extractionPath);

    if (filesList.length == 0 || filesList.length == 1) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindExcelFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      await cleanUploadFolder();
      return;
    }

    const excelFilePath = path.join('./uploads', xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    const excelData = await handleBulkExcelFile(excelFilePath);
    // await _fs.remove(filePath);

    if (excelData.response == false) {
      var errorDetails = (excelData.Details).length > 0 ? excelData.Details : "";
      res.status(400).json({ status: "FAILED", message: excelData.message, details: errorDetails });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.Certs + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedCerts = pdfFiles.filter(cert => certsWithPDF.includes(cert));

    if ((pdfFiles.length != matchedCerts.length) || (matchedCerts.length != excelData.message[1])) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var bulkIssueResponse = await bulkIssueSingleCertificates(pdfFiles, excelDataResponse, excelFilePath);

    if (bulkIssueResponse.status == false) {
      var statusCode = bulkIssueResponse.code || 400;
      var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
      var statusDetails = bulkIssueResponse.Details || "";
      res.status(statusCode).json({ status: "FAILED", message: statusMessage, details: statusDetails });
      await wipeUploadFolder();
      // await flushUploadFolder();
      return;
    } else {
      const zipFileName = `${formattedDateTime}.zip`;
      const resultFilePath = path.join(__dirname, '../../uploads/completed', zipFileName);

      // Check if the directory exists, if not, create it
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Create a new zip archive
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level
      });

      // Create a write stream for the zip file
      const output = fs.createWriteStream(resultFilePath);
      var fetchResultZipFile = path.basename(resultFilePath);

      // Listen for close event of the archive
      output.on('close', async () => {
        console.log(archive.pointer() + ' total bytes');
        const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 1);
        if (fileBackup.response == false) {
          console.log("The S3 backup failed", fileBackup.details);
        }
        console.log('Zip file created successfully');
        // Send the zip file as a download
        res.download(resultFilePath, zipFileName, (err) => {
          if (err) {
            console.error('Error downloading zip file:', err);
          }
          // Delete the zip file after download
          // fs.unlinkSync(resultFilePath);
          fs.unlink(resultFilePath, (err) => {
            if (err) {
              console.error('Error deleting zip file:', err);
            }
            console.log('Zip file deleted');
          });
        });
      });

      // Pipe the output stream to the zip archive
      archive.pipe(output);
      var excelFileName = path.basename(excelFilePath);
      // Append the file to the list
      pdfFiles.push(excelFileName);
      // Add PDF & Excel files to the zip archive
      pdfFiles.forEach(file => {
        const filePath = path.join(__dirname, '../../uploads/completed', file);
        archive.file(filePath, { name: file });
      });

      // Finalize the zip archive
      archive.finalize();

      // Always delete the excel files (if it exists)
      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
      }

      await flushUploadFolder();
      return;
    }
    // return res.status(200).json({ status: "SUCCESS", message: messageCode.msgAbleToFindFiles });

  } catch (error) {
    res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
    return;
  }
}

/**
 * API call for Bulk Certificate issue (batch) with pdf templates.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */

const bulkBatchIssueCertificates = async (req, res) => {
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ status: "FAILED", message: errorMessage });
    await cleanUploadFolder();
    return;
  }

  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];

  var today = new Date();
  var options = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: 'America/New_York' // Set the timezone to US Eastern Time
  };

  var formattedDateTime = today.toLocaleString('en-US', options).replace(/\//g, '-').replace(/,/g, '-').replace(/:/g, '-').replace(/\s/g, '');

  const resultDierectory = path.join(__dirname, '../../uploads/completed');

  try {
    await isDBConnected();

    var filePath = req.file.path;

    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);

    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: extractionPath }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });
    filesList = await fs.promises.readdir(extractionPath);

    if (filesList.length == 0 || filesList.length == 1) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindExcelFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    const excelFilePath = path.join('./uploads', xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    const excelData = await handleBulkExcelFile(excelFilePath);
    // await _fs.remove(filePath);

    if (excelData.response == false) {
      var errorDetails = (excelData.Details).length > 0 ? excelData.Details : "";
      res.status(400).json({ status: "FAILED", message: excelData.message, details: errorDetails });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.Certs + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedCerts = pdfFiles.filter(cert => certsWithPDF.includes(cert));

    if ((pdfFiles.length != matchedCerts.length) || (matchedCerts.length != excelData.message[1])) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var bulkIssueResponse = await bulkIssueBatchCertificates(pdfFiles, excelData.message, excelFilePath);

    if (bulkIssueResponse.status == false) {
      var statusCode = bulkIssueResponse.code || 400;
      var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
      var statusDetails = bulkIssueResponse.Details || "";
      res.status(statusCode).json({ status: "FAILED", message: statusMessage, details: statusDetails });
      await wipeUploadFolder();
      // await flushUploadFolder();
      return;
    } else {
      const zipFileName = `${formattedDateTime}.zip`;
      const resultFilePath = path.join(__dirname, '../../uploads/completed', zipFileName);

      // Check if the directory exists, if not, create it
      const uploadDir = path.join(__dirname, './uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Create a new zip archive
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level
      });

      // Create a write stream for the zip file
      const output = fs.createWriteStream(resultFilePath);
      var fetchResultZipFile = path.basename(resultFilePath);

      // Listen for close event of the archive
      output.on('close', async () => {
        console.log(archive.pointer() + ' total bytes');
        const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 2);
        if (fileBackup.response == false) {
          console.log("The S3 backup failed", fileBackup.details);
        }
        console.log('Zip file created successfully');
        // Send the zip file as a download
        res.download(resultFilePath, zipFileName, (err) => {
          if (err) {
            console.error('Error downloading zip file:', err);
          }
          // Delete the zip file after download
          // fs.unlinkSync(resultFilePath);
          fs.unlink(resultFilePath, (err) => {
            if (err) {
              console.error('Error deleting zip file:', err);
            }
            console.log('Zip file deleted');
          });
        });
      });

      // Pipe the output stream to the zip archive
      archive.pipe(output);
      var excelFileName = path.basename(excelFilePath);
      // Append the file to the list
      pdfFiles.push(excelFileName);

      // Add PDF files to the zip archive
      pdfFiles.forEach(file => {
        const filePath = path.join(__dirname, '../../uploads/completed', file);
        archive.file(filePath, { name: file });
      });

      // Finalize the zip archive
      archive.finalize();


      // Always delete the excel files (if it exists)
      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
      }

      await flushUploadFolder();
      return;
    }

  } catch (error) {
    res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
    return;
  }
};

const _bulkBatchIssueCertificates = async (req, res) => {
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ status: "FAILED", message: errorMessage });
    await cleanUploadFolder();
    return;
  }

  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];

  var today = new Date();
  var options = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: 'America/New_York' // Set the timezone to US Eastern Time
  };

  var formattedDateTime = today.toLocaleString('en-US', options).replace(/\//g, '-').replace(/,/g, '-').replace(/:/g, '-').replace(/\s/g, '');

  const resultDierectory = path.join(__dirname, '../../uploads/completed');

  try {
    await isDBConnected();

    var filePath = req.file.path;

    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);

    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: extractionPath }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });
    filesList = await fs.promises.readdir(extractionPath);

    if (filesList.length == 0 || filesList.length == 1) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindExcelFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    const excelFilePath = path.join('./uploads', xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    const excelData = await handleBulkExcelFile(excelFilePath);
    // await _fs.remove(filePath);

    if (excelData.response == false) {
      var errorDetails = (excelData.Details).length > 0 ? excelData.Details : "";
      res.status(400).json({ status: "FAILED", message: excelData.message, details: errorDetails });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.Certs + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedCerts = pdfFiles.filter(cert => certsWithPDF.includes(cert));

    if ((pdfFiles.length != matchedCerts.length) || (matchedCerts.length != excelData.message[1])) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var bulkIssueResponse = await bulkIssueBatchCertificates(pdfFiles, excelData.message, excelFilePath);

    if (bulkIssueResponse.status == false) {
      var statusCode = bulkIssueResponse.code || 400;
      var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
      var statusDetails = bulkIssueResponse.Details || "";
      res.status(statusCode).json({ status: "FAILED", message: statusMessage, details: statusDetails });
      await wipeUploadFolder();
      // await flushUploadFolder();
      return;
    } else {
      const zipFileName = `${formattedDateTime}.zip`;
      const resultFilePath = path.join(__dirname, '../../uploads/completed', zipFileName);

      // Check if the directory exists, if not, create it
      // const uploadDir = path.join(__dirname, './uploads');
      // if (!fs.existsSync(uploadDir)) {
      //   fs.mkdirSync(uploadDir, { recursive: true });
      // }

      // Create a new zip archive
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level
      });

      // Create a write stream for the zip file
      const output = fs.createWriteStream(resultFilePath);
      var fetchResultZipFile = path.basename(resultFilePath);

      // Listen for close event of the archive
      output.on('close', async () => {
        console.log(archive.pointer() + ' total bytes');
        
        const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 2);
        if (fileBackup.response == false) {
          console.log("The S3 backup failed", fileBackup.details);
        }
        console.log('Zip file created successfully');
        // Send the zip file as a download

        const zipBuffer = fs.readFileSync(resultFilePath);
        console.log("The zip buffer", resultFilePath);


        // Set response headers for ZIP download
        res.set({
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipFileName}"`,
        });

        res.send(zipBuffer);

      });

      // Pipe the output stream to the zip archive
      archive.pipe(output);
      var excelFileName = path.basename(excelFilePath);
      // Append the file to the list
      pdfFiles.push(excelFileName);

      // Add PDF files to the zip archive
      pdfFiles.forEach(file => {
        const filePath = path.join(__dirname, '../../uploads/completed', file);
        archive.file(filePath, { name: file });
      });

      // Finalize the zip archive
      archive.finalize();

      // Always delete the excel files (if it exists)
      if (fs.existsSync(zipFileName)) {
        fs.unlinkSync(zipFileName);
      }

      // Always delete the excel files (if it exists)
      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
      }

      await flushUploadFolder();
      return;
    }

  } catch (error) {
    res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
    return;
  }
};


const backupFileToCloud = async (file, filePath, type) => {

  const bucketName = process.env.BUCKET_NAME;
  if (type == 1) {
    var keyPrefix = 'bulkbackup/Single Issuance/'; // Specify desired prefix here
  } else if (type == 2) {
    var keyPrefix = 'bulkbackup/Batch Issuance/';
  } else {
    var keyPrefix = 'bulkbackup/';
  }
  const keyName = keyPrefix + file;

  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(filePath);

  const uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    console.log('File uploaded successfully to', data.Location);
    return ({ response: true, status: "SUCCESS", message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error uploading file:', error);
    return ({ response: false, status: "FAILED", message: 'An error occurred while uploading the file', details: error });
  }
};

module.exports = {

  bulkSingleIssueCertificates,

  bulkBatchIssueCertificates,

};
