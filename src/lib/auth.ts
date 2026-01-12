import nacl from "tweetnacl";
import util from "tweetnacl-util";
import bs58 from "bs58";

const { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } = util;

/**
 * Convert string to Uint8Array
 */
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert Uint8Array to string
 */
function uint8ArrayToString(arr: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(arr);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

/**
 * Convert base58 string to Uint8Array
 */
function base58ToUint8Array(base58: string): Uint8Array {
  return new Uint8Array(bs58.decode(base58));
}

/**
 * Frontend authentication service
 * Works with Solana wallet (Phantom, etc.)
 */

interface WalletAdapter {
  publicKey: { toString(): string };
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export async function walletLogin(wallet: WalletAdapter): Promise<string> {
  if (!wallet?.publicKey) {
    throw new Error("Wallet not connected");
  }

  const publicKey = wallet.publicKey.toString();
  const message = `Sign this message to authenticate with ShadowPay\nTimestamp: ${Date.now()}`;
  const messageUint8 = stringToUint8Array(message);

  try {
    const signature = await wallet.signMessage(messageUint8);
    const signatureBase64 = uint8ArrayToBase64(signature);

    // Use relative API path (backend should be proxied or on same origin)
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const endpoint = apiUrl ? `${apiUrl}/auth/login` : '/api/auth/login';
    
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, message, signature: signatureBase64 }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const { token } = await res.json();
    // Only use localStorage for UX cache, not for state
    return token;
  } catch (err) {
    console.error("Login error:", err);
    throw err;
  }
}

export function getToken(): string | null {
  return localStorage.getItem("shadowpay_token");
}

export function getWallet(): string | null {
  return localStorage.getItem("shadowpay_wallet");
}

export function logout() {
  localStorage.removeItem("shadowpay_token");
  localStorage.removeItem("shadowpay_wallet");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Fetch with automatic token injection
 */
export async function authFetch(url: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  } as Record<string, string>;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    logout();
    window.location.href = "/";
  }

  return res;
}

/**
 * Encrypt sensitive data for transmission
 */
export function encryptDataClient(data: any, publicKeyBase58: string): string {
  try {
    const publicKeyUint8 = base58ToUint8Array(publicKeyBase58);
    const dataUint8 = stringToUint8Array(JSON.stringify(data));
    const nonce = nacl.randomBytes(nacl.box.nonceLength);

    const ephemeral = nacl.box.keyPair();
    const encrypted = nacl.box(dataUint8, nonce, publicKeyUint8, ephemeral.secretKey);

    const result = {
      nonce: uint8ArrayToBase64(nonce),
      ephemeral: uint8ArrayToBase64(ephemeral.publicKey),
      ciphertext: uint8ArrayToBase64(encrypted),
    };

    return uint8ArrayToBase64(stringToUint8Array(JSON.stringify(result)));
  } catch (err) {
    console.error("Encrypt error:", err);
    throw err;
  }
}
