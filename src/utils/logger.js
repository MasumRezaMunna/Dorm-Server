import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logsDir = join(__dirname, '../../logs');

// Ensure logs directory exists
if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return stack
    ? `${timestamp} [${level}]: ${message}\n${stack}`
    : `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console transport (colored in development)
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    // Error log file
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
    }),
    // Combined log file
    new winston.transports.File({
      filename: join(logsDir, 'combined.log'),
    }),
  ],
});

export default logger;
