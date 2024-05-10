// Import the jsonwebtoken library for JWT token handling
const jwt = require("jsonwebtoken");

// Middleware function to ensure authentication using JWT token
module.exports.ensureAuthenticated = (req, res, next) => {
    try{
    // Extract the authorization header from the request
    const authorizationHeader = req.headers["authorization"];

    // Check if the authorization header is missing
    if (!authorizationHeader) {
        console.log("No authorization header found");
        // Send a 401 Unauthorized response if no token is provided
        return res.status(401).send({ status: false, err: "Unauthorized access. No token provided." });
    }

    // Split the authorization header into "Bearer" and the token
    const [bearer, token] = authorizationHeader.split(' ');

    // Check if the token or bearer is missing or if the bearer format is invalid
    if (!token || bearer.toLowerCase() !== 'bearer') {
        console.log("Invalid authorization header format");
        // Send a 401 Unauthorized response if the token format is invalid
        return res.status(401).send({ status: false, err: "Unauthorized access. Invalid token format." });
    }

    // Verify the JWT token using the secret key
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        // Check for errors during token verification
        if (err) {
            console.log("JWT token error: ", err);
            // Send a 401 Unauthorized response if the token is invalid
            return res.status(401).send({ status: false, err: "Unauthorized access. Invalid token." });
        }
        // If the token is valid, call the next middleware or route handler
        next();
    });
    } catch (error) {
        console.error("Error in ensureAuthenticated middleware:", error);
        return res.status(500).send({ status: false, err: "Internal server error." });
    }
};

