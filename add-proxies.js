/**
 * ADD PROXIES TO DATABASE
 * 
 * Fetches proxies from GitHub and adds them to database
 * Run with: node add-proxies.js
 */

const axios = require('axios');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const PROXY_LIST_URL = 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt';
const DB_PATH = path.join(process.cwd(), 'data', 'tool-live.db');

const CONFIG = {
  proxyCount: 15,              // Number of proxies to add
  maxViewersPerProxy: 5,       // Default max viewers per proxy
};

/**
 * Fetch proxies from GitHub
 */
async function fetchProxies() {
  console.log(`📥 Fetching proxies from GitHub...`);
  const response = await axios.get(PROXY_LIST_URL, { timeout: 15000 });
  
  const proxies = response.data
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .slice(0, CONFIG.proxyCount)
    .map(proxy => `socks5://${proxy}`);
  
  console.log(`✅ Fetched ${proxies.length} proxies\n`);
  return proxies;
}

/**
 * Add proxies to database
 */
async function addProxiesToDatabase(proxies) {
  console.log(`📝 Adding ${proxies.length} proxies to database...`);
  
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  let addedCount = 0;
  let skippedCount = 0;

  for (const proxyUrl of proxies) {
    try {
      // Check if proxy already exists
      const existingResult = db.exec(
        'SELECT id FROM proxies WHERE proxy_url = ?',
        [proxyUrl]
      );
      
      if (existingResult[0]?.values.length > 0) {
        console.log(`   ⏩ Skipped (already exists): ${proxyUrl.substring(0, 50)}...`);
        skippedCount++;
        continue;
      }

      // Insert new proxy
      db.run(
        `INSERT INTO proxies 
         (proxy_url, type, status, fail_count, success_count, max_viewers_per_proxy, current_viewers)
         VALUES (?, 'socks5', 'pending', 0, 0, ?, 0)`,
        [proxyUrl, CONFIG.maxViewersPerProxy]
      );
      
      console.log(`   ✅ Added: ${proxyUrl.substring(0, 50)}...`);
      addedCount++;

    } catch (error) {
      console.log(`   ❌ Failed: ${proxyUrl.substring(0, 50)}... (${error.message})`);
    }
  }

  // Save database
  const data = db.export();
  const newBuffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, newBuffer);
  
  db.close();

  return { addedCount, skippedCount };
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('📦 ADD PROXIES TO DATABASE');
  console.log('='.repeat(70));
  console.log(`\nConfiguration:`);
  console.log(`   Proxy Count: ${CONFIG.proxyCount}`);
  console.log(`   Max Viewers Per Proxy: ${CONFIG.maxViewersPerProxy}`);
  console.log(`   Total Capacity: ${CONFIG.proxyCount * CONFIG.maxViewersPerProxy} viewers\n`);

  try {
    // Check database
    if (!fs.existsSync(DB_PATH)) {
      console.log('❌ Database not found!');
      console.log('   Please run the app first: npm run dev\n');
      process.exit(1);
    }

    // Fetch proxies
    const proxies = await fetchProxies();

    // Add to database
    const { addedCount, skippedCount } = await addProxiesToDatabase(proxies);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ COMPLETED!');
    console.log('='.repeat(70));
    console.log(`\n📊 Summary:`);
    console.log(`   Total Proxies Processed: ${proxies.length}`);
    console.log(`   Added: ${addedCount}`);
    console.log(`   Skipped (already exists): ${skippedCount}`);
    console.log(`   Max Viewers Per Proxy: ${CONFIG.maxViewersPerProxy}`);
    console.log(`   Total Capacity: ${addedCount * CONFIG.maxViewersPerProxy} viewers\n`);

    console.log('💡 Next Steps:');
    console.log('   1. Check status: node check-proxy-status.js');
    console.log('   2. Start viewers: Open Electron app or run demo\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
main();
