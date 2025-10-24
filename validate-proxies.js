/**
 * Validate Proxies Script
 * Kiểm tra và kích hoạt tất cả proxies trong database
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const DB_PATH = path.join(__dirname, 'data', 'tool-live.db');

// Test URL (YouTube homepage - fast response)
const TEST_URL = 'https://www.youtube.com';
const TIMEOUT = 10000; // 10 seconds per proxy

/**
 * Validate a single proxy
 */
async function validateProxy(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    let agent;

    if (url.protocol === 'socks5:' || url.protocol === 'socks4:') {
      agent = new SocksProxyAgent(proxyUrl);
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      agent = new HttpsProxyAgent(proxyUrl);
    } else {
      throw new Error(`Unsupported protocol: ${url.protocol}`);
    }

    const startTime = Date.now();
    const response = await axios.get(TEST_URL, {
      httpsAgent: agent,
      httpAgent: agent,
      timeout: TIMEOUT,
      validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx
    });
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      responseTime,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main validation function
 */
async function validateAllProxies() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 PROXY VALIDATION TOOL');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Load database
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(dbBuffer);

  // Get all proxies
  const result = db.exec(`
    SELECT id, proxy_url, status, success_count, fail_count
    FROM proxies
    ORDER BY id
  `);

  if (!result.length || !result[0].values.length) {
    console.log('❌ No proxies found in database!\n');
    console.log('💡 Run: node add-proxies.js\n');
    db.close();
    return;
  }

  const proxies = result[0].values.map(row => ({
    id: row[0],
    proxy_url: row[1],
    status: row[2],
    success_count: row[3],
    fail_count: row[4],
  }));

  console.log(`📋 Found ${proxies.length} proxies to validate\n`);
  console.log('⏳ Testing proxies (10s timeout per proxy)...\n');

  let validatedCount = 0;
  let activeCount = 0;
  let failedCount = 0;

  // Validate each proxy
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[i];
    const progress = `[${i + 1}/${proxies.length}]`;
    
    process.stdout.write(`${progress} Testing ${proxy.proxy_url}... `);

    const testResult = await validateProxy(proxy.proxy_url);

    if (testResult.success) {
      // Update to active status
      db.run(`
        UPDATE proxies 
        SET status = 'active',
            success_count = success_count + 1
        WHERE id = ?
      `, [proxy.id]);

      console.log(`✅ ACTIVE (${testResult.responseTime}ms)`);
      activeCount++;
    } else {
      // Update to failed status
      db.run(`
        UPDATE proxies 
        SET status = 'failed',
            fail_count = fail_count + 1
        WHERE id = ?
      `, [proxy.id]);

      console.log(`❌ FAILED (${testResult.error.substring(0, 50)}...)`);
      failedCount++;
    }

    validatedCount++;
  }

  // Save updated database
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  db.close();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Validated: ${validatedCount}`);
  console.log(`✅ Active:       ${activeCount} (${((activeCount/validatedCount)*100).toFixed(1)}%)`);
  console.log(`❌ Failed:       ${failedCount} (${((failedCount/validatedCount)*100).toFixed(1)}%)`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (activeCount > 0) {
    console.log(`🎉 SUCCESS! ${activeCount} proxies are now ACTIVE and ready to use!\n`);
    console.log('💡 Next steps:');
    console.log('   1. Run: npm run dev (if not running)');
    console.log('   2. Open the app and start a session');
    console.log('   3. Run: node check-proxy-status.js (to monitor)\n');
  } else {
    console.log('⚠️  WARNING: No proxies passed validation!\n');
    console.log('💡 Suggestions:');
    console.log('   - Fetch fresh proxies: node add-proxies.js');
    console.log('   - Check your internet connection');
    console.log('   - Try different proxy sources\n');
  }
}

// Run validation
validateAllProxies().catch(error => {
  console.error('\n❌ ERROR:', error.message);
  process.exit(1);
});
