/**
 * Real-time Viewer-Proxy Mapping Monitor
 * Shows which viewer is using which proxy in real-time
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'tool-live.db');
const REFRESH_INTERVAL = 3000; // 3 seconds

let previousData = null;

/**
 * Format proxy URL for display
 */
function formatProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    return `${url.hostname}:${url.port}`;
  } catch {
    return proxyUrl.substring(0, 30) + '...';
  }
}

/**
 * Get viewer-proxy mapping
 */
async function getViewerProxyMapping() {
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(dbBuffer);

  // Get active sessions with viewer count
  const sessionsResult = db.exec(`
    SELECT id, livestream_url, status, 
           (SELECT COUNT(*) FROM viewer_sessions WHERE session_id = sessions.id AND status = 'active') as viewer_count
    FROM sessions
    WHERE status = 'active'
    ORDER BY id DESC
  `);

  const sessions = sessionsResult[0]?.values.map(row => ({
    id: row[0],
    url: row[1],
    status: row[2],
    viewerCount: row[3],
  })) || [];

  // Get viewers with their proxies
  const viewersResult = db.exec(`
    SELECT 
      v.id,
      v.session_id,
      v.proxy_id,
      v.status,
      v.started_at,
      p.proxy_url,
      p.status as proxy_status
    FROM viewer_sessions v
    LEFT JOIN proxies p ON v.proxy_id = p.id
    WHERE v.status = 'active'
    ORDER BY v.session_id, v.id
  `);

  const viewers = viewersResult[0]?.values.map(row => ({
    id: row[0],
    sessionId: row[1],
    proxyId: row[2],
    status: row[3],
    startedAt: row[4],
    proxyUrl: row[5],
    proxyStatus: row[6],
  })) || [];

  // Get proxy allocation stats
  const proxyStatsResult = db.exec(`
    SELECT 
      p.id,
      p.proxy_url,
      p.status,
      p.current_viewers,
      p.max_viewers_per_proxy,
      p.success_count,
      p.fail_count,
      (SELECT COUNT(*) FROM viewer_sessions WHERE proxy_id = p.id AND status = 'active') as active_viewer_count
    FROM proxies p
    WHERE p.status = 'active'
    ORDER BY p.current_viewers DESC, p.id
  `);

  const proxyStats = proxyStatsResult[0]?.values.map(row => ({
    id: row[0],
    proxyUrl: row[1],
    status: row[2],
    currentViewers: row[3],
    maxViewers: row[4],
    successCount: row[5],
    failCount: row[6],
    activeViewerCount: row[7],
  })) || [];

  db.close();

  return {
    sessions,
    viewers,
    proxyStats,
  };
}

/**
 * Render the monitoring dashboard
 */
