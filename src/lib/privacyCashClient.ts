/**
 * Privacy Cash Client - DEPRECATED MODEL
 * 
 * ⚠️  NOTE: Relayer-signed deposits are NOT the correct architecture
 * 
 * CORRECT ARCHITECTURE (confirmed by Privacy Cash team):
 * - Deposits: User signs in browser → privacyCashClientSigned.ts
 * - Withdrawals: Relayer-signed → Can use this file (requestWithdraw)
 * 
 * The requestDeposit() function below is DEPRECATED.
 * Use privacyCashClientSigned.ts for deposits.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export interface DepositRequest {
  amount: number; // in SOL
  linkId?: string;
  // walletAddress NOT needed - relayer signs everything
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
 * ❌ DEPRECATED: Do not use for deposits
 * 
 * This function expects relayer to sign deposits, which violates non-custodial principle.
 * 
 * USE INSTEAD: privacyCashClientSigned.ts for user-signed deposits
 * 
 * @deprecated Use submitSignedDeposit from privacyCashClientSigned.ts
 */
export async function requestDeposit(request: DepositRequest): Promise<DepositResponse> {
  throw new Error(
    "❌ requestDeposit() is deprecated - relayer deposits violate non-custodial principle\n" +
    "Use privacyCashClientSigned.ts instead for user-signed deposits\n" +
    "Architecture: User signs in browser → Browser submits to blockchain"
  );
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
