/**
 * Privacy Cash Browser Implementation
 * 
 * Browser-compatible wrapper untuk Privacy Cash SDK
 * Menggunakan fetch() untuk load circuit files instead of fs.readFileSync()
 */

import { Connection, PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction, SystemProgram, ComputeBudgetProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { groth16 } from 'snarkjs';
// @ts-ignore
import { utils } from 'ffjavascript';
import { WasmFactory } from '@lightprotocol/hasher.rs';
import { keccak256 } from '@ethersproject/keccak256';
import BN from 'bn.js';

// Constants from Privacy Cash SDK
const PROGRAM_ID = new PublicKey("zkcaWyMT45WD1rTiqcCMPdsBvfXgFEzBYe63XLFbNXc");
const RELAYER_API_URL = "https://api3.privacycash.org";
const MERKLE_TREE_DEPTH = 20;
const FIELD_SIZE = new BN('21888242871839275222246405745257275088548364400416034343698204186575808495617');

interface CircuitFiles {
    wasm: ArrayBuffer;
    zkey: ArrayBuffer;
}

export class PrivacyCashBrowser {
    private connection: Connection;
    private circuits: CircuitFiles | null = null;
    private loading = false;

    constructor(rpcUrl: string) {
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    /**
     * Load circuit files dari /circuits/
     */
    async loadCircuits(onProgress?: (percent: number) => void): Promise<void> {
        if (this.circuits) {
            onProgress?.(100);
            return;
        }

        if (this.loading) {
            throw new Error('Circuits already loading');
        }

        this.loading = true;

        try {
            console.log('📦 Loading ZK circuit files...');
            
            // Load wasm (3.1 MB)
            onProgress?.(10);
            const wasmRes = await fetch('/circuits/transaction2.wasm');
            if (!wasmRes.ok) {
                throw new Error(`Failed to load wasm: ${wasmRes.status} - Circuit files may not be deployed. Check Vercel deployment.`);
            }
            const wasm = await wasmRes.arrayBuffer();
            if (wasm.byteLength === 0) {
                throw new Error('Circuit wasm file is empty! Circuit files not properly deployed.');
            }
            console.log('✅ Loaded transaction2.wasm:', (wasm.byteLength / 1024 / 1024).toFixed(2), 'MB');
            
            onProgress?.(50);
            
            // Load zkey (16 MB)
            const zkeyRes = await fetch('/circuits/transaction2.zkey');
            if (!zkeyRes.ok) {
                throw new Error(`Failed to load zkey: ${zkeyRes.status} - Circuit files may not be deployed. Check Vercel deployment.`);
            }
            const zkey = await zkeyRes.arrayBuffer();
            if (zkey.byteLength === 0) {
                throw new Error('Circuit zkey file is empty! Circuit files not properly deployed.');
            }
            console.log('✅ Loaded transaction2.zkey:', (zkey.byteLength / 1024 / 1024).toFixed(2), 'MB');
            
            this.circuits = { wasm, zkey };
            onProgress?.(100);
            
            console.log('✅ Circuits loaded successfully');
        } finally {
            this.loading = false;
        }
    }

    /**
     * Deposit SOL ke Privacy Cash pool
     * User signs dengan Phantom wallet
     */
    async deposit({
        lamports,
        phantomPublicKey,
        signTransaction,
        onProgress
    }: {
        lamports: number;
        phantomPublicKey: PublicKey;
        signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
        onProgress?: (message: string) => void;
    }): Promise<{ signature: string }> {
        // Ensure circuits loaded
        onProgress?.('Loading ZK circuits...');
        await this.loadCircuits();

        if (!this.circuits) {
            throw new Error('Circuits not loaded');
        }

        console.log('🔐 Starting Privacy Cash deposit...');
        console.log('Amount:', lamports, 'lamports (', (lamports / LAMPORTS_PER_SOL).toFixed(6), 'SOL)');
        console.log('User:', phantomPublicKey.toString().slice(0, 8) + '...');

        // Check balance
        onProgress?.('Checking balance...');
        const balance = await this.connection.getBalance(phantomPublicKey);
        if (balance < lamports) {
            throw new Error(`Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL`);
        }

        // Initialize WASM hasher
        onProgress?.('Initializing cryptography...');
        const lightWasm = await WasmFactory.getInstance();

        // Get tree state from relayer
        onProgress?.('Fetching Merkle tree state...');
        const treeState = await this.queryRemoteTreeState();
        console.log('Tree state:', treeState);

        // Generate UTXO keypair (deterministic dari wallet)
        const utxoPrivateKey = this.deriveUtxoPrivateKey(phantomPublicKey);
        console.log('Generated UTXO private key');

        // Build circuit input
        onProgress?.('Generating zero-knowledge proof...');
        const circuitInput = this.buildCircuitInput({
            amount: lamports,
            treeRoot: treeState.root,
            nextIndex: treeState.nextIndex,
            utxoPrivateKey,
            lightWasm
        });

        console.log('Circuit input prepared, generating proof...');

        // Generate ZK proof menggunakan snarkjs
        const { proof, publicSignals } = await groth16.fullProve(
            circuitInput,
            this.circuits.wasm,
            this.circuits.zkey
        );

        console.log('✅ ZK proof generated!');

        // Build Solana transaction
        onProgress?.('Building transaction...');
        const transaction = await this.buildDepositTransaction({
            proof,
            publicSignals,
            publicKey: phantomPublicKey,
            lamports,
            lightWasm
        });

        // User signs dengan Phantom
        onProgress?.('Waiting for wallet approval...');
        const signedTx = await signTransaction(transaction);
        console.log('✅ Transaction signed by user');

        // Submit ke Privacy Cash relayer
        onProgress?.('Submitting to Privacy Cash relayer...');
        const signature = await this.submitToRelayer(signedTx, phantomPublicKey);
        
        console.log('✅ Deposit submitted:', signature);
        
        // Wait confirmation
        onProgress?.('Confirming transaction...');
        await this.waitForConfirmation(signature);
        
        return { signature };
    }

    /**
     * Get current Merkle tree state dari relayer (matches SDK queryRemoteTreeState)
     */
    private async queryRemoteTreeState(): Promise<{ root: string; nextIndex: number }> {
        console.log('🌳 Fetching Merkle root from:', `${RELAYER_API_URL}/merkle/root`);
        const res = await fetch(`${RELAYER_API_URL}/merkle/root`);
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Tree state fetch failed:', res.status, errorText);
            throw new Error(`Failed to fetch Merkle root: ${res.status} ${res.statusText}`);
        }
        return await res.json();
    }

    /**
     * Derive UTXO private key dari wallet public key
     * Matches SDK EncryptionService.deriveUtxoPrivateKey V2 method:
     * 1. Create deterministic seed from public key
     * 2. Apply keccak256 to get encryption key
     * 3. Apply keccak256 again to get UTXO private key
     */
    private deriveUtxoPrivateKey(publicKey: PublicKey): string {
        // Use publicKey bytes as deterministic seed (simplified for browser)
        // SDK would use: keccak256(wallet.signature) but we don't have wallet keypair
        const seed = publicKey.toBytes();
        
        // Step 1: Derive encryption key (V2 method)
        const encryptionKey = Buffer.from(keccak256(seed).slice(2), 'hex');
        
        // Step 2: Derive UTXO private key from encryption key
        // Matches SDK: this.utxoPrivateKeyV2 = '0x' + keccak256(encryptionKeyV2).slice(2)
        const utxoPrivateKey = keccak256(encryptionKey);
        
        return utxoPrivateKey; // Already has '0x' prefix
    }

    /**
     * Build circuit input untuk ZK proof
     */
    private buildCircuitInput(params: {
        amount: number;
        treeRoot: string;
        nextIndex: number;
        utxoPrivateKey: string;
        lightWasm: any;
    }) {
        // Simplified circuit input
        // In production, need full UTXO logic dari SDK
        const publicAmount = new BN(params.amount).add(FIELD_SIZE).mod(FIELD_SIZE);
        
        return {
            root: params.treeRoot,
            publicAmount: publicAmount.toString(),
            extDataHash: '0', // Placeholder
            // ... other circuit inputs
            // TODO: Extract full logic dari privacy-cash-sdk/src/deposit.ts
        };
    }

    /**
     * Build Solana transaction dengan proof
     */
    private async buildDepositTransaction(params: {
        proof: any;
        publicSignals: string[];
        publicKey: PublicKey;
        lamports: number;
        lightWasm: any;
    }): Promise<VersionedTransaction> {
        // Get program accounts
        const [treeAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from('tree')],
            PROGRAM_ID
        );

        // Build deposit instruction
        const instruction = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: params.publicKey, isSigner: true, isWritable: true },
                { pubkey: treeAccount, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([]) // TODO: Serialize proof + data
        });

        // Add compute budget
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_400_000
        });

        // Build V0 transaction
        const { blockhash } = await this.connection.getLatestBlockhash();
        
        const message = new TransactionMessage({
            payerKey: params.publicKey,
            recentBlockhash: blockhash,
            instructions: [modifyComputeUnits, instruction]
        }).compileToV0Message();

        return new VersionedTransaction(message);
    }

    /**
     * Submit signed transaction ke Privacy Cash relayer
     */
    private async submitToRelayer(
        signedTx: VersionedTransaction,
        senderPublicKey: PublicKey
    ): Promise<string> {
        const serialized = Buffer.from(signedTx.serialize()).toString('base64');

        const res = await fetch(`${RELAYER_API_URL}/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                signedTransaction: serialized,
                senderAddress: senderPublicKey.toString()
            })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Relayer error: ${error}`);
        }

        const { signature } = await res.json();
        return signature;
    }

    /**
     * Wait for transaction confirmation
     */
    private async waitForConfirmation(signature: string): Promise<void> {
        const startTime = Date.now();
        const timeout = 60000; // 60 seconds

        while (Date.now() - startTime < timeout) {
            try {
                const status = await this.connection.getSignatureStatus(signature);
                if (status?.value?.confirmationStatus === 'confirmed' || 
                    status?.value?.confirmationStatus === 'finalized') {
                    console.log('✅ Transaction confirmed');
                    return;
                }
            } catch (e) {
                // Retry
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error('Transaction confirmation timeout');
    }
}
