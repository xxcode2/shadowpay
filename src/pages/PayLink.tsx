import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { depositPrivateLy } from "@/lib/privacyCashDeposit";

/**
 * CORRECT ARCHITECTURE: Browser-based Privacy Cash Deposit
 * 
 * Flow:
 * 1. Fetch payment link metadata
 * 2. User connects Phantom wallet
 * 3. Initialize Privacy Cash SDK with user's public key
 * 4. SDK builds transaction + generates ZK proof
 * 5. SDK submits directly to blockchain (non-custodial)
 * 
 * NO RELAYER - User signs = User controls = Non-custodial
 */

export default function PayLink() {
  const { id } = useParams<{ id: string }>();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [link, setLink] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txSignature, setTxSignature] = useState<string>("");

  /* ───────────────── FETCH LINK ───────────────── */

  useEffect(() => {
    if (!id) return;

    fetch(`${import.meta.env.VITE_BACKEND_URL}/links/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.link) setLink(d.link);
        else setError("Payment link not found");
      })
      .catch(() => setError("Failed to load payment link"));
  }, [id]);

  /* ───────────────── PAY HANDLER ───────────────── */

  const handlePay = async () => {
    try {
      setError(null);

      if (!wallet.connected || !wallet.publicKey) {
        throw new Error("Wallet not connected");
      }

      if (!wallet.signTransaction) {
        throw new Error("Wallet cannot sign transaction");
      }

      if (!link) {
        throw new Error("Invalid payment link");
      }

      setLoading(true);

      const lamports = Math.floor(
        Number(link.amount) * LAMPORTS_PER_SOL
      );

      // Get RPC URL from environment
      const rpcUrl = import.meta.env.VITE_RPC_URL || 
                     import.meta.env.VITE_SOLANA_RPC_URL ||
                     "https://api.mainnet-beta.solana.com";

      // ✅ CORRECT: Call Privacy Cash SDK directly
      // SDK will:
      // - Initialize with user's public key
      // - Generate ZK proof
      // - Build & submit transaction
      // - Return transaction signature
      const result = await depositPrivateLy({
        amount: lamports,
        wallet,
        connection,
        rpcUrl,
        linkId: id,
      });

      setTxSignature(result.signature);
      setSuccess(true);

      // Notify backend about deposit (for tracking, not custodial)
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (apiUrl) {
          await fetch(`${apiUrl}/links/${id}/pay`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transactionSignature: result.signature,
              amount: lamports,
              payerWallet: wallet.publicKey.toBase58(),
            }),
          }).catch(err => 
            console.warn("Backend notification failed (non-critical):", err)
          );
        }
      } catch (err) {
        console.warn("Backend tracking failed (non-critical):", err);
      }

    } catch (e: any) {
      console.error("[PAY ERROR]", e);
      setError(e.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  /* ───────────────── UI ───────────────── */

  if (error) {
    return <div style={{ color: "red", whiteSpace: "pre-wrap" }}>{error}</div>;
  }

  if (!link) {
    return <div>Loading payment link...</div>;
  }

  if (success) {
    return (
      <div>
        <h2>✅ Payment Successful</h2>
        <p>Your payment has been sent privately.</p>
        {txSignature && (
          <p>
            Transaction: <code>{txSignature}</code>
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <h2>🔒 ShadowPay</h2>

      <p>
        Amount: <b>{link.amount} SOL</b>
      </p>

      <p>Status: {link.status}</p>

      <div style={{
        backgroundColor: "#f0f0f0",
        padding: "12px",
        borderRadius: "4px",
        fontSize: "12px",
        marginBottom: "16px"
      }}>
        <strong>🔐 Privacy:</strong> Your payment goes to a privacy pool.
        Recipient cannot see your wallet address.
      </div>

      <button
        onClick={handlePay}
        disabled={!wallet.connected || loading}
        style={{ width: "100%" }}
      >
        {loading ? "Processing..." : "Pay Privately"}
      </button>

      {!wallet.connected && (
        <p style={{ color: "orange" }}>
          Please connect your wallet
        </p>
      )}
    </div>
  );
}
