const express = require('express');
const router = express.Router();
const adminController = require('../controllers/verify');
const multer = require('multer');
const { fileFilter, excelFilter } = require('../model/tasks'); // Import file filter function
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

/**
 * @swagger
 * /api/verify:
 *   post:
 *     summary: Verify the Certification with QR  - Blockchain URL
 *     description: API Verify the Certification with QR in PDF document format - Blockchain URL. 
 *     tags: [Verifier]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdfFile:
 *                 type: string
 *                 format: binary
 *                 description: PDF file containing the certificate to be verified.
 *             required:
 *                - pdfFile
 *           example:
 *             status: "FAILED"
 *             error: Internal Server Error
 *     responses:
 *       '200':
 *         description: Certificate verified successfully
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
 *               message: Verification result message.
 *               detailsQR: Base64-decoded QR code image Details.
 *       '400':
 *         description: Certificate is not valid or other error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Certificate is not valid or other error.
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

router.post('/verify', _upload.single("pdfFile"), adminController.verify);

/**
 * @swagger
 * /api/verify-certification-id:
 *   post:
 *     summary: Verify Single/Batch Certificates by Certification ID
 *     description: Verify single/batch certificates using their certification ID. It checks whether the certification ID exists in the database and validates it against blockchain records if found.
 *     tags: [Verifier]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Certificate id to be verified
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *            schema:
 *              type: object
 *              properties:
 *                status:
 *                  type: string
 *                  example: "SUCCESS"
 *                message:
 *                  type: string
 *                  example: "Valid Certificate"
 *                details:
 *                  type: object
 *                  properties:
 *                    // Define properties of certificate details object here
 *       '400':
 *         description: Certificate not found
 *         content:
 *           application/json:
 *            schema:
 *              type: object
 *              properties:
 *                status:
 *                  type: string
 *                  example: "FAILED"
 *                message:
 *                  type: string
 *                  example: "Certificate doesn't exist"
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
 *            schema:
 *              type: object
 *              properties:
 *                status:
 *                  type: string
 *                  example: "FAILED"
 *                message:
 *                  type: string
 *                  example: "Internal Server error"
 */

router.post('/verify-certification-id', validationRoute.checkId, adminController.verifyCertificationId);

/**
 * @swagger
 * /api/verify-decrypt:
 *   post:
 *     summary: Verify a certification with encryption
 *     description: API for decode the certiication with encrypted inputs.
 *     tags: [Verifier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               encryptedData:
 *                 type: string
 *                 description: Encrypted data containing certificate information
 *               iv:
 *                 type: string
 *                 description: Initialization vector used for encryption
 *     responses:
 *       '200':
 *         description: Certificate decoded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Verification status (PASSED)
 *                 message:
 *                   type: string
 *                   description: Verification result message
 *                 data:
 *                   type: object
 *                   properties:
 *               
 *                     Certificate Number:
 *                       type: string
 *                       description: Certificate number
 *                     Course Name:
 *                       type: string
 *                       description: Name of the course
 *                     Expiration Date:
 *                       type: string
 *                       description: Date of certificate expiration
 *                     Grant Date:
 *                       type: string
 *                       description: Date of certificate grant
 *                     Name:
 *                       type: string
 *                       description: Recipient's name
 *                     Polygon Link:
 *                       type: string
 *                       description: Polygon Link
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
 *                 message:
 *                   type: string
 */

router.post('/verify-decrypt', (req, res) => adminController.decodeCertificate(req, res));

module.exports=router;