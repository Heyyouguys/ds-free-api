import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://127.0.0.1:22217';
const OUTPUT_DIR = '/home/dev/.gemini/antigravity-cli/brain/9a4d14c7-625b-4622-a0ba-0a01663204a1/screenshots';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'mobile-portrait', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'tablet-portrait', width: 768, height: 1024, isMobile: false, hasTouch: true },
  { name: 'tablet-landscape', width: 1024, height: 768, isMobile: false, hasTouch: false },
  { name: 'desktop-standard', width: 1280, height: 800, isMobile: false, hasTouch: false },
  { name: 'desktop-fhd', width: 1920, height: 1080, isMobile: false, hasTouch: false },
];

const PAGES = [
  { path: '/admin', name: 'dashboard' },
  { path: '/admin/models', name: 'models' },
  { path: '/admin/config', name: 'config' },
  { path: '/admin/settings', name: 'settings' },
  { path: '/admin/logs', name: 'logs' },
];

async function getAuthToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/admin/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: '111111' }),
  });
  const data = await res.json();
  return data.token;
}

async function run() {
  console.log('🚀 Starting Playwright responsive capture suite...');
  const authToken = await getAuthToken();
  console.log('🔑 Obtained admin token successfully:', authToken.slice(0, 10) + '...');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  for (const vp of VIEWPORTS) {
    console.log(`\n📱 Testing Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    
    // 1. Unauthenticated context for Login Page screenshot
    const unauthContext = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const loginPage = await unauthContext.newPage();
    await loginPage.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await loginPage.waitForTimeout(400);
    await loginPage.screenshot({
      path: path.join(OUTPUT_DIR, `${vp.name}-01-login.png`),
      fullPage: false,
    });
    await unauthContext.close();

    // 2. Authenticated context with real login flow
    const authContext = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const page = await authContext.newPage();
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.locator('input#password, input[type="password"]').fill('111111');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    await page.waitForTimeout(600);

    // 3. Test Each Page
    for (const p of PAGES) {
      console.log(`  📸 Capturing ${p.name} on ${vp.name}...`);
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${vp.name}-02-${p.name}.png`),
        fullPage: false,
      });

      // If on logs, test runtime tab
      if (p.name === 'logs') {
        const runtimeTabBtn = page.locator('button:has-text("Runtime"):visible').first();
        if (await runtimeTabBtn.count() > 0) {
          await runtimeTabBtn.click();
          await page.waitForTimeout(400);
          await page.screenshot({
            path: path.join(OUTPUT_DIR, `${vp.name}-02-logs-runtime.png`),
            fullPage: false,
          });
        }
      }
    }

    // 4. Test Profile Dropdown open state (and click accordion)
    console.log(`  👤 Testing Profile Dropdown on ${vp.name}...`);
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const profileTrigger = page.locator('header button[aria-label="User Profile and Settings"]:visible, aside button[aria-haspopup="menu"]:visible, button[aria-label="User Profile and Settings"]:visible, button[aria-haspopup="menu"]:visible').first();
    if (await profileTrigger.count() > 0) {
      await profileTrigger.click();
      await page.waitForTimeout(300);

      // Expand language accordion inside dropdown
      const langAccordionBtn = page.locator('button:has-text("Language"):visible').first();
      if (await langAccordionBtn.count() > 0) {
        await langAccordionBtn.click();
        await page.waitForTimeout(300);
      }

      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${vp.name}-03-profile-dropdown-open.png`),
        fullPage: false,
      });
    }

    await authContext.close();
  }

  await browser.close();
  console.log('✅ All Playwright responsive screenshots captured successfully!');
}

run().catch((err) => {
  console.error('❌ Playwright run failed:', err);
  process.exit(1);
});
