import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Lock, 
  Wallet, 
  ArrowDownRight, 
  Clock, 
  Copy, 
  ExternalLink, 
  Plus,
  Eye,
  EyeOff,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const paymentLinks = [
  { id: 1, amount: "50.00", token: "USDC", status: "active", created: "2 hours ago", received: "0.00" },
  { id: 2, amount: "Any", token: "USDC", status: "active", created: "1 day ago", received: "125.00" },
  { id: 3, amount: "100.00", token: "USDC", status: "completed", created: "3 days ago", received: "100.00" },
];

const Dashboard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTiming, setWithdrawTiming] = useState<"now" | "later">("now");
  const privateBalance = "225.00";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Page Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
              <p className="text-muted-foreground">
                Manage your private balance and payment links
              </p>
            </motion.div>

            {/* Balance & Withdraw Grid */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              {/* Private Balance Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-2xl p-6 shadow-soft"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Private Balance</span>
                  </div>
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    {showBalance ? (
                      <Eye className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-foreground">
                      {showBalance ? privateBalance : "••••••"}
                    </span>
                    <span className="text-xl text-muted-foreground">USDC</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Shielded in Privacy Cash pool
                  </p>
                </div>

                <div className="flex gap-3">
                  <Link to="/create" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Plus className="w-4 h-4" />
                      New Link
                    </Button>
                  </Link>
                  <Button className="flex-1">
                    <ArrowDownRight className="w-4 h-4" />
                    Withdraw
                  </Button>
                </div>
              </motion.div>

              {/* Withdraw Form Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-border/50 rounded-2xl p-6 shadow-soft"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Wallet className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Withdraw Privately</h2>
                </div>

                <div className="space-y-4">
                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="withdraw-amount">Amount</Label>
                    <div className="relative">
                      <Input
                        id="withdraw-amount"
                        type="number"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="h-12 pr-16"
                      />
                      <button
                        onClick={() => setWithdrawAmount(privateBalance)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium hover:underline"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Timing */}
                  <div className="space-y-2">
                    <Label>Timing</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setWithdrawTiming("now")}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                          withdrawTiming === "now"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <ArrowDownRight className="w-4 h-4 mx-auto mb-1" />
                        Now
                      </button>
                      <button
                        onClick={() => setWithdrawTiming("later")}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                          withdrawTiming === "later"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <Clock className="w-4 h-4 mx-auto mb-1" />
                        Delay
                      </button>
                    </div>
                    {withdrawTiming === "later" && (
                      <p className="text-xs text-muted-foreground">
                        Delayed withdrawals add extra privacy by randomizing timing.
                      </p>
                    )}
                  </div>

                  {/* Destination */}
                  <div className="space-y-2">
                    <Label htmlFor="destination">Destination Wallet</Label>
                    <Input
                      id="destination"
                      placeholder="Enter wallet address"
                      className="h-12"
                    />
                  </div>

                  <Button variant="hero" className="w-full" size="lg">
                    <Lock className="w-4 h-4" />
                    Withdraw Privately
                  </Button>
                </div>
              </motion.div>
            </div>

            {/* Payment Links Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border/50 rounded-2xl shadow-soft overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Payment Links</h2>
                <Link to="/create">
                  <Button size="sm">
                    <Plus className="w-4 h-4" />
                    Create Link
                  </Button>
                </Link>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Received
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {paymentLinks.map((link) => (
                      <tr key={link.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-foreground">
                            {link.amount === "Any" ? "Any amount" : `${link.amount} ${link.token}`}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-medium ${
                              link.status === "active"
                                ? "bg-green-500/10 text-green-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {link.status === "active" ? "Active" : "Completed"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-foreground">
                          {link.received} {link.token}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {link.created}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
