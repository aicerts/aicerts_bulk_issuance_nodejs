const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/fetch');
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const validationRoute = require("../common/validationRoutes");

// const __upload = multer({ storage : _storage });
const __upload = multer({dest: "../../uploads/"});

/**
 * @swagger
 * /api/get-bulk-files:
 *   post:
 *     summary: Get Bulk issued Certifications backup file on input search date
 *     description: API to Fetch Bulk Issued details on Date (MM-DD-YYYY) input, Category would be single:1, Batch:2.
 *     tags: [Fetch/Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 type: string
 *                 description: search with date.
 *               category:
 *                 type: number
 *                 description: The certificate number.
 *             required:
 *               - search
 *               - category
 *     responses:
 *       200:
 *         description: Files fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: object
 *                   description: Issuer details
 *                 message:
 *                   type: string
 *                   example: Files fetched successfully
 *       400:
 *         description: Bad request or issuer not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Files not found (or) Bad request!
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: An error occurred during the process!
 */

router.post('/get-bulk-files', adminController.getBulkBackupFiles);

module.exports=router;