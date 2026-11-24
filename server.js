import 'dotenv/config';
import { createServer } from 'http';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { connectRedis, disconnectRedis } from './src/config/redis.js';
import { initSocket } from './src/config/socket.js';
import logger from './src/utils/logger.js';

const PORT = process.env.PORT || 5000;

// Create HTTP server (needed for Socket.IO)
const httpServer = createServer(app);

// Initialize Socket.IO on top of the HTTP server
initSocket(httpServer);

// Connect to MongoDB and Redis then start server
connectDB()
  .then(async () => {
    // Attempt Redis connection (fail-safe: will not prevent server from starting if Redis is down)
    await connectRedis().catch((err) => {
      logger.warn(`Redis initialization error: ${err.message}`);
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  await disconnectRedis();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
