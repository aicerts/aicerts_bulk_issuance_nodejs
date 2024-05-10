const crypto = require('crypto');
require('dotenv').config();

/**
 * Encrypts the provided data using AES-256-CBC encryption.
 *
 * @param {string} data - The data to be encrypted.
 * @returns {Object} An object containing the encrypted data and initialization vector (IV).
 */
function encryptData(data) {
    try{
        // Load the encryption key from environment variables
        const key = Buffer.from(process.env.KEY_HEX_STRING, 'hex');
        
        // Generate a random Initialization Vector (IV)
        const iv = crypto.randomBytes(16); // Initialization Vector, 128 bits for AES
        
        // Create a cipher using AES-256-CBC algorithm
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        // Encrypt the data
        let encryptedData = cipher.update(data, 'utf-8', 'base64');
        encryptedData += cipher.final('base64');
        
        // Return both the encrypted data and the IV for later decryption
        return {
            encryptedData,
            iv: iv.toString('base64')
        };
    } catch (error) {
        console.error("Encryption error:", error.message);
        return null;
    }
}

/**
 * Decrypts the provided encrypted data and IV using AES-256-CBC decryption.
 *
 * @param {string} encryptedDataAndIV - The combined string of encrypted data and IV.
 * @returns {string|null} The decrypted data, or null if decryption fails.
 */
function decryptData(encryptedData, iv) {
    try {
        // Load the encryption key from environment variables
        const key = Buffer.from(process.env.KEY_HEX_STRING, 'hex');

        if (!encryptedData) {
            throw new Error("Encrypted data is undefined");
        }

        // Create a decipher using AES-256-CBC algorithm
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));

        // Decrypt the data
        let decryptedData = decipher.update(encryptedData, 'base64', 'utf-8');
        decryptedData += decipher.final('utf-8');

        // Return the decrypted data
        return decryptedData;
    } catch (error) {
        // Handle decryption errors
        console.error("Decryption error:", error.message);
        return null;
    }
}

/**
 * Generates an encrypted URL containing the encrypted data and IV.
 *
 * @param {Object} data - The data to be encrypted and included in the URL.
 * @returns {string} The generated encrypted URL.
 */
function generateEncryptedUrl(data) {
    try{
        // Encrypt the data and retrieve the encrypted data and IV
        const { encryptedData, iv } = encryptData(JSON.stringify(data));
        
        // Implement the logic to generate the encrypted URL
        const encryptedUrl = process.env.ENCRYPTED_URL + encodeURIComponent(encryptedData) + '&iv=' + encodeURIComponent(iv);
        
        return encryptedUrl;
    } catch (error) {
        console.error("URL generation error:", error.message);
        return null;
    }
}

// Export the functions for use in other modules
module.exports = {
    encryptData,
    decryptData,
    generateEncryptedUrl
};
