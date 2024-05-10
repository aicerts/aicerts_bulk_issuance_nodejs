const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const multer = require('multer');
const { fileFilter } = require('../model/tasks'); // Import file filter function
const adminController = require('../controllers/issues');
const validationRoute = require("../common/validationRoutes");

// Configure multer storage options
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./uploads"); // Set the destination where files will be saved
    },
    filename: (req, file, cb) => {
      // Set the filename based on the Certificate_Number from the request body
      const Certificate_Number = req.body.Certificate_Number;
      cb(null, file.originalname);
    },
  });

  // Initialize multer with configured storage and file filter
  const _upload = multer({ storage, fileFilter });
  
  const __upload = multer({dest: "./uploads/"});

/**
 * @swagger
 * /api/issue:
 *   post:
 *     summary: API call for issuing a certificate (no pdf required)
 *     description: API call for issuing a certificate with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, Response Handling, Blockchain Interaction, Data Encryption, QR Code Generation, Database Interaction, Error Handling and Asynchronous Operation.
 *     tags:
 *       - Issue Certification (Details)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               certificateNumber:
 *                 type: string
 *                 description: The certificate number.
 *               name:
 *                 type: string
 *                 description: The name associated with the certificate.
 *               course:
 *                 type: string
 *                 description: The course name associated with the certificate.
 *               grantDate:
 *                 type: string
 *                 description: The grant date of the certificate.
 *               expirationDate:
 *                 type: string
 *                 description: The expiration date of the certificate.
 *             required:
 *               - email
 *               - certificateNumber
 *               - name
 *               - course
 *               - grantDate
 *               - expirationDate
 *     responses:
 *       '200':
 *         description: Successful certificate issuance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 qrCodeImage:
 *                   type: string
 *                 polygonLink:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               message: Certificate issued successfully.
 *               qrCodeImage: Base64-encoded QR code image.
 *               polygonLink: Link to the transaction on the Polygon network.
 *               details: Certificate details.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for certificate already issued or invalid input.
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal server error.
 */

router.post('/issue', validationRoute.issue, ensureAuthenticated, adminController.issue);

/**
 * @swagger
 * /api/issue-pdf:
 *   post:
 *     summary: API call for issuing certificates with a PDF template
 *     description: API call for issuing certificates with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, PDF Generation, Database Interaction, Response Handling, PDF Template, QR Code Integration, File Handling, Asynchronous Operation, Cleanup and Response Format.
 *     tags:
 *       - Issue Certification (*Upload pdf)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               certificateNumber:
 *                 type: string
 *                 description: The certificate number.
 *               name:
 *                 type: string
 *                 description: The name associated with the certificate.
 *               course:
 *                 type: string
 *                 description: The course name associated with the certificate.
 *               grantDate:
 *                 type: string
 *                 description: The grant date of the certificate.
 *               expirationDate:
 *                 type: string
 *                 description: The expiration date of the certificate.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to be uploaded.
 *                 x-parser:
 *                   expression: file.originalname.endsWith('.pdf') // Allow only PDF files
 *             required:
 *               - email
 *               - certificateNumber
 *               - name
 *               - course
 *               - grantDate
 *               - expirationDate
 *               - file
 *     responses:
 *       '200':
 *         description: Successful certificate issuance in PDF format
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *             example:
 *               status: "SUCCESS"
 *               message: PDF file containing the issued certificate.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for certificate already issued or invalid input.
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal Server Error.
 */

router.post('/issue-pdf', _upload.single("file"), ensureAuthenticated, adminController.issuePdf);

/**
 * @swagger
 * /api/batch-certificate-issue:
 *   post:
 *     summary: API call for issuing batch certificates.
 *     description: API call for issuing batch certificates with Request Data Extraction, Validation Checks, Excel Data Processing, Blockchain Processing, Certificate Issuance, Response Handling, Excel File Processing, Blockchain Verification, Merkle Tree Generation, QR Code Integration, Database Interaction, Error Handling and Asynchronous Operation. 
 *     tags: [Issue Batch (*Upload Excel)]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               excelFile:
 *                 type: string
 *                 format: binary
 *                 description: Excel file to be uploaded. Must not be blank.
 *             required:
 *               - email
 *               - excelFile
 *     responses:
 *       '200':
 *         description: Batch issuance successful
 *         content:
 *           application/json:
 *             example:
 *               status: "SUCCESS"
 *               message: Batch of Certificates issued successfully
 *               polygonLink: https://your-network.com/tx/transactionHash
 *               details:
 *                 - id: 2323a323cb
 *                   batchID: 1
 *                   transactionHash: 12345678
 *                   certuficateHash: 122113523
 *                   certificateNumber: ASD2121
 *                   name: ABC
 *                   course: Advanced AI
 *                   grantDate: 12-12-24
 *                   expirationDate: 12-12-25
 *                   issueDate: 12-12-24
 *                   qrCode: rewrewr34242423
 *                 - id: 2323a323cb
 *                   batchID: 1
 *                   transactionHash: 12345673
 *                   certuficateHash: 122113529
 *                   certificateNumber: ASD3131
 *                   name: XYZ
 *                   course: Advanced AI
 *                   grantDate: 12-11-24
 *                   expirationDate: 12-11-25
 *                   issueDate: 12-11-24
 *                   qrCode: rewrewr34242423
 *                 # Add more certifications details if needed
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               error: Bad Request
 *               status: "FAILED"
 *               message: Please provide valid Certification(Batch) details.
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               status: "FAILED"
 *               error: Internal Server Error
 */

