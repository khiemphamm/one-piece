/**
 * Replace Proxies Script
 * Xóa proxy cũ và thêm proxy mới với authentication
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'tool-live.db');

// Proxy mới với format: host:port:username:password
const NEW_PROXIES = [
  '142.111.48.253:7030:usgpkfrl:xjptxq5nd88s',
  '31.59.20.176:6754:usgpkfrl:xjptxq5nd88s',
  '38.170.176.177:5572:usgpkfrl:xjptxq5nd88s',
  '198.23.239.134:6540:usgpkfrl:xjptxq5nd88s',
  '45.38.107.97:6014:usgpkfrl:xjptxq5nd88s',
  '107.172.163.27:6543:usgpkfrl:xjptxq5nd88s',
  '64.137.96.74:6641:usgpkfrl:xjptxq5nd88s',
  '216.10.27.159:6837:usgpkfrl:xjptxq5nd88s',
  '142.111.67.146:5611:usgpkfrl:xjptxq5nd88s',
  '142.147.128.93:6593:usgpkfrl:xjptxq5nd88s'
];

const MAX_VIEWERS_PER_PROXY = 5;

/**
 * Parse proxy string to URL format
 */
function parseProxyToUrl(proxyString) {
  const parts = proxyString.split(':');
  
  if (parts.length === 4) {
    // Format: host:port:username:password
    const [host, port, username, password] = parts;
    return `http://${username}:${password}@${host}:${port}`;
  } else if (parts.length === 2) {
    // Format: host:port (no auth)
    const [host, port] = parts;
    return `http://${host}:${port}`;
  } else {
    throw new Error(`Invalid proxy format: ${proxyString}`);
  }
}

async function replaceProxies() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔄 REPLACE PROXIES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Load database
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(dbBuffer);

  // Count old proxies
  const oldCountResult = db.exec('SELECT COUNT(*) FROM proxies');
  const oldCount = oldCountResult[0]?.values[0]?.[0] || 0;

  console.log(`📊 Old proxies in database: ${oldCount}`);

  // Delete all old proxies
  db.run('DELETE FROM proxies');
  console.log('🗑️  Deleted all old proxies\n');

  console.log(`📥 Adding ${NEW_PROXIES.length} new proxies with authentication...\n`);

  let addedCount = 0;
  let errorCount = 0;

  // Add new proxies
  for (const proxyString of NEW_PROXIES) {
    try {
      const proxyUrl = parseProxyToUrl(proxyString);
      const parts = proxyString.split(':');
      const displayUrl = `${parts[0]}:${parts[1]}`;

      db.run(`
        INSERT INTO proxies (
          proxy_url, 
          type, 
          status, 
          max_viewers_per_proxy, 
          current_viewers,
          success_count,
          fail_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        proxyUrl,
        'http',
        'pending',
        MAX_VIEWERS_PER_PROXY,
        0,
        0,
        0
      ]);

      console.log(`   ✅ Added: ${displayUrl} (with auth)`);
      addedCount++;
    } catch (error) {
      console.log(`   ❌ Error: ${proxyString} - ${error.message}`);
      errorCount++;
    }
  }

  // Save database
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  db.close();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ COMPLETED!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Added: ${addedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Max Viewers Per Proxy: ${MAX_VIEWERS_PER_PROXY}`);
  console.log(`Total Capacity: ${addedCount * MAX_VIEWERS_PER_PROXY} viewers`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('💡 Next Step: Validate proxies');
  console.log('   Run: node validate-proxies.js\n');
}

replaceProxies().catch(error => {
  console.error('❌ ERROR:', error.message);
  process.exit(1);
});
