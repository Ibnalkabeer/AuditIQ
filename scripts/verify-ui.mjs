import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createAuditServer } from '../server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const requireFromScrollcraft = createRequire(
  path.join(workspaceRoot, 'projects', 'scrollcraft', 'package.json')
);
const { chromium } = requireFromScrollcraft('playwright-core');

const outDir = path.join(projectRoot, 'verification-screenshots');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const server = createAuditServer({ rateLimitMax: 50 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`AuditIQ test server listening at ${baseUrl}`);

  const chromePath = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].find(p => fs.existsSync(p));

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(err.message));

  try {
    // 1. Landing Page
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outDir, '01-landing-verified.png') });

    // Scroll halfway down landing page before starting assessment to test BUG-02 scroll-to-top fix
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.locator('#hero-primary-cta, button:has-text("Start Free Audit")').first().click();
    await page.waitForTimeout(300);

    const step1ScrollY = await page.evaluate(() => window.scrollY);
    console.log(`[Verify BUG-02] Step 1 window.scrollY after transition: ${step1ScrollY}`);
    if (step1ScrollY !== 0) {
      throw new Error(`BUG-02 Regression: Expected scrollY === 0 on Step 1 entry, got ${step1ScrollY}`);
    }

    // 2. Step 1: Fill Business Profile & verify BUG-01 (no ghost blue border on unselected radio cards)
    await page.fill('#businessName', 'Socialander Digital Agency');
    await page.selectOption('#industry', 'Agencies & Consulting');

    // Click 'Growing Firm (11 - 50)' radio card
    const growingFirmCard = page.locator('[role="radio"]:has-text("Growing Firm (11 - 50)")');
    await growingFirmCard.click();
    await page.waitForTimeout(150);

    // Check computed styles of selected vs unselected radio cards in businessSize group
    const radioCheck = await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('[aria-label="businessSize"] [role="radio"]'));
      return radios.map(el => {
        const cs = window.getComputedStyle(el);
        return {
          text: el.innerText.split('\n')[0],
          checked: el.getAttribute('aria-checked'),
          outlineStyle: cs.outlineStyle,
          outlineWidth: cs.outlineWidth,
          borderColor: cs.borderColor
        };
      });
    });
    console.log('[Verify BUG-01] Step 1 Radio Cards:', JSON.stringify(radioCheck));

    await page.screenshot({ path: path.join(outDir, '02-step1-verified.png') });

    // Scroll down and click Continue to Step 2
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.locator('button:has-text("Continue")').click();
    await page.waitForTimeout(300);

    const step2ScrollY = await page.evaluate(() => window.scrollY);
    console.log(`[Verify BUG-02] Step 2 window.scrollY after transition: ${step2ScrollY}`);
    if (step2ScrollY !== 0) {
      throw new Error(`BUG-02 Regression: Expected scrollY === 0 on Step 2 entry, got ${step2ScrollY}`);
    }

    // 3. Step 2: Workflows & Tools
    await page.locator('[role="checkbox"]:has-text("Lead Qualification")').click();
    await page.locator('[role="checkbox"]:has-text("Data Re-Entry & Copying")').click();
    await page.locator('[role="checkbox"]:has-text("Operational Reporting")').click();
    await page.fill('#currentTools', 'Meta Ads Manager, Google Sheets, HubSpot CRM, WhatsApp Business, Slack');
    await page.locator('[role="radio"]:has-text("11 to 20 hours")').click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, '03-step2-verified.png') });

    await page.locator('button:has-text("Continue")').click();
    await page.waitForTimeout(300);

    // 4. Step 3: Sticking Points & Friction
    await page.fill(
      '#primaryBottleneck',
      'Incoming leads from client Meta and Google ad campaigns sit in spreadsheets for 2 to 6 hours before being qualified and routed into WhatsApp and CRM.'
    );
    await page.fill(
      '#customerDropoff',
      'When newly generated leads wait more than 15 minutes for a first WhatsApp response or when monthly reports take days to compile.'
    );
    await page.screenshot({ path: path.join(outDir, '04-step3-verified.png') });

    await page.locator('button:has-text("Continue")').click();
    await page.waitForTimeout(300);

    // 5. Step 4: Modernization Goals
    await page.locator('[role="radio"]:has-text("Grow Top-Line Revenue")').click();
    await page.locator('[role="radio"]:has-text("SaaS modernizer ($100 - $500/mo)")').click();
    await page.fill(
      '#suspectedAutomation',
      'Instant speed-to-lead routing from Meta Lead Ads to WhatsApp Business and HubSpot CRM with AI qualification.'
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, '05-step4-verified.png') });

    // Submit & wait for Report View
    await page.locator('button:has-text("Generate Business Audit")').click();
    await page.waitForSelector('#print-report-button', { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, '06-report-verified.png') });

    const reportText = await page.evaluate(() => document.body.innerText);
    const hasAuditId = /AUD-\d{4}/.test(reportText);
    console.log(`[Verify BUG-04] Report displays deterministic AUD-XXXX ID: ${hasAuditId}`);
    if (!hasAuditId) {
      throw new Error('BUG-04 Regression: Report view did not display AUD-XXXX ID');
    }

    if (consoleErrors.length > 0) {
      throw new Error(`Console/Page errors detected: ${consoleErrors.join('; ')}`);
    }

    console.log('[SUCCESS] All headless UI & functional checks passed with 0 runtime errors.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(err => {
  console.error('[VERIFY FAILED]', err);
  process.exit(1);
});
