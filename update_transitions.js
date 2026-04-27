const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/HomePage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/transition=\{\{ delay: ([0-9.]+) \}\}/g, 'transition={{ duration: 1.2, delay: $1, ease: [0.22, 1, 0.36, 1] }}');
content = content.replace(/transition=\{\{ duration: ([0-9.]+), delay: ([0-9.]+) \}\}/g, 'transition={{ duration: $1, delay: $2, ease: [0.22, 1, 0.36, 1] }}');
content = content.replace(/transition=\{\{ duration: ([0-9.]+) \}\}/g, 'transition={{ duration: $1, ease: [0.22, 1, 0.36, 1] }}');
content = content.replace(/transition=\{\{ delay: i \* ([0-9.]+) \}\}/g, 'transition={{ duration: 1.2, delay: i * $1, ease: [0.22, 1, 0.36, 1] }}');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated HomePage.tsx transitions');
