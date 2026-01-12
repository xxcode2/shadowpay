# ShadowPay Security Audit Report

**Date**: January 12, 2026  
**Status**: AUDIT IN PROGRESS  
**Risk Level**: LOW → MEDIUM (with recommendations)

## 🔒 Executive Summary

ShadowPay has implemented solid foundational security measures:
- ✅ Non-custodial architecture (funds never touch backend)
- ✅ TweetNaCl signature verification
- ✅ JWT authentication with expiry
- ✅ Environment variable protection
- ✅ Input validation on critical paths
- ✅ Solana address format verification

However, several security enhancements are recommended before production:

---

## ✅ Security Strengths

### 1. Non-Custodial Model (EXCELLENT)
**Status**: ✅ STRONG  
**Location**: `server/privacyCashService.js`, `server/index.js`

**What's Good**:
- All funds held in Privacy Cash smart contract, NOT backend database
- Backend only manages metadata (links, commitments, timestamps)
- Direct transfers to recipient wallets (no fund intermediation)
- Reduces regulatory risk and security exposure

**Evidence**:
```javascript
// In /links/:id/pay endpoint
// Backend calls Privacy Cash SDK to deposit
const result = await privacyCashService.depositSOL({ lamports, referrer });
// Funds go to Privacy Cash pool contract
// Backend only stores: commitment, txHash, status
```

### 2. Cryptographic Signature Verification (STRONG)
**Status**: ✅ STRONG  
**Location**: `server/auth.js` (lines 28-37)

**What's Good**:
- Uses TweetNaCl.js (audited crypto library)
- Detached signatures prevent tampering
- Public key derivation from Solana keypairs
- Proper error handling

**Code Review**:
```javascript
export function verifySignature(message, signature, publicKeyBase58) {
  try {
    const publicKeyUint8 = bs58.decode(publicKeyBase58);
    const messageUint8 = decodeUTF8(message);
    const signatureUint8 = decodeBase64(signature);
    return nacl.sign.detached.verify(messageUint8, signatureUint8, publicKeyUint8);
  } catch (err) {
    return false; // Fail safely
  }
}
```

### 3. JWT Authentication (GOOD)
**Status**: ✅ GOOD  
**Location**: `server/auth.js` (lines 44-56)

**What's Good**:
- 24-hour token expiry
- Claims include publicKey and wallet info
- Middleware-protected endpoints
- Proper token verification

**Code Review**:
```javascript
export function generateToken(publicKey, wallet) {
  return jwt.sign(
    { publicKey, wallet, iat: Date.now() },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}
```

### 4. Input Validation (GOOD)
**Status**: ✅ GOOD  
**Location**: `server/index.js` (multiple endpoints)

**What's Good**:
- Solana address validation via PublicKey constructor
- Amount must be positive
- Required fields checked
- Prevents duplicate withdrawals

**Examples**:
```javascript
// POST /links/:id/pay
if (!amount || !token) {
  return res.status(400).json({ error: "Amount and token required" });
}
if (amount <= 0) {
  return res.status(400).json({ error: "Amount must be positive" });
}

// POST /links/:id/claim  
try {
  new PublicKey(recipientWallet); // Validates format
} catch (err) {
  return res.status(400).json({ error: "Invalid Solana wallet address" });
}
```

### 5. Environment Variable Protection (GOOD)
**Status**: ✅ GOOD  
**Location**: `.env.testnet`, `supabaseClient.ts`

**What's Good**:
- Sensitive keys in environment variables
- Never logged or exposed
- Graceful fallback if missing
- Clear warnings in console

---

## ⚠️ Security Concerns & Recommendations

### 1. CORS Configuration (MEDIUM RISK)
**Status**: ⚠️ NEEDS IMPROVEMENT  
**Location**: `server/index.js` line 70

**Current**:
```javascript
app.use(cors()); // Allows ALL origins
```

**Risk**: 
- Any website can call ShadowPay backend API
- Vulnerable to CSRF attacks
- Could enable token theft if stored in localStorage

**Recommendation**:
```javascript
// ADD THIS
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Specific CORS origins
const corsOptions = {
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
};
app.use(cors(corsOptions));

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);
```

**Priority**: 🔴 HIGH - Implement before production

---

### 2. Rate Limiting (MEDIUM RISK)
**Status**: ⚠️ MISSING  
**Location**: `server/index.js`

**Risk**:
- No protection against brute force attacks
- No DoS protection
- Endpoints exposed to abuse

**Recommendation**:
```javascript
// Rate limit auth endpoint more strictly
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Only 10 login attempts per 15 min
  skipSuccessfulRequests: true
});
app.post("/auth/login", authLimiter, async (req, res) => { ... });

// Rate limit payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 payment attempts per minute
});
app.post("/links/:id/pay", paymentLimiter, async (req, res) => { ... });
```