function renderDashboard(data) {
  console.clear();
  
  const now = new Date().toLocaleString();
  
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           🔍 VIEWER-PROXY MAPPING MONITOR - REAL-TIME                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`⏰ Time: ${now}\n`);

  // SECTION 1: Active Sessions
  console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃  📺 ACTIVE SESSIONS                                                      ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n');

  if (data.sessions.length === 0) {
    console.log('   ⚪ No active sessions\n');
  } else {
    data.sessions.forEach(session => {
      console.log(`   🎬 Session #${session.id}`);
      console.log(`      URL: ${session.url}`);
      console.log(`      Viewers: ${session.viewerCount}`);
      console.log();
    });
  }

  // SECTION 2: Viewer-Proxy Mapping
  console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃  👤 VIEWER → PROXY MAPPING                                               ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n');

  if (data.viewers.length === 0) {
    console.log('   ⚪ No active viewers\n');
  } else {
    // Group by session
    const viewersBySession = {};
    data.viewers.forEach(viewer => {
      if (!viewersBySession[viewer.sessionId]) {
        viewersBySession[viewer.sessionId] = [];
      }
      viewersBySession[viewer.sessionId].push(viewer);
    });

    Object.keys(viewersBySession).forEach(sessionId => {
      console.log(`   📺 Session #${sessionId}:`);
      console.log('   ─────────────────────────────────────────────────────────────────────────');
      
      viewersBySession[sessionId].forEach((viewer, index) => {
        const statusIcon = viewer.status === 'active' ? '🟢' : '⚪';
        const proxyDisplay = viewer.proxyUrl ? formatProxyUrl(viewer.proxyUrl) : 'No proxy';
        const uptime = viewer.startedAt ? calculateUptime(viewer.startedAt) : 'N/A';
        
        console.log(`   ${statusIcon} Viewer #${viewer.id} → Proxy #${viewer.proxyId || 'N/A'}`);
        console.log(`      Proxy: ${proxyDisplay}`);
        console.log(`      Status: ${viewer.status.toUpperCase()}`);
        console.log(`      Uptime: ${uptime}`);
        
        if (index < viewersBySession[sessionId].length - 1) {
          console.log();
        }
      });
      console.log();
    });
  }

  // SECTION 3: Proxy Load Distribution
  console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃  🔄 PROXY LOAD DISTRIBUTION                                              ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n');

  if (data.proxyStats.length === 0) {
    console.log('   ⚪ No active proxies\n');
  } else {
    const totalCapacity = data.proxyStats.reduce((sum, p) => sum + p.maxViewers, 0);
    const totalUsed = data.proxyStats.reduce((sum, p) => sum + p.activeViewerCount, 0);
    const utilization = totalCapacity > 0 ? ((totalUsed / totalCapacity) * 100).toFixed(1) : 0;

    console.log(`   📊 Overall: ${totalUsed}/${totalCapacity} viewers (${utilization}% utilization)\n`);

    data.proxyStats.forEach(proxy => {
      const percentage = proxy.maxViewers > 0 
        ? ((proxy.activeViewerCount / proxy.maxViewers) * 100).toFixed(0) 
        : 0;
      
      const progressBar = generateProgressBar(proxy.activeViewerCount, proxy.maxViewers);
      const statusIcon = proxy.activeViewerCount > 0 ? '🟢' : '⚪';
      
      console.log(`   ${statusIcon} Proxy #${proxy.id}: ${progressBar} ${proxy.activeViewerCount}/${proxy.maxViewers} (${percentage}%)`);
      console.log(`      ${formatProxyUrl(proxy.proxyUrl)}`);
      console.log(`      Success: ${proxy.successCount}, Fails: ${proxy.failCount}`);
      console.log();
    });
  }

  // SECTION 4: Summary Stats
  console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃  📈 SUMMARY                                                               ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n');
  
  console.log(`   Active Sessions:  ${data.sessions.length}`);
  console.log(`   Active Viewers:   ${data.viewers.length}`);
  console.log(`   Active Proxies:   ${data.proxyStats.filter(p => p.activeViewerCount > 0).length}/${data.proxyStats.length}`);
  
  const avgLoad = data.proxyStats.length > 0
    ? (data.proxyStats.reduce((sum, p) => sum + p.activeViewerCount, 0) / data.proxyStats.length).toFixed(1)
    : 0;
  console.log(`   Avg Load/Proxy:   ${avgLoad} viewers`);

  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Press Ctrl+C to stop monitoring                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n🔄 Refreshing in 3 seconds...\n');
}

/**
 * Generate progress bar
 */
function generateProgressBar(current, max) {
  const width = 10;
  const filled = Math.round((current / max) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Calculate uptime from timestamp
 */
function calculateUptime(startedAt) {
  try {
    const start = new Date(startedAt);
    const now = new Date();
    const diff = now - start;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  } catch {
    return 'N/A';
  }
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  console.log('Starting viewer-proxy mapping monitor...\n');

  const monitor = async () => {
    try {
      const data = await getViewerProxyMapping();
      renderDashboard(data);
      previousData = data;
    } catch (error) {
      console.error('❌ Monitor error:', error.message);
    }
  };

  // Initial render
  await monitor();

  // Start interval
  const interval = setInterval(monitor, REFRESH_INTERVAL);

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n👋 Monitoring stopped. Goodbye!\n');
    process.exit(0);
  });
}

// Start monitoring
startMonitoring().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
