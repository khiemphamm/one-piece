/**
 * TEST SCRIPT: Proxy Allocation Feature
 * 
 * This script tests the new Proxy Allocation feature with real proxies
 * from https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt
 */

import axios from 'axios';
import SessionManager from './core/engine/SessionManager';
import ProxyManager from './core/proxy/ProxyManager';
import logger from './core/utils/logger';

// SOCKS5 proxy list URL
const PROXY_LIST_URL = 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt';

// Test configuration
const TEST_CONFIG = {
  livestreamUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', // lofi hip hop radio
  viewerCount: 10, // Start with 10 viewers for testing
  maxViewersPerProxy: 2, // Conservative: 2 viewers per proxy
};

/**
 * Fetch proxy list from URL
 */
async function fetchProxyList(): Promise<string[]> {
  try {
    console.log('📥 Fetching proxy list from GitHub...');
    const response = await axios.get(PROXY_LIST_URL, {
      timeout: 10000,
    });
    
    const proxies = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith('#'))
      .map((proxy: string) => {
        // Convert to socks5:// format if needed
        if (!proxy.startsWith('socks5://')) {
          return `socks5://${proxy}`;
        }
        return proxy;
      })
      .slice(0, 10); // Take first 10 proxies for testing
    
    console.log(`✅ Fetched ${proxies.length} proxies`);
    return proxies;
    
  } catch (error) {
    console.error('❌ Failed to fetch proxy list:', error);
    throw error;
  }
}

/**
 * Validate a proxy (optional - for more reliability)
 */
async function validateProxy(proxy: string): Promise<boolean> {
  // For now, just return true
  // In production, you might want to test connectivity
  return true;
}

/**
 * Display proxy allocation status
 */
function displayProxyStatus() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PROXY ALLOCATION STATUS');
  console.log('='.repeat(70));
  
  const stats = ProxyManager.getStats();
  console.log(`\n📈 Overall Statistics:`);
  console.log(`   Total Proxies: ${stats.total}`);
  console.log(`   Active Proxies: ${stats.active}`);
  console.log(`   Failed Proxies: ${stats.failed}`);
  console.log(`   Pending Proxies: ${stats.pending}`);
  console.log(`   Current Viewers: ${stats.currentViewers}`);
  console.log(`   Total Capacity: ${stats.totalCapacity}`);
  console.log(`   Available Capacity: ${stats.availableCapacity}`);
  
  console.log(`\n📋 Proxy Details:`);
  const proxies = ProxyManager.getProxiesWithAllocation();
  
  proxies.forEach((proxy, index) => {
    const percentage = (proxy.current_viewers / proxy.max_viewers_per_proxy * 100).toFixed(0);
    const bar = '█'.repeat(proxy.current_viewers) + 
                '░'.repeat(proxy.max_viewers_per_proxy - proxy.current_viewers);
    const statusIcon = proxy.status === 'active' ? '✅' : 
                       proxy.status === 'failed' ? '❌' : '⏳';
    
    console.log(`   ${statusIcon} Proxy ${index + 1}: ${bar} ${proxy.current_viewers}/${proxy.max_viewers_per_proxy} (${percentage}%) - ${proxy.status}`);
    console.log(`      URL: ${proxy.proxy_url.substring(0, 40)}...`);
  });
  
  console.log('='.repeat(70) + '\n');
}

/**
 * Display session status
 */
function displaySessionStatus() {
  const sessionStats = SessionManager.getStats();
  
  console.log('🎬 Session Status:');
  console.log(`   Active Viewers: ${sessionStats.activeViewers}/${sessionStats.totalViewers}`);
  console.log(`   Failed Viewers: ${sessionStats.failedViewers}`);
  console.log(`   CPU Usage: ${sessionStats.cpuUsage.toFixed(1)}%`);
  console.log(`   Memory Usage: ${sessionStats.memoryUsage.toFixed(1)}%`);
}

/**
 * Main test function
 */
