// Load environment variables from .env file
require('dotenv').config();

// Initialize scheduler
require('./src/config/scheduler');

// Import required modules
const express = require("express");
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const bodyParser = require('body-parser');
const cors = require("cors");
const multer = require('multer');

// Create an Express application
const app = express();

// Define the port number
const port = process.env.PORT || 8000;

// Import routes
const tasksRoutes = require('./src/routes/index');

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blockchain API',
      version: '1.0.0',
      description: 'API documentation for Blockchain module',
    },
  },
  apis: ['./src/routes/*.js'], // Add other paths if needed
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Configure CORS with whitelisted routes
// const corsOptions = {
//   origin: ['https://example.com'], // Add allowed origins
//   methods: ['GET', 'POST'], // Add allowed methods
// };

// Middleware
// app.use(cors(corsOptions)); // Use CORS middleware with custom options
app.use(cors());
app.use(bodyParser.json());

// Routes 
app.use('/api', tasksRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  setTimeout(function () { next(); }, 120000); // 120 seconds
  console.error(err.stack);
  if (err instanceof multer.MulterError) {
    // Multer error occurred (e.g., file size limit exceeded)
    res.status(400).json({ status: "FAILED", message: "Invalid File format / " + err.message });
  } else if (err) {
    // Other errors
    res.status(400).json({ status: "FAILED", message: err.message });
  } else {
    next(); // Pass control to the next middleware
  }
});

// Handling uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Perform cleanup tasks if needed
  process.exit(1); // Exit the process with a failure code
});

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Start the server
const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing server gracefully.');
  // Close the server gracefully
  server.close(() => {
    console.log('Server closed.');
    process.exit(0); // Exit the process with a success code
  });
});


