const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const STOCKFISH_CACHE = path.join(DATA_DIR, 'stockfish.js');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(STORE_FILE)) {
  fs.writeFileSync(
    STORE_FILE,
    JSON.stringify({ version: 2, activeProfileId: null, profiles: {} }, null, 2),
    'utf-8'
  );
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function fetchRemote(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'ChessAnalyzerLocalApp/1.0 (contact: local-user)',
            Accept: '*/*'
          }
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchRemote(res.headers.location).then(resolve).catch(reject);
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} ao acessar ${url}`));
            res.resume();
            return;
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        }
      )
      .on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API: Persistent local storage
  if (pathname === '/api/store' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(STORE_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/store' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(STORE_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Same-origin Stockfish WebWorker proxy & local cache
  if (pathname === '/api/stockfish.js' && req.method === 'GET') {
    try {
      if (fs.existsSync(STOCKFISH_CACHE)) {
        const cached = fs.readFileSync(STOCKFISH_CACHE);
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(cached);
        return;
      }
      const stockfishUrl =
        'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';
      const buf = await fetchRemote(stockfishUrl);
      fs.writeFileSync(STOCKFISH_CACHE, buf);
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(buf);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(`console.error("Falha ao baixar Stockfish:", ${JSON.stringify(err.message)});`);
    }
    return;
  }

  // API: Chess.com proxy with User-Agent header
  if (pathname.startsWith('/api/chesscom/') && req.method === 'GET') {
    const targetPath = pathname.replace('/api/chesscom/', '');
    const targetUrl = `https://api.chess.com/pub/${targetPath}`;
    try {
      const buf = await fetchRemote(targetUrl);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(buf);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  let safePath = path.normalize(pathname === '/' ? '/index.html' : pathname);
  safePath = safePath.replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo não encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`♟️  Chess.com Analyzer & Coach rodando com sucesso!`);
  console.log(`👉 Acesse no navegador: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
