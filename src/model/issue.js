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
  convertDateFormat,
  insertCertificateData, // Function to insert certificate data into the database
  insertBatchCertificateData,
  insertBulkSingleIssueData,
  insertBulkBatchIssueData,
  addLinkToPdf, // Function to add a link to a PDF file
  verifyPDFDimensions, //Verify the uploading pdf template dimensions
  calculateHash, // Function to calculate the hash of a file
  cleanUploadFolder, // Function to clean up the upload folder
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


const handleIssueCertification = async (email, certificateNumber, name, courseName, _grantDate, _expirationDate) => {
  // Extracting required data from the request body
  const grantDate = await convertDateFormat(_grantDate);
  const expirationDate = await convertDateFormat(_expirationDate);

  try {
    if (grantDate && expirationDate) {
      // check copmare dates are valid
      var compareResult = await compareInputDates(grantDate, expirationDate);
      if (compareResult == 0 || compareResult == 2) {
        return ({ code: 400, status: "FAILED", message: `${messageCode.msgProvideValidDates} : Grant date: ${grantDate}, Expiration date: ${expirationDate}` });
      }
    } else {
      return ({ code: 400, status: "FAILED", message: `${messageCode.msgProvideValidDates} : Grant date: ${_grantDate}, Expiration date: ${_expirationDate}` });
    }

    await isDBConnected();
    // Check if user with provided email exists
    const idExist = await User.findOne({ email });
    // Check if certificate number already exists
    const isNumberExist = await Issues.findOne({ certificateNumber: certificateNumber });
    // Check if certificate number already exists in the Batch
    const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: certificateNumber });

    // Validation checks for request data
    if (
      (!idExist || idExist.status !== 1) || // User does not exist
      // !idExist || // User does not exist
      isNumberExist || // Certificate number already exists 
      isNumberExistInBatch || // Certificate number already exists in Batch
      !certificateNumber || // Missing certificate number
      !name || // Missing name
      !courseName || // Missing course name
      (!grantDate || grantDate == 'Invalid date') || // Missing grant date
      (!expirationDate || expirationDate == 'Invalid date') || // Missing expiration date
      [certificateNumber, name, courseName, grantDate, expirationDate].some(value => typeof value !== 'string' || value == 'string') || // Some values are not strings
      certificateNumber.length > max_length || // Certificate number exceeds maximum length
      certificateNumber.length < min_length // Certificate number is shorter than minimum length
    ) {
      // Prepare error message
      let errorMessage = messageCode.msgPlsEnterValid;

      // Check for specific error conditions and update the error message accordingly
      if (isNumberExist || isNumberExistInBatch) {
        errorMessage = messageCode.msgCertIssued;
      } else if ((!grantDate || grantDate == 'Invalid date') || (!expirationDate || expirationDate == 'Invalid date')) {
        errorMessage = messageCode.msgProvideValidDates;
      } else if (!certificateNumber) {
        errorMessage = messageCode.msgCertIdRequired;
      } else if (certificateNumber.length > max_length) {
        errorMessage = messageCode.msgCertLength;
      } else if (certificateNumber.length < min_length) {
        errorMessage = messageCode.msgCertLength;
      } else if (!idExist) {
        errorMessage = messageCode.msgInvalidIssuer;
      } else if (idExist.status !== 1) {
        errorMessage = messageCode.msgUnauthIssuer;
      }

      // Respond with error message
      return ({ code: 400, status: "FAILED", message: errorMessage });
    } else {
      try {
        // Prepare fields for the certificate
        const fields = {
          Certificate_Number: certificateNumber,
          name: name,
          courseName: courseName,
          Grant_Date: grantDate,
          Expiration_Date: expirationDate,
        };
        // Hash sensitive fields
        const hashedFields = {};
        for (const field in fields) {
          hashedFields[field] = calculateHash(fields[field]);
        }
        const combinedHash = calculateHash(JSON.stringify(hashedFields));

        try {
          // Verify certificate on blockchain
          const isPaused = await newContract.paused();
          // Check if the Issuer wallet address is a valid Ethereum address
          if (!ethers.isAddress(idExist.issuerId)) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidEthereum });
          }
          const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
          const val = await newContract.verifyCertificateById(certificateNumber);

          if (
            val === true ||
            isPaused === true
          ) {
            // Certificate already issued / contract paused
            var messageContent = messageCode.msgCertIssued;
            if (isPaused === true) {
              messageContent = messageCode.msgOpsRestricted;
            } else if (issuerAuthorized === false) {
              messageContent = messageCode.msgIssuerUnauthrized;
            }
            return ({ code: 400, status: "FAILED", message: messageContent });

          } else {
            try {
              // If simulation successful, issue the certificate on blockchain
              const tx = await newContract.issueCertificate(
                certificateNumber,
                combinedHash
              );

              // await tx.wait();
              var txHash = tx.hash;

              // Generate link URL for the certificate on blockchain
              var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

            } catch (error) {
              if (error.reason) {
                // Extract and handle the error reason
                console.log("Error reason:", error.reason);
                return ({ code: 400, status: "FAILED", message: error.reason });
              } else {
                // If there's no specific reason provided, handle the error generally
                console.error(messageCode.msgFailedOpsAtBlockchain, error);
                return ({ code: 400, status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
              }
            }

            // Generate encrypted URL with certificate data
            const dataWithLink = { ...fields, polygonLink: polygonLink }
            const urlLink = generateEncryptedUrl(dataWithLink);

            // Generate QR code based on the URL
            const legacyQR = false;
            let qrCodeData = '';
            if (legacyQR) {
              // Include additional data in QR code
              qrCodeData = `Verify On Blockchain: ${polygonLink},
            Certification Number: ${certificateNumber},
            Name: ${name},
            Certification Name: ${courseName},
            Grant Date: ${grantDate},
            Expiration Date: ${expirationDate}`;

            } else {
              // Directly include the URL in QR code
              qrCodeData = urlLink;
            }

            const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
              errorCorrectionLevel: "H",
              width: 450, // Adjust the width as needed
              height: 450, // Adjust the height as needed
            });


            try {
              // Check mongoose connection
              const dbStatus = await isDBConnected();
              const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
              console.log(dbStatusMessage);

              const issuerId = idExist.issuerId;

              var certificateData = {
                issuerId,
                transactionHash: txHash,
                certificateHash: combinedHash,
                certificateNumber: fields.Certificate_Number,
                name: fields.name,
                course: fields.courseName,
                grantDate: fields.Grant_Date,
                expirationDate: fields.Expiration_Date
              };

              // Insert certificate data into database
              await insertCertificateData(certificateData);

            } catch (error) {
              // Handle mongoose connection error (log it, response an error, etc.)
              console.error(messageCode.msgInternalError, error);
              return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
            }

            // Respond with success message and certificate details
            return ({
              code: 200,
              status: "SUCCESS",
              message: messageCode.msgCertIssuedSuccess,
              qrCodeImage: qrCodeImage,
              polygonLink: polygonLink,
              details: certificateData,
            });
          }

        } catch (error) {
          // Internal server error
          console.error(error);
          return ({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
        }
      } catch (error) {
        // Internal server error
        console.error(error);
        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }
    }
  } catch (error) {
    // Internal server error
    console.error(error);
    return ({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
  }

};

const handleIssuePdfCertification = async (email, certificateNumber, name, courseName, _grantDate, _expirationDate, _pdfPath) => {
  const pdfPath = _pdfPath;
  const grantDate = await convertDateFormat(_grantDate);
  const expirationDate = await convertDateFormat(_expirationDate);

  try {
    // check copmare dates are valid
    if (grantDate && expirationDate) {
      // check copmare dates are valid
      var compareResult = await compareInputDates(grantDate, expirationDate);
      if (compareResult == 0 || compareResult == 2) {
        return ({ code: 400, status: "FAILED", message: `${messageCode.msgProvideValidDates} : Grant date: ${grantDate}, Expiration date: ${expirationDate}` });
      }
    } else {
      return ({ code: 400, status: "FAILED", message: `${messageCode.msgProvideValidDates} : Grant date: ${_grantDate}, Expiration date: ${_expirationDate}` });
    }

    await isDBConnected();
    // Check if user with provided email exists
    const idExist = await User.findOne({ email });
    // Check if certificate number already exists
    const isNumberExist = await Issues.findOne({ certificateNumber: certificateNumber });
    // Check if certificate number already exists in the Batch
    const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: certificateNumber });

    var _result = '';
    const templateData = await verifyPDFDimensions(pdfPath)
      .then(result => {
        // console.log("Verification result:", result);
        _result = result;
      })
      .catch(error => {
        console.error("Error during verification:", error);
      });

    // Validation checks for request data
    if (
      (!idExist || idExist.status !== 1) || // User does not exist
      _result == false ||
      isNumberExist || // Certificate number already exists 
      isNumberExistInBatch || // Certificate number already exists in Batch
      !certificateNumber || // Missing certificate number
      !name || // Missing name
      !courseName || // Missing course name
      !grantDate || // Missing grant date
      !expirationDate || // Missing expiration date
      [certificateNumber, name, courseName, grantDate, expirationDate].some(value => typeof value !== 'string' || value == 'string') || // Some values are not strings
      certificateNumber.length > max_length || // Certificate number exceeds maximum length
      certificateNumber.length < min_length // Certificate number is shorter than minimum length
    ) {
      // res.status(400).json({ message: "Please provide valid details" });
      let errorMessage = messageCode.msgPlsEnterValid;

      // Check for specific error conditions and update the error message accordingly
      if (isNumberExist || isNumberExistInBatch) {
        errorMessage = messageCode.msgCertIssued;
      } else if (!grantDate || !expirationDate) {
        errorMessage = messageCode.msgProvideValidDates;
      } else if (!certificateNumber) {
        errorMessage = messageCode.msgCertIdRequired;
      } else if (certificateNumber.length > max_length) {
        errorMessage = messageCode.msgCertLength;
      } else if (certificateNumber.length < min_length) {
        errorMessage = messageCode.msgCertLength;
      } else if (!idExist) {
        errorMessage = messageCode.msgInvalidIssuer;
      } else if (idExist.status != 1) {
        errorMessage = messageCode.msgUnauthIssuer;
      } else if (_result == false) {
        await cleanUploadFolder();
        errorMessage = messageCode.msgInvalidPdfTemplate;
      }

      // Respond with error message
      return ({ code: 400, status: "FAILED", message: errorMessage });
    } else {
      // If validation passes, proceed with certificate issuance
      const fields = {
        Certificate_Number: certificateNumber,
        name: name,
        courseName: courseName,
        Grant_Date: grantDate,
        Expiration_Date: expirationDate,
      };
      const hashedFields = {};
      for (const field in fields) {
        hashedFields[field] = calculateHash(fields[field]);
      }
      const combinedHash = calculateHash(JSON.stringify(hashedFields));

      try {
        // Verify certificate on blockchain
        const isPaused = await newContract.paused();
        // Check if the Issuer wallet address is a valid Ethereum address
        if (!ethers.isAddress(idExist.issuerId)) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidEthereum });
        }
        const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
        const val = await newContract.verifyCertificateById(certificateNumber);

        if (
          val === true ||
          isPaused === true
        ) {
          // Certificate already issued / contract paused
          var messageContent = messageCode.msgCertIssued;
          if (isPaused === true) {
            messageContent = messageCode.msgOpsRestricted;
          } else if (issuerAuthorized === false) {
            messageContent = messageCode.msgIssuerUnauthrized;
          }
          return ({ code: 400, status: "FAILED", message: messageContent });
        }
        else {

          try {
            // If simulation successful, issue the certificate on blockchain
            const tx = await newContract.issueCertificate(
              fields.Certificate_Number,
              combinedHash
            );

            var txHash = tx.hash;

            // Generate link URL for the certificate on blockchain
            var linkUrl = `https://${process.env.NETWORK}/tx/${txHash}`;

          } catch (error) {
            if (error.reason) {
              // Extract and handle the error reason
              return ({ code: 400, status: "FAILED", message: error.reason });
            } else {
              // If there's no specific reason provided, handle the error generally
              console.error(messageCode.msgFailedOpsAtBlockchain, error);
              return ({ code: 400, status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
            }
          }

          // Generate encrypted URL with certificate data
          const dataWithLink = {
            ...fields, polygonLink: linkUrl
          }
          const urlLink = generateEncryptedUrl(dataWithLink);
          const legacyQR = false;

          let qrCodeData = '';
          if (legacyQR) {
            // Include additional data in QR code
            qrCodeData = `Verify On Blockchain: ${linkUrl},
            Certification Number: ${dataWithLink.Certificate_Number},
            Name: ${dataWithLink.name},
            Certification Name: ${dataWithLink.courseName},
            Grant Date: ${dataWithLink.Grant_Date},
            Expiration Date: ${dataWithLink.Expiration_Date}`;
          } else {
            // Directly include the URL in QR code
            qrCodeData = urlLink;
          }

          const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
            errorCorrectionLevel: "H", width: 450, height: 450
          });

          file = pdfPath;
          const outputPdf = `${fields.Certificate_Number}${name}.pdf`;

          // Add link and QR code to the PDF file
          const opdf = await addLinkToPdf(
            path.join("./", '.', file),
            outputPdf,
            linkUrl,
            qrCodeImage,
            combinedHash
          );

          // Read the generated PDF file
          const fileBuffer = fs.readFileSync(outputPdf);

          try {
            // Check mongoose connection
            const dbStatus = await isDBConnected();
            const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
            console.log(dbStatusMessage);

            // Insert certificate data into database
            const issuerId = idExist.issuerId;
            const certificateData = {
              issuerId,
              transactionHash: txHash,
              certificateHash: combinedHash,
              certificateNumber: fields.Certificate_Number,
              name: fields.name,
              course: fields.courseName,
              grantDate: fields.Grant_Date,
              expirationDate: fields.Expiration_Date
            };
            await insertCertificateData(certificateData);

            // Delete files
            if (fs.existsSync(outputPdf)) {
              // Delete the specified file
              fs.unlinkSync(outputPdf);
            }

            // Always delete the temporary file (if it exists)
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }

            await cleanUploadFolder();

            // Set response headers for PDF download
            return ({ code: 200, file: fileBuffer });

          } catch (error) {
            // Handle mongoose connection error (log it, response an error, etc.)
            console.error("Internal server error", error);
            return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
          }
        }
      } catch (error) {
        // Handle mongoose connection error (log it, response an error, etc.)
        console.error("Internal server error", error);
        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }
    }
  } catch (error) {
    // Handle mongoose connection error (log it, response an error, etc.)
    console.error("Internal server error", error);
    return ({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

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
        if (!linkUrl) {
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

        var { txHash, linkUrl } = await issueBatchCertificateWithRetry(tree.root);
        if (!linkUrl) {
          return ({ code: 400, status: false, message: messageCode.msgFaileToIssueAfterRetry });
        }

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

// Function to parse MM/DD/YYYY date string into a Date object
const parseDate = async (dateString) => {
  const [month, day, year] = dateString.split('/');
  return new Date(`${month}/${day}/${year}`);
};

const compareInputDates = async (_grantDate, _expirationDate) => {
  // Parse the date strings into Date objects
  const grantDate = await parseDate(_grantDate);
  const expirationDate = await parseDate(_expirationDate);

  // Compare the dates
  if (grantDate < expirationDate) {
    return 1;
  } else if (grantDate > expirationDate) {
    return 2;
  } else {
    return 0;
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
  // Function to issue a PDF certificate
  handleIssuePdfCertification,

  // Function to issue a certification
  handleIssueCertification,

  // Function to issue bulk Single PDF certificate
  bulkIssueSingleCertificates,

  // Function to issue bulk Batch PDF certificate
  bulkIssueBatchCertificates
};