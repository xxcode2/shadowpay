import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Copy,
  Share2,
  Check,
  ChevronDown,
  Shield,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import type { AmountType, LinkUsageType } from "@/lib/types";

const CreateLink = () => {
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState<AmountType>("fixed");
  const [linkUsageType, setLinkUsageType] = useState<LinkUsageType>("reusable");
  const [linkCreated, setLinkCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [token, setToken] = useState("SOL");
  const [expiryHours, setExpiryHours] = useState<string>("");

  const handleCreateLink = async () => {
    if (amountType === "fixed") {
      const amountNum = parseFloat(amount);
      if (!amount || isNaN(amountNum) || amountNum <= 0) {
        toast.error("Invalid Amount", {
          description: "Please enter a valid amount greater than 0",
        });
        return;
      }
    }

    setLoadingCreate(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        throw new Error("VITE_API_URL not configured");
      }

      const res = await fetch(`${apiUrl}/api/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountType === "fixed" ? amount : null,
          token,
          anyAmount: amountType === "any",
          linkUsageType,
          amountType,
          creator_id: "anonymous",
          expiryHours: expiryHours ? parseInt(expiryHours) : undefined,
        }),
      });

      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Invalid response from server");
      }

      if (!res.ok || !json.link?.url) {
        throw new Error(json.error || "Failed to create link");
      }

      setGeneratedLink(json.link.url);
      setLinkCreated(true);

      toast.success("Link Created!", {
        description: "Your payment link is ready to share",
      });
    } catch (err: any) {
      console.error("Create link error:", err);
      toast.error("Failed to Create Link", {
        description: err.message || "Unknown error",
      });
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success("Copied!", { description: "Link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Lock className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold mb-3">
                Create Receive Link
              </h1>
              <p className="text-muted-foreground">
                Generate a link to receive private payments.
              </p>
            </motion.div>

            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Privacy-first payment links. No wallet required to create.
              </AlertDescription>
            </Alert>

            <motion.div className="bg-card rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {!linkCreated ? (
                  <motion.div key="form" className="space-y-6">
                    {/* Amount */}
                    {amountType === "fixed" && (
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-14 text-xl"
                      />
                    )}

                    <Button
                      className="w-full"
                      onClick={handleCreateLink}
                      disabled={loadingCreate}
                    >
                      {loadingCreate ? "Creating..." : "Create Private Link"}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div key="success" className="space-y-4">
                    <h2 className="text-xl font-semibold text-center">
                      Link Created
                    </h2>
                    <div className="flex gap-2">
                      <Input value={generatedLink || ""} readOnly />
                      <Button onClick={handleCopy}>
                        {copied ? <Check /> : <Copy />}
                      </Button>
                    </div>
                    <Button variant="ghost" onClick={handleReset}>
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
