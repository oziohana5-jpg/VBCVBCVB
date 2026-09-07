const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 80;

// Serve compressed .br and .gz Unity WebGL files correctly
app.use((req, res, next) => {
  // Brotli compressed Unity files
  if (req.url.endsWith('.js.br') || req.url.endsWith('.wasm.br') || req.url.endsWith('.data.br')) {
    res.setHeader('Content-Encoding', 'br');
    if (req.url.endsWith('.js.br')) res.setHeader('Content-Type', 'application/javascript');
    if (req.url.endsWith('.wasm.br')) res.setHeader('Content-Type', 'application/wasm');
    if (req.url.endsWith('.data.br')) res.setHeader('Content-Type', 'application/octet-stream');
  }
  // Gzip compressed Unity files
  if (req.url.endsWith('.js.gz') || req.url.endsWith('.wasm.gz') || req.url.endsWith('.data.gz')) {
    res.setHeader('Content-Encoding', 'gzip');
    if (req.url.endsWith('.js.gz')) res.setHeader('Content-Type', 'application/javascript');
    if (req.url.endsWith('.wasm.gz')) res.setHeader('Content-Type', 'application/wasm');
    if (req.url.endsWith('.data.gz')) res.setHeader('Content-Type', 'application/octet-stream');
  }
  next();
});

// Enable gzip compression for all other responses
app.use(compression());

// Serve the WebGL build folder as static files
// Place your Unity WebGL build output inside: webgl-server/public/
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    // Allow cross-origin isolation required by Unity WebGL
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
}));

// Fallback: serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running at http://thejews.duckdns.org`);
  console.log(`   Local address: http://localhost:${PORT}\n`);
});
