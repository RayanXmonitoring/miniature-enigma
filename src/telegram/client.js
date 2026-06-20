const { TelegramClient } = require('gramjs');
const { StringSession } = require('gramjs/sessions');
const logger = require('../utils/logger');

let client = null;

async function initializeClient() {
  try {
    const sessionString = process.env.SESSION_STRING || '';
    
    client = new TelegramClient(
      new StringSession(sessionString),
      parseInt(process.env.API_ID),
      process.env.API_HASH,
      {
        connectionRetries: 5,
        useWSS: true,
        ipv6: false,
        timeout: 30,
        floodSleepThreshold: 60,
      }
    );

    await client.start({
      phoneNumber: () => process.env.PHONE_NUMBER,
      password: async () => {
        throw new Error('2FA password required');
      },
      phoneCode: async () => {
        return '';
      },
      onError: (err) => {
        logger.error('Telegram client error:', err);
      },
    });

    logger.info('✅ Telegram client initialized successfully');
    return client;
  } catch (error) {
    logger.error('Failed to initialize Telegram client:', error);
    throw error;
  }
}

async function getClient() {
  if (!client) {
    await initializeClient();
  }
  return client;
}

async function disconnectClient() {
  if (client) {
    await client.disconnect();
    client = null;
    logger.info('Telegram client disconnected');
  }
}

// Fungsi untuk mendapatkan ID dari username
async function getGroupIdFromUsername(username) {
  try {
    const client = await getClient();
    
    // Hapus @ jika ada
    const cleanUsername = username.replace('@', '');
    
    // Cari chat berdasarkan username
    const dialogs = await client.getDialogs();
    const chat = dialogs.find(d => 
      d.entity.username && 
      d.entity.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    
    if (!chat) {
      throw new Error(`Group dengan username @${cleanUsername} tidak ditemukan`);
    }
    
    return {
      id: chat.id,
      title: chat.title,
      username: chat.entity.username,
      accessHash: chat.entity.accessHash,
      isGroup: chat.isGroup || chat.isSupergroup,
    };
  } catch (error) {
    logger.error(`Error getting group ID for username ${username}:`, error);
    throw error;
  }
}

// Fungsi untuk mendapatkan info grup dari username
async function getGroupInfoByUsername(username) {
  try {
    const client = await getClient();
    const cleanUsername = username.replace('@', '');
    
    // Cari chat
    const chat = await client.getEntity(cleanUsername);
    
    // Dapatkan info lengkap
    const fullInfo = await client.getFullChat(chat.id);
    
    return {
      id: chat.id,
      title: chat.title || chat.username,
      username: chat.username,
      accessHash: chat.accessHash,
      membersCount: fullInfo.fullChat?.participantsCount || 0,
      about: fullInfo.fullChat?.about || '',
      isGroup: chat.isGroup || chat.isSupergroup,
      isSupergroup: chat.isSupergroup,
      inviteLink: fullInfo.fullChat?.inviteLink || null,
    };
  } catch (error) {
    logger.error(`Error getting group info for ${username}:`, error);
    throw error;
  }
}

module.exports = {
  initializeClient,
  getClient,
  disconnectClient,
  getGroupIdFromUsername,
  getGroupInfoByUsername,
};
