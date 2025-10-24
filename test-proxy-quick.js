/**
 * QUICK TEST: Fetch and add proxies from GitHub
 * Run with: npx tsx test-proxy-quick.ts
 */

const axios = require('axios');

const PROXY_LIST_URL = 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt';

async function fetchAndDisplayProxies() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 FETCHING PROXY LIST FROM GITHUB');
    console.log('='.repeat(70));
    console.log(`\nURL: ${PROXY_LIST_URL}\n`);
    
    console.log('⏳ Downloading...');
    const response = await axios.get(PROXY_LIST_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('✅ Downloaded successfully!\n');
    
    // Parse proxies
    const lines = response.data.split('\n');
    const proxies = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .slice(0, 20); // Take first 20 for testing
    
    console.log('='.repeat(70));
    console.log(`📋 PROXY LIST (First 20 proxies)`);
    console.log('='.repeat(70));
    console.log(`\nTotal proxies found: ${lines.length}`);
    console.log(`Showing: ${proxies.length}\n`);
    
    proxies.forEach((proxy, index) => {
      console.log(`  ${(index + 1).toString().padStart(2, ' ')}. socks5://${proxy}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS!');
    console.log('='.repeat(70));
    console.log('\n📊 Statistics:');
    console.log(`   Total proxies in list: ${lines.length}`);
    console.log(`   Valid proxies: ${proxies.length}`);
    console.log(`   Format: SOCKS5`);
    
    console.log('\n💡 Next steps:');
    console.log('   1. These proxies will be added to the database');
    console.log('   2. System will allocate viewers across proxies');
    console.log('   3. Each proxy handles max 2-5 viewers (configurable)');
    console.log('   4. Load balancing ensures even distribution\n');
    
    // Save to file for reference
    const fs = require('fs');
    const proxyList = proxies.map(p => `socks5://${p}`).join('\n');
    fs.writeFileSync('data/fetched-proxies.txt', proxyList);
    console.log('💾 Saved to: data/fetched-proxies.txt\n');
    
    return proxies;
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.statusText}`);
    }
    throw error;
  }
}

// Run
fetchAndDisplayProxies()
  .then(() => {
    console.log('✅ Test completed successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });
