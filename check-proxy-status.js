/**
 * PROXY STATUS CHECKER
 * 
 * Tool để kiểm tra proxy allocation status real-time
 * Run with: node check-proxy-status.js
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'tool-live.db');

/**
 * Check if database exists
 */
function checkDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ Database not found!');
    console.log('   Expected at:', DB_PATH);
    console.log('   Please run the app first to create database.\n');
    return false;
  }
  return true;
}

/**
 * Get proxy statistics
 */
async function getProxyStatus() {
  try {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    // Check if new columns exist
    const tableInfo = db.exec("PRAGMA table_info(proxies)");
    const columns = tableInfo[0]?.values.map(row => row[1]) || [];
    
    if (!columns.includes('current_viewers')) {
      console.log('⚠️  Database needs migration!');
      console.log('   Run: node migrate-database.js\n');
      db.close();
      return null;
    }

    // Get all proxies
    const proxiesResult = db.exec(`
      SELECT 
        id,
        proxy_url,
        type,
        status,
        max_viewers_per_proxy,
        current_viewers,
        fail_count,
        success_count
      FROM proxies
      ORDER BY status, current_viewers DESC
    `);

    const proxies = proxiesResult[0]?.values.map(row => ({
      id: row[0],
      proxy_url: row[1],
      type: row[2],
      status: row[3],
      max_viewers_per_proxy: row[4] || 5,
      current_viewers: row[5] || 0,
      fail_count: row[6] || 0,
      success_count: row[7] || 0,
    })) || [];

    // Get session info
    const sessionResult = db.exec(`
      SELECT COUNT(*) as count
      FROM sessions
      WHERE status = 'active'
    `);
    const activeSessions = sessionResult[0]?.values[0]?.[0] || 0;

    // Get viewer sessions
    const viewerResult = db.exec(`
      SELECT COUNT(*) as count
      FROM viewer_sessions
      WHERE status = 'active'
    `);
    const activeViewers = viewerResult[0]?.values[0]?.[0] || 0;

    db.close();

    return {
      proxies,
      activeSessions,
      activeViewers,
    };

  } catch (error) {
    console.error('❌ Error reading database:', error.message);
    return null;
  }
}

/**
 * Display proxy status
 */
function displayStatus(data) {
  const { proxies, activeSessions, activeViewers } = data;

  console.clear();
  console.log('\n' + '='.repeat(80));
  console.log('📊 PROXY ALLOCATION STATUS - REAL-TIME MONITOR');
  console.log('='.repeat(80));
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  // Overall statistics
  const totalProxies = proxies.length;
  const activeProxies = proxies.filter(p => p.status === 'active').length;
  const failedProxies = proxies.filter(p => p.status === 'failed').length;
  const pendingProxies = proxies.filter(p => p.status === 'pending').length;
  const currentViewers = proxies.reduce((sum, p) => sum + p.current_viewers, 0);
  const totalCapacity = proxies.reduce((sum, p) => sum + p.max_viewers_per_proxy, 0);
  const availableCapacity = totalCapacity - currentViewers;

  console.log('\n📈 OVERALL STATISTICS:');
  console.log('─'.repeat(80));
  console.log(`   Total Proxies: ${totalProxies} (Active: ${activeProxies}, Failed: ${failedProxies}, Pending: ${pendingProxies})`);
  console.log(`   Current Viewers: ${currentViewers}/${totalCapacity} (${((currentViewers/totalCapacity)*100).toFixed(1)}% utilization)`);
  console.log(`   Available Capacity: ${availableCapacity} viewer slots`);
  console.log(`   Active Sessions: ${activeSessions}`);
  console.log(`   Active Viewers (DB): ${activeViewers}`);

  // Check if proxies are running
  const isRunning = currentViewers > 0 || activeViewers > 0 || activeSessions > 0;
  
  console.log('\n🔍 STATUS:');
  console.log('─'.repeat(80));
  if (isRunning) {
    console.log('   🟢 PROXIES ARE RUNNING!');
    console.log(`   └─ ${currentViewers} viewers allocated across proxies`);
    console.log(`   └─ ${activeSessions} active session(s)`);
  } else {
    console.log('   ⚪ NO ACTIVE VIEWERS');
    console.log('   └─ All proxies are idle (no viewers allocated)');
  }

  if (totalProxies === 0) {
    console.log('\n⚠️  NO PROXIES IN DATABASE');
    console.log('   To add proxies, run: node test-proxy-quick.js');
    console.log('='.repeat(80) + '\n');
    return;
  }

  // Proxy details
  console.log('\n📋 PROXY DETAILS:');
  console.log('─'.repeat(80));

  if (proxies.length === 0) {
    console.log('   No proxies found in database\n');
  } else {
    // Group by status
    const statusGroups = {
      active: proxies.filter(p => p.status === 'active'),
      pending: proxies.filter(p => p.status === 'pending'),
      failed: proxies.filter(p => p.status === 'failed'),
    };

    ['active', 'pending', 'failed'].forEach(status => {
      const group = statusGroups[status];
      if (group.length === 0) return;

      const statusIcon = status === 'active' ? '🟢' : status === 'pending' ? '🟡' : '🔴';
      console.log(`\n${statusIcon} ${status.toUpperCase()} PROXIES (${group.length}):`);

      group.forEach((proxy, index) => {
        const percentage = (proxy.current_viewers / proxy.max_viewers_per_proxy * 100).toFixed(0);
        const bar = '█'.repeat(proxy.current_viewers) + 
                    '░'.repeat(proxy.max_viewers_per_proxy - proxy.current_viewers);
        const isActive = proxy.current_viewers > 0 ? '🔴' : '⚪';
        
        console.log(`   ${isActive} #${proxy.id}: ${bar} ${proxy.current_viewers}/${proxy.max_viewers_per_proxy} (${percentage}%)`);
        console.log(`      URL: ${proxy.proxy_url.substring(0, 60)}...`);
        console.log(`      Success: ${proxy.success_count}, Fails: ${proxy.fail_count}`);
      });
    });
  }

  console.log('\n' + '='.repeat(80));
  
  // Tips
  if (!isRunning && totalProxies > 0) {
    console.log('💡 TIP: To start viewers with these proxies:');
    console.log('   1. Open the Electron app (npm run dev)');
    console.log('   2. Or run: node demo-proxy-allocation.js');
  }
  
  if (isRunning) {
    console.log('💡 Proxies are actively handling viewers!');
    console.log('   Monitor continues every 5 seconds...');
  }
  
  console.log('='.repeat(80) + '\n');
}

/**
 * Main function
 */
async function main() {
  console.log('\n🔍 PROXY STATUS CHECKER');
  console.log('   Press Ctrl+C to stop\n');

  // Check database
  if (!checkDatabase()) {
    process.exit(1);
  }

  // Get and display status
  const data = await getProxyStatus();
  
  if (!data) {
    process.exit(1);
  }

  displayStatus(data);

  // Continuous monitoring
  console.log('🔄 Auto-refresh in 5 seconds...\n');
  
  setInterval(async () => {
    const newData = await getProxyStatus();
    if (newData) {
      displayStatus(newData);
      console.log('🔄 Auto-refresh in 5 seconds...\n');
    }
  }, 5000);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Monitoring stopped. Goodbye!\n');
  process.exit(0);
});

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
