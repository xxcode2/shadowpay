import { Link, useLocation } from "react-router-dom";
import { Lock, Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/hooks/use-wallet";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { connected, publicKey, loading, connect, disconnect } = useWallet();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/create", label: "Create Link" },
    { to: "/withdraw", label: "Withdraw" },
    { to: "/dashboard", label: "Dashboard" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo - ShadowPay with gravity effect */}
          <Link to="/" className="flex items-center group">
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111', fontFamily: 'Courier New, monospace', letterSpacing: '-0.05em' }}>
              ShadowPay
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            {loading ? (
              <Button 
                variant="ghost" 
                size="sm"
                disabled
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  Checking...
                </div>
              </Button>
            ) : !connected ? (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={connect}
              >
                Connect Wallet
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={disconnect}
                className="text-green-600 hover:text-green-700"
              >
                <LogOut className="w-4 h-4 mr-1" />
                {publicKey?.slice(0, 4)}...{publicKey?.slice(-4)}
              </Button>
            )}
            <Link to="/create">
              <Button size="sm">
                <Lock className="w-4 h-4" />
                Create Link
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-card border-t border-border/30"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-2 border-t border-border/30 mt-2">
                {!connected ? (
                  <Button 
                    variant="ghost" 
                    className="justify-start"
                    onClick={connect}
                    disabled={loading}
                  >
                    {loading ? "Connecting..." : "Connect Wallet"}
                  </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    className="justify-start text-green-600 hover:text-green-700"
                    onClick={disconnect}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {publicKey?.slice(0, 4)}...{publicKey?.slice(-4)}
                  </Button>
                )}
                <Link to="/create" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="justify-start w-full">
                    <Lock className="w-4 h-4" />
                    Create Link
                  </Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
