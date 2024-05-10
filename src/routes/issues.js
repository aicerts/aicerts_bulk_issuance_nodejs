const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const multer = require('multer');
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
  
  const _upload = multer({dest: "./uploads/"});

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

router.post('/bulk-single-issue', _upload.single("zipFile"), adminController.bulkSingleIssueCertificates);

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

router.post('/bulk-batch-issue', _upload.single("zipFile"), adminController.bulkBatchIssueCertificates);

module.exports=router;