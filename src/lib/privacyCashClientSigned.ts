/**
 * Privacy Cash Client - CORRECT ARCHITECTURE
 * 
 * User signs transactions in browser (user = fee payer)
 * Backend only forwards signed transactions to relayer
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export interface DepositRequest {
  signedTransaction: string; // Base64 encoded signed transaction
  linkId?: string;
}

export interface DepositResponse {
  success: boolean;
  txSignature: string;
  message?: string;
}

/**
 * Submit user-signed deposit transaction via backend
 * User must sign with Privacy Cash SDK in browser first
 */
export async function submitSignedDeposit(request: DepositRequest): Promise<DepositResponse> {
  console.log('📤 Submitting signed deposit transaction...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/privacy/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = 'Deposit submission failed';
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
    
    console.log('✅ Deposit submitted successfully!');
    console.log('   TX:', data.txSignature);
    
    return data;
  } catch (error) {
    console.error('❌ Deposit submission failed:', error);
    console.error('   API URL:', `${API_BASE_URL}/api/privacy/deposit`);
    throw error;
  }
}
