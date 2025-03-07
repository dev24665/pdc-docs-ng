const fs = require('fs');
const path = require('path');

// Directory containing the JSON files
const jsonDir = path.join(__dirname, 'data-dictionary-json');

// Array to hold the combined data
let combinedData = [];

// Function to read and combine JSON files
const readAndCombineFiles = (dir, callback) => {
    fs.readdir(dir, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }

        let jsonFiles = files.filter(file => path.extname(file) === '.json');
        let filesRead = 0;

        jsonFiles.forEach(file => {
            const filePath = path.join(dir, file);

            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error('Error reading file:', err);
                    return;
                }

                // Parse and add the data to the combined array
                combinedData.push(JSON.parse(data));

                filesRead++;
                if (filesRead === jsonFiles.length) {
                    callback();
                }
            });
        });
    });
};

// Combine the JSON files into one variable
readAndCombineFiles(jsonDir, () => {
    console.log('Combined Data:', combinedData);
});