**Priority**: 🟡 MEDIUM - Implement before production

---

### 3. Missing Security Headers (LOW-MEDIUM RISK)
**Status**: ⚠️ MISSING  
**Location**: `server/index.js`

**Risk**:
- No protection against XSS, clickjacking, MIME type attacks
- Missing CSP headers
- No HSTS enforcement

**Recommendation**:
```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "phantom.app"], // Allow Phantom wallet
      styleSrc: ["'self'", "'unsafe-inline'"], // For CSS
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["phantom.app"], // Allow Phantom iframe
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));
```

**Priority**: 🟡 MEDIUM

---

### 4. Input Sanitization (LOW RISK)
**Status**: ⚠️ PARTIALLY ADDRESSED  
**Location**: `server/index.js`

**Risk**:
- No sanitization of message/signature in auth
- Could be vulnerable to buffer overflow attacks
- JSON parsing could have issues

**Recommendation**:
```javascript
import sanitize from 'mongo-sanitize';

app.use(sanitize()); // Prevents NoSQL injection

// In auth endpoint
app.post("/auth/login", async (req, res) => {
  let { publicKey, message, signature } = req.body;
  
  // Sanitize inputs
  publicKey = String(publicKey).trim().substring(0, 100);
  message = String(message).trim().substring(0, 500);
  signature = String(signature).trim().substring(0, 1000);
  
  // Validate format
  if (!/^[A-Za-z0-9]+$/.test(publicKey)) {
    return res.status(400).json({ error: "Invalid key format" });
  }
  
  // ... rest of code
});
```

**Priority**: 🟡 MEDIUM

---

### 5. Private Key Management (HIGH RISK)
**Status**: ⚠️ DANGEROUS IN CURRENT FORM  
**Location**: `server/index.js` line 50, `.env.testnet`

**Current**:
```javascript
const OWNER = process.env.PRIVATE_KEY; // ← Stored in env file
```

**Risk**:
- If `.env` is committed to git, key is compromised
- Dev/prod keys not separated
- Keypair used for all transactions (single point of failure)
- No key rotation mechanism

**Recommendation**:
```javascript
// 1. Use AWS Secrets Manager / HashiCorp Vault / Azure Key Vault
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function getPrivateKey() {
  const client = new SecretsManager();
  const secret = await client.getSecretValue({ 
    SecretId: 'shadowpay-private-key' 
  });
  return JSON.parse(secret.SecretString).key;
}

// 2. NEVER commit .env files
// Create .env.example for reference only
// Add to .gitignore:
echo ".env*" >> .gitignore
echo "*.key" >> .gitignore

// 3. Use separate keys for different operations
// - Deposit operations: operatorKey (limited permissions)
// - Withdrawal operations: withdrawKey (limited permissions)
// - Admin operations: adminKey (full permissions)
```

**Priority**: 🔴 CRITICAL - Fix before production

---

### 6. JWT Secret Management (MEDIUM RISK)
**Status**: ⚠️ HARDCODED DEFAULT  
**Location**: `server/auth.js` line 8

**Current**:
```javascript
const JWT_SECRET = process.env.JWT_SECRET || "shadowpay-dev-secret-key-change-in-production";
```

**Risk**:
- If env var not set, uses weak default
- Default left in code as fallback
- No rotation mechanism

**Recommendation**:
```javascript
// Enforce JWT_SECRET is set
if (!process.env.JWT_SECRET) {
  throw new Error(
    '❌ CRITICAL: JWT_SECRET not set in environment\n' +
    '   Generate with: openssl rand -hex 32\n' +
    '   Add to .env: JWT_SECRET=<output>\n'
  );
}

if (process.env.JWT_SECRET === "shadowpay-dev-secret-key-change-in-production") {
  throw new Error('❌ CRITICAL: Must set unique JWT_SECRET in production');
}

const JWT_SECRET = process.env.JWT_SECRET;

// Optional: Add token rotation after N uses
const TOKEN_ROTATION_THRESHOLD = 100; // Rotate every 100 tokens
let tokenCount = 0;
```

**Priority**: 🟡 MEDIUM

---

### 7. Logging & Monitoring (LOW RISK)
**Status**: ⚠️ MISSING SECURITY LOGGING  
**Location**: `server/index.js`

**Risk**:
- No audit trail for sensitive operations
- Failed auth attempts not tracked
- No intrusion detection

**Recommendation**:
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/audit.log' }),
    new winston.transports.Console()
  ]
});

