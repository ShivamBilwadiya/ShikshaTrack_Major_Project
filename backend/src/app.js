import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const app = express();

// Security and CORS configuration
const allowedOrigins = config.frontendUrl
  ? config.frontendUrl.split(',').map((u) => u.trim().replace(/\/+$/, ''))
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, vitest supertest)
      if (!origin) return callback(null, true);

      // In development or if wildcard origin is configured, allow all
      if (config.nodeEnv !== 'production' || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Check configured allowlist in production
      const isAllowed = allowedOrigins.some(
        (allowed) => allowed === origin || origin.endsWith(allowed.replace(/^https?:\/\//, ''))
      );

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy rejection: Origin ${origin} is not allowed.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiter to general API
app.use('/api', apiLimiter);

// Mount API v1 router
app.use('/api/v1', routes);

// Central error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

