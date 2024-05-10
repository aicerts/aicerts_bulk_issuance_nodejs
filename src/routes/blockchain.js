const express = require('express');
const router = express.Router();
const adminController = require('../controllers/blockchain');
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const validationRoute = require("../common/validationRoutes");

/**
 * @swagger
 * /api/validate-issuer:
 *   post:
 *     summary: Approve or Reject an Issuer
 *     description: API to approve or reject Issuer status (to perform the Issuing Certification over the Blockchain)
 *     tags: [Blockchain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: integer
 *                 description: Status code indicating approval (1) or rejection (2)
 *               email:
 *                 type: string
 *                 description: Email of the issuer to be approved or rejected
 *             example:
 *               status: 1
 *               email: issuer@example.com
 *     responses:
 *       '200':
 *         description: Successful operation. Returns status of the email and a success message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (SUCCESS).
 *                 email:
 *                   type: string
 *                   description: Status of the email (sent or NA).
 *                 message:
 *                   type: string
 *                   description: Success message indicating approval or rejection.
 *       '400':
 *         description: Invalid input parameter or issuer status. Returns a failure message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (FAILED).
 *                 message:
 *                   type: string
 *                   description: Error message detailing the issue.
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
 *         description: Internal server error. Returns a failure message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (FAILED).
 *                 message:
 *                   type: string
 *                   description: Error message indicating an error during the validation process.
 */

router.post('/validate-issuer', validationRoute.validateIssuer, ensureAuthenticated, adminController.validateIssuer);

/**
 * @swagger
 * /api/add-trusted-owner:
 *   post:
 *     summary: Grant Admin / Issuer role to an address
 *     description: Add the ISSUER_ROLE to the given Ethereum Address (If it hasn't)
 *     tags: [Blockchain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 format: ethereum-address
 *                 description: Ethereum address to which the role will be assigned
 *     responses:
 *       200:
 *         description: Role successfully granted to the address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Details of the operation result
 *                 details:
 *                   type: string
 *                   description: URL to view transaction details on the blockchain explorer
 *       400:
 *         description: Bad request or invalid role assigned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Reason for the failure
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
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Details of the internal server error
 */

router.post('/add-trusted-owner', validationRoute.checkAddress, ensureAuthenticated, adminController.addTrustedOwner);

/**
 * @swagger
 * /api/remove-trusted-owner:
 *   post:
 *     summary: Revoke Admin / Issuer role from the address
 *     descriotion: Revoke the ISSUER_ROLE from the given Ethereum Address (If it has)
 *     tags: [Blockchain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 format: ethereum-address
 *                 description: Ethereum address to which the role will be revoked
 *     responses:
 *       200:
 *         description: Role successfully revoked from the address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Details of the operation result
 *                 details:
 *                   type: string
 *                   description: URL to view transaction details on the blockchain explorer
 *       400:
 *         description: Bad request or invalid role assigned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Reason for the failure
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
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Details of the internal server error
 */

router.post('/remove-trusted-owner', validationRoute.checkAddress, ensureAuthenticated, adminController.removeTrustedOwner);

/**
 * @swagger
 * /api/check-balance:
 *   get:
 *     summary: Check the balance of an Ethereum account address
 *     description: Check MATIC Balance of the given valid Ethereum address
 *     tags: [Blockchain]
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         description: Ethereum account address
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful balance check
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Balance check result message
 *                 balance:
 *                   type: string
 *                   description: Balance in Ether
 *       400:
 *         description: Invalid input or address format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for invalid input
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
 *         description: An error occurred during the balance check
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for internal server error
 */

router.get('/check-balance', ensureAuthenticated, adminController.checkBalance);

// /**
//  * @swagger
//  * /api/polygonlink:
//  *   get:
//  *     summary: Get Polygon link URL
//  *     description: API route handler is designed to respond to incoming HTTP.  
//  *     tags: [Polygon]
//  *     responses:
//  *       200:
//  *         description: Successful response with Polygon link URL
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 linkUrl:
//  *                   type: string
//  *                   example: "https://example.com/polygon"
//  */

router.get('/polygonlink', adminController.polygonLink);

module.exports=router;