import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Lock, 
  ArrowDownRight, 
  Copy, 
  ExternalLink, 
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  Info
} from "lucide-react";
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getPrivateBalance, getAllLinks } from "@/lib/privacyCash";
import type { PaymentLink } from "@/lib/types";

const Dashboard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);

  // Fetch balance on mount
  useEffect(() => {
    fetchBalance();
    fetchLinks();
  }, []);

  const fetchBalance = async () => {
    try {
      setBalanceLoading(true);
      const balance = await getPrivateBalance();
      setPrivateBalance(balance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setPrivateBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchLinks = async () => {
    try {
      setLinksLoading(true);
      const allLinks = await getAllLinks();
      setLinks(allLinks);
    } catch (error) {
      console.error('Failed to fetch links:', error);
      setLinks([]);
    } finally {
      setLinksLoading(false);
    }
  };

  const handleRefreshBalance = async () => {
    setRefreshing(true);
    await fetchBalance();
    await fetchLinks(); // Also refresh links
    toast.success('Balance Updated', {
      description: 'Your private balance has been refreshed',
    });
    setRefreshing(false);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied!', {
      description: 'Link copied to clipboard',
    });
  };

  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

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

            {/* Private Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-2xl p-6 shadow-soft mb-8"
            >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Private Balance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefreshBalance}
                      disabled={refreshing}
                      className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                      title="Refresh balance"
                    >
                      <RefreshCw className={`w-4 h-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
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
                </div>

                <div className="mb-6">
                  {balanceLoading ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-muted-foreground animate-pulse">
                        •••
                      </span>
                      <span className="text-xl text-muted-foreground">USDC</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-foreground">
                        {showBalance ? privateBalance.toFixed(2) : "••••••"}
                      </span>
                      <span className="text-xl text-muted-foreground">USDC</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Private balance held in Privacy Cash pool
                  </p>
                </div>

                <div className="flex gap-3">
                  <Link to="/create" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Plus className="w-4 h-4" />
                      New Link
                    </Button>
                  </Link>
                  <Link to="/withdraw" className="flex-1">
                    <Button className="w-full">
                      <ArrowDownRight className="w-4 h-4" />
                      Withdraw
                    </Button>
                  </Link>
                </div>
              </motion.div>

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

              {/* Info Alert */}
              <div className="p-6 border-b border-border/50">
                <Alert className="border-blue-500/30 bg-blue-500/5">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-muted-foreground">
                    Payment links you create will appear here. Click refresh to update the list.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Links Loading */}
              {linksLoading ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading links...</p>
                </div>
              ) : links.length === 0 ? (
                /* Empty State */
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No payment links yet
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first payment link to start receiving funds privately
                  </p>
                  <Link to="/create">
                    <Button>
                      <Plus className="w-4 h-4" />
                      Create Your First Link
                    </Button>
                  </Link>
                </div>
              ) : (
                /* Links Table */
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Payments
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
                      {links.map((link) => (
                        <tr key={link.linkId} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-foreground">
                              {link.amountType === 'any' ? 'Any amount' : `${link.amount} ${link.token}`}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-muted-foreground capitalize">
                              {link.linkUsageType === 'one-time' ? 'One-time' : 'Reusable'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded-md text-xs font-medium ${
                                link.status === 'active'
                                  ? 'bg-green-500/10 text-green-600'
                                  : link.status === 'paid'
                                  ? 'bg-blue-500/10 text-blue-600'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {link.status === 'active' ? 'Active' : link.status === 'paid' ? 'Paid' : 'Expired'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-foreground">
                            {link.paymentCount}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-sm">
                            {formatDate(link.createdAt)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleCopyLink(link.url)}
                                title="Copy link"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <a 
                                href={link.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                title="Open link"
                              >
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
