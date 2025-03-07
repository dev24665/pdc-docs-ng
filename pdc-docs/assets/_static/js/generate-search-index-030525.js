const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '../../../app');
const outputFilePath = path.join(__dirname, '../searchindex.js');

// Define the file extensions you want to include in the search index
const includedExtensions = ['.html', '.json'];

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath, callback);
    } else {
      // Check if the file extension is in the includedExtensions array
      if (includedExtensions.includes(path.extname(file))) {
        callback(filePath);
      }
    }
  });
}

const searchIndex = {
  _index: {
    alltitles: {},
    docnames: [],
    excerpts: {}
  }
};

walkDir(appDir, filePath => {
  const relativePath = path.relative(appDir, filePath);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, path.extname(filePath));

  searchIndex._index.alltitles[fileName] = [[searchIndex._index.docnames.length, null]];
  searchIndex._index.docnames.push(relativePath);

  // Extract an excerpt from the file content
  const excerpt = extractExcerpt(fileContent);
  searchIndex._index.excerpts[fileName] = excerpt;

  // Optionally, you can add more content-based indexing here
});

function extractExcerpt(content) {
  // Use a regular expression to extract text from header tags
  const headerTags = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi);
  let textContent = '';

  if (headerTags) {
    headerTags.forEach(tag => {
      // Remove HTML tags from the header content
      const text = tag.replace(/<\/?[^>]+(>|$)/g, "");
      textContent += text + ' ';
    });
  }

  // Extract the first 200 characters as an excerpt
  return textContent.trim().substring(0, 200) + '...';
}

const searchIndexContent = `var Search1 = ${JSON.stringify(searchIndex)};`;
fs.writeFileSync(outputFilePath, searchIndexContent, 'utf-8');

console.log('Search index generated successfully.');