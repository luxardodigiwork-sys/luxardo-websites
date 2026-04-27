const fs = require('fs');
const https = require('https');

https.get('https://open.er-api.com/v6/latest/INR', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const rates = JSON.parse(data).rates;
    
    let content = fs.readFileSync('src/countries.ts', 'utf8');
    
    // Let's just generate the specificData string and replace it properly.
    const countryToCurrency = require('country-to-currency');
    
    let newSpecificData = 'const specificData: Record<string, Partial<Country>> = {\n';
    
    const match = content.match(/const countryData = \[([\s\S]*?)\];/);
    if (match) {
      const countryDataStr = match[1];
      const lines = countryDataStr.split('\n');
      for (const line of lines) {
        const codeMatch = line.match(/code:\s*"([A-Z]{2})"/);
        const nameMatch = line.match(/name:\s*"([^"]+)"/);
        if (codeMatch && nameMatch) {
          const code = codeMatch[1];
          const name = nameMatch[1];
          const currencyCode = countryToCurrency[code] || 'INR';
          const rate = rates[currencyCode] || 1;
          
          let symbol = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).formatToParts(0).find(x => x.type === 'currency').value;
          
          newSpecificData += `  "${name}": { code: '${code}', currency: { code: '${currencyCode}', symbol: '${symbol}', rate: ${rate} } },\n`;
        }
      }
    }
    
    newSpecificData += '};\n';
    
    // Fix the broken file by finding where specificData starts and ALL_COUNTRIES.forEach starts
    const startIdx = content.indexOf('const specificData: Record<string, Partial<Country>> = {');
    const endIdx = content.indexOf('ALL_COUNTRIES.forEach(country => {');
    
    if (startIdx !== -1 && endIdx !== -1) {
      // Use a function for replacement to avoid $ replacement issues
      content = content.substring(0, startIdx) + newSpecificData + '\n' + content.substring(endIdx);
      fs.writeFileSync('src/countries.ts', content);
      console.log('Fixed and updated countries.ts!');
    } else {
      console.log('Could not find boundaries.');
    }
  });
});
