/**
 * EXAMPLE: How to use Proxy Allocation Feature
 * 
 * This file demonstrates various ways to use the new proxy allocation system
 */

import SessionManager from '../core/engine/SessionManager';
import ProxyManager from '../core/proxy/ProxyManager';

// ============================================
// EXAMPLE 1: Basic Usage with Default Settings
// ============================================
async function example1_BasicUsage() {
  console.log('=== EXAMPLE 1: Basic Usage ===\n');
  
  // Start session with default settings
  // - useProxyAllocation: true (auto-enabled)
  // - maxViewersPerProxy: 5 (from config)
  await SessionManager.startSession({
    livestreamUrl: 'https://youtube.com/watch?v=abc123',
    viewerCount: 20
  });
  
  console.log('✅ Started 20 viewers with smart proxy allocation');
  console.log('   Viewers will be distributed across available proxies');
  console.log('   Each proxy will handle max 5 viewers (default)\n');
}

// ============================================
// EXAMPLE 2: Custom Max Viewers Per Proxy
// ============================================
async function example2_CustomMaxViewers() {
  console.log('=== EXAMPLE 2: Custom Max Viewers Per Proxy ===\n');
  
  // Use more restrictive allocation (only 2 viewers per proxy)
  await SessionManager.startSession({
    livestreamUrl: 'https://youtube.com/watch?v=abc123',
    viewerCount: 20,
    maxViewersPerProxy: 2  // Lower risk of detection
  });
  
  console.log('✅ Started 20 viewers with 2 viewers per proxy');
  console.log('   Need at least 10 proxies for optimal distribution\n');
}

// ============================================
// EXAMPLE 3: Check Capacity Before Starting
// ============================================
async function example3_CheckCapacity() {
  console.log('=== EXAMPLE 3: Check Capacity Before Starting ===\n');
  
  const desiredViewers = 50;
  const stats = ProxyManager.getStats();
  
  console.log('Current Proxy Stats:');
  console.log(`- Total Proxies: ${stats.total}`);
  console.log(`- Current Viewers: ${stats.currentViewers}`);
  console.log(`- Total Capacity: ${stats.totalCapacity}`);
  console.log(`- Available Capacity: ${stats.availableCapacity}\n`);
  
  if (stats.availableCapacity < desiredViewers) {
    console.log(`⚠️ WARNING: Not enough capacity!`);
    console.log(`   Need: ${desiredViewers} viewers`);
    console.log(`   Available: ${stats.availableCapacity} slots`);
    console.log(`   Shortage: ${desiredViewers - stats.availableCapacity} viewers\n`);
    
    console.log('Solutions:');
    console.log('1. Add more proxies');
    console.log('2. Reduce viewer count');
    console.log('3. Increase maxViewersPerProxy (higher detection risk)\n');
  } else {
    console.log('✅ Sufficient capacity available!');
    await SessionManager.startSession({
      livestreamUrl: 'https://youtube.com/watch?v=abc123',
      viewerCount: desiredViewers
    });
  }
}

// ============================================
// EXAMPLE 4: Monitor Proxy Allocation
// ============================================
async function example4_MonitorAllocation() {
  console.log('=== EXAMPLE 4: Monitor Proxy Allocation ===\n');
  
  // Start session
  await SessionManager.startSession({
    livestreamUrl: 'https://youtube.com/watch?v=abc123',
    viewerCount: 25,
    maxViewersPerProxy: 5
  });
  
  // Monitor every 5 seconds
  const monitorInterval = setInterval(() => {
    const proxies = ProxyManager.getProxiesWithAllocation();
    
    console.log('\n📊 Current Proxy Allocation:');
    console.log('─'.repeat(60));
    
    proxies.forEach((proxy, index) => {
      const percentage = (proxy.current_viewers / proxy.max_viewers_per_proxy * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(proxy.current_viewers)) + 
                  '░'.repeat(proxy.max_viewers_per_proxy - proxy.current_viewers);
      
      console.log(`Proxy ${index + 1}: ${bar} ${proxy.current_viewers}/${proxy.max_viewers_per_proxy} (${percentage}%) - ${proxy.status}`);
    });
    
    const stats = ProxyManager.getStats();
    console.log('─'.repeat(60));
    console.log(`Total: ${stats.currentViewers}/${stats.totalCapacity} viewers (${stats.availableCapacity} slots free)`);
  }, 5000);
  
  // Stop monitoring after 30 seconds
  setTimeout(() => {
    clearInterval(monitorInterval);
    console.log('\n✅ Monitoring stopped');
  }, 30000);
}

