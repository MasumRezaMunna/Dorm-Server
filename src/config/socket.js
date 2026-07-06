import { Server } from 'socket.io';
import logger from '../utils/logger.js';

/** @type {Server} */
let io;

/**
 * Initialize Socket.IO server attached to the HTTP server.
 * Exported `io` instance is used anywhere in the app to emit events.
 */
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join a personal room using userId for targeted notifications
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      logger.info(`User ${userId} joined personal room`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
};

/**
 * Get the initialized Socket.IO instance.
 * Call this after initSocket() has been called.
 */
export const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket() first.');
  return io;
};

/**
 * Emit a notification to a specific user's personal room.
 * @param {string} userId - MongoDB ObjectId string
 * @param {string} event - Event name
 * @param {any} data - Payload
 */
export const emitToUser = (userId, event, data) => {
  getIO().to(`user_${userId}`).emit(event, data);
};

/**
 * Broadcast an event to all connected clients.
 */
export const broadcast = (event, data) => {
  getIO().emit(event, data);
};
