/**
 * Privacy Cash API Client
 * 
 * Frontend client untuk communicate dengan backend/relayer.
 * Frontend TIDAK import Privacy Cash SDK - semua ZK operations di backend.
 * 
 * Architecture:
 * Browser (Phantom) → Backend API → Relayer → Privacy Cash SDK → Blockchain
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export interface DepositRequest {
  amount: number; // in SOL
  walletAddress: string;
  linkId?: string;
}

export interface DepositResponse {
  success: boolean;
  txSignature: string;
  commitment: string;
  amount: number;
  message?: string;
}

export interface WithdrawRequest {
  amount: number;
  recipientAddress: string;
  commitment: string;
  linkId?: string;
}

export interface WithdrawResponse {
  success: boolean;
  txSignature: string;
  amount: number;
  recipient: string;
  message?: string;
}

/**
 * Request deposit via backend relayer
 * Backend will call Privacy Cash SDK to perform ZK deposit
 */
export async function requestDeposit(request: DepositRequest): Promise<DepositResponse> {
  console.log('📤 Requesting deposit via backend...');
  console.log('   Amount:', request.amount, 'SOL');
  console.log('   Wallet:', request.walletAddress);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/privacy/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lamports: Math.floor(request.amount * 1e9),
        walletAddress: request.walletAddress,
        linkId: request.linkId,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Deposit request failed';
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || JSON.stringify(error);
      } catch (e) {
        // Response is not JSON, try text
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
      }
      console.error('❌ Backend error response:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    console.log('✅ Deposit request successful!');
    console.log('   TX:', data.txSignature);
    console.log('   Commitment:', data.commitment);
    
    return data;
  } catch (error) {
    console.error('❌ Deposit request failed:', error);
    console.error('   API URL:', `${API_BASE_URL}/api/privacy/deposit`);
    console.error('   Error type:', error instanceof Error ? error.constructor.name : typeof error);
    throw error;
  }
}

/**
 * Request withdrawal via backend relayer
 * Backend will call Privacy Cash SDK to perform ZK withdrawal
 */
export async function requestWithdraw(request: WithdrawRequest): Promise<WithdrawResponse> {
  console.log('📤 Requesting withdrawal via backend...');
  console.log('   Amount:', request.amount, 'SOL');
  console.log('   Recipient:', request.recipientAddress);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/privacy/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lamports: Math.floor(request.amount * 1e9),
        recipientAddress: request.recipientAddress,
        commitment: request.commitment,
        linkId: request.linkId,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Withdrawal request failed';
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || JSON.stringify(error);
      } catch (e) {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
      }
      console.error('❌ Backend error response:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    console.log('✅ Withdrawal request successful!');
    console.log('   TX:', data.txSignature);
    
    return data;
  } catch (error) {
    console.error('❌ Withdrawal request failed:', error);
    throw error;
  }
}

/**
 * Check relayer health status
 */
export async function checkRelayerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error('❌ Relayer health check failed:', error);
    return false;
  }
}
