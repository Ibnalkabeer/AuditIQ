import { validateAndSanitizeAnswers } from '../src/validation.mjs';
import { generateAuditReport } from '../src/engine.mjs';

const ipBuckets = new Map();
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = ipBuckets.get(ip) || [];
  const active = bucket.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (active.length >= RATE_LIMIT_MAX) {
    ipBuckets.set(ip, active);
    return false;
  }
  active.push(now);
  ipBuckets.set(ip, active);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1')
    .toString()
    .split(',')[0]
    .trim();

  if (!checkRateLimit(clientIp)) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    res.status(429).json({
      success: false,
      reason: 'rate_limit',
      error: 'Too many diagnostic requests from this IP. Please wait a few minutes and try again.'
    });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const validation = validateAndSanitizeAnswers(body.answers);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        reason: 'validation_error',
        error: validation.error
      });
      return;
    }

    const report = await generateAuditReport(validation.answers);
    res.status(200).json({
      success: true,
      auditId: report.auditId,
      data: report
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      reason: 'server_error',
      error: err.message || 'Internal diagnostic server error'
    });
  }
}
