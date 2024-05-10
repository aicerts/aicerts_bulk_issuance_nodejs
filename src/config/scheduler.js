// Load environment variables from a .env file into process.env
require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Import the mongoose library for MongoDB interaction
const mongoose = require("mongoose");

// Import the issuer model from the schema defined in "./schema"
const { User } = require("./schema");

// Parse environment variables for days to be deleted
const schedule_days = parseInt(process.env.SCHEDULE_DAYS);

const MONGODB_OPTIONS = {
  connectTimeoutMS: 6000000
  // Add more MongoDB connection options as needed
};

// Function to connect to MongoDB with retry logic
const connectWithRetry = async () => {

  return mongoose.connect(process.env.MONGODB_URI, MONGODB_OPTIONS)
    .then(() => {
      // console.log("DB Connected & Scheduler initialised");
    })
    .catch((err) => {
      console.error("Error connecting to MongoDB:", err.message);
      console.log("Retrying connection in 5 seconds...");
      setTimeout(connectWithRetry, 5000); // Retry connection after 5 seconds
    });
};

try {
  // Load environment variables from the .env file
  if (!process.env.MONGODB_URI || !process.env.SCHEDULE_DAYS) {
    throw new Error("Required environment variables are missing.");
  }

  // Connect to MongoDB using the MONGODB_URI environment variable
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      // Connect to MongoDB
      connectWithRetry();
      createUploadsFolder();
      // Schedule the task to run every day at midnight
      cron.schedule('0 0 * * *', async () => {

        try {
          // Calculate the date scheduled days ago
          const scheduledDaysAgo = new Date();
          scheduledDaysAgo.setDate(scheduledDaysAgo.getDate() - schedule_days);

          const thresholdDate = new Date(scheduledDaysAgo);

          // Find records with rejectedDate older than scheduledDaysAgo
          const usersToDelete = await User.find({
            //  $and : [{ rejectedDate: { $lt: thresholdDate }, approved: {$ne: true}}]
            rejectedDate: { $lt: thresholdDate }
          });

          // Delete the users
          for (const user of usersToDelete) {
            // Ensure that user is a mongoose model instance
            if (user instanceof mongoose.Model) {
              await User.findByIdAndDelete(user._id);
              console.log(`Deleted user with rejectedDate older than ${schedule_days} days: ${user}`);
            } else {
              console.log(`Skipping user deletion. Not a valid Mongoose model instance: ${user}`);
            }
          }
        } catch (error) {
          console.error('Error deleting old records:', error);
        }
      });
      console.log("DB Connected & Scheduler initialised"); // Log a message when the connection is successful
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err); // Log an error if the connection fails
      process.exit(1);
    });
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
};

const createUploadsFolder = async () => {

  try {
    const folderPath = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
      console.log("Uploads folder created successfully.");
    } else {
      console.log("Uploads folder already exists.");
    }
  } catch (error) {
    console.error("Error creating uploads folder:", error);
  }
};