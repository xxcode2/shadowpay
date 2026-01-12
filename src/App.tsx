import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import CreateLink from "./pages/CreateLink";
import PayLink from "./pages/PayLink";
import Withdraw from "./pages/Withdraw";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import React from "react";

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<any, { hasError: boolean; error?: Error | null }>{
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Log to console for developer
    console.error("Uncaught render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h1 style={{ color: "#b91c1c" }}>Something went wrong while rendering the app</h1>
          <pre style={{ whiteSpace: "pre-wrap", color: "#111" }}>{String(this.state.error)}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/create" element={<CreateLink />} />
            <Route path="/withdraw" element={<Withdraw />} />
            <Route path="/pay/:id" element={<PayLink />} />
            <Route path="/pay" element={<PayLink />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