// ============================================
// EXAMPLE 5: Dynamic Proxy Management
// ============================================
async function example5_DynamicManagement() {
  console.log('=== EXAMPLE 5: Dynamic Proxy Management ===\n');
  
  // Add new proxies with custom allocation
  const newProxies = [
    'http://proxy1.example.com:8080',
    'http://proxy2.example.com:8080',
    'http://proxy3.example.com:8080'
  ];
  
  ProxyManager.addProxies(newProxies, 10); // Each proxy can handle 10 viewers
  console.log('✅ Added 3 proxies with 10 viewers capacity each');
  console.log('   Total new capacity: 30 viewers\n');
  
  // Update max viewers for a specific proxy
  ProxyManager.updateMaxViewersPerProxy(1, 15);
  console.log('✅ Updated proxy #1 to handle 15 viewers\n');
  
  // Update all proxies
  ProxyManager.updateAllProxiesMaxViewers(8);
  console.log('✅ Updated ALL proxies to handle 8 viewers\n');
}

// ============================================
// EXAMPLE 6: Disable Smart Allocation
// ============================================
async function example6_DisableSmartAllocation() {
  console.log('=== EXAMPLE 6: Disable Smart Allocation ===\n');
  
  // Use old round-robin method
  await SessionManager.startSession({
    livestreamUrl: 'https://youtube.com/watch?v=abc123',
    viewerCount: 20,
    useProxyAllocation: false  // Disable smart allocation
  });
  
  console.log('✅ Started with legacy proxy allocation method');
  console.log('   Proxies will be assigned in round-robin fashion');
  console.log('   No capacity tracking or load balancing\n');
}

// ============================================
// EXAMPLE 7: Error Handling
// ============================================
async function example7_ErrorHandling() {
  console.log('=== EXAMPLE 7: Error Handling ===\n');
  
  try {
    const stats = ProxyManager.getStats();
    
    if (stats.total === 0) {
      console.log('❌ ERROR: No proxies available!');
      console.log('   Add proxies first using ProxyManager.addProxies()\n');
      return;
    }
    
    if (stats.availableCapacity === 0) {
      console.log('⚠️ WARNING: All proxies are at capacity!');
      console.log('   Options:');
      console.log('   1. Wait for current viewers to stop');
      console.log('   2. Add more proxies');
      console.log('   3. Increase maxViewersPerProxy\n');
      return;
    }
    
    // Start session with error handling
    await SessionManager.startSession({
      livestreamUrl: 'https://youtube.com/watch?v=abc123',
      viewerCount: stats.availableCapacity  // Use all available capacity
    });
    
    console.log(`✅ Started ${stats.availableCapacity} viewers (max available)\n`);
    
  } catch (error) {
    console.error('❌ Error starting session:', error);
  }
}

// ============================================
// EXAMPLE 8: Cleanup and Reset
// ============================================
async function example8_CleanupAndReset() {
  console.log('=== EXAMPLE 8: Cleanup and Reset ===\n');
  
  // Check current allocations
  const beforeStats = ProxyManager.getStats();
  console.log(`Before: ${beforeStats.currentViewers} viewers allocated\n`);
  
  // Stop all sessions
  await SessionManager.stopSession();
  console.log('✅ Stopped all viewer sessions');
  console.log('   All proxy allocations have been released\n');
  
  // Verify cleanup
  const afterStats = ProxyManager.getStats();
  console.log(`After: ${afterStats.currentViewers} viewers allocated`);
  
  if (afterStats.currentViewers === 0) {
    console.log('✅ Cleanup successful - all slots released\n');
  } else {
    console.log('⚠️ Warning: Some allocations were not released');
    console.log('   Running manual cleanup...\n');
    
    // Manual cleanup if needed
    ProxyManager.resetProxyStats();
    console.log('✅ Manual cleanup completed\n');
  }
}

// ============================================
// EXAMPLE 9: Production Best Practices
// ============================================
async function example9_ProductionBestPractices() {
  console.log('=== EXAMPLE 9: Production Best Practices ===\n');
  
  const config = {
    livestreamUrl: 'https://youtube.com/watch?v=abc123',
    viewerCount: 100
  };
  
  // Step 1: Validate proxy capacity
  const stats = ProxyManager.getStats();
  console.log('Step 1: Validating proxy capacity...');
  
  if (stats.availableCapacity < config.viewerCount) {
    console.log(`❌ Insufficient capacity: ${stats.availableCapacity}/${config.viewerCount}`);
    console.log('   Aborting to prevent partial deployment\n');
    return;
  }
  console.log(`✅ Sufficient capacity: ${stats.availableCapacity}/${config.viewerCount}\n`);
  
  // Step 2: Choose appropriate maxViewersPerProxy based on proxy type
  let maxViewersPerProxy = 5; // Default
  
  // Adjust based on proxy quality (example logic)
  const proxyQuality: 'residential' | 'datacenter' | 'free' = 'residential';
  
  switch (proxyQuality) {
    case 'residential':
      maxViewersPerProxy = 10; // High quality, can handle more
      break;
    case 'datacenter':
      maxViewersPerProxy = 3;  // Medium quality, be conservative
      break;
    case 'free':
      maxViewersPerProxy = 1;  // Low quality, one viewer per proxy
      break;
  }
  
  console.log(`Step 2: Using ${maxViewersPerProxy} viewers per proxy (${proxyQuality} proxies)\n`);
  
  // Step 3: Start with monitoring
  console.log('Step 3: Starting session with monitoring...');
  await SessionManager.startSession({
    ...config,
    maxViewersPerProxy
  });
  
  // Step 4: Set up health monitoring
  const healthCheck = setInterval(() => {
    const currentStats = ProxyManager.getStats();
    const sessionStats = SessionManager.getStats();
    
    console.log('\n🏥 Health Check:');
    console.log(`   Active Viewers: ${sessionStats.activeViewers}/${config.viewerCount}`);
    console.log(`   Failed Viewers: ${sessionStats.failedViewers}`);
    console.log(`   Proxy Capacity: ${currentStats.currentViewers}/${currentStats.totalCapacity}`);
    
    if (sessionStats.failedViewers > config.viewerCount * 0.1) {
      console.log('   ⚠️ High failure rate detected!');
    }
    
    if (currentStats.failed > currentStats.total * 0.2) {
      console.log('   ⚠️ Many proxies have failed!');
    }
  }, 30000); // Every 30 seconds
  
  console.log('✅ Production deployment complete with monitoring\n');
  
  // Cleanup after demonstration
  setTimeout(() => {
    clearInterval(healthCheck);
  }, 120000); // Stop after 2 minutes
}

