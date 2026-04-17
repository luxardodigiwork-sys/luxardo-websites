const https = require('https');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)){
    fs.mkdirSync(publicDir);
}

https.get('https://www.luxardofashion.in/Img/LOGOn.png', (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to get image, status code: ${res.statusCode}`);
    return;
  }
  
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const base64 = buffer.toString('base64');
    const tsContent = `export const LOGO_BASE64 = "data:image/png;base64,${base64}";\n`;
    fs.writeFileSync(path.join(__dirname, 'src', 'components', 'LogoData.ts'), tsContent);
    
    // Also save as a file just in case
    fs.writeFileSync(path.join(publicDir, 'logo.png'), buffer);
    console.log('Logo downloaded and saved as Base64 and file.');
  });
}).on('error', (err) => {
  console.error('Error: ', err.message);
});
