/**
 * ShadowPay Security Middleware
 * Implements CORS, rate limiting, security headers, and audit logging
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'shadowpay-server' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(__dirname, 'logs/error.log'),
      level: 'error'
    }),
    // All logs
    new winston.transports.File({
      filename: path.join(__dirname, 'logs/combined.log')
    }),
    // Audit log (auth, payments, withdrawals)
    new winston.transports.File({
      filename: path.join(__dirname, 'logs/audit.log'),
      level: 'info'
    })
  ]
});

// Also log to console in development
if (process.env.NODE_ENV !== 'production') {
  auditLogger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export function getCorsOptions() {
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
  
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile, curl, etc)
      if (!origin) return callback(null, true);
      
      const isAllowed = corsOrigins.some(allowed => 
        origin.includes(allowed.trim())
      );
      
      if (isAllowed) {
        return callback(null, true);
      }
      
      auditLogger.warn('❌ CORS violation attempted', {
        origin,
        allowedOrigins: corsOrigins,
        timestamp: new Date()
      });
      
      callback(new Error('CORS policy violation'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
    optionsSuccessStatus: 200
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════════════════════

export function getHelmetOptions() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        frameSrc: ["phantom.app", "*.phantom.app"],
        connectSrc: ["'self'", "*.solana.com", "*.helius-rpc.com", "*.rpc.sandstorm.systems"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

// Global rate limiter - 100 requests per 15 minutes per IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: '⚠️ Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Strict rate limiter for authentication - 15 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: '❌ Too many login attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful attempts
  keyGenerator: (req) => {
    // Rate limit by IP and public key for extra security
    const pubKey = req.body?.publicKey || 'unknown';
    return `${req.ip}-${pubKey}`;
  }
});

// Moderate rate limiter for payment endpoints - 50 per minute per IP
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: '⚠️ Too many payment attempts. Please slow down.',
  keyGenerator: (req) => {
    // Rate limit by IP and link ID
    const linkId = req.params.id || 'unknown';
    return `${req.ip}-${linkId}`;
  }
});

// Withdrawal limiter - 10 per hour per user
export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: '⚠️ Too many withdrawal attempts. Please try again later.',
  keyGenerator: (req) => {
    // Rate limit by wallet address from JWT
    const wallet = req.user?.address || req.ip;
    return `withdrawal-${wallet}`;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input Sanitization Middleware
 * Prevents XSS and injection attacks
 */
export function sanitizeInput(req, res, next) {
  // Sanitize string values
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potential malicious content
      return obj
        .trim()
        .substring(0, 10000) // Limit string length
        .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
          key,
          sanitize(value)
        ])
      );
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
}

/**
 * Error Handling Middleware
 * Never expose sensitive information in errors
 */
export function errorHandler(err, req, res, next) {
  // Log full error internally
  auditLogger.error('❌ Application error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date()
  });

  // Return safe error to client (no internals)
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(statusCode).json({
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
}

/**
 * Security Logging Middleware
 * Logs all requests with details
 */
export function securityLogger(req, res, next) {
  const start = Date.now();

  // Log request
  auditLogger.info('📥 Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date()
  });

  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    // Log suspicious responses
    if (res.statusCode >= 400) {
      auditLogger.warn('⚠️ Error response', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        timestamp: new Date()
      });
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Validate JWT is Set
 * Ensures authentication is properly configured
 */
export function validateJwtSecret() {
  if (!process.env.JWT_SECRET) {
    console.error(
      '❌ CRITICAL: JWT_SECRET environment variable not set!\n' +
      '   Generate a secure secret with: openssl rand -hex 32\n' +
      '   Add to .env: JWT_SECRET=<output>\n'
    );
    process.exit(1);
  }

  if (process.env.JWT_SECRET === 'shadowpay-dev-secret-key-change-in-production') {
    console.error(
      '❌ CRITICAL: Must set unique JWT_SECRET for production!\n' +
      '   Current secret is the default development secret.\n' +
      '   Generate new secret: openssl rand -hex 32\n'
    );
    process.exit(1);
  }

  console.log('✅ JWT_SECRET is properly configured');
}

/**
 * Validate Private Key is Secure
 * Ensures keys aren't using default/weak values
 */
export function validatePrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.warn(
      '⚠️ WARNING: PRIVATE_KEY not set. Privacy Cash operations will fail.\n' +
      '   For demo mode, set: PRIVACY_CASH_ENABLED=false\n' +
      '   For production, add PRIVATE_KEY to .env\n'
    );
    return;
  }

  if (privateKey === '<your-private-key-base58>' || privateKey.includes('your-')) {
    console.error(
      '❌ CRITICAL: PRIVATE_KEY contains placeholder value!\n' +
      '   Replace with actual keypair in .env file.\n'
    );
    process.exit(1);
  }

  if (privateKey.length < 20) {
    console.error(
      '❌ CRITICAL: PRIVATE_KEY seems too short. Verify it\'s a valid base58 keypair.\n'
    );
    process.exit(1);
  }

  console.log('✅ PRIVATE_KEY is configured');
}

export default {
  getCorsOptions,
  getHelmetOptions,
  globalLimiter,
  authLimiter,
  paymentLimiter,
  withdrawalLimiter,
  sanitizeInput,
  errorHandler,
  securityLogger,
  validateJwtSecret,
  validatePrivateKey,
  auditLogger
};
