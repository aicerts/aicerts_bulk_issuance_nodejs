// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const path = require("path");
const QRCode = require("qrcode");
const fs = require("fs");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const keccak256 = require('keccak256');

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../common/cryptoFunction");

// Import MongoDB models
const { User, Issues, BatchIssues } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

// Importing functions from a custom module
const {
  insertBulkSingleIssueData,
  insertBulkBatchIssueData,
  addLinkToPdf, // Function to add a link to a PDF file
  calculateHash, // Function to calculate the hash of a file
  isDBConnected, // Function to check if the database connection is established
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

// Parse environment variables for password length constraints
const min_length = parseInt(process.env.MIN_LENGTH);
const max_length = parseInt(process.env.MAX_LENGTH);

var messageCode = require("../common/codes");


const bulkIssueSingleCertificates = async (_pdfReponse, _excelResponse, excelFilePath) => {

  const pdfResponse = _pdfReponse;
  const excelResponse = _excelResponse;
  var insertPromises = []; // Array to hold all insert promises

  try {
    // Check if the directory exists, if not, create it
    const destDirectory = path.join(__dirname, '../../uploads/completed');
    if (fs.existsSync(destDirectory)) {
      // Delete the existing directory recursively
      fs.rmSync(destDirectory, { recursive: true });
    }
    // Recreate the directory
    fs.mkdirSync(destDirectory, { recursive: true });
    const excelFileName = path.basename(excelFilePath);
    // Destination file path
    const destinationFilePath = path.join(destDirectory, excelFileName);
    // Read the content of the source file
    const fileContent = fs.readFileSync(excelFilePath);
    // Write the content to the destination file
    fs.writeFileSync(destinationFilePath, fileContent);

    try {
      await isDBConnected();
      for (let i = 0; i < pdfResponse.length; i++) {
        const pdfFileName = pdfResponse[i];
        const pdfFilePath = path.join(__dirname, '../../uploads', pdfFileName);

        // Extract Certs from pdfFileName
        const certs = pdfFileName.split('.')[0]; // Remove file extension
        const foundEntry = await excelResponse.find(entry => entry.Certs === certs);
        if (foundEntry) {
          // Do something with foundEntry
          console.log("Found entry for", certs);
        } else {
          console.log("No matching entry found for", certs);
          return ({ code: 400, status: false, message: messageCode.msgNoEntryMatchFound, Details: certs });
        }

        // const getQrStatus = await extractQRCodeDataFromPDF(pdfFilePath);
        var fields = {
          Certificate_Number: foundEntry.certificationID,
          name: foundEntry.name,
          courseName: foundEntry.certificationName,
          Grant_Date: foundEntry.grantDate,
          Expiration_Date: foundEntry.expirationDate,
        };

        var hashedFields = {};
        for (const field in fields) {
          hashedFields[field] = calculateHash(fields[field]);
        }
        var combinedHash = calculateHash(JSON.stringify(hashedFields));

        console.log("Source Cert", pdfFilePath);

        var { txHash, linkUrl } = await issueCertificateWithRetry(fields.Certificate_Number, combinedHash);
        if (!linkUrl || !txHash) {
          return ({ code: 400, status: false, message: messageCode.msgFaileToIssueAfterRetry, Details: certs });
        }

        try {
          await isDBConnected();
          var certificateData = {
            issuerId: process.env.ACCOUNT_ADDRESS,
            transactionHash: txHash,
            certificateHash: combinedHash,
            certificateNumber: fields.Certificate_Number,
            name: fields.name,
            course: fields.courseName,
            grantDate: fields.Grant_Date,
            expirationDate: fields.Expiration_Date
          };
          // await insertCertificateData(certificateData);
          insertPromises.push(insertBulkSingleIssueData(certificateData));

        } catch (error) {
          console.error('Error:', error);
          return ({ code: 400, status: false, message: messageCode.msgDBFailed, Details: error });

        }

        // Generate encrypted URL with certificate data
        const dataWithLink = {
          ...fields, polygonLink: linkUrl
        }
        const urlLink = generateEncryptedUrl(dataWithLink);

        const qrCodeImage = await QRCode.toDataURL(urlLink, {
          errorCorrectionLevel: "H", width: 450, height: 450
        });

        file = pdfFilePath;
        var outputPdf = `${pdfFileName}`;

        // Add link and QR code to the PDF file
        var opdf = await addLinkToPdf(
          path.join("./", file),
          outputPdf,
          linkUrl,
          qrCodeImage,
          combinedHash
        );
        // Read the generated PDF file
        var fileBuffer = fs.readFileSync(outputPdf);

        // Assuming fileBuffer is available after the code you provided

        var outputPath = path.join(__dirname, '../../uploads', 'completed', `${pdfFileName}`);


        // Always delete the source files (if it exists)
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }

        // Always delete the source files (if it exists)
        if (fs.existsSync(outputPdf)) {
          fs.unlinkSync(outputPdf);
        }

        fs.writeFileSync(outputPath, fileBuffer);

        console.log('File saved successfully at:', outputPath);

      }

      // Wait for all insert promises to resolve
      await Promise.all(insertPromises);
      return ({ status: true });

    } catch (error) {
      return ({ code: 500, status: false, message: messageCode.msgDBFailed, Details: error });
    }

  } catch (error) {
    return ({ code: 500, status: false, message: messageCode.msgInternalError, Details: error });
  }
};

