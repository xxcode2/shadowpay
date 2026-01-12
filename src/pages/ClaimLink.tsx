/**
 * Withdraw Link Page
 * 
 * This page allows recipients to WITHDRAW funds from a receive link.
 * 
 * IMPORTANT TERMINOLOGY:
 * - This is NOT a "claim" (bearer token model)
 * - This is NOT "anonymous claiming"
 * - This IS an explicit WITHDRAWAL to a specified wallet
 * 
 * How It Works:
 * 1. Sender creates a receive link and shares the link ID
 * 2. Payer deposits funds to Privacy Cash pool (link becomes "paid")
 * 3. Recipient (you) enters link ID + YOUR wallet address
 * 4. System validates link is paid and has a commitment
 * 5. You authorize the withdrawal (JWT authentication)
 * 6. Privacy Cash pool releases funds DIRECTLY to your wallet
 * 
 * Security:
 * - Link must be "paid" (have a valid commitment)
 * - Link cannot be withdrawn twice (status check)
 * - Recipient wallet is EXPLICITLY provided (not anonymous)
 * - Each withdrawal requires authentication
 * - Funds come from Privacy Cash pool, NOT ShadowPay backend
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { AlertCircle, CheckCircle, Loader, Copy } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { usePrivacyLinks } from "@/hooks/use-privacy-links";

const ClaimLink = () => {
  // Wallet
  const { connected, publicKey } = useWallet();

  // Link management
  const { claim, error, loading } = usePrivacyLinks();

  // UI state
  const [linkId, setLinkId] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [claimedLink, setClaimedLink] = useState<any | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  // Handle claim
  const handleClaim = async () => {
    if (!linkId.trim()) {
      alert("Please enter a link ID");
      return;
    }

    if (!recipientAddress.trim()) {
      alert("Please enter your wallet address");
      return;
    }

    if (publicKey && recipientAddress !== publicKey) {
      const confirm = window.confirm(
        `Your wallet (${publicKey?.slice(0, 8)}...) does not match the recipient address. ` +
        `Funds will be sent to ${recipientAddress?.slice(0, 8)}... instead. Continue?`
      );
      if (!confirm) return;
    }

    try {
      // Validate link exists and is claimable via backend
      const result = await claim(linkId, recipientAddress);
      setClaimedLink(result);
      setShowSuccess(true);
      setLinkId("");
      setRecipientAddress("");
    } catch (err) {
      console.error("Claim failed:", err);
      setShowError(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 pt-20 pb-10">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Withdraw Your Payment
          </h1>
          <p className="text-muted-foreground text-lg">
            Enter the link ID and your wallet address. Funds will be withdrawn from the Privacy Cash pool to your wallet.
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 rounded-2xl border border-border/30 mb-8"
        >
          {/* Wallet Status */}
          {!connected && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-yellow-700 font-medium">Connect Your Wallet</p>
                <p className="text-yellow-600 text-sm mt-1">
                  You need to connect your wallet to receive funds. Use the "Connect Wallet" button in the navbar.
                </p>
              </div>
            </div>
          )}

          {/* Link ID Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Link ID
            </label>
            <Input
              type="text"
              placeholder="Enter the payment link ID you received"
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              disabled={loading}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              The person who sent you money will provide this ID.
            </p>
          </div>

          {/* Recipient Address Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Your Solana Wallet Address
            </label>
            <Input
              type="text"
              placeholder="Enter your Solana wallet address"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              disabled={loading}
              className="w-full"
            />
            {publicKey && (
              <div className="mt-2 p-3 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-between">
                <span className="text-sm text-primary">
                  Connected: {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
                </span>
                <button
                  onClick={() => setRecipientAddress(publicKey)}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Use Connected
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Funds will be sent directly to this address from the ShadowPay privacy pool.
            </p>
          </div>

          {/* Claim Button */}
          <Button
            onClick={handleClaim}
            disabled={loading || !recipientAddress.trim() || !linkId.trim()}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin mr-2" />
                Processing Claim...
              </>
            ) : (
              "Claim Payment"
            )}
          </Button>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h3 className="font-semibold text-blue-700 mb-2">How it works:</h3>
            <ol className="text-sm text-blue-600 space-y-1 list-decimal list-inside">
              <li>You provide your wallet address</li>
              <li>We withdraw from the ShadowPay privacy pool</li>
              <li>Funds are sent directly to your wallet</li>
              <li>No one (not even us) can prevent the withdrawal</li>
            </ol>
          </div>
        </motion.div>

        {/* Privacy Guarantee */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 rounded-2xl border border-border/30"
        >
          <h3 className="font-semibold text-foreground mb-3">Privacy Guarantee</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>✓ Your wallet address is never stored in the link</p>
            <p>✓ The sender cannot see your address</p>
            <p>✓ Funds are in ShadowPay contracts (non-custodial)</p>
            <p>✓ Only you can claim with the correct link ID</p>
          </div>
        </motion.div>
      </div>

      {/* Success Dialog */}
      <AlertDialog open={showSuccess} onOpenChange={setShowSuccess}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Payment Claimed!
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            {claimedLink && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount:</p>
                  <p className="font-semibold text-foreground">
                    {(claimedLink.amount / 1e9).toFixed(4)} {claimedLink.token}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recipient:</p>
                  <p className="font-mono text-xs text-foreground break-all">
                    {recipientAddress}
                  </p>
                </div>
                <p className="text-sm text-green-600">
                  Funds have been withdrawn from the ShadowPay privacy pool and sent to your wallet.
                </p>
              </div>
            )}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSuccess(false)}>
              Done
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog open={showError} onOpenChange={setShowError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-destructive" />
              Claim Failed
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            {error && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Error:</p>
                <p className="font-mono text-xs text-destructive bg-destructive/10 p-3 rounded">
                  {error}
                </p>
              </div>
            )}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowError(false)}>
              Close
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClaimLink;
