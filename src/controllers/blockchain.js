// Load environment variables from .env file
require('dotenv').config();
const { validationResult } = require("express-validator");
// Import required modules
const { ethers } = require("ethers"); // Ethereum JavaScript library

// Import MongoDB models
const { User } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

// Importing functions from a custom module
const {
  isDBConnected, // Function to check if the database connection is established
  sendEmail, // Function to send an email on approved
  rejectEmail // Function to send an email on rejected
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

// Create a new ethers provider using the default provider and the RPC endpoint from environment variable
const provider = new ethers.JsonRpcProvider(process.env.RPC_ENDPOINT);

// Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const newContract = new ethers.Contract(contractAddress, abi, signer);

var messageCode = require("../common/codes");
/**
 * Define a route that takes a hash parameter.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const polygonLink = async (req, res) => {
  res.json({ linkUrl });
};

/**
 * API to approve or reject Issuer status.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const validateIssuer = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  let validationStatus = req.body.status;
  let email = req.body.email;

  // Find user by email
  const userExist = await User.findOne({ email });

  if (!email || !userExist || (validationStatus != 1 && validationStatus != 2)) {
    var defaultMessage = messageCode.msgInvalidInput;

    if ((validationStatus != 1 && validationStatus != 2)) {
      var defaultMessage = messageCode.msgProvideValidStatus;
    } else if (!userExist) {
      var defaultMessage = messageCode.msgUserNotFound;
    }
    return res.status(400).json({ status: "FAILED", message: defaultMessage });
  }

  try {
    // Check mongo DB connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);

    try {
      const roleStatus = await newContract.hasRole(process.env.ISSUER_ROLE, userExist.issuerId);

      if (roleStatus === false && validationStatus == 2) {
        if (userExist.status != 2) {
          // Save Issuer rejected details
          userExist.approved = false;
          userExist.status = 2;
          userExist.rejectedDate = Date.now();
          await userExist.save();

          // If user is not rejected yet, send email and update user's rejected status
          var mailStatus = await rejectEmail(userExist.name, email);
          var mailresponse = (mailStatus === true) ? "sent" : "NA";

          // Respond with success message indicating user rejected
          res.json({
            status: "SUCCESS",
            email: mailresponse,
            message: messageCode.msgIssuerRejectSuccess,
            details: userExist
          });
        } else {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgRejecetedAlready });
        }
      }

      else if (validationStatus == 1 && roleStatus === false) {

        if ((userExist.status == validationStatus) && (roleStatus == true)) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgExistedVerified });
        }

        var grantedStatus;
        if (roleStatus === false) {
          try {
            var tx = await newContract.grantRole(process.env.ISSUER_ROLE, userExist.issuerId);
            grantedStatus = "SUCCESS";
            var txHash = tx.hash;
            var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

          } catch (error) {
            grantedStatus = "FAILED";
            if (error.reason) {
              // Extract and handle the error reason
              console.log("Error reason:", error.reason);
              return res.status(400).json({ status: "FAILED", message: error.reason });
            } else {
              // If there's no specific reason provided, handle the error generally
              console.error(messageCode.msgFailedOpsAtBlockchain, error);
              return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain });
            }
          }

          // Save verification details
          userExist.approved = true;
          userExist.status = 1;
          userExist.rejectedDate = null;
          await userExist.save();

          // If user is not approved yet, send email and update user's approved status
          var mailStatus = await sendEmail(userExist.name, email);
          var mailresponse = (mailStatus === true) ? "sent" : "NA";
          var _details = grantedStatus == "SUCCESS" ? _details = polygonLink : _details = "";

          // Respond with success message indicating user approval
          res.json({
            status: "SUCCESS",
            email: mailresponse,
            grant: grantedStatus,
            message: messageCode.msgIssuerApproveSuccess,
            details: _details
          });
        }

      } else if (validationStatus == 2 && roleStatus === true) {

        if ((userExist.status == validationStatus) && (roleStatus == false)) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgExistRejectIssuer });
        }

        var revokedStatus;
        if (roleStatus === true) {
          try {
            var tx = await newContract.revokeRole(process.env.ISSUER_ROLE, userExist.issuerId);
            revokedStatus = "SUCCESS";
            var txHash = tx.hash;
            var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;
          } catch (error) {
            revokedStatus = "FAILED";
            if (error.reason) {
              // Extract and handle the error reason
              console.log("Error reason:", error.reason);
              return res.status(400).json({ status: "FAILED", message: error.reason });
            } else {
              // If there's no specific reason provided, handle the error generally
              console.error(messageCode.msgFailedOpsAtBlockchain, error);
              return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain });
            }
          }

          // Save Issuer rejected details
          userExist.approved = false;
          userExist.status = 2;
          userExist.rejectedDate = Date.now();
          await userExist.save();

          // If user is not rejected yet, send email and update user's rejected status
          var mailStatus = await rejectEmail(userExist.name, email);
          var mailresponse = (mailStatus === true) ? "sent" : "NA";
          var _details = revokedStatus == "SUCCESS" ? _details = polygonLink : _details = "";

          // Respond with success message indicating user rejected
          res.json({
            status: "SUCCESS",
            email: mailresponse,
            revoke: revokedStatus,
            message: messageCode.msgIssuerRejectSuccess,
            details: _details
          });
        }
      } else if (validationStatus == 1 && roleStatus === true) {
        res.json({
          status: "SUCCESS",
          message: messageCode.msgIssuerApproveSuccess
        });
      }
    } catch (error) {
      // Error occurred during user approval process, respond with failure message
      return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
    }
  } catch (error) {
    // Error occurred during user approval process, respond with failure message
    res.json({
      status: 'FAILED',
      message: messageCode.msgIssueInValidation,
      details: error
    });
  }
};

/**
 * API to Grant Issuer/Owner Role to an Address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const addTrustedOwner = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  // const { newOwnerAddress } = req.body;
  try {
    // Extract new wallet address from request body
    const assignRole = 1;
    const newAddress = req.body.address;

    // Validate Ethereum address format
    if (!ethers.isAddress(newAddress)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
    }

    if (assignRole == 0 || assignRole == 1) {

      const assigningRole = (assignRole == 0) ? process.env.ADMIN_ROLE : process.env.ISSUER_ROLE;

      try {
        // Blockchain processing.
        const response = await newContract.hasRole(assigningRole, newAddress);

        if (response === true) {
          // Simulation failed, send failure response
          return res.status(400).json({ status: "FAILED", message: messageCode.msgAddressExistBlockchain });
        }

        try {
          const tx = await newContract.grantRole(assigningRole, newAddress);
          var txHash = tx.hash;
        } catch (error) {
          // Handle the error During the transaction
          if (error.reason) {
            // Extract and handle the error reason
            console.log("Error reason:", error.reason);
            return res.status(400).json({ status: "FAILED", message: error.reason });
          } else {
            // If there's no specific reason provided, handle the error generally
            console.error(messageCode.msgFailedOpsAtBlockchain, error);
            return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain });
          }
        }

        const messageInfo = (assignRole == 0) ? messageCode.msgAdminGrant : messageCode.msgIssuerRoleGrant;

        // Prepare success response
        const responseMessage = {
          status: "SUCCESS",
          message: messageInfo,
          details: `https://${process.env.NETWORK}/tx/${txHash}`
        };

        // Send success response
        res.status(200).json(responseMessage);
      } catch (error) {
        // Error occurred during user approval process, respond with failure message
        return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }
    }
  } catch (error) {
    // Internal server error occurred, send failure response
    console.error(error);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * API to Revoke Issuer/Owner Role from the Address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const removeTrustedOwner = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  // const { newOwnerAddress } = req.body;
  try {
    // Extract new wallet address from request body
    const assignRole = 1;
    const newAddress = req.body.address;

    // Check if the target address is a valid Ethereum address
    if (!ethers.isAddress(newAddress)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
    }

    if (assignRole == 0 || assignRole == 1) {

      const assigningRole = (assignRole == 0) ? process.env.ADMIN_ROLE : process.env.ISSUER_ROLE;

      try {
        // Blockchain processing.
        const response = await newContract.hasRole(assigningRole, newAddress);

        if (response === false) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgAddressNotExistBlockchain });
        }

        try {
          const tx = await newContract.revokeRole(assigningRole, newAddress);

          var txHash = tx.hash;

        } catch (error) {
          // Handle the error During the transaction
          if (error.reason) {
            // Extract and handle the error reason
            console.log("Error reason:", error.reason);
            return res.status(400).json({ status: "FAILED", message: error.reason });
          } else {
            // If there's no specific reason provided, handle the error generally
            console.error(messageCode.msgFailedOpsAtBlockchain, error);
            return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain });
          }
        }

        const messageInfo = (assignRole == 0) ? messageCode.msgAdminRevoke : messageCode.msgIssuerRoleRevoke;

        // Prepare success response
        const responseMessage = {
          status: "SUCCESS",
          message: messageInfo,
          details: `https://${process.env.NETWORK}/tx/${txHash}`
        };
        // Send success response
        res.status(200).json(responseMessage);
      } catch (error) {
        // Error occurred during user approval process, respond with failure message
        return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }
    }
  } catch (error) {
    // Internal server error occurred, send failure response
    console.error(error);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * API to Check the balance of an Ethereum account address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const checkBalance = async (req, res) => {

  try {
    // Extract the target address from the query parameter
    const targetAddress = req.query.address;

    // Check if the target address is a valid Ethereum address
    if (!ethers.isAddress(targetAddress)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
    }

    // Get the balance of the target address in Wei
    const balanceWei = await fallbackProvider.getBalance(targetAddress);

    // Convert balance from Wei to Ether
    const balanceEther = ethers.formatEther(balanceWei);

    // Convert balanceEther to fixed number of decimals (e.g., 2 decimals)
    const fixedDecimals = parseFloat(balanceEther).toFixed(3);

    // Prepare balance response
    const balanceResponse = {
      message: messageCode.msgBalanceCheck,
      balance: fixedDecimals,
    };

    // Respond with the balance information
    res.status(200).json(balanceResponse);
  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

module.exports = {
  // Function to generate a Polygon link for a certificate
  polygonLink,

  // Function to Approve or Reject the Issuer
  validateIssuer,

  // Function to grant role to an address
  addTrustedOwner,

  // Function to revoke role from the address
  removeTrustedOwner,

  // Function to check the balance of an Ethereum address
  checkBalance
};
