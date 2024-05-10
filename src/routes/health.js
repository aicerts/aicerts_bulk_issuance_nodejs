const express = require('express');
const router = express.Router();
const adminController = require('../controllers/health');

/**
 * @swagger
 * /api/health-check:
 *   get:
 *     summary: API to do Health Check
 *     description: API to do Perform checks on the API, such as database connectivity and response times
 *     tags: [Health]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 message:
 *                   type: string
 *                   example: API is healthy
 *       500:
 *         description: Health check failed
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
 *                   example: Health check failed
 */

router.get('/health-check', adminController.healthCheck);

module.exports=router;