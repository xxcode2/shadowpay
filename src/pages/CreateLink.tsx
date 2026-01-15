import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Copy, Share2, Check, ChevronDown, Shield, ExternalLink, Info } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { createPrivateLink } from "@/lib/privacyCash";
import type { AmountType, LinkUsageType } from "@/lib/types";
import { useWallet } from "@/hooks/use-wallet";

const CreateLink = () => {
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState<AmountType>("fixed");
  const [linkUsageType, setLinkUsageType] = useState<LinkUsageType>("reusable");
  const [linkCreated, setLinkCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [token, setToken] = useState("SOL"); // Changed from USDC to SOL for devnet
  const [expiryHours, setExpiryHours] = useState<string>("");
  const { publicKey } = useWallet();
  const navigate = useNavigate();

  const handleCreateLink = async () => {
    // Validate amount for fixed type
    if (amountType === "fixed") {
      const amountNum = parseFloat(amount);
      if (!amount || isNaN(amountNum) || amountNum <= 0) {
        toast.error('Invalid Amount', {
          description: 'Please enter a valid amount greater than 0',
        });
        return;
      }
    }

    setLoadingCreate(true);
    try {
      // Use relative URL - Vite proxy handles /api routing
      const endpoint = '/api/links';
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountType === "fixed" ? amount : null,
          token,
          anyAmount: amountType === "any",
          linkUsageType,
          amountType,
          creator_id: publicKey || "unknown",
        }),
      });

      const responseText = await res.text();
      
      if (!res.ok) {
        let error = { error: 'Unknown error' };
        try {
          error = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse error response:', responseText);
        }
        throw new Error(error.error || `Server error: ${res.status}`);
      }

      let json;
      try {
        json = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }
      
      if (!json.link || !json.link.url) {
        throw new Error('Invalid response from server - missing link data');
      }

      setGeneratedLink(json.link.url);
      setLinkCreated(true);
      
      // Show success toast
      toast.success('Link Created!', {
        description: 'Your payment link is ready to share',
      });

      // Navigate to Dashboard after 1 second to allow toast to display
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error creating link:', error);
      toast.error('Failed to Create Link', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Copied!', {
        description: 'Link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setLinkCreated(false);
    setAmount("");
    setAmountType("fixed");
    setLinkUsageType("reusable");
    setExpiryHours("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Lock className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Create Receive Link
              </h1>
              <p className="text-muted-foreground">
                Generate a link to receive payments. Share the link — recipients withdraw to their own wallets.
              </p>
            </motion.div>

            {/* Privacy Model Explanation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6"
            >
              <Alert className="border-blue-500/30 bg-blue-500/5">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Privacy-First Payments:</span> Create payment links that work like
                  payment requests. Funds are routed through Privacy Cash contracts. Multi-token and cross-chain support coming soon.
                </AlertDescription>
              </Alert>
            </motion.div>

            {/* Form Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border/50 rounded-2xl shadow-soft p-6 sm:p-8"
            >
              <AnimatePresence mode="wait">
                {!linkCreated ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Wallet Status */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Wallet Connected</p>
                          <p className="text-xs text-muted-foreground">Private pool ready</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-600 text-xs font-medium">
                        Connected
                      </span>
                    </div>

                    {/* Link Type Selection */}
                    <div className="space-y-3">
                      <Label className="text-foreground">Link Type</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {/* One-time */}
                        <button
                          onClick={() => setLinkUsageType("one-time")}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            linkUsageType === "one-time"
                              ? "border-primary bg-primary/5"
                              : "border-border bg-muted/30"
                          }`}
                        >
                          <div className="text-sm font-semibold text-foreground">
                            One-Time
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Can be paid once
                          </div>
                        </button>

                        {/* Reusable */}
                        <button
                          onClick={() => setLinkUsageType("reusable")}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            linkUsageType === "reusable"
                              ? "border-primary bg-primary/5"
                              : "border-border bg-muted/30"
                          }`}
                        >
                          <div className="text-sm font-semibold text-foreground">
                            Reusable
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Multiple payments
                          </div>
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {linkUsageType === "one-time"
                          ? "Link will auto-expire after first payment"
                          : "Link can accept multiple payments (ideal for donations)"}
                      </p>
                    </div>

                    {/* Amount Type Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="amountType" className="text-foreground">
                          Amount
                        </Label>
                        <button
                          onClick={() =>
                            setAmountType(amountType === "fixed" ? "any" : "fixed")
                          }
                          className="text-xs text-primary hover:underline"
                        >
                          {amountType === "fixed" ? "Allow any amount" : "Set fixed amount"}
                        </button>
                      </div>

                      {amountType === "fixed" ? (
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-14 text-2xl font-semibold pr-20 bg-background"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">$</span>
                            </div>
                            <span className="text-sm font-medium text-foreground">{token}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-14 flex items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/5">
                          <span className="text-muted-foreground">Sender chooses amount</span>
                        </div>
                      )}
                    </div>

                    {/* Token Selector */}
                    <div className="space-y-3">
                      <Label className="text-foreground">Token</Label>
                      <div className="w-full h-12 flex items-center justify-between px-4 rounded-xl border border-border bg-background">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">$</span>
                          </div>
                          <select
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="bg-transparent outline-none font-medium"
                          >
                            <option value="SOL">SOL</option>
                            <option value="USDC" disabled>USDC (Coming Soon)</option>
                            <option value="USDT" disabled>USDT (Coming Soon)</option>
                          </select>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      {/* Token Roadmap Badges */}
                      <div className="flex gap-2 flex-wrap items-center">
                        <span className="text-xs text-muted-foreground">Supported:</span>
                        <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                          SOL
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></span>
                          USDC (Q1 2026)
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></span>
                          USDT (Q1 2026)
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></span>
                          Base (Roadmap)
                        </span>
                      </div>
                    </div>

                    {/* Optional Expiry */}
                    <div className="space-y-3">
                      <Label className="text-foreground">Link Expiry (Optional)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="Hours until expiry (leave empty for no expiry)"
                          value={expiryHours}
                          onChange={(e) => setExpiryHours(e.target.value)}
                          className="h-12"
                          min="1"
                          max="720"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        If set, the link will automatically expire after the specified hours. Max: 30 days (720 hours).
                      </p>
                    </div>

                    {/* Privacy Level */}
                    <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Lock className="w-5 h-5 text-primary" />
                          <span className="font-medium text-foreground">Privacy Level</span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Maximum
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Payment routed through ShadowPay privacy pool. No on-chain link between sender and receiver.
                      </p>
                    </div>

                    {/* Create Button */}
                    <Button
                      variant="hero"
                      size="xl"
                      className="w-full"
                      onClick={handleCreateLink}
                      disabled={loadingCreate || (amountType === "fixed" && !amount)}
                    >
                      <Lock className="w-5 h-5" />
                      {loadingCreate ? "Creating..." : "Create Private Payment Link"}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Success Icon */}
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-500" />
                      </div>
                      <h2 className="text-xl font-semibold text-foreground mb-2">
                        Link Created!
                      </h2>
                      <p className="text-muted-foreground">
                        Share this link to receive {linkUsageType === "one-time" ? "a single payment" : "multiple payments"}
                      </p>
                    </div>

                    {/* Link Display */}
                    <div className="p-4 rounded-xl bg-muted/50 border border-border">
                      <p className="text-sm text-muted-foreground mb-2">Your payment link</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-foreground font-mono text-sm bg-background px-3 py-2 rounded-lg overflow-hidden text-ellipsis">
                          {generatedLink}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopy}
                          className="shrink-0"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Link Config Summary */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-semibold text-foreground capitalize">
                          {linkUsageType === "one-time" ? "One-Time" : "Reusable"}
                        </span>
                      </div>

                      {amountType === "fixed" && (
                        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-semibold text-foreground">
                            {amount} {token}
                          </span>
                        </div>
                      )}

                      {amountType === "any" && (
                        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-semibold text-foreground">Sender chooses</span>
                        </div>
                      )}
                    </div>

                    {/* Privacy Badges */}
                    <div className="flex flex-wrap gap-3">
                      <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        Wallet Hidden
                      </span>
                      <span className="px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-sm font-medium flex items-center gap-1.5">
                        <Shield className="w-3 h-3" />
                        Maximum Privacy
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={handleCopy}>
                        <Copy className="w-4 h-4" />
                        {copied ? "Copied!" : "Copy Link"}
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Share2 className="w-4 h-4" />
                        Share
                      </Button>
                    </div>

                    <Button variant="ghost" className="w-full" onClick={handleReset}>
                      Create another link
                    </Button>
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

export default CreateLink;
