import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const IS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const logDir = IS_LAMBDA ? '/tmp/logs' : path.join(__dirname, '../../logs');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const fileTransports = [];

if (!IS_LAMBDA) {
  // Only add file transports in non-Lambda environments
  try {
    require('fs').mkdirSync(logDir, { recursive: true });
    fileTransports.push(
      // Error logs - daily rotation
      new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
      }),
      // Combined logs - daily rotation
      new DailyRotateFile({
        filename: path.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
      }),
      // Access logs - daily rotation
      new DailyRotateFile({
        filename: path.join(logDir, 'access-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        maxSize: '20m',
        maxFiles: '7d',
        zippedArchive: true,
      })
    );
  } catch (e: any) {
    console.warn('Could not create log directory, using console only:', e.message);
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'cooksmart-api' },
  transports: [
    ...fileTransports,
    // Console always available
    new winston.transports.Console({
      format: IS_LAMBDA ? logFormat : consoleFormat,
    }),
  ],
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections (console only in Lambda)
logger.exceptions.handle(
  new winston.transports.Console({ format: logFormat })
);

logger.rejections.handle(
  new winston.transports.Console({ format: logFormat })
);

// Create stream for Morgan middleware
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;

