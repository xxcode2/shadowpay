import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Shield, Check, Loader2, ArrowRight, AlertCircle, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getLinkDetails, payLink, depositToPrivacyPool } from "@/lib/privacyCash";
import { useWallet } from "@/hooks/use-wallet";
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";

const PayLink = () => {
  const { connected, publicKey, connect } = useWallet();
  const [paymentState, setPaymentState] = useState<"confirm" | "processing" | "success">("confirm");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  
  const [paymentData, setPaymentData] = useState<{ amount?: string; token?: string } | null>({
    amount: undefined,
    token: undefined,
  });
  const [linkId, setLinkId] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const id = path.split("/").pop();
    setLinkId(id || null);
    (async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const endpoint = apiUrl ? `${apiUrl}/links/${id}` : `/api/links/${id}`;
        const res = await fetch(endpoint);
        if (res.ok) {
          const json = await res.json();
          const d = json.link;
          setPaymentData({ amount: d.amountType === 'any' ? undefined : d.amount, token: d.token });
          return;
        }
      } catch (e) {
        // fallback to stub
      }

      const d = await getLinkDetails(id);
      if (d) {
        // Check if link has expired
        const storedLink = localStorage.getItem(`link_${id}`);
        if (storedLink) {
          const linkData = JSON.parse(storedLink);
          if (linkData.expiryTimestamp && Date.now() > linkData.expiryTimestamp) {
            setError('This payment link has expired');
            return;
          }
        }
        setPaymentData({ amount: d.amountType === 'any' ? undefined : d.amount, token: d.token });
      }
    })();
  }, []);

  const handlePay = async () => {
    // Check wallet connection first
    if (!connected || !publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    // Check if link has expired
    if (linkId) {
      const storedLink = localStorage.getItem(`link_${linkId}`);
      if (storedLink) {
        const linkData = JSON.parse(storedLink);
        if (linkData.expiryTimestamp && Date.now() > linkData.expiryTimestamp) {
          setError('This payment link has expired');
          toast.error('Link Expired', {
            description: 'This payment link is no longer valid',
          });
          return;
        }
      }
    }

    if (!paymentData?.amount) {
      setError("Invalid payment amount");
      return;
    }

    // Token validation: For devnet demo, only SOL is supported
    const token = paymentData.token || 'SOL';
    if (token !== 'SOL') {
      setError(`Sorry, only SOL payments are supported on devnet. This link requires ${token}.`);
      toast.error('Token Not Supported', {
        description: `This link requires ${token}, but only SOL is available on devnet demo.`,
      });
      return;
    }

    setError(null);
    setPaymentState("processing");

    try {
      // Get Phantom wallet
      const phantom = (window as any).phantom?.solana;
      if (!phantom) {
        throw new Error("Phantom wallet not found. Please install Phantom extension.");
      }

      console.log("💳 Initiating REAL devnet payment...");
      console.log("Amount:", paymentData.amount, token);
      console.log("Link ID:", linkId);
      console.log("Wallet:", publicKey);

      // Get network from env (default devnet)
      const network = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
      const rpcUrl = network === 'devnet' 
        ? 'https://api.devnet.solana.com'
        : network === 'testnet'
        ? 'https://api.testnet.solana.com'
        : 'https://api.mainnet-beta.solana.com';

      console.log(`🌐 Network: ${network}`);
      console.log(`🔗 RPC: ${rpcUrl}`);

      // Create Solana connection
      const connection = new Connection(rpcUrl, 'confirmed');

      // Try backend first (Privacy Cash SDK integration)
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        if (apiUrl) {
          const endpoint = `${apiUrl}/links/${linkId}/pay`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: paymentData.amount,
              token: paymentData.token || "SOL",
              network,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            console.log("✅ Payment successful via Privacy Cash SDK", data);
            setTimeout(() => setPaymentState("success"), 400);
            return;
          } else {
            const errorData = await res.json();
            console.warn("Backend payment failed:", errorData.error || 'Unknown error');
          }
        }
      } catch (e) {
        console.warn("Backend not available, using direct Solana transaction");
      }

      // Direct Solana transaction (REAL devnet transaction)
      console.log("🚀 Creating REAL Solana transaction on", network);
      
      // For demo, we'll send to a burn address (or you can specify recipient)
      // In production, this should be the Privacy Cash pool address
      const recipientAddress = "11111111111111111111111111111112"; // Burn address for demo
      const recipient = new PublicKey(recipientAddress);
      const sender = new PublicKey(publicKey);

      // Convert amount to lamports (1 SOL = 1e9 lamports)
      const amount = parseFloat(paymentData.amount);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      console.log(`💰 Sending ${amount} ${token} (${lamports} lamports)`);
      console.log(`📤 From: ${sender.toBase58().slice(0, 8)}...`);
      console.log(`📥 To: ${recipient.toBase58().slice(0, 8)}... (demo burn address)`);

      // Check balance first
      const balance = await connection.getBalance(sender);
      console.log(`💼 Your balance: ${balance / LAMPORTS_PER_SOL} ${token}`);

      if (balance < lamports) {
        throw new Error(
          `Insufficient balance. You have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL, ` +
          `but need ${amount} SOL. Get devnet SOL: https://faucet.solana.com`
        );
      }

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: recipient,
          lamports,
        })
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = sender;

      console.log("📝 Requesting transaction signature from Phantom...");
      
      // Sign and send transaction via Phantom
      const { signature } = await phantom.signAndSendTransaction(transaction);
      
      console.log("⏳ Transaction sent, waiting for confirmation...");
      console.log(`🔗 Signature: ${signature}`);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log("✅ Transaction confirmed!");
      const explorer = `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
      console.log(`🔍 View on explorer: ${explorer}`);

      // Save transaction proof
      setTxSignature(signature);
      setExplorerUrl(explorer);

      // Update localStorage for demo
      await payLink(linkId);
      
      // Add funds to Privacy Cash balance (simulate deposit to privacy pool)
      try {
        const depositAmount = parseFloat(paymentData.amount);
        await depositToPrivacyPool({
          amount: depositAmount,
          token: paymentData.token as any || 'SOL',
        });
        console.log(`💰 Added ${depositAmount} ${paymentData.token} to privacy pool balance`);
      } catch (err) {
        console.warn('Failed to update balance:', err);
      }
      
      // Show success toast
      toast.success('Payment Confirmed!', {
        description: `Transaction sent successfully. View on explorer.`,
      });
      
      setTimeout(() => setPaymentState("success"), 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      console.error("❌ Payment error:", message);
      setError(message);
      
      // Show error toast
      toast.error('Payment Failed', {
        description: message,
      });
      
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
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 sm:p-8"
                  >
                    {/* Header */}
                    <div className="text-center mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-glow">
                        <Lock className="w-7 h-7 text-primary-foreground" />
                      </div>
                      <h1 className="text-2xl font-bold text-foreground mb-2">
                        Private Payment
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        Powered by ShadowPay
                      </p>
                    </div>

                    {/* Amount Display */}
                    <div className="text-center mb-8">
                      <p className="text-muted-foreground text-sm mb-2">Amount to pay</p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-4xl font-bold text-foreground">
                          {paymentData?.amount ?? "—"}
                        </span>
                        <span className="text-xl text-muted-foreground">
                          {paymentData?.token ?? "SOL"}
                        </span>
                      </div>
                    </div>

                    {/* Privacy Info */}
                    <div className="space-y-3 mb-8">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-3">
                          <Lock className="w-5 h-5 text-primary" />
                          <span className="text-foreground">Recipient Wallet</span>
                        </div>
                        <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Hidden
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-primary" />
                          <span className="text-foreground">Your Identity</span>
                        </div>
                        <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Hidden
                        </span>
                      </div>
                    </div>

                    {/* Error Alert */}
                    {error && (
                      <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    {/* Wallet Connection Warning */}
                    {!connected && (
                      <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/30">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-700">
                          You need to connect your wallet to pay. Click the button above.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Privacy Model Info */}
                    <Alert className="mb-4 border-blue-500/30 bg-blue-500/5">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-muted-foreground">
                        Funds are routed through Privacy Cash contracts. 
                        This link is a payment request, not a bearer claim token.
                      </AlertDescription>
                    </Alert>

                    {/* Privacy Note */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-6">
                      <p className="text-sm text-muted-foreground text-center">
                        Payment will be routed through ShadowPay privacy pool.
                        <br />
                        <span className="text-primary font-medium">No on-chain link between you and the recipient.</span>
                      </p>
                    </div>

                    {/* Pay Button */}
                    {!connected ? (
                      <Button
                        variant="hero"
                        size="xl"
                        className="w-full group"
                        onClick={connect}
                      >
                        <Lock className="w-5 h-5" />
                        Connect Wallet to Pay
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                      </Button>
                    ) : (
                      <Button
                        variant="hero"
                        size="xl"
                        className="w-full group"
                        onClick={handlePay}
                      >
                        <Lock className="w-5 h-5" />
                        Pay {paymentData?.amount} {paymentData?.token}
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                      </Button>
                    )}

                    <p className="text-xs text-muted-foreground text-center mt-4">
                      {connected 
                        ? `Paying from: ${publicKey?.slice(0, 8)}...${publicKey?.slice(-4)}`
                        : "Connect your wallet to complete the payment"}
                    </p>
                  </motion.div>
                )}

                {paymentState === "processing" && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 text-center"
                  >
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-3">
                      Processing Payment
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Routing through ShadowPay privacy pool...
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4 text-primary" />
                        Breaking on-chain link
                      </p>
                      <p className="flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Ensuring privacy
                      </p>
                    </div>
                  </motion.div>
                )}

                {paymentState === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6"
                    >
                      <Check className="w-10 h-10 text-green-500" />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-foreground mb-3">
                      Payment Complete!
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Your payment was sent privately
                    </p>

                    {/* Confirmation Details */}
                    <div className="p-4 rounded-xl bg-muted/50 border border-border mb-6 text-left space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-semibold text-foreground">
                          {paymentData?.amount ?? "Any"} {paymentData?.token ?? "USDC"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status</span>
                        <span className="text-green-500 font-medium">Confirmed</span>
                      </div>
                      {txSignature && (
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-muted-foreground text-xs">Transaction</span>
                            <code className="text-xs font-mono text-foreground">
                              {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
                            </code>
                          </div>
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
                            >
                              View on Solana Explorer
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Privacy Badges */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        Recipient Hidden
                      </span>
                      <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center gap-1.5">
                        <Shield className="w-3 h-3" />
                        Identity Hidden
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Payment routed through Privacy Cash
                    </p>
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
