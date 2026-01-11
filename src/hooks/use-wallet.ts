import { useState, useEffect } from "react";
import { walletLogin, logout, getToken, getWallet } from "@/lib/auth";

interface WalletState {
  connected: boolean;
  publicKey: string | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    token: null,
    loading: true, // Start with loading true
    error: null,
  });

  // Check if already authenticated on mount and auto-reconnect
  useEffect(() => {
    const initWallet = async () => {
      const token = getToken();
      const wallet = getWallet();
      
      // Check if we have stored wallet data
      if (wallet) {
        try {
          const phantom = (window as any).phantom?.solana;
          
          if (!phantom) {
            console.warn("Phantom not found, clearing stored wallet data");
            localStorage.removeItem("shadowpay_wallet");
            localStorage.removeItem("shadowpay_token");
            setState({
              connected: false,
              publicKey: null,
              token: null,
              loading: false,
              error: null,
            });
            return;
          }

          // Check if Phantom is already connected
          if (phantom.isConnected) {
            console.log("✅ Wallet already connected to Phantom:", wallet.slice(0, 8) + "...");
            setState({
              connected: true,
              publicKey: wallet,
              token,
              loading: false,
              error: null,
            });
          } else {
            // Try to reconnect silently
            console.log("🔄 Attempting silent reconnection...");
            try {
              const resp = await phantom.connect({ onlyIfTrusted: true });
              const publicKey = resp.publicKey?.toString();
              
              if (publicKey && publicKey === wallet) {
                console.log("✅ Silently reconnected:", publicKey.slice(0, 8) + "...");
                setState({
                  connected: true,
                  publicKey,
                  token,
                  loading: false,
                  error: null,
                });
              } else {
                // Clear stored data if wallet changed
                console.warn("Wallet address changed, clearing stored data");
                localStorage.removeItem("shadowpay_wallet");
                localStorage.removeItem("shadowpay_token");
                setState({
                  connected: false,
                  publicKey: null,
                  token: null,
                  loading: false,
                  error: null,
                });
              }
            } catch (err) {
              // Silent reconnect failed, user needs to connect manually
              const errMsg = err instanceof Error ? err.message : String(err);
              console.log("ℹ️ Silent reconnect failed, manual connection required");
              console.log("Reconnect error details:", errMsg);
              setState({
                connected: false,
                publicKey: null,
                token: null,
                loading: false,
                error: null,
              });
            }
          }
        } catch (err) {
          console.error("Error initializing wallet:", err);
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("Init error details:", errMsg);
          setState({
            connected: false,
            publicKey: null,
            token: null,
            loading: false,
            error: null,
          });
        }
      } else {
        // No stored wallet
        setState({
          connected: false,
          publicKey: null,
          token: null,
          loading: false,
          error: null,
        });
      }
    };

    initWallet();

    // Listen for Phantom disconnect events
    const phantom = (window as any).phantom?.solana;
    if (phantom) {
      const handleDisconnect = () => {
        console.log("👋 Phantom disconnected");
        localStorage.removeItem("shadowpay_wallet");
        localStorage.removeItem("shadowpay_token");
        setState({
          connected: false,
          publicKey: null,
          token: null,
          loading: false,
          error: null,
        });
      };

      phantom.on("disconnect", handleDisconnect);

      // Cleanup
      return () => {
        phantom.off("disconnect", handleDisconnect);
      };
    }
  }, []);

  const connect = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Check if Phantom is installed with better detection
      const phantom = (window as any).phantom?.solana;
      
      if (!phantom) {
        // Check if window.solana exists (some wallets)
        const solana = (window as any).solana;
        if (solana?.isPhantom) {
          throw new Error("Phantom wallet detected but not properly initialized. Please refresh the page.");
        }
        throw new Error("Phantom wallet not found. Please install Phantom extension from phantom.app");
      }

      console.log("🦊 Phantom wallet detected, requesting connection...");

      // Request connection with timeout
      const connectPromise = phantom.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timed out. Please try again.")), 30000)
      );
      
      const resp = await Promise.race([connectPromise, timeoutPromise]) as any;
      
      const publicKey = resp.publicKey?.toString();
      if (!publicKey) {
        throw new Error("Failed to get public key from Phantom");
      }

      console.log("✅ Wallet connected:", publicKey.slice(0, 8) + "...");

      // ========================================================================
      // WALLET CONNECTED — SET STATE FIRST (DEMO/HACKATHON MODE)
      // ========================================================================
      // This ensures wallet shows as "connected" even if backend is offline.
      // Perfect for demos, testnet, or when backend auth is not critical.
      
      setState({
        connected: true,
        publicKey,
        token: null, // Will be populated if backend auth succeeds
        loading: false,
        error: null,
      });

      // Store wallet (no token yet)
      localStorage.setItem("shadowpay_wallet", publicKey);

      // ========================================================================
      // OPTIONAL BACKEND AUTH (GRACEFUL FAIL)
      // ========================================================================
      // Try to authenticate with backend, but DON'T fail wallet connection if it's down.
      // Backend auth is only needed for protected endpoints (withdrawal).
      
      try {
        console.log("🔐 Attempting backend authentication...");

        // Create message to sign
        const message = `Sign this message to authenticate with ShadowPay\nTimestamp: ${Date.now()}`;
        const messageBytes = new TextEncoder().encode(message);

        // Request signature
        const signResult = await phantom.signMessage(messageBytes);
        
        if (!signResult || !signResult.signature) {
          throw new Error("Failed to get signature from Phantom");
        }

        // Convert signature to base64
        let signatureBase64: string;
        if (signResult.signature instanceof Uint8Array) {
          signatureBase64 = btoa(String.fromCharCode(...signResult.signature));
        } else if (typeof signResult.signature === 'string') {
          signatureBase64 = signResult.signature;
        } else {
          throw new Error("Invalid signature format");
        }

        // Authenticate with backend
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const endpoint = apiUrl ? `${apiUrl}/auth/login` : '/api/auth/login';
        
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey,
            message,
            signature: signatureBase64,
          }),
        });

        if (!res.ok) {
          throw new Error(`Backend auth failed: ${res.status}`);
        }

        const data = await res.json();
        
        if (!data.token) {
          throw new Error("No token received from backend");
        }

        // Store token
        localStorage.setItem("shadowpay_token", data.token);

        // Update state with token
        setState(prev => ({
          ...prev,
          token: data.token,
        }));

        console.log("✅ Backend authentication successful!");
      } catch (authErr) {
        // Backend auth failed, but wallet is still connected
        const authMessage = authErr instanceof Error ? authErr.message : "Backend auth failed";
        console.warn("⚠️ Backend auth skipped:", authMessage);
        console.warn("📝 Wallet is connected, but protected endpoints (withdrawal) may not work.");
        console.warn("💡 Start backend server: cd server && npm run dev");
        
        // Don't set error state — wallet is still usable for many features
      }

    } catch (err) {
      // Critical wallet connection error (Phantom not found, connection rejected, etc.)
      let message = "Connection failed";
      
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        message = String((err as any).message);
      }
      
      // Handle specific Phantom errors
      if (message.includes('User rejected')) {
        message = "Connection rejected by user";
      } else if (message.includes('not found')) {
        message = "Phantom wallet not found. Please install Phantom extension.";
      } else if (message === "Connection failed" || message === "Unexpected error") {
        // Generic error - provide helpful message
        message = "Failed to connect wallet. Please try again or refresh the page.";
      }
      
      console.error("❌ Wallet connection failed:", message);
      console.error("Full error:", err);
      
      setState({
        connected: false,
        publicKey: null,
        token: null,
        loading: false,
        error: message,
      });
    }
  };

  const disconnect = () => {
    logout();
    setState({
      connected: false,
      publicKey: null,
      token: null,
      loading: false,
      error: null,
    });
  };

  return {
    ...state,
    connect,
    disconnect,
  };
}
