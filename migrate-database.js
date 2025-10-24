/**
 * DATABASE MIGRATION SCRIPT
 * 
 * Adds new columns for Proxy Allocation feature:
 * - max_viewers_per_proxy
 * - current_viewers
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'tool-live.db');

async function runMigration() {
  console.log('\n' + '='.repeat(70));
  console.log('🔧 DATABASE MIGRATION - Proxy Allocation Feature');
  console.log('='.repeat(70));
  console.log('\nThis will add new columns to the proxies table:');
  console.log('  - max_viewers_per_proxy (INTEGER, default: 5)');
  console.log('  - current_viewers (INTEGER, default: 0)\n');

  try {
    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      console.log('❌ Database not found at:', DB_PATH);
      console.log('   Creating new database with updated schema...\n');
      
      // Will be created on next app start with new schema
      console.log('✅ New database will be created on next startup\n');
      return;
    }

    console.log('📁 Database found:', DB_PATH);
    console.log('📊 Current size:', (fs.statSync(DB_PATH).size / 1024).toFixed(2), 'KB\n');

    // Backup database first
    const backupPath = DB_PATH + '.backup-' + Date.now();
    fs.copyFileSync(DB_PATH, backupPath);
    console.log('💾 Backup created:', backupPath, '\n');

    // Load database
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    console.log('🔍 Checking current schema...\n');

    // Check if columns already exist
    const tableInfo = db.exec("PRAGMA table_info(proxies)");
    const columns = tableInfo[0]?.values.map(row => row[1]) || [];
    
    console.log('Current columns in proxies table:');
    columns.forEach(col => console.log(`  - ${col}`));
    console.log('');

    const hasMaxViewers = columns.includes('max_viewers_per_proxy');
    const hasCurrentViewers = columns.includes('current_viewers');

    if (hasMaxViewers && hasCurrentViewers) {
      console.log('✅ Columns already exist! No migration needed.\n');
      db.close();
      return;
    }

    console.log('🔨 Running migration...\n');

    // Add columns if they don't exist
    if (!hasMaxViewers) {
      console.log('  Adding column: max_viewers_per_proxy...');
      db.run('ALTER TABLE proxies ADD COLUMN max_viewers_per_proxy INTEGER DEFAULT 5');
      console.log('  ✅ Added max_viewers_per_proxy\n');
    }

    if (!hasCurrentViewers) {
      console.log('  Adding column: current_viewers...');
      db.run('ALTER TABLE proxies ADD COLUMN current_viewers INTEGER DEFAULT 0');
      console.log('  ✅ Added current_viewers\n');
    }

    // Save updated database
    const data = db.export();
    const newBuffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, newBuffer);
    
    console.log('💾 Database updated successfully!\n');
    console.log('📊 New size:', (newBuffer.length / 1024).toFixed(2), 'KB\n');

    // Verify migration
    const verifyTableInfo = db.exec("PRAGMA table_info(proxies)");
    const newColumns = verifyTableInfo[0]?.values.map(row => row[1]) || [];
    
    console.log('✅ Verified - New columns in proxies table:');
    newColumns.forEach(col => console.log(`  - ${col}`));
    console.log('');

    db.close();

    console.log('='.repeat(70));
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n✨ Proxy Allocation feature is now ready to use!');
    console.log('   You can start the app with: npm run dev\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    
    // Restore from backup if it exists
    const backupFiles = fs.readdirSync(path.dirname(DB_PATH))
      .filter(f => f.startsWith('tool-live.db.backup-'))
      .sort()
      .reverse();
    
    if (backupFiles.length > 0) {
      const latestBackup = path.join(path.dirname(DB_PATH), backupFiles[0]);
      console.log('\n🔄 Restoring from backup:', latestBackup);
      fs.copyFileSync(latestBackup, DB_PATH);
      console.log('✅ Database restored\n');
    }
    
    process.exit(1);
  }
}

// Run migration
console.log('\n⏳ Starting migration in 2 seconds...');
console.log('   Press Ctrl+C to abort\n');

setTimeout(() => {
  runMigration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 2000);
