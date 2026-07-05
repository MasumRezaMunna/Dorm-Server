import 'dotenv/config';
import { createServer } from 'http';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { initSocket } from './src/config/socket.js';
import logger from './src/utils/logger.js';

const PORT = process.env.PORT || 5000;

// Create HTTP server (needed for Socket.IO)
const httpServer = createServer(app);

// Initialize Socket.IO on top of the HTTP server
initSocket(httpServer);

// Connect to MongoDB then start server
connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
