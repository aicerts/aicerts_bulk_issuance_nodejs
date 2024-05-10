// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const crypto = require('crypto'); // Module for cryptographic functions
const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;
const fs = require("fs"); // File system module
const path = require("path"); // Module for working with file paths
const { fromPath } = require("pdf2pic"); // Converter from PDF to images
const { PNG } = require("pngjs"); // PNG image manipulation library
const jsQR = require("jsqr"); // JavaScript QR code reader
const ethers = require("ethers"); // Ethereum JavaScript library
const mongoose = require("mongoose"); // MongoDB object modeling tool
const nodemailer = require('nodemailer'); // Module for sending emails
const moment = require('moment');

const { decryptData } = require("../common/cryptoFunction"); // Custom functions for cryptographic operations

const retryDelay = parseInt(process.env.TIME_DELAY);
const maxRetries = 3; // Maximum number of retries

// Create a nodemailer transporter using the provided configuration
const transporter = nodemailer.createTransport({
  // Specify the email service provider (e.g., Gmail, Outlook)
  service: process.env.MAIL_SERVICE,
  // Specify the email server host (e.g., smtp.gmail.com)
  host: process.env.MAIL_HOST,
  // Specify the port number for SMTP (587 for most services)
  port: 587,
  // Specify whether to use TLS (Transport Layer Security)
  secure: false,
  // Provide authentication details for the email account
  auth: {
    // Specify the email address used for authentication
    user: process.env.USER_NAME, // replace with your Gmail email
    // Specify the password associated with the email address
    pass: process.env.MAIL_PWD,  // replace with your Gmail password
  },
});


// Define nodemailer mail options for sending emails
const mailOptions = {
  // Specify the sender's information
  from: {
    // Name of the sender
    name: 'AICerts Admin',
    // Sender's email address (obtained from environment variable)
    address: process.env.USER_MAIL,
  },
  // Specify the recipient's email address (to be filled dynamically)
  to: '', // replace with recipient's email address
  // Subject line of the email
  subject: 'AICerts Admin Notification',
  // Plain text content of the email body (to be filled dynamically)
  text: '', // replace with text content of the email body
};


// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

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

// Create a new ethers wallet instance using the private key from environment variable and the provider
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract ABI and wallet)
const sim_contract = new ethers.Contract(contractAddress, abi, signer);

// Import the Issues models from the schema defined in "../config/schema"
const { User, Issues, BatchIssues } = require("../config/schema");

