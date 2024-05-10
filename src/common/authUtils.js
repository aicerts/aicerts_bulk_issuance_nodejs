const jwt = require('jsonwebtoken');

function generateJwtToken(response) {
    const expiresInMinutes = 60;
    const claims = {
      userType:"Admin",
    };
    try {
    const token = jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET, { expiresIn: `${expiresInMinutes}m` });
    return token;
    } catch (error) {
      console.log("Error occurred while generating JWT token:", error);
      throw error;
    }
  }
 
  module.exports = {
    generateJwtToken,
  };