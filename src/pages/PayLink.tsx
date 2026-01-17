import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Shield,
  Check,
  Loader2,
  ArrowRight,
  AlertCircle,
  ExternalLink,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useWallet } from "@/hooks/use-wallet";

// ✅ FIX: correct SDK import
import PrivacyCash from "privacy-cash-sdk";

const PayLink = () => {
  const { connected, publicKey, connect } = useWallet();

  const [paymentState, setPaymentState] = useState<
    "confirm" | "processing" | "success"
  >("confirm");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

  const [paymentData, setPaymentData] = useState<{
    amount?: string;
    token?: string;
  } | null>({
    amount: undefined,
    token: undefined,
  });

  const [linkId, setLinkId] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const id = path.split("/").pop();
    setLinkId(id || null);

    const params = new URLSearchParams(window.location.search);
    const urlAmount = params.get("amount");
    const urlToken = params.get("token");

    if (urlAmount && urlToken) {
      setPaymentData({ amount: urlAmount, token: urlToken });
      return;
    }

    (async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) throw new Error("API URL not configured");
        const res = await fetch(`${apiUrl}/links/${id}`);
        if (res.ok) {
          const json = await res.json();
          const d = json.link;
          setPaymentData({
            amount: d.amountType === "any" ? undefined : d.amount,
            token: d.token,
          });
        } else {
          setError("Link not found or expired.");
        }
      } catch {
        setError("Failed to fetch link details from backend.");
      }
    })();
  }, []);

  const handlePay = async () => {
    if (paymentState === "processing") return;

    if (!connected || !publicKey) {
      setError("Please connect your wallet to pay");
      toast.error("Wallet Required", {
        description: "Privacy Cash requires your signature",
      });
      return;
    }

    if (
      !paymentData?.amount ||
      paymentData.amount === "—" ||
      isNaN(parseFloat(paymentData.amount))
    ) {
      setError(
        "Invalid payment amount. This link requires a fixed amount but none was specified."
      );
      return;
    }

    const token = paymentData.token || "SOL";
    if (token !== "SOL") {
      setError("Only SOL payments are supported");
      return;
    }

    if (!linkId) {
      setError("Invalid payment link (missing link ID)");
      return;
    }

    setError(null);
    setPaymentState("processing");

    try {
      console.log("💰 Starting Privacy Cash deposit (SDK)");

      const amount = parseFloat(paymentData.amount);
      const lamports = Math.floor(amount * 1_000_000_000);

      const phantom = (window as any).phantom?.solana;
      if (!phantom || !phantom.isConnected) {
        throw new Error("Phantom wallet not connected");
      }

      // ✅ FIX: fetch circuit files in browser
      const wasm = await fetch("/circuits/transaction2.wasm").then((r) =>
        r.arrayBuffer()
      );
      const zkey = await fetch("/circuits/transaction2.zkey").then((r) =>
        r.arrayBuffer()
      );

      // ✅ FIX: instantiate PrivacyCash correctly
      const privacyCash = new PrivacyCash({
        wallet: phantom,
        prover: {
          wasm: new Uint8Array(wasm),
          zkey: new Uint8Array(zkey),
        },
      });

      // ✅ FIX: call deposit as METHOD, not standalone fn
      const result = await privacyCash.deposit({
        amount: lamports,
      });

      console.log("✅ Deposit success:", result.signature);

      const network = "mainnet-beta";
      setTxSignature(result.signature);
      setExplorerUrl(
        `https://explorer.solana.com/tx/${result.signature}?cluster=${network}`
      );

      setPaymentState("success");

      toast.success("Payment Successful!", {
        description: `Transaction ${result.signature.slice(0, 8)}...`,
      });
    } catch (err: any) {
      console.error("❌ Payment error:", err);
      setError(err?.message || "Payment failed");
      toast.error("Payment Failed", { description: err?.message });
      setPaymentState("confirm");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border/50 rounded-2xl shadow-soft overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {paymentState === "confirm" && (
                  <motion.div className="p-6 sm:p-8">
                    {/* UI TIDAK DIUBAH */}
                    <Button
                      variant="hero"
                      size="xl"
                      className="w-full group"
                      onClick={!connected ? connect : handlePay}
                    >
                      <Lock className="w-5 h-5" />
                      {connected
                        ? `Pay ${paymentData?.amount} ${paymentData?.token}`
                        : "Connect Wallet to Pay"}
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </motion.div>
                )}

                {paymentState === "processing" && (
                  <motion.div className="p-8 text-center">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
                    <p>Processing private payment…</p>
                  </motion.div>
                )}

                {paymentState === "success" && (
                  <motion.div className="p-8 text-center">
                    <Check className="w-10 h-10 text-green-500 mx-auto mb-4" />
                    <p className="mb-4">Payment Complete</p>
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        View on Explorer
                      </a>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PayLink;