//Connect to polygon
const connectToPolygon = async () => {
  try {
    const provider = new ethers.FallbackProvider(providers);
    await provider.getNetwork(); // Attempt to detect the network
    return provider;

  } catch (error) {
    console.error('Failed to connect to Polygon node:', error.message);
    console.log(`Retrying connection in ${retryDelay / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait before retrying
    return connectToPolygon(providers); // Retry connecting recursively
  }
};

// Function to convert the Date format
const validateSearchDateFormat = async (dateString) => {
  if (dateString.length < 11) {
    let month, day, year;
    if (dateString.includes('-')) {
      [month, day, year] = dateString.split('-');
    } else {
      // If the dateString does not contain '-', extract month, day, and year using substring
      month = dateString.substring(0, 2);
      day = dateString.substring(3, 5);
      year = dateString.substring(6);
    }

    // Convert month and day to integers and pad with leading zeros if necessary
    month = parseInt(month, 10).toString().padStart(2, '0');
    day = parseInt(day, 10).toString().padStart(2, '0');

    let formatDate = `${month}-${day}-${year}`;
    const numericMonth = parseInt(month, 10);
    const numericDay = parseInt(day, 10);
    const numericYear = parseInt(year, 10);
    // Check if month, day, and year are within valid ranges
    if (numericMonth > 0 && numericMonth <= 12 && numericDay > 0 && numericDay <= 31 && numericYear >= 1900 && numericYear <= 9999) {
      if ((numericMonth == 1 || numericMonth == 3 || numericMonth == 5 || numericMonth == 7 ||
        numericMonth == 8 || numericMonth == 10 || numericMonth == 12) && numericDay <= 31) {
        return formatDate;
      } else if ((numericMonth == 4 || numericMonth == 6 || numericMonth == 9 || numericMonth == 11) && numericDay <= 30) {
        return formatDate;
      } else if (numericMonth == 2 && numericDay <= 29) {
        if (numericYear % 4 == 0 && numericDay <= 29) {
          // Leap year: February has 29 days
          return formatDate;
        } else if (numericYear % 4 != 0 && numericDay <= 28) {
          // Non-leap year: February has 28 days
          return formatDate;
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  } else {
    return null;
  }
}

// Function to convert the Date format
const convertDateFormat = async (dateString) => {

  if (dateString.length < 11) {
    // Parse the date string to extract month, day, and year
    const [month, day, year] = dateString.split('/');
    let formatDate = `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    const numericMonth = parseInt(month, 10);
    const numericDay = parseInt(day, 10);
    const numericYear = parseInt(year, 10);
    // Check if month, day, and year are within valid ranges
    if (numericMonth > 0 && numericMonth <= 12 && numericDay > 0 && numericDay <= 31 && numericYear >= 1900 && numericYear <= 9999) {
      if ((numericMonth == 1 || numericMonth == 3 || numericMonth == 5 || numericMonth == 7 ||
        numericMonth == 8 || numericMonth == 10 || numericMonth == 12) && numericDay <= 31) {
        return formatDate;
      } else if ((numericMonth == 4 || numericMonth == 6 || numericMonth == 9 || numericMonth == 11) && numericDay <= 30) {
        return formatDate;
      } else if (numericMonth == 2 && numericDay <= 29) {
        if (numericYear % 4 == 0 && numericDay <= 29) {
          // Leap year: February has 29 days
          return formatDate;
        } else if (numericYear % 4 != 0 && numericDay <= 28) {
          // Non-leap year: February has 28 days
          return formatDate;
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  var formatString = 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ';
  // Define the possible date formats
  const formats = ['ddd MMM DD YYYY HH:mm:ss [GMT]ZZ', 'M/D/YY', 'M/D/YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD MMMM, YYYY', 'DD MMM, YYYY', 'MMMM d, yyyy', 'MM/DD/YY'];

  // Attempt to parse the input date string using each format
  let dateObject;
  for (const format of formats) {
    dateObject = moment(dateString, format, true);
    if (dateObject.isValid()) {
      break;
    }
  }

  // Check if a valid date object was obtained
  if (dateObject && dateObject.isValid()) {

    // Convert the dateObject to moment (if it's not already)
    const momentDate = moment(dateObject);

    // Format the date to 'YY/MM/DD'
    var formattedDate = momentDate.format('MM/DD/YYYY');
    return formattedDate;
  } else if (!formattedDate) {
    // Format the parsed date to 'MM/DD/YY'
    var formattedDate = moment(dateString, formatString).format('MM/DD/YYYY');
    if (formattedDate != 'Invalid date') {
      return formattedDate;
    } else {
      var formattedDate = moment(dateString).utc().format('MM/DD/YYYY');
      return formattedDate;
    }
  }
  else {
    // Return null or throw an error based on your preference for handling invalid dates
    return null;
  }
};

// Convert Date format for the Display on Verification
const convertDateOnVerification = async (dateString) => {

  var formatString = 'MM/DD/YYYY';

  // Attempt to parse the input date string using the specified format
  const dateObject = moment(dateString, formatString, true);
  if (dateObject.isValid()) {
    // Format the date to 'MM/DD/YYYY'
    var formattedDate = moment(dateObject).format(formatString);
    return formattedDate;
  }
};

const dateFormatToStore = async (inputDate) => {
  // Split the input date string by '/'
  const parts = inputDate.split('/');

  // Check if the month and day already have two digits
  const month = parts[0].length === 2 ? parts[0] : ('0' + parts[0]).slice(-2);
  const day = parts[1].length === 2 ? parts[1] : ('0' + parts[1]).slice(-2);
  const year = parts[4];

  // Concatenate the formatted parts with '/'
  return `${month}/${day}/${year}`;
};

// Verify Certification ID from both collections (single / batch)
const isCertificationIdExisted = async (certId) => {
  const dbStaus = await isDBConnected();

  if (certId == null || certId == "") {
    return [{ status: "FAILED", message: "Invalid Data" }];
  }

  const singleIssueExist = await Issues.findOne({ certificateNumber: certId });
  const batchIssueExist = await BatchIssues.findOne({ certificateNumber: certId });

  try {
    if (singleIssueExist) {

      return [{ status: "SUCCESS", message: "unit", details: singleIssueExist }];
    } else if (batchIssueExist) {

      return [{ status: "SUCCESS", message: "batch", details: batchIssueExist }];
    } else {

      return [{ status: "FAILED", message: "Certification ID not found" }];
    }

  } catch (error) {
    console.error("Error during validation:", error);
  }
};

// Function to insert certification data into MongoDB
const insertBulkSingleIssueData = async (data) => {
  try {
    // Create a new Issues document with the provided data
    const newIssue = new Issues({
      issuerId: data.issuerId,
      transactionHash: data.transactionHash,
      certificateHash: data.certificateHash,
      certificateNumber: data.certificateNumber,
      name: data.name,
      course: data.course,
      grantDate: data.grantDate,
      expirationDate: data.expirationDate,
      certificateStatus: 1,
      issueDate: Date.now() // Set the issue date to the current timestamp
    });

    // Save the new Issues document to the database
    const result = await newIssue.save();
    // Logging confirmation message
    // console.log("Certificate data inserted");
  } catch (error) {
    // Handle errors related to database connection or insertion
    console.error("Error connecting to MongoDB:", error);
  }
};

// Function to insert certification data into MongoDB
const insertBulkBatchIssueData = async (data) => {
  try {

    // Insert data into MongoDB
    const newBatchIssue = new BatchIssues({
      issuerId: data.issuerId,
      batchId: data.batchId,
      proofHash: data.proofHash,
      encodedProof: data.encodedProof,
      transactionHash: data.transactionHash,
      certificateHash: data.certificateHash,
      certificateNumber: data.certificateNumber,
      name: data.name,
      course: data.course,
      grantDate: data.grantDate,
      expirationDate: data.expirationDate,
      issueDate: Date.now()
    });

    const result = await newBatchIssue.save();
    // Logging confirmation message
    // console.log("Certificate data inserted");

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

// Function to insert certification data into MongoDB
const insertCertificateData = async (data) => {
  try {
    // Create a new Issues document with the provided data
    const newIssue = new Issues({
      issuerId: data.issuerId,
      transactionHash: data.transactionHash,
      certificateHash: data.certificateHash,
      certificateNumber: data.certificateNumber,
      name: data.name,
      course: data.course,
      grantDate: data.grantDate,
      expirationDate: data.expirationDate,
      certificateStatus: 1,
      issueDate: Date.now() // Set the issue date to the current timestamp
    });

    // Save the new Issues document to the database
    const result = await newIssue.save();

    const idExist = await User.findOne({ issuerId: data.issuerId });
    // If user with given id exists, update certificatesIssued count
    const previousCount = idExist.certificatesIssued || 0; // Initialize to 0 if certificatesIssued field doesn't exist
    idExist.certificatesIssued = previousCount + 1;
    await idExist.save(); // Save the changes to the existing user
    // Logging confirmation message
    // console.log("Certificate data inserted");
  } catch (error) {
    // Handle errors related to database connection or insertion
    console.error("Error connecting to MongoDB:", error);
  }
};

// Function to insert certification data into MongoDB
const insertBatchCertificateData = async (data) => {
  try {

    // Insert data into MongoDB
    const newBatchIssue = new BatchIssues({
      issuerId: data.issuerId,
      batchId: data.batchId,
      proofHash: data.proofHash,
      encodedProof: data.encodedProof,
      transactionHash: data.transactionHash,
      certificateHash: data.certificateHash,
      certificateNumber: data.certificateNumber,
      name: data.name,
      course: data.course,
      grantDate: data.grantDate,
      expirationDate: data.expirationDate,
      issueDate: Date.now()
    });

    const result = await newBatchIssue.save();

    const idExist = await User.findOne({ issuerId: data.issuerId });
    // If user with given id exists, update certificatesIssued count
    const previousCount = idExist.certificatesIssued || 0; // Initialize to 0 if certificatesIssued field doesn't exist
    idExist.certificatesIssued = previousCount + 1;
    await idExist.save(); // Save the changes to the existing user

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

// Function to extract certificate information from a QR code text
const extractCertificateInfo = async (qrCodeText) => {
  // console.log("QR Code Text", qrCodeText);
  // Check if the data starts with 'http://' or 'https://'
  if (qrCodeText.startsWith('http://') || qrCodeText.startsWith('https://')) {
    // If it's an encrypted URL, extract the query string parameters q and iv
    const url = decodeURIComponent(qrCodeText);
    const qIndex = url.indexOf("q=");
    const ivIndex = url.indexOf("iv=");
    const q = url.substring(qIndex + 2, ivIndex - 1);
    const iv = url.substring(ivIndex + 3);

    // Decrypt the data using the provided q and iv parameters
    const fetchDetails = decryptData(q, iv);

    // Parse the JSON string into a JavaScript object
    const parsedData = JSON.parse(fetchDetails);
    // console.log("cert details", parsedData);
    // Create a new object with desired key-value mappings for certificate information
    const convertedData = {
      "Certificate Number": parsedData.Certificate_Number,
      "Name": parsedData.name,
      "Course Name": parsedData.courseName,
      "Grant Date": parsedData.Grant_Date,
      "Expiration Date": parsedData.Expiration_Date,
      "Polygon URL": parsedData.polygonLink
    };
    // console.log("Data of Redirect", convertedData);
    return convertedData;
  } else {
    // If it's not an encrypted URL, assume it's plain text and split by new lines
    const lines = qrCodeText.split("\n");
    // Initialize an object to store certificate information
    const certificateInfo = {
      "Verify On Blockchain": "",
      "Certification Number": "",
      "Name": "",
      "Certification Name": "",
      "Grant Date": "",
      "Expiration Date": ""
    };
    // Loop through each line of the text
    for (const line of lines) {
      const parts = line.trim().split(/:\s+/); // Use a regular expression to split by colon followed by optional whitespace
      // If there are two parts (a key-value pair), extract the key and value
      if (parts.length === 2) {
        const key = parts[0].trim();
        let value = parts[1].trim();

        // Remove commas from the value (if any)
        value = value.replace(/,/g, "");

        // Map the key-value pairs to corresponding fields in the certificateInfo object
        if (key === "Verify On Blockchain") {
          certificateInfo["Polygon URL"] = value;
        } else if (key === "Certification Number") {
          certificateInfo["Certificate Number"] = value;
        } else if (key === "Name") {
          certificateInfo["Name"] = value;
        } else if (key === "Certification Name") {
          certificateInfo["Course Name"] = value;
        } else if (key === "Grant Date") {
          certificateInfo["Grant Date"] = value;
        } else if (key === "Expiration Date") {
          certificateInfo["Expiration Date"] = value;
        }
      }
    }
    var convertedCertData = {
      "Certificate Number": certificateInfo["Certificate Number"],
      "Name": certificateInfo["Name"],
      "Course Name": certificateInfo["Course Name"],
      "Grant Date": certificateInfo['Grant Date'],
      "Expiration Date": certificateInfo['Expiration Date'],
      "Polygon URL": certificateInfo["Polygon URL"]
    };
    return convertedCertData;
  }
};

const holdExecution = (delay) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, delay); // If 1500 milliseconds = 1.5 seconds
  });
};

const baseCodeResponse = async (pdfFilePath, pdf2PicOptions) => {

  var base64Response = await fromPath(pdfFilePath, pdf2PicOptions)(
    1, // page number to be converted to image
    true // returns base64 output
  );

  // Extract base64 data URI from response
  var dataUri = base64Response?.base64;

  // Convert base64 string to buffer
  var buffer = Buffer.from(dataUri, "base64");
  // Read PNG data from buffer
  var png = PNG.sync.read(buffer);

  // Decode QR code from PNG data
  return _code = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);

};

const extractQRCodeDataFromPDF = async (pdfFilePath) => {
  try {
    const pdf2picOptions = {
      quality: 100,
      density: 300,
      format: "png",
      width: 2000,
      height: 2000,
    };

    const pdf2picOptions2 = {
      quality: 100,
      density: 350,
      format: "png",
      width: 3000,
      height: 3000,
    };

    const pdf2picOptions3 = {
      quality: 100,
      density: 350,
      format: "png",
      width: 4000,
      height: 4000,
    };
    // Decode QR code from PNG data
    var code = await baseCodeResponse(pdfFilePath, pdf2picOptions);
    if (!code) {
      var code = await baseCodeResponse(pdfFilePath, pdf2picOptions2);
      if (!code) {
        var code = await baseCodeResponse(pdfFilePath, pdf2picOptions3);
      }
    }
    const qrCodeText = code?.data;
    // Throw error if QR code text is not available
    if (!qrCodeText) {
      // throw new Error("QR Code Text could not be extracted from PNG image");
      console.log("QR Code Not Found / QR Code Text could not be extracted");
      return false;
    } else {
      detailsQR = qrCodeText;
      // Extract certificate information from QR code text
      const certificateInfo = extractCertificateInfo(qrCodeText);

      // Return the extracted certificate information
      return certificateInfo;
    }

  } catch (error) {
    // Log and rethrow any errors that occur during the process
    console.error(error);
    // throw error;
    return false;
  }
};

const addLinkToPdf = async (
  inputPath, // Path to the input PDF file
  outputPath, // Path to save the modified PDF file
  linkUrl, // URL to be added to the PDF
  qrCode, // QR code image to be added to the PDF
  combinedHash // Combined hash value to be displayed (optional)
) => {
  // Read existing PDF file bytes
  const existingPdfBytes = fs.readFileSync(inputPath);

  // Load existing PDF document
  const pdfDoc = await pdf.PDFDocument.load(existingPdfBytes);

  // Get the first page of the PDF document
  const page = pdfDoc.getPage(0);

  // Get page width and height
  const width = page.getWidth();
  const height = page.getHeight();

  // Add link URL to the PDF page
  page.drawText(linkUrl, {
    x: 62, // X coordinate of the text
    y: 30, // Y coordinate of the text
    size: 8, // Font size
  });

  // page.drawText(combinedHash, {
  //   x: 5,
  //   y: 10,
  //   size: 3
  // });

  //Adding qr code
  const pdfDc = await PDFDocument.create();
  // Adding QR code to the PDF page
  const pngImage = await pdfDoc.embedPng(qrCode); // Embed QR code image
  const pngDims = pngImage.scale(0.36); // Scale QR code image

  page.drawImage(pngImage, {
    x: width - pngDims.width - 108,
    y: 135,
    width: pngDims.width,
    height: pngDims.height,
  });
  qrX = width - pngDims.width - 75;
  qrY = 75;
  qrWidth = pngDims.width;
  qrHeight = pngDims.height;

  const pdfBytes = await pdfDoc.save();

  fs.writeFileSync(outputPath, pdfBytes);
  return pdfBytes;
};

const verifyPDFDimensions = async (pdfPath) => {
  // Extract QR code data from the PDF file
  const certificateData = await extractQRCodeDataFromPDF(pdfPath);
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  const firstPage = pdfDoc.getPages()[0];
  const { width, height } = firstPage.getSize();

  // Assuming PDF resolution is 72 points per inch
  const dpi = 72;
  const widthInches = width / dpi;
  const heightInches = height / dpi;

  // Convert inches to millimeters (1 inch = 25.4 mm)
  const widthMillimeters = widthInches * 25.4;
  const heightMillimeters = heightInches * 25.4;

  // Check if dimensions fall within the specified ranges
  if (
    (widthMillimeters >= 340 && widthMillimeters <= 360) &&
    (heightMillimeters >= 240 && heightMillimeters <= 260) &&
    (certificateData === false)
  ) {
    // Convert inches to pixels (assuming 1 inch = 96 pixels)
    // const widthPixels = widthInches * 96;
    // const heightPixels = heightInches * 96;

    // console.log("The certificate width x height (in mm):", widthMillimeters, heightMillimeters);

    return true;
  } else {
    // throw new Error('PDF dimensions must be within 240-260 mm width and 340-360 mm height');
    return false;
  }

};

// Function to calculate SHA-256 hash of data
const calculateHash = (data) => {
  // Create a hash object using SHA-256 algorithm
  // Update the hash object with input data and digest the result as hexadecimal string
  return crypto.createHash('sha256').update(data).digest('hex').toString();
};

// Function to create a new instance of Web3 and connect to a specified RPC endpoint
const web3i = async () => {
  var provider = new ethers.providers.getDefaultProvider(process.env.RPC_ENDPOINT);
  await provider.getNetwork(); // Attempt to detect the network

  if (provider) {

    // Get contract ABI from configuration
    const contractABI = abi;
    var signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    // Create a new contract instance using the ABI and contract address
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    return contract; // Return the contract instance

  } else {
    // console.log("Invalid Endpoint");
    return false;
  }
};

const fileFilter = (req, file, cb) => {
  // Check if the file MIME type is a PDF
  if (file.mimetype === "application/pdf") {
    cb(null, true); // Accept the file
  } else {
    // If the file type is not PDF, reject the file upload with an error message
    cb(
      new Error("Invalid file type. Only PDF files are allowed."),
      false
    );
  }
};

const cleanUploadFolder = async () => {
  const uploadFolder = '../uploads'; // Specify the folder path you want
  const folderPath = path.join(__dirname, '..', uploadFolder);

  // Check if the folder is not empty
  const filesInFolder = fs.readdirSync(folderPath);

  if (filesInFolder.length > 0) {
    // Delete all files in the folder
    filesInFolder.forEach(fileToDelete => {
      const filePathToDelete = path.join(folderPath, fileToDelete);
      // try {
      //   if (fs.lstatSync(filePathToDelete).isDirectory()) {
      //     // If it's a directory, recursively delete it
      //     fs.rmdirSync(filePathToDelete, { recursive: true });
      //   } else {
      //     // If it's a file, just delete it
      //     fs.unlinkSync(filePathToDelete);
      //   }
      // }
      try {
        fs.unlinkSync(filePathToDelete);
      } catch (error) {
        console.error("Error deleting file:", filePathToDelete, error);
      }
    });
  }
};


const flushUploadFolder = async () => {
  const uploadFolder = '../uploads'; // Specify the folder path you want
  const folderPath = path.join(__dirname, '..', uploadFolder);

  // Check if the folder is not empty
  const filesInFolder = fs.readdirSync(folderPath);

  const fileToDelete = filesInFolder[0]; // Get the first file in the folder
  const filePathToDelete = path.join(folderPath, fileToDelete); // Construct the full path of the file to delete

  // Delete the file
  fs.unlink(filePathToDelete, (err) => {
    if (err) {
      console.error(`Error deleting file "${filePathToDelete}":`, err);
    } else {
      console.log(`Only Files in "${filePathToDelete}" were deleted successfully.`);
    }
  });
};

const wipeUploadFolder = async () => {
  const uploadFolder = '../uploads'; // Specify the folder path you want
  const folderPath = path.join(__dirname, '..', uploadFolder);

  // Check if the folder is not empty
  const filesInFolder = fs.readdirSync(folderPath);

  if (filesInFolder.length > 0) {
    // Delete all files in the folder
    filesInFolder.forEach(fileToDelete => {
      const filePathToDelete = path.join(folderPath, fileToDelete);
      try {
        if (fs.lstatSync(filePathToDelete).isDirectory()) {
          // If it's a directory, recursively delete it
          fs.rmdirSync(filePathToDelete, { recursive: true });
        } else {
          // If it's a file, just delete it
          fs.unlinkSync(filePathToDelete);
        }
      } catch (error) {
        console.error("Error deleting file:", filePathToDelete, error);
      }
    });
  }
};

const isDBConnected = async () => {
  let retryCount = 0; // Initialize retry count
  while (retryCount < maxRetries) {
    try {
      // Attempt to establish a connection to the MongoDB database using the provided URI
      await mongoose.connect(process.env.MONGODB_URI);
      // console.log('Connected to MongoDB successfully!');
      return true; // Return true if the connection is successful
    } catch (error) {
      console.error('Error connecting to MongoDB:', error.message);
      retryCount++; // Increment retry count
      console.log(`Retrying connection (${retryCount}/${maxRetries}) in 1.5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait for 1.5 seconds before retrying
    }
  }
  console.error('Failed to connect to MongoDB after maximum retries.');
  return false; // Return false if unable to connect after maximum retries
};

// Email Approved Notfication function
const sendEmail = async (name, email) => {
  // Log the details of the email recipient (name and email address)
  try {
    // Update the mailOptions object with the recipient's email address and email body
    mailOptions.to = email;
    mailOptions.text = `Hi ${name}, 
Congratulations! You've been approved by the admin. 
You can now log in to your profile. With username ${email}`;

    // Send the email using the configured transporter
    transporter.sendMail(mailOptions);
    console.log('Email sent successfully');

    // Return true to indicate that the email was sent successfully
    return true;
  } catch (error) {
    // Log an error message if there was an error sending the email
    console.error('Error sending email:', error);

    // Return false to indicate that the email sending failed
    return false;
  }
};

// Email Rejected Notfication function
const rejectEmail = async (name, email) => {
  try {
    // Update the mailOptions object with the recipient's email address and email body
    mailOptions.to = email;
    mailOptions.text = `Hi ${name}, 
    We regret to inform you that your account registration has been declined by the admin. 
    If you have any questions or concerns, please feel free to contact us. 
    Thank you for your interest.`;

    // Send the email using the configured transporter
    transporter.sendMail(mailOptions);
    console.log('Email sent successfully');

    // Return true to indicate that the email was sent successfully
    return true;
  } catch (error) {
    // Log an error message if there was an error sending the email
    console.error('Error sending email:', error);

    // Return false to indicate that the email sending failed
    return false;
  }
};


module.exports = {
  // Connect to Polygon 
  connectToPolygon,

  // Verify Certification ID from both collections (single / batch)
  isCertificationIdExisted,

  // Function to insert certificate data into MongoDB
  insertCertificateData,
  insertBulkSingleIssueData,

  // Insert Batch certificate data into Database
  insertBatchCertificateData,
  insertBulkBatchIssueData,

  // Function to extract certificate information from a QR code text
  extractCertificateInfo,

  // Function to convert the Date format
  convertDateFormat,

  dateFormatToStore,

  convertDateOnVerification,
  validateSearchDateFormat,

  // Function to extract QR code data from a PDF file
  extractQRCodeDataFromPDF,

  // Function to add a link and QR code to a PDF file
  addLinkToPdf,

  //Verify the uploading pdf template dimensions
  verifyPDFDimensions,

  // Function to calculate the hash of data using SHA-256 algorithm
  calculateHash,

  // Function to initialize and return a web3 instance
  web3i,

  // Function for filtering file uploads based on MIME type Pdf
  fileFilter,

  // Function to clean up the upload folder
  cleanUploadFolder,

  flushUploadFolder,

  wipeUploadFolder,

  // Function to check if MongoDB is connected
  isDBConnected,

  // Function to send an email (approved)
  sendEmail,

  // Function to hold an execution for some time
  holdExecution,

  // Function to send an email (rejected)
  rejectEmail
};
