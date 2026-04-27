import https from 'https';

https.get('https://www.luxardofashion.in/', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const matches = data.match(/href=["'][^"']*(instagram|facebook|twitter|x\.com)[^"']*["']/gi);
    console.log(matches);
  });
});
