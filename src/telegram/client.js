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
        // You might want to store password or handle it differently
        throw new Error('2FA password required');
      },
      phoneCode: async () => {
        // For automated login with session, code is not needed
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

module.exports = {
  initializeClient,
  getClient,
  disconnectClient,
};
