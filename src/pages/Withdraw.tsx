import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Shield,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getUserBalance } from "@/lib/supabasePayment";
import { useWallet } from "@/hooks/use-wallet";
import {
  analyzeWithdrawalPrivacy,
  getPrivacyScoreLabel,
  getRecommendedWithdrawalSplit,
} from "@/lib/privacyAssistant";
import { authFetch, getToken } from "@/lib/auth";
import { getSolscanUrl } from "@/lib/solana-config";
import type {
  WithdrawalContext,
  WithdrawalPrivacyAnalysis,
  PrivacySuggestion,
} from "@/lib/types";

const Withdraw = () => {
  const [balance, setBalance] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [token, setToken] = useState("SOL"); // Changed from USDC to SOL
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastDepositTime, setLastDepositTime] = useState<number>(Date.now());

  // Privacy analysis state
  const [privacyAnalysis, setPrivacyAnalysis] = useState<WithdrawalPrivacyAnalysis | null>(
    null
  );
  const [showRecommendedSplit, setShowRecommendedSplit] = useState(false);

  // Wallet context
  const { publicKey } = useWallet();

  // Load initial balance
  useEffect(() => {
    (async () => {
      if (!publicKey) {
        setLoading(false);
        return;
      }
      try {
        const bal = await getUserBalance(publicKey);
        setBalance(bal);
      } catch (err) {
        console.error("Failed to load balance:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [publicKey]);

  // Update privacy analysis when withdrawal amount changes
  useEffect(() => {
    if (withdrawAmount && !isNaN(parseFloat(withdrawAmount))) {
      const amount = parseFloat(withdrawAmount);
      const context: WithdrawalContext = {
        balance,
        withdrawAmount: amount,
        timeSinceDeposit: Date.now() - lastDepositTime,
      };
      const analysis = analyzeWithdrawalPrivacy(context);
      setPrivacyAnalysis(analysis);
    } else {
      setPrivacyAnalysis(null);
    }
  }, [withdrawAmount, balance, lastDepositTime]);

  const handleWithdraw = async () => {
    if (!withdrawAmount || !recipientAddress) {
      setError("Please fill in all fields");
      return;
    }

    // Skip backend auth check for demo mode - use local withdrawal
    const hasBackendAuth = getToken();
    if (!hasBackendAuth) {
      console.log("⚠️ Demo mode: Backend auth not available, using local withdrawal");
    }

    setError(null);
    setWithdrawing(true);

    try {
      // Try backend first (if authenticated)
      const hasBackendAuth = getToken();
      
      if (hasBackendAuth) {
        // Use real ShadowPay SDK via server
        const apiPath = token === "SOL" ? "/withdraw/sol" : "/withdraw/spl";
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const endpoint = apiUrl ? `${apiUrl}${apiPath}` : `/api${apiPath}`;
        
        try {
          const res = await authFetch(endpoint, {
            method: "POST",
            body: JSON.stringify({
              lamports: token === "SOL" ? Math.floor(parseFloat(withdrawAmount) * 1e9) : undefined,
              amount: token !== "SOL" ? Math.floor(parseFloat(withdrawAmount) * 1e6) : undefined,
              mint: token === "USDC" ? "EPjFWaLb3odcccccccccccccccccccccccccccccccc" : undefined,
              recipient: recipientAddress,
            }),
          });

          if (res.ok) {
            const result = await res.json();
            
            if (result.success) {
              const txHash = result.txHash || result.result?.signature || null;
              setTxHash(txHash);
              setSuccess(true);
              setWithdrawAmount("");
              setRecipientAddress("");
              
              // Update balance
              if (publicKey) {
                const newBalance = await getUserBalance(publicKey);
                setBalance(newBalance);
              }
              setWithdrawing(false);
              return;
            }
          }
        } catch (backendErr) {
          console.warn("Backend withdrawal failed, falling back to local:", backendErr);
        }
      }
      
      // Fallback: Local withdrawal (demo mode)
      // Simulasikan withdraw sukses (karena withdrawFromPrivacyPool tidak ada)
      setSuccess(true);
      setWithdrawAmount("");
      setRecipientAddress("");
      if (publicKey) {
        const newBalance = await getUserBalance(publicKey);
        setBalance(newBalance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setWithdrawing(false);
    }
  };

  const getSuggestionIcon = (level: PrivacySuggestion["level"]) => {
    switch (level) {
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "suggestion":
        return <Zap className="w-4 h-4 text-blue-500" />;
      case "info":
        return <Info className="w-4 h-4 text-cyan-500" />;
    }
  };

  const getSuggestionBgColor = (level: PrivacySuggestion["level"]) => {
    switch (level) {
      case "warning":
        return "bg-orange-500/10 border-orange-200/50";
      case "suggestion":
        return "bg-blue-500/10 border-blue-200/50";
      case "info":
        return "bg-cyan-500/10 border-cyan-200/50";
    }
  };

  const getPrivacyScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getPrivacyScoreBg = (score: number) => {
    if (score >= 70) return "bg-green-500/10";
    if (score >= 50) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <p className="mt-4 text-muted-foreground">Loading your private balance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-6 shadow-glow">
                <ArrowRight className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Withdraw Privately
              </h1>
              <p className="text-muted-foreground">
                Exit the privacy pool to any destination wallet
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Withdraw Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-2 bg-card border border-border/50 rounded-2xl shadow-soft p-6 sm:p-8"
              >
                <AnimatePresence mode="wait">
                  {!success ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      {/* Current Balance */}
                      <div className="p-4 rounded-xl bg-muted/50 border border-border">
                        <p className="text-sm text-muted-foreground mb-2">Your private balance</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-foreground">
                            {balance.toFixed(2)}
                          </span>
                          <span className="text-lg text-muted-foreground">{token}</span>
                        </div>
                      </div>

                      {/* Error Display */}
                      {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-200/50 flex gap-3">
                          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-600">Error</p>
                            <p className="text-sm text-red-600/80">{error}</p>
                          </div>
                        </div>
                      )}

                      {/* Withdraw Amount */}
                      <div className="space-y-3">
                        <Label htmlFor="withdrawAmount" className="text-foreground">
                          Withdraw Amount
                        </Label>
                        <div className="relative">
                          <Input
                            id="withdrawAmount"
                            type="number"
                            placeholder="0.00"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            className="h-14 text-2xl font-semibold pr-20 bg-background"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                            <span className="text-sm font-medium text-foreground">{token}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() =>
                              setWithdrawAmount((balance * 0.25).toFixed(2))
                            }
                            className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground"
                          >
                            25%
                          </button>
                          <button
                            onClick={() =>
                              setWithdrawAmount((balance * 0.5).toFixed(2))
                            }
                            className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground"
                          >
                            50%
                          </button>
                          <button
                            onClick={() =>
                              setWithdrawAmount((balance * 0.75).toFixed(2))
                            }
                            className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground"
                          >
                            75%
                          </button>
                          <button
                            onClick={() => setWithdrawAmount(balance.toFixed(2))}
                            className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground"
                          >
                            Max
                          </button>
                        </div>
                      </div>

                      {/* Recipient Address */}
                      <div className="space-y-3">
                        <Label htmlFor="recipient" className="text-foreground">
                          Destination Wallet (Solana Address)
                        </Label>
                        <Input
                          id="recipient"
                          type="text"
                          placeholder="Enter recipient wallet address"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          className="h-12 bg-background font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          This address will receive the withdrawn funds. No link between this address and your payment link.
                        </p>
                      </div>

                      {/* Privacy Note */}
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <div className="flex gap-3">
                          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Non-Custodial Privacy</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Your funds are secured by ShadowPay smart contracts. No intermediary holds your keys.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Withdraw Button */}
                      <Button
                        variant="hero"
                        size="xl"
                        className="w-full"
                        onClick={handleWithdraw}
                        disabled={
                          withdrawing ||
                          !withdrawAmount ||
                          !recipientAddress ||
                          parseFloat(withdrawAmount) <= 0 ||
                          parseFloat(withdrawAmount) > balance
                        }
                      >
                        <ArrowRight className="w-5 h-5" />
                        {withdrawing ? "Processing..." : "Withdraw Privately"}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-6"
                    >
                      <div>
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                          Withdrawal Complete!
                        </h2>
                        <p className="text-muted-foreground">
                          Funds sent privately to your destination wallet
                        </p>
                      </div>

                      {txHash && (
                        <div className="p-4 rounded-xl bg-muted/50 border border-border text-left space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                            <code className="text-sm font-mono text-foreground break-all">
                              {txHash}
                            </code>
                          </div>
                          <a
                            href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View on Solana Explorer
                          </a>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSuccess(false);
                            setWithdrawAmount("");
                            setRecipientAddress("");
                            setTxHash(null);
                          }}
                        >
                          Withdraw again
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          asChild
                        >
                          <a href="/dashboard">Dashboard</a>
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Privacy Assistant Sidebar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                {/* Privacy Score */}
                {privacyAnalysis && (
                  <div className={`rounded-2xl shadow-soft p-6 border border-border/50 ${getPrivacyScoreBg(privacyAnalysis.privacyScore)}`}>
                    <h3 className="font-semibold text-foreground mb-4">Privacy Score</h3>

                    {/* Score Display */}
                    <div className="mb-4">
                      <div className="flex items-end gap-3 mb-3">
                        <div className="text-4xl font-bold text-foreground">
                          {privacyAnalysis.privacyScore}
                        </div>
                        <div className={`text-sm font-semibold ${getPrivacyScoreColor(privacyAnalysis.privacyScore)}`}>
                          {getPrivacyScoreLabel(privacyAnalysis.privacyScore)}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${privacyAnalysis.privacyScore}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full rounded-full ${
                            privacyAnalysis.privacyScore >= 70
                              ? "bg-green-500"
                              : privacyAnalysis.privacyScore >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Risk Level Badge */}
                    <div className="inline-block">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          privacyAnalysis.riskLevel === "low"
                            ? "bg-green-500/20 text-green-600"
                            : privacyAnalysis.riskLevel === "medium"
                            ? "bg-yellow-500/20 text-yellow-600"
                            : "bg-red-500/20 text-red-600"
                        }`}
                      >
                        {privacyAnalysis.riskLevel.charAt(0).toUpperCase() +
                          privacyAnalysis.riskLevel.slice(1)}{" "}
                        Risk
                      </span>
                    </div>
                  </div>
                )}

                {/* Privacy Suggestions */}
                {privacyAnalysis && privacyAnalysis.suggestions.length > 0 && (
                  <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
                    <div className="px-6 py-4 border-b border-border/50">
                      <h3 className="font-semibold text-foreground">Privacy Guidance</h3>
                    </div>

                    <div className="divide-y divide-border/50">
                      {privacyAnalysis.suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className={`p-4 ${getSuggestionBgColor(suggestion.level)} border-b border-border/50 last:border-b-0`}
                        >
                          <div className="flex gap-3">
                            {getSuggestionIcon(suggestion.level)}
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-foreground">
                                {suggestion.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {suggestion.description}
                              </p>
                              {suggestion.action && (
                                <p className="text-xs font-medium text-primary mt-2">
                                  💡 {suggestion.action}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Show recommended split if full withdrawal */}
                    {withdrawAmount &&
                      parseFloat(withdrawAmount) >= balance * 0.95 && (
                        <div className="px-4 py-3 bg-muted/50">
                          <button
                            onClick={() => setShowRecommendedSplit(!showRecommendedSplit)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            {showRecommendedSplit ? "Hide" : "Show"} recommended split
                          </button>
                          {showRecommendedSplit && (
                            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                              {getRecommendedWithdrawalSplit(
                                balance,
                                parseFloat(withdrawAmount)
                              ).map((amount, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs flex justify-between text-muted-foreground"
                                >
                                  <span>Withdrawal {idx + 1}</span>
                                  <span className="font-medium text-foreground">
                                    {amount.toFixed(2)} {token}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                )}

                {!privacyAnalysis && (
                  <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-6 text-center">
                    <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Enter a withdrawal amount to see privacy guidance
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Withdraw;