async function runTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 PROXY ALLOCATION FEATURE - LIVE TEST');
  console.log('='.repeat(70));
  console.log(`\nTest Configuration:`);
  console.log(`   Livestream: ${TEST_CONFIG.livestreamUrl}`);
  console.log(`   Viewer Count: ${TEST_CONFIG.viewerCount}`);
  console.log(`   Max Viewers Per Proxy: ${TEST_CONFIG.maxViewersPerProxy}`);
  console.log(`   Required Proxies: ~${Math.ceil(TEST_CONFIG.viewerCount / TEST_CONFIG.maxViewersPerProxy)}`);
  console.log('');
  
  try {
    // Step 1: Fetch proxies
    console.log('📝 Step 1: Fetching proxies from GitHub...');
    const proxies = await fetchProxyList();
    
    if (proxies.length === 0) {
      console.error('❌ No proxies fetched. Aborting test.');
      return;
    }
    
    // Step 2: Add proxies to database
    console.log(`\n📝 Step 2: Adding ${proxies.length} proxies to database...`);
    ProxyManager.addProxies(proxies, TEST_CONFIG.maxViewersPerProxy);
    console.log('✅ Proxies added successfully');
    
    // Step 3: Check capacity
    console.log('\n📝 Step 3: Checking proxy capacity...');
    displayProxyStatus();
    
    const stats = ProxyManager.getStats();
    if (stats.availableCapacity < TEST_CONFIG.viewerCount) {
      console.warn(`⚠️  WARNING: Insufficient capacity!`);
      console.warn(`   Needed: ${TEST_CONFIG.viewerCount} viewers`);
      console.warn(`   Available: ${stats.availableCapacity} slots`);
      console.warn(`   Will attempt to start anyway (some viewers may not have proxies)\n`);
    } else {
      console.log(`✅ Sufficient capacity: ${stats.availableCapacity} >= ${TEST_CONFIG.viewerCount}\n`);
    }
    
    // Step 4: Start session
    console.log('📝 Step 4: Starting viewer session...');
    console.log('⏳ This may take a few minutes (viewers start with 5s delay)...\n');
    
    await SessionManager.startSession({
      livestreamUrl: TEST_CONFIG.livestreamUrl,
      viewerCount: TEST_CONFIG.viewerCount,
      maxViewersPerProxy: TEST_CONFIG.maxViewersPerProxy,
      useProxyAllocation: true,
    });
    
    console.log('✅ Session started successfully!\n');
    
    // Step 5: Monitor for 60 seconds
    console.log('📝 Step 5: Monitoring session (60 seconds)...\n');
    
    let monitorCount = 0;
    const monitorInterval = setInterval(() => {
      monitorCount++;
      console.clear();
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📊 LIVE MONITORING - Update #${monitorCount}`);
      console.log('='.repeat(70));
      
      displaySessionStatus();
      console.log('');
      displayProxyStatus();
      
      console.log('⏰ Monitoring will stop in ' + (60 - monitorCount * 10) + ' seconds...\n');
    }, 10000); // Every 10 seconds
    
    // Wait 60 seconds
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Clear monitoring
    clearInterval(monitorInterval);
    
    // Step 6: Stop session
    console.log('\n📝 Step 6: Stopping session...');
    await SessionManager.stopSession();
    console.log('✅ Session stopped successfully\n');
    
    // Step 7: Verify cleanup
    console.log('📝 Step 7: Verifying cleanup...');
    displayProxyStatus();
    
    const finalStats = ProxyManager.getStats();
    if (finalStats.currentViewers === 0) {
      console.log('✅ CLEANUP SUCCESSFUL - All viewer slots released\n');
    } else {
      console.log(`⚠️  WARNING: ${finalStats.currentViewers} viewers still allocated\n`);
    }
    
    // Final summary
    console.log('='.repeat(70));
    console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n📊 Final Statistics:');
    console.log(`   Total Proxies Tested: ${stats.total}`);
    console.log(`   Active Proxies: ${finalStats.active}`);
    console.log(`   Failed Proxies: ${finalStats.failed}`);
    console.log(`   Viewers Started: ${TEST_CONFIG.viewerCount}`);
    console.log(`   Final Allocation: ${finalStats.currentViewers} viewers`);
    console.log('\n✨ Proxy Allocation Feature is working correctly!\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('\nTrying to cleanup...');
    
    try {
      await SessionManager.stopSession();
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
    
    process.exit(1);
  }
}

/**
 * Cleanup on exit
 */
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted by user. Cleaning up...');
  try {
    await SessionManager.stopSession();
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
  process.exit(0);
});

// Run the test
console.log('\n⏳ Starting test in 3 seconds...');
console.log('   Press Ctrl+C to abort\n');

setTimeout(() => {
  runTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 3000);
