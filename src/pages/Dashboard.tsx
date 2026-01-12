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
  Info,
  Shield,
  MoreVertical,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { fetchDashboardData } from "@/lib/api";
import type { PaymentLink } from "@/lib/types";

type FilterStatus = 'all' | 'active' | 'paid' | 'expired';

const Dashboard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  
  // Filter and pagination state
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Fetch dashboard data (balance & links) on mount
  useEffect(() => {
    async function loadDashboard() {
      try {
        setBalanceLoading(true);
        setLinksLoading(true);
        console.log('Fetching dashboard data...');
        const { balance, links } = await fetchDashboardData();
        console.log('Fetched data:', { balance, linksCount: links.length });
        setPrivateBalance(balance);
        setLinks(links);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setPrivateBalance(0);
        setLinks([]);
      } finally {
        setBalanceLoading(false);
        setLinksLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const handleRefreshBalance = async () => {
    setRefreshing(true);
    try {
      const { balance, links } = await fetchDashboardData();
      setPrivateBalance(balance);
      setLinks(links);
      toast.success('Balance Updated', {
        description: 'Your private balance has been refreshed',
      });
    } catch (error) {
      toast.error('Failed to refresh dashboard data');
    }
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

  // Filter logic: filter links by status
  const filteredLinks = links.filter((link) => {
    if (filterStatus === 'all') return true;
    
    // Check if expired
    const isExpired = link.expiresAt && Date.now() > link.expiresAt;
    
    if (filterStatus === 'expired') {
      return isExpired || link.status === 'expired';
    }
    
    if (filterStatus === 'active') {
      return link.status === 'active' && !isExpired;
    }
    
    if (filterStatus === 'paid') {
      return link.status === 'paid';
    }
    
    return true;
  });

  // Pagination logic: slice filtered links
  const totalPages = Math.ceil(filteredLinks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLinks = filteredLinks.slice(startIndex, endIndex);

  // Handle filter change (reset to page 1)
  const handleFilterChange = (status: FilterStatus) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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
                      <span className="text-xl text-muted-foreground">SOL</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-foreground">
                        {showBalance ? privateBalance.toFixed(2) : "••••••"}
                      </span>
                      <span className="text-xl text-muted-foreground">SOL</span>
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
              <div className="p-6 border-b border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Payment Links</h2>
                  <Link to="/create">
                    <Button size="sm">
                      <Plus className="w-4 h-4" />
                      Create Link
                    </Button>
                  </Link>
                </div>
                
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground mr-2">Filter:</span>
                  <div className="inline-flex rounded-lg border border-border/50 p-1 bg-muted/30">
                    {(['all', 'active', 'paid', 'expired'] as FilterStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleFilterChange(status)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          filterStatus === status
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                  {filteredLinks.length !== links.length && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {filteredLinks.length} of {links.length}
                    </span>
                  )}
                </div>
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
                  <p className="text-muted-foreground">
                    Create payment links to receive crypto without revealing your wallet address.
                  </p>
                  <Link to="/create" className="inline-flex items-center gap-1 text-primary hover:underline mt-2">
                    Create your first private payment link →
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                Uses
                                <Info className="w-3 h-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Number of successful payments made using this link</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                      {paginatedLinks.map((link) => {
                        // Check if link is expired
                        const isExpired = link.expiresAt && Date.now() > link.expiresAt;
                        const displayStatus = isExpired ? 'expired' : link.status;
                        
                        return (
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
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded-md text-xs font-medium ${
                                    displayStatus === 'active'
                                      ? 'bg-green-500/10 text-green-600'
                                      : displayStatus === 'paid'
                                      ? 'bg-blue-500/10 text-blue-600'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {displayStatus === 'active' ? 'Active' : displayStatus === 'paid' ? 'Paid' : 'Expired'}
                                </span>
                                {displayStatus === 'paid' && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Shield className="w-3.5 h-3.5 text-primary" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Funds secured in Privacy Cash pool</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-foreground">
                              {link.paymentCount}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground text-sm">
                              {formatDate(link.createdAt)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-1">
                                {/* Primary Action: Open Link */}
                                <a 
                                  href={link.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                    Open
                                  </Button>
                                </a>
                                
                                {/* Secondary Actions: Dropdown */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleCopyLink(link.url)}>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy Link
                                    </DropdownMenuItem>
                                    {displayStatus === 'paid' && link.paidAt && (
                                      <DropdownMenuItem asChild>
                                        <a
                                          href={`https://explorer.solana.com/address/${link.linkId}?cluster=devnet`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center"
                                        >
                                          <ExternalLink className="w-4 h-4 mr-2" />
                                          View on Explorer
                                        </a>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Pagination Controls */}
              {!linksLoading && filteredLinks.length > ITEMS_PER_PAGE && (
                <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredLinks.length)} of {filteredLinks.length}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        const showPage = 
                          page === 1 || 
                          page === totalPages || 
                          (page >= currentPage - 1 && page <= currentPage + 1);
                        
                        if (!showPage) {
                          // Show ellipsis
                          if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <span key={page} className="px-2 text-muted-foreground">
                                ⋯
                              </span>
                            );
                          }
                          return null;
                        }
                        
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                            className="h-8 w-8 p-0"
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
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