router.post('/batch-certificate-issue', __upload.single("excelFile"), ensureAuthenticated, adminController.batchIssueCertificate);

/**
 * @swagger
 * /api/bulk-single-issue:
 *   post:
 *     summary: upload ZIP contain Excel & Pdfs with bulk issue with single approach.
 *     description: API extract zip file contents into uploads folder
 *     tags: [Bulk Issue]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               zipFile:
 *                 type: string
 *                 format: binary
 *                 description: ZIP file containing the PDF certificates & Excel to be issued.
 *             required:
 *                - zipFile
 *           example:
 *             status: "FAILED"
 *             error: Internal Server Error
 *     responses:
 *       '200':
 *         description: Files successfully extracted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 detailsQR:
 *                   type: string
 *             example:
 *               status: "SUCCESS"
 *               message: Files successfully extracted.
 *       '400':
 *         description: Files successfully not extracted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Files successfully Not extracted.
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal Server Error.
 */

router.post('/bulk-single-issue', __upload.single("zipFile"), adminController.bulkSingleIssueCertificates);

/**
 * @swagger
 * /api/bulk-batch-issue:
 *   post:
 *     summary: upload ZIP contain Excel & Pdfs with bulk issue with batch approach.
 *     description: API extract zip file contents into uploads folder
 *     tags: [Bulk Issue]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               zipFile:
 *                 type: string
 *                 format: binary
 *                 description: ZIP file containing the PDF certificates & Excel to be issued.
 *             required:
 *                - zipFile
 *           example:
 *             status: "FAILED"
 *             error: Internal Server Error
 *     responses:
 *       '200':
 *         description: Files successfully extracted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 detailsQR:
 *                   type: string
 *             example:
 *               status: "SUCCESS"
 *               message: Files successfully extracted.
 *       '400':
 *         description: Files successfully not extracted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Files successfully Not extracted.
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal Server Error.
 */

router.post('/bulk-batch-issue', __upload.single("zipFile"), adminController.bulkBatchIssueCertificates);


/**
 * @swagger
 * /api/auth-issue:
 *   post:
 *     summary: API call for issuing a certification (no pdf required) with Authorization token
 *     description: API call for issuing a certificate with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, Response Handling, Blockchain Interaction, Data Encryption, QR Code Generation, Database Interaction, Error Handling and Asynchronous Operation.
 *     tags:
 *       - Issue Certification (Details)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               certificateNumber:
 *                 type: string
 *                 description: The certificate number.
 *               name:
 *                 type: string
 *                 description: The name associated with the certificate.
 *               course:
 *                 type: string
 *                 description: The course name associated with the certificate.
 *               grantDate:
 *                 type: string
 *                 description: The grant date of the certificate.
 *               expirationDate:
 *                 type: string
 *                 description: The expiration date of the certificate.
 *             required:
 *               - email
 *               - certificateNumber
 *               - name
 *               - course
 *               - grantDate
 *               - expirationDate
 *     responses:
 *       '200':
 *         description: Successful certificate issuance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 qrCodeImage:
 *                   type: string
 *                 polygonLink:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               message: Certificate issued successfully.
 *               qrCodeImage: Base64-encoded QR code image.
 *               polygonLink: Link to the transaction on the Polygon network.
 *               details: Certificate details.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for certificate already issued or invalid input.
 *       '401':
 *         description: Authorization token is missing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Authorization token is missing.
 *       '403':
 *         description: User provided invalid Token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: User provided invalid Token.
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal server error.
 */

router.post('/auth-issue', validationRoute.authIssue, adminController.authIssue);

module.exports=router;