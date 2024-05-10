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
  convertDateFormat,
  insertBatchCertificateData, // Function to insert Batch certificate data into the database
  dateFormatToStore,
  calculateHash, // Function to calculate the hash of a file
  cleanUploadFolder, // Function to clean up the upload folder
  flushUploadFolder,
  wipeUploadFolder,
  isDBConnected, // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { handleExcelFile, handleBulkExcelFile } = require('../model/handleExcel');
const { handleIssueCertification, handleIssuePdfCertification, bulkIssueSingleCertificates, bulkIssueBatchCertificates } = require('../model/issue');

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
 * API call for Certificate issue with pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issuePdf = async (req, res) => {
  if (!req.file.path) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMustPdf });
  }

  var fileBuffer = fs.readFileSync(req.file.path);
  var pdfDoc = await PDFDocument.load(fileBuffer);

  if (pdfDoc.getPageCount() > 1) {
    // Respond with success status and certificate details
    await cleanUploadFolder();
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf });
  }
  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    var _grantDate = req.body.grantDate;
    var _expirationDate = req.body.expirationDate;


    if (specialCharsRegex.test(certificateNumber)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgNoSpecialCharacters });
    }

    var grantDateFormat = await convertDateFormat(_grantDate);
    var expirationDateFormat = await convertDateFormat(_expirationDate);

    if (!grantDateFormat || !expirationDateFormat) {
      return res.status(400).json({ status: "FAILED", message: `${messageCode.msgInvalidDate}: ${_grantDate}, ${_expirationDate}` });
    }

    const issueResponse = await handleIssuePdfCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate, req.file.path);
    var responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {

      // Set response headers for PDF download
      const certificateName = `${certificateNumber}_certificate.pdf`;
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${certificateName}"`,
      });

      return res.send(issueResponse.file);

    } else {
      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
    }

  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }

};


