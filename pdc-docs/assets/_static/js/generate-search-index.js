const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, 'pdc-docs/src/app');
const outputFilePath = path.join(__dirname, 'pdc-docs/src/assets/_static/searchindex.js');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath, callback);
    } else {
      callback(filePath);
    }
  });
}

const searchIndex = {
  _index: {
    alltitles: {},
    docnames: []
  }
};

walkDir(appDir, filePath => {
  const relativePath = path.relative(appDir, filePath);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, path.extname(filePath));

  searchIndex._index.alltitles[fileName] = [[searchIndex._index.docnames.length, null]];
  searchIndex._index.docnames.push(relativePath);

  // Optionally, you can add more content-based indexing here
});

const searchIndexContent = `var Search1 = ${JSON.stringify(searchIndex)};`;
fs.writeFileSync(outputFilePath, searchIndexContent, 'utf-8');

console.log('Search index generated successfully.');