// Log security events
app.post("/auth/login", async (req, res) => {
  try {
    const { publicKey } = req.body;
    const isValid = verifySignature(message, signature, publicKey);
    
    if (!isValid) {
      logger.warn('⚠️ Failed auth attempt', {
        timestamp: new Date(),
        publicKey,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      return res.status(401).json({ error: "Invalid signature" });
    }
    
    logger.info('✅ Successful auth', {
      timestamp: new Date(),
      publicKey,
      ip: req.ip
    });
  } catch (err) {
    logger.error('❌ Auth error', { error: err.message, publicKey: req.body.publicKey });
  }
});
```

**Priority**: 🟡 MEDIUM

---

### 8. Supabase Security (MEDIUM RISK)
**Status**: ⚠️ USING ANON KEY  
**Location**: `src/lib/supabaseClient.ts`

**Current**:
```typescript
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
```

**Risk**:
- Anon key exposed to frontend
- Could allow direct DB manipulation
- No row-level security enforced
- Backend should use service role key only

**Recommendation**:
```typescript
// Frontend - Read only, with RLS enabled
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Backend - Use service role key for sensitive operations
// server/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ← Never expose this
);

// Enable RLS on all tables:
// - Enable anon access: SELECT only (via RLS policy)
// - Enable authenticated access: Own data only
// - Disable service role bypass for auth checks

// Example policy:
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id OR created_by = auth.uid());
```

**Priority**: 🟡 MEDIUM

---

## 🔐 Security Checklist

### Before Beta/Testnet
- [ ] Add rate limiting to all endpoints
- [ ] Configure CORS to specific origins
- [ ] Add helmet security headers
- [ ] Implement audit logging
- [ ] Enforce JWT_SECRET is set
- [ ] Add input sanitization
- [ ] Test with OWASP ZAP
- [ ] Review all error messages (no leaking internals)

### Before Production
- [ ] Move private keys to secure vault (AWS Secrets Manager)
- [ ] Enable Supabase RLS policies
- [ ] Set up DDoS protection (CloudFlare, AWS Shield)
- [ ] Implement Web Application Firewall (WAF)
- [ ] Add intrusion detection logging
- [ ] Set up 24/7 monitoring alerts
- [ ] Penetration testing by 3rd party
- [ ] Bug bounty program
- [ ] Insurance/liability coverage

### Ongoing
- [ ] Weekly security log review
- [ ] Monthly dependency updates & CVE checks
- [ ] Quarterly penetration testing
- [ ] Annual security audit

---

## 📋 Implementation Priority

### CRITICAL (This Week)
1. ✅ Move PRIVATE_KEY to AWS Secrets Manager
2. ✅ Enforce JWT_SECRET is set
3. ✅ Add rate limiting (auth endpoint)

### HIGH (Before Beta)
1. ✅ Configure CORS properly
2. ✅ Add helmet security headers
3. ✅ Add input sanitization

### MEDIUM (Before Production)
1. ✅ Implement audit logging
2. ✅ Enable Supabase RLS
3. ✅ Add monitoring alerts

---

## 🔍 Security Testing

### Manual Testing
```bash
# 1. Test CORS
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -v http://localhost:3333/auth/login

# 2. Test rate limiting
for i in {1..50}; do
  curl -X POST http://localhost:3333/auth/login \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}'
done

# 3. Test SQL injection (should fail safely)
curl -X POST http://localhost:3333/links/a1b2c3d4/pay \
  -H "Content-Type: application/json" \
  -d '{"amount": "0.1; DROP TABLE links; --", "token": "SOL"}'

# 4. Test XSS in messages
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"publicKey": "xxx", "message": "<script>alert(1)</script>", "signature": "xxx"}'
```

### Automated Testing
```bash
# Install OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3333

# Install npm security auditor
npm audit
npm audit fix
```

---

## ✅ Conclusion

**Current Status**: GOOD FOUNDATION, NEEDS HARDENING

ShadowPay has implemented solid security practices for a beta application:
- ✅ Non-custodial model eliminates fund risk
- ✅ Cryptographic signature verification working
- ✅ JWT authentication in place
- ✅ Input validation on critical paths

**Before Production**:
1. Implement rate limiting
2. Configure CORS properly
3. Move keys to secure vault
4. Add security headers
5. Enable Supabase RLS
6. Implement audit logging
7. Penetration testing

**Risk Level**: 
- Current: 🟡 MEDIUM (acceptable for beta)
- With recommendations: 🟢 LOW (acceptable for production)

---

## 📞 Security Contact

For security issues, email: security@shadowpay.app (TODO: Set up)

Do not disclose security vulnerabilities publicly until fixed.
