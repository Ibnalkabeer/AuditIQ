/**
 * AuditIQ Input Validation & Prompt-Injection Sanitization Module (SEC-02)
 */

const ALLOWED_SIZES = new Set(['solo', '1', '2-10', '11-50', '50+', '51-200', '200-plus']);
const ALLOWED_YEARS = new Set(['under-1', '1-3', '4-9', '10-plus']);
const ALLOWED_ADMIN_HOURS = new Set(['under-5', '5-10', '11-20', '20-plus', '21-40', '40-plus']);
const ALLOWED_GOALS = new Set(['save-time', 'reduce-costs', 'grow-revenue', 'improve-ux', 'scale', 'scale-ops']);
const ALLOWED_BUDGETS = new Set(['minimal', 'low', 'moderate', 'aggressive', 'high', 'unsure']);

/**
 * Strips control characters, HTML/script tags, and prompt-injection delimiters,
 * then enforces a strict character length cap.
 */
export function sanitizeText(value, maxLength = 400) {
  if (typeof value !== 'string') return '';
  return value
    // Remove ASCII control characters except standard whitespace (\t, \n, \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Strip LLM special tokens and role delimiters
    .replace(/<\|[^|]*\|>/g, '')
    .replace(/```\s*(system|assistant|developer|user)/gi, '')
    .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions/gi, '[filtered]')
    // Strip HTML/script tags to prevent stored/reflected XSS in generated PDFs/views
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates and sanitizes an incoming AssessmentAnswers payload.
 */
export function validateAndSanitizeAnswers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Invalid answers payload: expected JSON object.' };
  }

  const businessName = sanitizeText(raw.businessName, 120);
  const industry = sanitizeText(raw.industry, 100);
  const currentTools = sanitizeText(raw.currentTools, 400);
  const primaryBottleneck = sanitizeText(raw.primaryBottleneck, 600);
  const customerDropoff = sanitizeText(raw.customerDropoff, 600);
  const suspectedAutomation = sanitizeText(raw.suspectedAutomation, 600);

  if (!businessName || !industry || !currentTools || !primaryBottleneck || !customerDropoff) {
    return {
      valid: false,
      error: 'Missing required assessment fields (businessName, industry, currentTools, primaryBottleneck, or customerDropoff).'
    };
  }

  const businessSize = ALLOWED_SIZES.has(raw.businessSize) ? raw.businessSize : '2-10';
  const yearsInOperation = ALLOWED_YEARS.has(raw.yearsInOperation) ? raw.yearsInOperation : '1-3';
  const repetitiveAdminHours = ALLOWED_ADMIN_HOURS.has(raw.repetitiveAdminHours) ? raw.repetitiveAdminHours : '5-10';
  const primaryGoal90Days = ALLOWED_GOALS.has(raw.primaryGoal90Days) ? raw.primaryGoal90Days : 'save-time';
  const budgetOpenness = ALLOWED_BUDGETS.has(raw.budgetOpenness) ? raw.budgetOpenness : 'moderate';

  const manualWorkflows = Array.isArray(raw.manualWorkflows)
    ? raw.manualWorkflows
        .map(item => sanitizeText(String(item), 80))
        .filter(Boolean)
        .slice(0, 12)
    : ['customer follow-up', 'data entry'];

  if (manualWorkflows.length === 0) {
    return { valid: false, error: 'At least one manual workflow is required.' };
  }

  const defaultPainPoints = [
    'Slow response times',
    'Dropped leads',
    'Manual reporting',
    'Missed follow-ups',
    'Staff overload',
    'Inconsistent quality'
  ];

  const painPointRanking = Array.isArray(raw.painPointRanking) && raw.painPointRanking.length > 0
    ? raw.painPointRanking
        .map(item => sanitizeText(String(item), 80))
        .filter(Boolean)
        .slice(0, 10)
    : defaultPainPoints;

  return {
    valid: true,
    answers: {
      businessName,
      industry,
      businessSize,
      yearsInOperation,
      manualWorkflows,
      currentTools,
      repetitiveAdminHours,
      primaryBottleneck,
      painPointRanking,
      customerDropoff,
      primaryGoal90Days,
      budgetOpenness,
      suspectedAutomation
    }
  };
}
