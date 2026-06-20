require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { initializeClient } = require('./telegram/client');
const apiRoutes = require('./routes/api');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});
app.use('/api', limiter);

// API Routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Telegram Member Mover API',
    version: '2.0.0',
    status: 'online',
    description: 'Pindahkan member grup Telegram menggunakan username',
    endpoints: {
      health: '/api/health',
      me: '/api/me',
      groupInfo: '/api/group/:username',
      members: '/api/members/:username',
      preview: '/api/preview (POST) - Dry run',
      move: '/api/move (POST) - Move members',
      leave: '/api/leave/:username (POST)',
    },
    example: {
      move: {
        method: 'POST',
        url: '/api/move',
        headers: { 'x-api-key': 'your_api_key' },
        body: {
          sourceUsername: 'namagroupsumber',
          destUsername: 'namagrupptujuan',
          batchSize: 50,
          delay: 1000,
          limit: 100
        }
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Initialize Telegram client and start server
async function startServer() {
  try {
    await initializeClient();
    logger.info('Telegram client initialized');

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      console.log(`✅ Server is running at http://localhost:${PORT}`);
      console.log(`📱 Telegram client is ready`);
      console.log(`🔑 Use API key: ${process.env.ADMIN_API_KEY}`);
      console.log(`\n📝 Contoh penggunaan:`);
      console.log(`POST /api/move`);
      console.log(`Body: { "sourceUsername": "namagroup", "destUsername": "namatujuan" }`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  await require('./telegram/client').disconnectClient();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  await require('./telegram/client').disconnectClient();
  process.exit(0);
});

startServer();