// ============================================
// EXAMPLE 10: Complete Workflow
// ============================================
async function example10_CompleteWorkflow() {
  console.log('=== EXAMPLE 10: Complete Workflow ===\n');
  
  try {
    // 1. Setup: Add proxies
    console.log('📝 Step 1: Adding proxies...');
    const proxies = [
      'http://proxy1.example.com:8080',
      'http://proxy2.example.com:8080',
      'http://proxy3.example.com:8080',
      'http://proxy4.example.com:8080',
      'http://proxy5.example.com:8080'
    ];
    ProxyManager.addProxies(proxies, 5); // 5 viewers per proxy
    console.log(`✅ Added ${proxies.length} proxies (5 viewers each)\n`);
    
    // 2. Check capacity
    console.log('📊 Step 2: Checking capacity...');
    const stats = ProxyManager.getStats();
    console.log(`   Total capacity: ${stats.totalCapacity} viewers`);
    console.log(`   Available: ${stats.availableCapacity} viewers\n`);
    
    // 3. Start session
    console.log('🚀 Step 3: Starting viewer session...');
    await SessionManager.startSession({
      livestreamUrl: 'https://youtube.com/watch?v=abc123',
      viewerCount: 20,
      maxViewersPerProxy: 5
    });
    console.log('✅ Session started successfully\n');
    
    // 4. Monitor for 10 seconds
    console.log('👀 Step 4: Monitoring for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const sessionStats = SessionManager.getStats();
    console.log(`   Active viewers: ${sessionStats.activeViewers}/${sessionStats.totalViewers}`);
    console.log(`   Failed viewers: ${sessionStats.failedViewers}\n`);
    
    // 5. Stop session
    console.log('🛑 Step 5: Stopping session...');
    await SessionManager.stopSession();
    console.log('✅ Session stopped successfully\n');
    
    // 6. Verify cleanup
    console.log('✨ Step 6: Verifying cleanup...');
    const finalStats = ProxyManager.getStats();
    console.log(`   Current viewers: ${finalStats.currentViewers}`);
    console.log(`   Available capacity: ${finalStats.availableCapacity}\n`);
    
    console.log('🎉 Complete workflow finished successfully!\n');
    
  } catch (error) {
    console.error('❌ Workflow failed:', error);
  }
}

// ============================================
// Export all examples
// ============================================
export {
  example1_BasicUsage,
  example2_CustomMaxViewers,
  example3_CheckCapacity,
  example4_MonitorAllocation,
  example5_DynamicManagement,
  example6_DisableSmartAllocation,
  example7_ErrorHandling,
  example8_CleanupAndReset,
  example9_ProductionBestPractices,
  example10_CompleteWorkflow
};

// ============================================
// Main function to run all examples
// ============================================
async function runAllExamples() {
  console.log('\n' + '='.repeat(60));
  console.log('PROXY ALLOCATION FEATURE - EXAMPLES');
  console.log('='.repeat(60) + '\n');
  
  // Run each example (commented out for safety)
  // Uncomment the ones you want to run
  
  // await example1_BasicUsage();
  // await example2_CustomMaxViewers();
  // await example3_CheckCapacity();
  // await example4_MonitorAllocation();
  // await example5_DynamicManagement();
  // await example6_DisableSmartAllocation();
  // await example7_ErrorHandling();
  // await example8_CleanupAndReset();
  // await example9_ProductionBestPractices();
  // await example10_CompleteWorkflow();
  
  console.log('ℹ️ Examples are ready to run. Uncomment the ones you need.\n');
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
