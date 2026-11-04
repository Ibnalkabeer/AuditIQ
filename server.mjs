import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAndSanitizeAnswers } from './src/validation.mjs';
import { generateAuditReport } from './src/engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

// Automatically load .env from projects/auditiq/.env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Applies strict security headers (SEC-01) and suppresses X-Powered-By.
 */
function applySecurityHeaders(res) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
}

/**
 * Reads JSON request body with a strict 32KB byte limit (SEC-03).
 */
function readJsonBody(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks = [];
    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        reject(Object.assign(new Error('Payload Too Large'), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('Malformed JSON body'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Creates a hardened AuditIQ HTTP server instance.
 */
export function createAuditServer(options = {}) {
  const rateLimitMax = options.rateLimitMax ?? 15;
  const rateLimitWindowMs = options.rateLimitWindowMs ?? 15 * 60 * 1000;
  const ipBuckets = new Map();

  function checkRateLimit(ip) {
    const now = Date.now();
    const bucket = ipBuckets.get(ip) || [];
    const active = bucket.filter(ts => now - ts < rateLimitWindowMs);
    if (active.length >= rateLimitMax) {
      ipBuckets.set(ip, active);
      return false;
    }
    active.push(now);
    ipBuckets.set(ip, active);
    return true;
  }

  const server = http.createServer(async (req, res) => {
    applySecurityHeaders(res);

    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    // Health check endpoint
    if (req.method === 'GET' && pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok', service: 'AuditIQ', version: '2.0.0' }));
      return;
    }

    // Core AuditIQ Diagnostic Generation Endpoint
    if (req.method === 'POST' && pathname === '/api/generate-audit') {
      const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
        .toString()
        .split(',')[0]
        .trim();

      if (!checkRateLimit(clientIp)) {
        res.writeHead(429, {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': String(Math.ceil(rateLimitWindowMs / 1000))
        });
        res.end(
          JSON.stringify({
            success: false,
            reason: 'rate_limit',
            error: 'Too many diagnostic requests from this IP. Please wait a few minutes and try again.'
          })
        );
        return;
      }

      try {
        const body = await readJsonBody(req, 32 * 1024);
        const validation = validateAndSanitizeAnswers(body?.answers);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              success: false,
              reason: 'validation_error',
              error: validation.error
            })
          );
          return;
        }

        const report = await generateAuditReport(validation.answers);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            auditId: report.auditId,
            data: report
          })
        );
      } catch (err) {
        const code = err.statusCode || 500;
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: false,
            reason: code === 413 ? 'payload_too_large' : 'server_error',
            error: err.message || 'Internal diagnostic server error'
          })
        );
      }
      return;
    }

    // Static file serving with path-traversal protection
    if (req.method === 'GET' || req.method === 'HEAD') {
      let safeRel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let candidate = path.resolve(publicDir, safeRel);
      if (!candidate.startsWith(publicDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
        // SPA history fallback for /assessment/step-1, /report, etc.
        candidate = path.join(publicDir, 'index.html');
      }

      if (fs.existsSync(candidate)) {
        const ext = path.extname(candidate).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        if (req.method === 'HEAD') {
          res.end();
        } else {
          fs.createReadStream(candidate).pipe(res);
        }
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

// Start server directly when invoked via `node server.mjs`
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const port = Number(process.env.PORT || 4650);
  const srv = createAuditServer();
  srv.listen(port, '127.0.0.1', () => {
    console.log(`AuditIQ v2.0.0 running at http://localhost:${port}`);
  });
}
