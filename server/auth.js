import nacl from "tweetnacl";
import util from "tweetnacl-util";
import jwt from "jsonwebtoken";
import bs58 from "bs58";

const { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } = util;

// CRITICAL: Enforce JWT_SECRET is set
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    '❌ CRITICAL: JWT_SECRET environment variable not set!\n' +
    '   Generate a secure secret with: openssl rand -hex 32\n' +
    '   Add to .env: JWT_SECRET=<output>\n'
  );
  process.exit(1);
}

if (JWT_SECRET === 'shadowpay-dev-secret-key-change-in-production') {
  console.error(
    '❌ CRITICAL: Must set unique JWT_SECRET for production!\n' +
    '   Current secret is the default development secret.\n' +
    '   Generate new secret: openssl rand -hex 32\n'
  );
  process.exit(1);
}

/**
 * Sign a message with a Solana private key
 */
export function signMessage(message, privateKeyBase58) {
  try {
    const privateKeyUint8 = bs58.decode(privateKeyBase58);
    const messageUint8 = decodeUTF8(message);
    const signature = nacl.sign.detached(messageUint8, privateKeyUint8);
    return encodeBase64(signature);
  } catch (err) {
    console.error("Sign error:", err);
    throw new Error("Failed to sign message");
  }
}

/**
 * Verify a signed message with a public key
 */
export function verifySignature(message, signature, publicKeyBase58) {
  try {
    const publicKeyUint8 = bs58.decode(publicKeyBase58);
    const messageUint8 = decodeUTF8(message);
    const signatureUint8 = decodeBase64(signature);
    return nacl.sign.detached.verify(messageUint8, signatureUint8, publicKeyUint8);
  } catch (err) {
    console.error("Verify error:", err);
    return false;
  }
}

/**
 * Generate a JWT token for authenticated session
 */
export function generateToken(publicKey, wallet) {
  return jwt.sign(
    { publicKey, wallet, iat: Date.now() },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Encrypt sensitive data using NaCl box (public key encryption)
 */
export function encryptData(data, publicKeyBase58) {
  try {
    const publicKeyUint8 = bs58.decode(publicKeyBase58);
    const dataUint8 = decodeUTF8(JSON.stringify(data));
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    
    // Generate ephemeral keypair for encryption
    const ephemeral = nacl.box.keyPair();
    const encrypted = nacl.box(dataUint8, nonce, publicKeyUint8, ephemeral.secretKey);
    
    const result = {
      nonce: encodeBase64(nonce),
      ephemeral: encodeBase64(ephemeral.publicKey),
      ciphertext: encodeBase64(encrypted),
    };
    
    return encodeBase64(encodeUTF8(JSON.stringify(result)));
  } catch (err) {
    console.error("Encrypt error:", err);
    throw new Error("Encryption failed");
  }
}

/**
 * Decrypt data (server-side only, requires private key)
 */
export function decryptData(encryptedData, privateKeyBase58) {
  try {
    const privateKeyUint8 = bs58.decode(privateKeyBase58);
    const decrypted = JSON.parse(decodeUTF8(decodeBase64(encryptedData)));
    
    const nonce = decodeBase64(decrypted.nonce);
    const ephemeralPublicKey = decodeBase64(decrypted.ephemeral);
    const ciphertext = decodeBase64(decrypted.ciphertext);
    
    const plaintext = nacl.box.open(ciphertext, nonce, ephemeralPublicKey, privateKeyUint8);
    
    if (!plaintext) {
      throw new Error("Decryption failed");
    }
    
    return JSON.parse(decodeUTF8(plaintext));
  } catch (err) {
    console.error("Decrypt error:", err);
    throw new Error("Decryption failed");
  }
}

/**
 * Middleware to verify JWT token
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization token" });
  }
  
  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  
  req.user = decoded;
  next();
}
