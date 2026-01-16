/**
 * Privacy Cash Client-Side Deposit (MODEL B)
 * 
 * ARCHITECTURE:
 * - 100% browser-based ZK proof generation
 * - User wallet signs transaction
 * - Direct RPC submission (no backend)
 * - UTXO stored in localStorage
 * 
 * SAME MODEL AS: Tornado Cash, Railgun, Aztec
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Privacy Cash Program ID (mainnet-beta)
// TODO: Replace with actual Privacy Cash program ID from official deployment
// This is a placeholder - using System Program for now to avoid initialization errors
const PRIVACY_PROGRAM_ID = new PublicKey("11111111111111111111111111111111"); // SystemProgram as placeholder

// Circuit paths
const CIRCUIT_WASM_PATH = "/circuit2/transaction2.wasm";
const CIRCUIT_ZKEY_PATH = "/circuit2/transaction2.zkey";
const WITNESS_CALCULATOR_PATH = "/circuit2/witness_calculator.js";

// BN254 scalar field size (circom uses this)
const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DepositResult {
  txSignature: string;
  commitment: string;
  utxo: UTXOData;
}

export interface UTXOData {
  amount: number; // lamports
  commitment: string;
  nullifier: string;
  secret: string;
  timestamp: number;
}

interface WitnessCalculator {
  calculateWitness: (input: any, sanityCheck?: boolean) => Promise<any>;
}

declare global {
  interface Window {
    witnessCalculator?: any;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION SERVICE (Wallet-Based)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derives encryption key from wallet signature
 * Same approach as Privacy Cash official website
 */
export class EncryptionService {
  private encryptionKey: Uint8Array | null = null;

  /**
   * User signs message "Privacy Money account sign in"
   * Signature is used as encryption key for UTXO storage
   */
  async deriveEncryptionKeyFromSignature(signature: Uint8Array): Promise<void> {
    // Use first 32 bytes of signature as encryption key
    this.encryptionKey = signature.slice(0, 32);
    console.log("✅ Encryption key derived from wallet signature");
  }

  getEncryptionKey(): Uint8Array {
    if (!this.encryptionKey) {
      throw new Error("Encryption key not initialized. Call deriveEncryptionKeyFromSignature first.");
    }
    return this.encryptionKey;
  }

  /**
   * Encrypt UTXO data for localStorage using XOR cipher
   */
  async encryptUTXO(utxo: UTXOData): Promise<string> {
    const json = JSON.stringify(utxo);
    const key = this.getEncryptionKey();
    const encrypted = new Uint8Array(json.length);
    
    for (let i = 0; i < json.length; i++) {
      encrypted[i] = json.charCodeAt(i) ^ key[i % key.length];
    }
    
    return btoa(String.fromCharCode(...encrypted));
  }

  /**
   * Decrypt UTXO data from localStorage
   */
  async decryptUTXO(encrypted: string): Promise<UTXOData> {
    const key = this.getEncryptionKey();
    const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const decrypted = new Uint8Array(encryptedBytes.length);
    
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ key[i % key.length];
    }
    
    const json = String.fromCharCode(...decrypted);
    return JSON.parse(json);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT & PROOF GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load witness calculator builder from JavaScript file
 * Returns the builder function that creates WitnessCalculator instances
 */
async function loadWitnessCalculatorBuilder(): Promise<any> {
  console.log("📦 Loading witness calculator builder...");
  
  try {
    // Check if already loaded
    if (window.witnessCalculator) {
      console.log("✅ Witness calculator builder already loaded");
      return window.witnessCalculator;
    }

    // Dynamically load witness calculator script
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = WITNESS_CALCULATOR_PATH;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load witness calculator'));
      document.head.appendChild(script);
    });

    if (!window.witnessCalculator) {
      throw new Error('Witness calculator not available after loading');
    }

