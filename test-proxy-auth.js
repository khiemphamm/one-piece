/**
 * Quick test authenticated proxies
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PROXY = 'http://usgpkfrl:xjptxq5nd88s@142.111.48.253:7030';
const TEST_URL = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';

async function testProxy() {
  console.log('🚀 Testing authenticated proxy...\n');

  // Parse proxy
  const proxyUrl = new URL(PROXY);
  const proxyHost = `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`;
  const username = decodeURIComponent(proxyUrl.username);
  const password = decodeURIComponent(proxyUrl.password);

  console.log('Proxy:', proxyHost);
  console.log('Username:', username);
  console.log('Password:', '***' + password.slice(-4));
  console.log();

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--proxy-server=${proxyHost}`,
    ],
  });

  const page = await browser.newPage();

  // Authenticate
  await page.authenticate({
    username: username,
    password: password,
  });

  console.log('✅ Authenticated proxy');

  // Navigate
  console.log('📡 Navigating to YouTube...');
  await page.goto(TEST_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  console.log('✅ Page loaded successfully!');
  console.log('🎉 Proxy authentication working!\n');

  // Get page title
  const title = await page.title();
  console.log('Page title:', title);

  await browser.close();
  console.log('\n✅ Test completed successfully!');
}

testProxy().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
