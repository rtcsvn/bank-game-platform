import winston from 'winston';
import { config } from './env';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    config.isDev ? combine(colorize(), simple()) : json()
  ),
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});