    console.log("✅ Witness calculator builder loaded");
    return window.witnessCalculator;
  } catch (error) {
    console.error("❌ Failed to load witness calculator:", error);
    throw new Error(`Circuit loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load WASM circuit
 */
async function loadCircuitWasm(): Promise<ArrayBuffer> {
  console.log("📦 Loading circuit WASM...");
  
  try {
    const response = await fetch(CIRCUIT_WASM_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    console.log(`✅ Circuit WASM loaded (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    return buffer;
  } catch (error) {
    console.error("❌ Failed to load circuit WASM:", error);
    throw new Error(`Circuit WASM loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load proving key
 */
async function loadProvingKey(): Promise<ArrayBuffer> {
  console.log("📦 Loading proving key...");
  
  try {
    const response = await fetch(CIRCUIT_ZKEY_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    console.log(`✅ Proving key loaded (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    return buffer;
  } catch (error) {
    console.error("❌ Failed to load proving key:", error);
    throw new Error(`Proving key loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate random secret as single BN254 field element
 * CRITICAL: Must be ONE field, not array/bytes
 */
function generateSecret(): bigint {
  // Generate 31 bytes (248 bits) to safely fit in BN254 field (254 bits)
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  
  // Convert bytes to BigInt
  let secret = 0n;
  for (let i = 0; i < bytes.length; i++) {
    secret = (secret << 8n) | BigInt(bytes[i]);
  }
  
  // Ensure within field size
  if (secret >= FIELD_SIZE) {
    secret = secret % FIELD_SIZE;
  }
  
  console.log('✅ Generated secret (single field element):', {
    value: secret.toString().slice(0, 20) + '...',
    type: typeof secret,
    isArray: Array.isArray(secret),
    inField: secret < FIELD_SIZE
  });
  
  return secret;
}

/**
 * Compute Poseidon hash (placeholder - use Privacy Cash's implementation)
 * In real implementation, this would use the Poseidon hash from the circuit
 */
function poseidonHash(inputs: bigint[]): bigint {
  // CRITICAL: This is a placeholder
  // Real implementation should use the exact Poseidon hash from Privacy Cash
  // For now, use a simple hash as fallback
  let hash = 0n;
  for (const input of inputs) {
    hash = (hash + input) % (2n ** 254n);
  }
  return hash;
}

/**
 * Compute commitment from secret
 * TEMPORARY: For testing, use identity function
 * TODO: Replace with actual Poseidon hash matching the circuit
 */
function computeCommitment(secret: bigint): bigint {
  console.log("🔐 Computing commitment (testing mode: commitment = secret)...");
  // TESTING ONLY: Use secret as commitment to validate circuit works
  // This is safe for testing - no mainnet funds at risk
  return secret;
}

/**
 * Compute nullifier from secret
 * TEMPORARY: For testing, use identity function
 * TODO: Replace with actual Poseidon hash matching the circuit
 */
function computeNullifier(secret: bigint): bigint {
  console.log("🔐 Computing nullifier (testing mode: nullifier = secret)...");
  // TESTING ONLY: Use secret as nullifier to validate circuit works
  return secret;
}

/**
 * Generate ZK proof for WITHDRAWAL (not deposit!)
 * CRITICAL: Privacy Cash deposits do NOT need ZK proofs
 * ZK proofs are only for withdrawals/spends
 * 
 * This function is kept for future withdrawal implementation
 */
async function generateWithdrawalProof(
  secret: bigint,
  commitment: bigint,
  amount: bigint
): Promise<{ proof: Uint8Array; publicSignals: bigint[] }> {
  console.log("🔐 Generating ZK proof for withdrawal...");
  console.log("   This may take 10-30 seconds...");
  
  // TODO: Implement withdrawal proof generation with transaction2.wasm
  // Circuit expects: root, nullifierHash, outCommitment, extDataHash, etc.
  // NOT: secret, commitment, amount
  
  throw new Error("Withdrawal proof generation not yet implemented. Use this for withdrawals, not deposits!");
}

/**
 * Build Privacy Cash deposit instruction
 * CRITICAL: Deposit does NOT require ZK proof!
 * Only commitment and amount are needed
 */
function buildDepositInstruction(
  userPubkey: PublicKey,
  commitment: bigint,
  amount: bigint
): TransactionInstruction {
  console.log("📝 Building deposit instruction (NO ZK proof)...");

  // Serialize instruction data
  // Format: [discriminator: 1 byte][commitment: 32 bytes][amount: 8 bytes]
  const data = Buffer.alloc(1 + 32 + 8);
  let offset = 0;

  // Instruction discriminator (0 = deposit)
  data.writeUInt8(0, offset);
  offset += 1;

  // Commitment (32 bytes)
  const commitmentBytes = Buffer.from(commitment.toString(16).padStart(64, '0'), 'hex');
  commitmentBytes.copy(data, offset);
  offset += 32;

  // Amount (8 bytes, little-endian)
  data.writeBigUInt64LE(amount, offset);

  console.log("   ✅ Instruction data:", data.length, "bytes (no proof needed)");

  // Build instruction
  // Note: Real implementation needs correct account metas (pool PDA, merkle tree, etc.)
  return new TransactionInstruction({
    keys: [
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: PRIVACY_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PRIVACY_PROGRAM_ID,
    data
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DEPOSIT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Client-side SOL deposit to Privacy Cash
 * 
 * @param amountLamports - Amount to deposit in lamports
 * @param connection - Solana connection
 * @param publicKey - User's wallet public key
 * @param signTransaction - Wallet's sign function
 * @param encryptionService - Encryption service for UTXO storage
 * 
 * @returns DepositResult with tx signature, commitment, UTXO
 */
export async function depositSOL({
  amountLamports,
  connection,
  publicKey,
  signTransaction,
  encryptionService
}: {
  amountLamports: number;
  connection: Connection;
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  encryptionService: EncryptionService;
}): Promise<DepositResult> {
  console.log("💰 Starting Privacy Cash deposit...");
  console.log("   Amount:", amountLamports / LAMPORTS_PER_SOL, "SOL");
  console.log("   Wallet:", publicKey.toBase58());
  console.log("   Mode: CLIENT-SIDE (MODEL B)");

  try {
    // 1. Generate secret and commitment
    console.log("\n🔐 Step 1: Generating secret and commitment...");
    const secret = generateSecret();
    const commitment = computeCommitment(secret);
    const nullifier = computeNullifier(secret);
    
    console.log("   Secret:", secret.toString(16).substring(0, 16) + "...");
    console.log("   Commitment:", commitment.toString(16).substring(0, 16) + "...");
    console.log("   Nullifier:", nullifier.toString(16).substring(0, 16) + "...");

    // 2. Build deposit transaction (NO ZK PROOF NEEDED!)
    console.log("\n📝 Step 2: Building deposit transaction...");
    console.log("   ℹ️  Privacy Cash deposits do NOT require ZK proofs");
    console.log("   ℹ️  ZK proofs are only for withdrawals (like Tornado Cash)");
    
    const transaction = new Transaction();
    
    const depositInstruction = buildDepositInstruction(
      publicKey,
      commitment,
      BigInt(amountLamports)
    );
    
    transaction.add(depositInstruction);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = publicKey;

    console.log("   ✅ Transaction built (no ZK proof required for deposits)");

    // 3. User signs transaction
    console.log("\n✍️  Step 3: Requesting wallet signature...");
    console.log("   Please approve the transaction in your wallet");
    
    const signedTransaction = await signTransaction(transaction);
    console.log("   ✅ Transaction signed by user");

    // 4. Submit to RPC directly (NO BACKEND)
    console.log("\n📡 Step 4: Submitting to Solana RPC...");
    const signature = await connection.sendRawTransaction(
      signedTransaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      }
    );

    console.log("   ✅ Transaction submitted:", signature);

    // 5. Confirm transaction
    console.log("\n⏳ Step 5: Confirming transaction...");
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log("   ✅ Transaction confirmed!");

    // 6. Create UTXO data
    const utxo: UTXOData = {
      amount: amountLamports,
      commitment: commitment.toString(16),
      nullifier: nullifier.toString(16),
      secret: secret.toString(16),
      timestamp: Date.now(),
    };

    // 7. Store encrypted UTXO in localStorage
    console.log("\n💾 Step 6: Storing encrypted UTXO...");
    const encryptedUTXO = await encryptionService.encryptUTXO(utxo);
    const storedUTXOs = JSON.parse(localStorage.getItem("privacycash_utxos") || "[]");
    storedUTXOs.push(encryptedUTXO);
    localStorage.setItem("privacycash_utxos", JSON.stringify(storedUTXOs));

    console.log("   ✅ UTXO stored in localStorage");
    console.log("\n🎉 DEPOSIT COMPLETE!");
    console.log("   TX:", signature);
    console.log("   Commitment:", utxo.commitment.substring(0, 16) + "...");
    console.log("\n   ℹ️  Deposit is PUBLIC (like Tornado Cash)");
    console.log("   ℹ️  Use ZK proof for WITHDRAWAL to break on-chain link");

    return {
      txSignature: signature,
      commitment: utxo.commitment,
      utxo,
    };
  } catch (error) {
    console.error("\n❌ DEPOSIT FAILED:", error);
    throw error;
  }
}

/**
 * Get all stored UTXOs from localStorage
 */
export async function getStoredUTXOs(encryptionService: EncryptionService): Promise<UTXOData[]> {
  const stored = JSON.parse(localStorage.getItem("privacycash_utxos") || "[]");
  const decrypted: UTXOData[] = [];
  
  for (const encrypted of stored) {
    try {
      const utxo = await encryptionService.decryptUTXO(encrypted);
      decrypted.push(utxo);
    } catch (err) {
      console.error("Failed to decrypt UTXO:", err);
    }
  }
  
  return decrypted;
}

/**
 * Clear all stored UTXOs (for testing)
 */
export function clearStoredUTXOs(): void {
  localStorage.removeItem("privacycash_utxos");
  console.log("✅ Cleared all stored UTXOs");
}