/**
 * API call for Certificate issue without pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issue = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    var _grantDate = req.body.grantDate;
    var _expirationDate = req.body.expirationDate;

    if (specialCharsRegex.test(name) || specialCharsRegex.test(certificateNumber)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgNoSpecialCharacters });
    }

    var grantDateFormat = await convertDateFormat(_grantDate);
    var expirationDateFormat = await convertDateFormat(_expirationDate);

    if (!grantDateFormat || !expirationDateFormat) {
      return res.status(400).json({ status: "FAILED", message: `${messageCode.msgInvalidDate}: ${_grantDate}, ${_expirationDate}` });
    }

    const issueResponse = await handleIssueCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate);
    var responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {
      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, qrCodeImage: issueResponse.qrCodeImage, polygonLink: issueResponse.polygonLink, details: responseDetails });
    }

    res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Batch Certificates issue.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const batchIssueCertificate = async (req, res) => {

  const email = req.body.email;
  if (!email || email == "string") {
    res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEmail });
    return;
  }
  // Check if the file path matches the pattern
  if (!req.file || req.file.mimetype != fileType || !req.file.originalname.endsWith('.xlsx')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustExcel;
    await cleanUploadFolder();
    res.status(400).json({ status: "FAILED", message: errorMessage });
    return;
  }

  try {
    await isDBConnected();
    const idExist = await User.findOne({ email });
    if (!idExist) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuer });
      return;
    }
    var filePath = req.file.path;

    // Fetch the records from the Excel file
    const excelData = await handleExcelFile(filePath);
    await _fs.remove(filePath);

    try {

      if (
        (!idExist || idExist.status !== 1) || // User does not exist
        // !idExist || 
        !req.file ||
        !req.file.filename ||
        req.file.filename === 'undefined' ||
        excelData.response === false) {

        let errorMessage = messageCode.msgPlsEnterValid;
        var _details = excelData.Details;
        if (!idExist) {
          errorMessage = messageCode.msgInvalidIssuer;
          var _details = idExist.email;
        }
        else if (excelData.response == false) {
          errorMessage = excelData.message;
        } else if (idExist.status !== 1) {
          errorMessage = messageCode.msgUnauthIssuer;
        }

        res.status(400).json({ status: "FAILED", message: errorMessage, details: _details });
        return;

      } else {


        // Batch Certification Formated Details
        const rawBatchData = excelData.message[0];
        // Certification count
        const certificatesCount = excelData.message[1];
        // certification unformated details
        const batchData = excelData.message[2];

        const certificationIDs = rawBatchData.map(item => item.certificationID);
        console.log("Data", rawBatchData, certificatesCount, batchData);
        // Assuming BatchIssues is your MongoDB model
        for (const id of certificationIDs) {
          const issueExist = await Issues.findOne({ certificateNumber: id });
          const _issueExist = await BatchIssues.findOne({ certificateNumber: id });
          if (issueExist || _issueExist) {
            matchingIDs.push(id);
          }
        }

        const hashedBatchData = batchData.map(data => {
          // Convert data to string and calculate hash
          const dataString = data.map(item => item.toString()).join('');
          const _hash = calculateHash(dataString);
          return _hash;
        });

        // Format as arrays with corresponding elements using a loop
        const values = [];
        for (let i = 0; i < certificatesCount; i++) {
          values.push([hashedBatchData[i]]);
        }

        try {
          // Verify on blockchain
          const isPaused = await newContract.paused();
          // Check if the Issuer wallet address is a valid Ethereum address
          if (!ethers.isAddress(idExist.issuerId)) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
          }
          const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);

          if (isPaused === false) {
            // Certificate contract paused
            var messageContent = messageCode.msgOpsRestricted;

            if (issuerAuthorized === flase) {
              messageContent = messageCode.msgIssuerUnauthrized;
            }

            return res.status(400).json({ status: "FAILED", message: messageContent });
          }

          // Generate the Merkle tree
          const tree = StandardMerkleTree.of(values, ['string']);

          const batchNumber = await newContract.getRootLength();
          const allocateBatchId = parseInt(batchNumber) + 1;
          // const allocateBatchId = 1;

          try {
            // Issue Batch Certifications on Blockchain
            const tx = await newContract.issueBatchOfCertificates(
              tree.root
            );

            var txHash = tx.hash;

            var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

          } catch (error) {
            if (error.reason) {
              // Extract and handle the error reason
              console.log("Error reason:", error.reason);
              return res.status(400).json({ status: "FAILED", message: error.reason });
            } else {
              // If there's no specific reason provided, handle the error generally
              console.error(messageCode.msgFailedOpsAtBlockchain, error);
              return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain });
            }
          }

          try {
            // Check mongoose connection
            const dbStatus = await isDBConnected();
            const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
            console.log(dbStatusMessage);

            var batchDetails = [];
            var batchDetailsWithQR = [];
            var insertPromises = []; // Array to hold all insert promises

            for (var i = 0; i < certificatesCount; i++) {
              var _proof = tree.getProof(i);
              let _proofHash = await keccak256(Buffer.from(_proof)).toString('hex');
              let _grantDate = await convertDateFormat(rawBatchData[i].grantDate);
              let _expirationDate = await convertDateFormat(rawBatchData[i].expirationDate);
              batchDetails[i] = {
                issuerId: idExist.issuerId,
                batchId: allocateBatchId,
                proofHash: _proof,
                encodedProof: _proofHash,
                transactionHash: txHash,
                certificateHash: hashedBatchData[i],
                certificateNumber: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                course: rawBatchData[i].certificationName,
                grantDate: _grantDate,
                expirationDate: _expirationDate
              }

              let _fields = {
                Certificate_Number: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                courseName: rawBatchData[i].certificationName,
                Grant_Date: _grantDate,
                Expiration_Date: _expirationDate,
                polygonLink
              }

              let encryptLink = await generateEncryptedUrl(_fields);

              let qrCodeImage = await QRCode.toDataURL(encryptLink, {
                errorCorrectionLevel: "H",
                width: 450, // Adjust the width as needed
                height: 450, // Adjust the height as needed
              });

              batchDetailsWithQR[i] = {
                issuerId: idExist.issuerId,
                batchId: allocateBatchId,
                transactionHash: txHash,
                certificateHash: hashedBatchData[i],
                certificateNumber: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                course: rawBatchData[i].certificationName,
                grantDate: _grantDate,
                expirationDate: _expirationDate,
                qrImage: qrCodeImage
              }

              // console.log("Batch Certificate Details", batchDetailsWithQR[i]);
              // await insertBatchCertificateData(batchDetails[i]);
              insertPromises.push(insertBatchCertificateData(batchDetails[i]));
            }
            // Wait for all insert promises to resolve
            await Promise.all(insertPromises);
            var newCount = certificatesCount;
            var oldCount = idExist.certificatesIssued;
            idExist.certificatesIssued = newCount + oldCount;
            await idExist.save();

            res.status(200).json({
              status: "SUCCESS",
              message: messageCode.msgBatchIssuedSuccess,
              polygonLink: polygonLink,
              details: batchDetailsWithQR,
            });

            await cleanUploadFolder();

          } catch (error) {
            // Handle mongoose connection error (log it, response an error, etc.)
            console.error(messageCode.msgInternalError, error);
            return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
          }

        } catch (error) {
          console.error('Error:', error);
          return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidExcel, details: error });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

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
    if(zipFileSize <= 100){
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles});
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

    if (filesList.length == 0) {
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

    if(xlsxFiles.length == 0){
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

    if(pdfFiles.length == 0){
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      await cleanUploadFolder();
      return;
    }

    const excelFilePath = path.join('./uploads', xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    const excelData = await handleBulkExcelFile(excelFilePath);
    // await _fs.remove(filePath);

    if(excelData.response == false){
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

    if((pdfFiles.length != matchedCerts.length) || (matchedCerts.length != excelData.message[1])){
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputRecordsNotMatched});
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var bulkIssueResponse = await bulkIssueSingleCertificates(pdfFiles, excelDataResponse, excelFilePath);

    if(bulkIssueResponse.status == false){
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
      output.on('close', () => {
          console.log(archive.pointer() + ' total bytes');
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

      const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 1);
      if(fileBackup.response == false){
        console.log("The S3 backup failed", fileBackup.details);
      }

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
    res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error});
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
    if(zipFileSize <= 100){
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
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err});
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });

    filesList = await fs.promises.readdir(extractionPath);

    if (filesList.length == 0) {
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

    if(xlsxFiles.length == 0){
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

    if(pdfFiles.length == 0){
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

    if(excelData.response == false){
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

    if((pdfFiles.length != matchedCerts.length) || (matchedCerts.length != excelData.message[1])){
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputRecordsNotMatched});
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var bulkIssueResponse = await bulkIssueBatchCertificates(pdfFiles, excelData.message, excelFilePath);

    if(bulkIssueResponse.status == false){
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
      const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 2);
      if(fileBackup.response == false){
        console.log("The S3 backup failed", fileBackup.details);
      }

      // Listen for close event of the archive
      output.on('close', () => {
          console.log(archive.pointer() + ' total bytes');
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
    res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error});
    return;
  }
}

/**
 * API call for Certificate issue without pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const authIssue = async (req, res) => {
  const token = req.headers.authorization;
  try {
    // Check if the token is provided in the request header
    if (!token) {
      return res.status(401).json({ status: "FAILED", message: messageCode.msgAuthMissing });
    }

    if (decodeKey == 0) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidKey });
    }

    if (token != decodeKey) {
      return res.status(403).json({ status: "FAILED", message: messageCode.msgInvalidToken });
    }

  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }

  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    var _grantDate = req.body.grantDate;
    var _expirationDate = req.body.expirationDate;

    if (specialCharsRegex.test(name) || specialCharsRegex.test(certificateNumber)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgNoSpecialCharacters });
    }

    var grantDateFormat = await convertDateFormat(_grantDate);
    var expirationDateFormat = await convertDateFormat(_expirationDate);

    if (!grantDateFormat || !expirationDateFormat) {
      return res.status(400).json({ status: "FAILED", message: `${messageCode.msgInvalidDate}: ${_grantDate}, ${_expirationDate}` });
    }

    const issueResponse = await handleIssueCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate);
    var responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {
      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, qrCodeImage: issueResponse.qrCodeImage, polygonLink: issueResponse.polygonLink, details: responseDetails });
    }

    res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

const backupFileToCloud = async(file, filePath, type) => {

  const bucketName = process.env.BUCKET_NAME;
  if(type == 1){
    var keyPrefix = 'bulkbackup/Single Issuance/'; // Specify desired prefix here
  } else if(type == 2) {
    var keyPrefix = 'bulkbackup/Batch Issuance/';
  } else {
    var keyPrefix = 'bulkbackup/';
  }
  const keyName = keyPrefix + file;

  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(filePath);

  // const stats = await fs.promises.stat(filePath);
  console.log("testing", filePath);

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
  // Function to issue a PDF certificate
  issuePdf,

  // Function to issue a certification
  issue,

  // Function to issue a Batch of certifications
  batchIssueCertificate,

  bulkSingleIssueCertificates,

  bulkBatchIssueCertificates,

  // Function to issue a certification with Authorization Token
  authIssue

};