const bulkIssueBatchCertificates = async (_pdfReponse, _excelResponse, excelFilePath) => {

  const pdfResponse = _pdfReponse;
  const excelResponse = _excelResponse[0];
  var insertPromises = []; // Array to hold all insert promises

  try {
    // Check if the directory exists, if not, create it
    const destDirectory = path.join(__dirname, '../../uploads/completed');
    if (fs.existsSync(destDirectory)) {
      // Delete the existing directory recursively
      fs.rmSync(destDirectory, { recursive: true });
    }
    // Recreate the directory
    fs.mkdirSync(destDirectory, { recursive: true });
    const excelFileName = path.basename(excelFilePath);
    // Destination file path
    const destinationFilePath = path.join(destDirectory, excelFileName);
    // Read the content of the source file
    const fileContent = fs.readFileSync(excelFilePath);
    // Write the content to the destination file
    fs.writeFileSync(destinationFilePath, fileContent);

    var transformedResponse = _excelResponse[2];
    // return ({ code: 400, status: false, message: messageCode.msgUnderConstruction, Details: `${transformedResponse}, ${pdfResponse}`});

    const hashedBatchData = transformedResponse.map(data => {
      // Convert data to string and calculate hash
      const dataString = data.map(item => item.toString()).join('');
      const _hash = calculateHash(dataString);
      return _hash;
    });
    // Format as arrays with corresponding elements using a loop
    var values = [];
    for (let i = 0; i < excelResponse.length; i++) {
      values.push([hashedBatchData[i]]);
    }
    try {

      // Generate the Merkle tree
      var tree = StandardMerkleTree.of(values, ['string']);
      try {
        var batchNumber = await newContract.getRootLength();
        var allocateBatchId = parseInt(batchNumber) + 1;

        // var { txHash, linkUrl } = await issueBatchCertificateWithRetry(tree.root);
        // if (!linkUrl || !txHash) {
        //   return ({ code: 400, status: false, message: messageCode.msgFaileToIssueAfterRetry });
        // }
        var txHash = "txHash";
        var linkUrl = "linkUrl";

      } catch (error) {
        return ({ code: 400, status: false, message: messageCode.msgFailedAtBlockchain, Details: error });
      }

      if (pdfResponse.length == _excelResponse[1]) {

        for (let i = 0; i < pdfResponse.length; i++) {
          const pdfFileName = pdfResponse[i];
          const pdfFilePath = path.join(__dirname, '../../uploads', pdfFileName);

          // Extract Certs from pdfFileName
          const certs = pdfFileName.split('.')[0]; // Remove file extension
          const foundEntry = await excelResponse.find(entry => entry.Certs === certs);
          if (foundEntry) {
            var index = excelResponse.indexOf(foundEntry);
            var _proof = tree.getProof(index);
            var _proofHash = await keccak256(Buffer.from(_proof)).toString('hex');
            // Do something with foundEntry
            console.log("Found entry for", certs);
            // You can return or process foundEntry here
          } else {
            console.log("No matching entry found for", certs);
            return ({ code: 400, status: false, message: messageCode.msgNoEntryMatchFound, Details: certs });
          }

          var fields = {
            Certificate_Number: foundEntry.certificationID,
            name: foundEntry.name,
            courseName: foundEntry.certificationName,
            Grant_Date: foundEntry.grantDate,
            Expiration_Date: foundEntry.expirationDate,
            polygonLink: linkUrl
          };

          var combinedHash = hashedBatchData[index];

          try {
            await isDBConnected();
            var certificateData = {
              issuerId: process.env.ACCOUNT_ADDRESS,
              batchId: allocateBatchId,
              proofHash: _proof,
              encodedProof: `0x${_proofHash}`,
              transactionHash: txHash,
              certificateHash: combinedHash,
              certificateNumber: fields.Certificate_Number,
              name: fields.name,
              course: fields.courseName,
              grantDate: fields.Grant_Date,
              expirationDate: fields.Expiration_Date
            };
            // await insertCertificateData(certificateData);
            insertPromises.push(insertBulkBatchIssueData(certificateData));

          } catch (error) {
            console.error('Error:', error);
            return ({ code: 400, status: false, message: messageCode.msgDBFailed, Details: error });
          }

          // Generate encrypted URL with certificate data
          var encryptLink = await generateEncryptedUrl(fields);

          const qrCodeImage = await QRCode.toDataURL(encryptLink, {
            errorCorrectionLevel: "H", width: 450, height: 450
          });

          file = pdfFilePath;
          var outputPdf = `${pdfFileName}`;

          // Add link and QR code to the PDF file
          var opdf = await addLinkToPdf(
            path.join("./", file),
            outputPdf,
            linkUrl,
            qrCodeImage,
            combinedHash
          );
          // Read the generated PDF file
          var fileBuffer = fs.readFileSync(outputPdf);

          // Assuming fileBuffer is available after the code you provided

          var outputPath = path.join(__dirname, '../../uploads', 'completed', `${pdfFileName}`);


          // Always delete the source files (if it exists)
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }

          // Always delete the source files (if it exists)
          if (fs.existsSync(outputPdf)) {
            fs.unlinkSync(outputPdf);
          }

          fs.writeFileSync(outputPath, fileBuffer);

          console.log('File saved successfully at:', outputPath);

        }
        // Wait for all insert promises to resolve
        await Promise.all(insertPromises);
        return ({ status: true });
      } else {
        return ({ code: 400, status: false, message: messageCode.msgInputRecordsNotMatched, Details: error });
      }

    } catch (error) {
      return ({ code: 400, status: false, message: messageCode.msgFailedToIssueBulkCerts, Details: error });
    }

  } catch (error) {
    return ({ code: 500, status: false, message: messageCode.msgInternalError, Details: error });
  }

};

