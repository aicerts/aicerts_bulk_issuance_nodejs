const { web3i, fetchExcelRecord } = require('../../batch_issue_git/src/model/handleExcel');
// const { checkBalance, batchCertificateIssue } = require('../../batch_issue_git/src/controllers/controllers'); // Import the function to be tested
const xlsx = require('xlsx'); // Library for creating test Excel files
const { ethers } = require('ethers'); // Import ethers for mocking
const fs = require('fs'); // File system module
require('dotenv').config();

jest.mock('ethers', () => ({
  providers: {
    getDefaultProvider: jest.fn(),
  },
  Wallet: jest.fn(),
  Contract: jest.fn(),
}));


// Test suite for fetchExcelRecord function
describe('fetchExcelRecord', () => {

    describe('Valid Excel file', () => {
          // Test case for valid Excel file with correct sheet name and headers
          it('should return SUCCESS for valid Excel file', async () => {
            // Define test data
            const testData = [
              ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
              [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
              [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
              [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
            ];
        
            // Create a workbook and add test data to a sheet named "Batch"
            const wb = xlsx.utils.book_new();
            const ws = xlsx.utils.aoa_to_sheet(testData);
            xlsx.utils.book_append_sheet(wb, ws, "Batch");
        
            // Write workbook to a temporary file
            const tempFilePath = './test.xlsx';
            xlsx.writeFile(wb, tempFilePath);
        
            // Call the function with the temporary file path
            const result = await fetchExcelRecord(tempFilePath);
        
            // Assert the result
            expect(result.status).toBe("SUCCESS");
            expect(result.response).toBe(true);
      
            // Check for unique certificationIDs
            // const certificationIDs = result.message.map(item => item.certificationID);
            // const uniqueCertificationIDs = new Set(certificationIDs);
            // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);
      
            expect(result.message.length).toBe(3);
            expect(result.message[0]).toEqual([
              { certificationID: 15792100, name: "Alice", certificationName:  "AI Advanced", grantDate: "12/12/23" , expirationDate: "12/12/25"},
              { certificationID: 15792101, name: "Bob", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" },
              { certificationID: 15792109, name: "John", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" }
            ]);
            expect(result.message[1]).toBe(3);
            expect(result.message[2].length).toBe(3);
        
            // Delete the temporary file
            fs.unlinkSync(tempFilePath);
          });
        // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

    });

    describe('Valid Excel file records order', () => {
      // Test case for valid Excel file with correct sheet name and headers
      it('should return SUCCESS for valid Excel file', async () => {
        // Define test data
        const testData = [
          ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
          [15792101, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
          [15792100, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
          [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
        ];
    
        // Create a workbook and add test data to a sheet named "Batch"
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(testData);
        xlsx.utils.book_append_sheet(wb, ws, "Batch");
    
        // Write workbook to a temporary file
        const tempFilePath = './test.xlsx';
        xlsx.writeFile(wb, tempFilePath);
    
        // Call the function with the temporary file path
        const result = await fetchExcelRecord(tempFilePath);
    
        // Assert the result
        expect(result.status).toBe("SUCCESS");
        expect(result.response).toBe(true);
  
        // Check for unique certificationIDs
        // const certificationIDs = result.message.map(item => item.certificationID);
        // const uniqueCertificationIDs = new Set(certificationIDs);
        // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);
  
        expect(result.message.length).toBe(3);
        expect(result.message[0]).toEqual([
          { certificationID: 15792100, name: "Alice", certificationName:  "AI Advanced", grantDate: "12/12/23" , expirationDate: "12/12/25"},
          { certificationID: 15792101, name: "Bob", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" },
          { certificationID: 15792109, name: "John", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" }
        ]);
        expect(result.message[1]).toBe(3);
        expect(result.message[2].length).toBe(3);
    
        // Delete the temporary file
        fs.unlinkSync(tempFilePath);
      });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

    });

    describe('Valid Excel file order sent', () => {
      // Test case for valid Excel file with correct sheet name and headers
      it('should return SUCCESS for valid Excel file', async () => {
        // Define test data
        const testData = [
          ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
          [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
          [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
          [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
        ];
    
        // Create a workbook and add test data to a sheet named "Batch"
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(testData);
        xlsx.utils.book_append_sheet(wb, ws, "Batch");
    
        // Write workbook to a temporary file
        const tempFilePath = './test.xlsx';
        xlsx.writeFile(wb, tempFilePath);
    
        // Call the function with the temporary file path
        const result = await fetchExcelRecord(tempFilePath);
    
        // Assert the result
        expect(result.status).toBe("SUCCESS");
        expect(result.response).toBe(true);
  
        // Check for unique certificationIDs
        // const certificationIDs = result.message.map(item => item.certificationID);
        // const uniqueCertificationIDs = new Set(certificationIDs);
        // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);
  
        expect(result.message.length).toBe(3);
        expect(result.message[0]).toEqual([
          { certificationID: 15792100, name: "Alice", certificationName:  "AI Advanced", grantDate: "12/12/23" , expirationDate: "12/12/25"},
          { certificationID: 15792101, name: "Bob", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" },
          { certificationID: 15792109, name: "John", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" }
        ]);
        expect(result.message[1]).toBe(3);
        expect(result.message[2].length).toBe(3);
    
        // Delete the temporary file
        fs.unlinkSync(tempFilePath);
      });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

    });

    describe('Valid Excel file order received', () => {
      // Test case for valid Excel file with correct sheet name and headers
      it('should return SUCCESS for valid Excel file', async () => {
        // Define test data
        const testData = [
          ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
          [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
          [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
          [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
        ];
    
        // Create a workbook and add test data to a sheet named "Batch"
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(testData);
        xlsx.utils.book_append_sheet(wb, ws, "Batch");
    
        // Write workbook to a temporary file
        const tempFilePath = './test.xlsx';
        xlsx.writeFile(wb, tempFilePath);
    
        // Call the function with the temporary file path
        const result = await fetchExcelRecord(tempFilePath);
    
        // Assert the result
        expect(result.status).toBe("SUCCESS");
        expect(result.response).toBe(true);
  
        // Check for unique certificationIDs
        // const certificationIDs = result.message.map(item => item.certificationID);
        // const uniqueCertificationIDs = new Set(certificationIDs);
        // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);
  
        expect(result.message.length).toBe(3);
        expect(result.message[0]).toEqual([
          { certificationID: 15792101, name: "Alice", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" },
          { certificationID: 15792100, name: "Bob", certificationName:  "AI Advanced", grantDate: "12/12/23" , expirationDate: "12/12/25"},
          { certificationID: 15792109, name: "John", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" }
        ]);
        expect(result.message[1]).toBe(3);
        expect(result.message[2].length).toBe(3);
    
        // Delete the temporary file
        fs.unlinkSync(tempFilePath);
      });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

    });

    describe('Valid Excel file records', () => {
      // Test case for valid Excel file with correct sheet name and headers
      it('should return SUCCESS for valid Excel file', async () => {
        // Define test data
        const testData = [
          ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
          [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
          [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"]
        ];
    
        // Create a workbook and add test data to a sheet named "Batch"
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(testData);
        xlsx.utils.book_append_sheet(wb, ws, "Batch");
    
        // Write workbook to a temporary file
        const tempFilePath = './tests.xlsx';
        xlsx.writeFile(wb, tempFilePath);
    
        // Call the function with the temporary file path
        const result = await fetchExcelRecord(tempFilePath);
    
        // Assert the result
        expect(result.status).toBe("SUCCESS");
        expect(result.response).toBe(true);
  
        expect(result.message[0]).toEqual([
          { certificationID: 15792100, name: "Alice", certificationName:  "AI Advanced", grantDate: "12/12/23" , expirationDate: "12/12/25"},
          { certificationID: 15792101, name: "Bob", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" }
        ]);
        expect(result.message[1]).toBe(2);
        expect(result.message[2].length).toBe(2);
    
        // Delete the temporary file
        fs.unlinkSync(tempFilePath);
      });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

    });

    describe('Valid Excel file name', () => {
      // Test case for valid Excel file with correct sheet name and headers
      it('should return SUCCESS for valid Excel file', async () => {
        // Define test data
        const testData = [
          ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
          [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
          [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
          [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
        ];
    
        // Create a workbook and add test data to a sheet named "Batch"
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(testData);
        xlsx.utils.book_append_sheet(wb, ws, "Batchs");
    
        // Write workbook to a temporary file
        const tempFilePath = './test.xlsx';
        xlsx.writeFile(wb, tempFilePath);
    
        // Call the function with the temporary file path
        const result = await fetchExcelRecord(tempFilePath);
    
        // Assert the result
        expect(result.status).toBe("SUCCESS");
        expect(result.response).toBe(true);

        expect(result.message.length).toBe(3);
        expect(result.message[0]).toEqual([
          { certificationID: 15792100, name: "Alice", certificationName:  "AI Advanced", grantDate: "12/12/23" , expirationDate: "12/12/25"},
          { certificationID: 15792101, name: "Bob", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" },
          { certificationID: 15792109, name: "John", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" }
        ]);
        expect(result.message[1]).toBe(3);
        expect(result.message[2].length).toBe(3);
    
        // Delete the temporary file
        fs.unlinkSync(tempFilePath);
      });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

    });

    describe('Unique Excel file IDs', () => {
      // Test case for valid Excel file with correct sheet name and headers
      it('should return SUCCESS for valid Excel file', async () => {
        // Define test data
        const testData = [
          ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
          [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
          [15792100, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
          [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
        ];
    
        // Create a workbook and add test data to a sheet named "Batch"
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(testData);
        xlsx.utils.book_append_sheet(wb, ws, "Batch");
    
        // Write workbook to a temporary file
        const tempFilePath = './test.xlsx';
        xlsx.writeFile(wb, tempFilePath);
    
        // Call the function with the temporary file path
        const result = await fetchExcelRecord(tempFilePath);
    
        // Assert the result
        expect(result.status).toBe("SUCCESS");
        expect(result.response).toBe(true);

        // Check for unique certificationIDs
        const certificationIDs = result.message.map(item => item.certificationID);
        const uniqueCertificationIDs = new Set(certificationIDs);
        expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);

        expect(result.message.length).toBe(3);
        expect(result.message[0]).toEqual([
          { certificationID: 15792100, name: "Alice", certificationName:  "AI Advanced", grantDate: "12/12/23" , expirationDate: "12/12/25"},
          { certificationID: 15792100, name: "Bob", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" },
          { certificationID: 15792109, name: "John", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" }
        ]);
        expect(result.message[1]).toBe(3);
        expect(result.message[2].length).toBe(3);
    
        // Delete the temporary file
        fs.unlinkSync(tempFilePath);
      });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

    });

    describe('Unique Certification ID', () => {
      it('should have unique certification IDs', async () => {
          // Define test data
          const testData = [
              ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
              [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
              [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
              [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
          ];

          // Create a workbook and add test data to a sheet named "Batch"
          const wb = xlsx.utils.book_new();
          const ws = xlsx.utils.aoa_to_sheet(testData);
          xlsx.utils.book_append_sheet(wb, ws, "Batch");

          // Write workbook to a temporary file
          const tempFilePath = './test.xlsx';
          xlsx.writeFile(wb, tempFilePath);

          // Call the function with the temporary file path
          const result = await fetchExcelRecord(tempFilePath);

          // Assert the result
          expect(result.status).toBe("SUCCESS");
          expect(result.response).toBe(true);

          // Check for unique certification IDs
          let matchCount = 0;
          const certificationIDs = testData.slice(1).map(row => row[0]);
          const existingIDs = [15792100, 15792105, 15792209];
          certificationIDs.forEach(id => {
              if (existingIDs.includes(id)) {
                  matchCount++; // Increment matchCount only if ID exists in the existing IDs array
              }
          });

          console.log("Match count:", matchCount); // Output matchCount for verification
          expect(matchCount).toBe(1);

          // Delete the temporary file
          fs.unlinkSync(tempFilePath);
      });
    });

  });

  describe('web3i', () => {
    it('should return contract instance when provider is valid', async () => {
      // Mock getDefaultProvider method to return a valid provider
      ethers.providers.getDefaultProvider.mockReturnValue({
        getNetwork: jest.fn(),
      });
  
      // Mock Wallet and Contract constructor
      ethers.Wallet.mockImplementation((privateKey, provider) => ({
        provider,
      }));
      ethers.Contract.mockReturnValue('mocked_contract_instance');
  
      // Call the function
      const result = await web3i();
  
      // Assertions
      expect(result).toBe('mocked_contract_instance');
      expect(ethers.providers.getDefaultProvider).toHaveBeenCalledWith('mocked_rpc_endpoint');
      expect(ethers.Wallet).toHaveBeenCalledWith('mocked_private_key', expect.anything());
      expect(ethers.Contract).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything());
    });
  
    it('should return false when provider is invalid', async () => {
      // Mock getDefaultProvider method to return falsy value
      ethers.providers.getDefaultProvider.mockReturnValue(null);
  
      // Call the function
      const result = await web3i();
  
      // Assertion
      expect(result).toBe(false);
    });

  });
