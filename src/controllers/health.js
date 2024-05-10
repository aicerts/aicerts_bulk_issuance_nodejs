// Importing functions from a custom module
const {
  isDBConnected // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

/**
 * API to do Health Check.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const healthCheck = async (req, res) => {
  // Perform checks on the API, such as database connectivity and response times
  const checks = [
    {
      name: 'Database connectivity',
      check: async () => {
        // Try to connect to the database
        const connection = await isDBConnected();
        // If the connection is successful, return true
        if (connection) {
          return true;
        }
        // Otherwise, return false
        return false;
      },
    },
    {
      name: 'Response',
      check: async () => {
        const healthcheck = {
          uptime: process.uptime(),
          message: 'OK',
          timestamp: Date.now()
        };
        try {
          // res.send(healthcheck);
          return true;
        } catch (error) {
          // healthcheck.message = error;
          return false;
          // res.status(503).send();
        }
      },
    },
  ];

  // Iterate over the checks and return an error if any of them fail
  for (const check of checks) {
    const result = await check.check();
    if (!result) {
      return res.status(500).send({ status: "FAILED", message: `Health check failed: ${check.name}` });
    }
  }

  // If all of the checks pass, return a success response
  return res.status(200).send({ status: "SUCCESS", message: 'API is healthy' });
};

module.exports = {
  // Function to do Health Check
  healthCheck
};