const issueCertificateWithRetry = async (certificateNumber, certificateHash, retryCount = 3) => {

  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.issueCertificate(
      certificateNumber,
      certificateHash
    );

    var txHash = tx.hash;

    var linkUrl = `https://${process.env.NETWORK}/tx/${txHash}`;

    return { txHash, linkUrl };

  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueCertificateWithRetry(certificateNumber, certificateHash, retryCount - 1);
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      console.log("Error reason:", error.reason);
      return null;
    } else if (error.reason) {
      // Extract and handle the error reason
      console.log("Error reason:", error.reason);
      return null;
    } else {
      // If there's no specific reason provided, handle the error generally
      console.error(messageCode.msgFailedOpsAtBlockchain, error);
      return null;
    }
  }
};

const issueBatchCertificateWithRetry = async (rootHash, retryCount = 3) => {

  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.issueBatchOfCertificates(
      rootHash
    );

    var txHash = tx.hash;

    var linkUrl = `https://${process.env.NETWORK}/tx/${txHash}`;

    return { txHash, linkUrl };

  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueBatchCertificateWithRetry(rootHash, retryCount - 1);
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      console.log("Error reason:", error.reason);
      return null;
    } else if (error.reason) {
      // Extract and handle the error reason
      console.log("Error reason:", error.reason);
      return null;
    } else {
      // If there's no specific reason provided, handle the error generally
      console.error("Failed to perform operation at Blockchain", error);
      return null;
    }
  }
};

module.exports = {

  // Function to issue bulk Single PDF certificate
  bulkIssueSingleCertificates,

  // Function to issue bulk Batch PDF certificate
  bulkIssueBatchCertificates
};