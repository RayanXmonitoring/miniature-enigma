require('dotenv').config();
const { getClient } = require('../src/telegram/client');

async function listGroups() {
  try {
    const client = await getClient();
    const dialogs = await client.getDialogs();
    
    console.log('\n📋 Daftar Grup Telegram:\n');
    console.log('='.repeat(60));
    
    let groupCount = 0;
    dialogs.forEach(dialog => {
      if (dialog.isGroup || dialog.isSupergroup) {
        groupCount++;
        const username = dialog.entity.username || 'Tidak ada username';
        console.log(`${groupCount}. ${dialog.title}`);
        console.log(`   Username: @${username}`);
        console.log(`   ID: ${dialog.id}`);
        console.log(`   Member: ${dialog.entity.participantsCount || '?'}`);
        console.log('-'.repeat(40));
      }
    });
    
    console.log(`\nTotal ${groupCount} grup ditemukan.`);
    
    await client.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

listGroups();
