// src/lib/api.ts

export async function fetchPrivateBalance(user_id: string): Promise<number> {
  const res = await fetch(`/api/balance?user_id=${user_id}`);
  if (!res.ok) throw new Error("Failed to fetch balance");
  const data = await res.json();
  return data.balance;
}

export async function withdrawFromBackend(opts: { user_id: string; amount: number; token: string; recipient: string }): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const res = await fetch(`/api/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) return { success: false, error: "Failed to withdraw" };
  return res.json();
}

// Add the missing fetchDashboardData function with better error handling
export async function fetchDashboardData(): Promise<{ balance: number; links: any[] }> {
  try {
    // Try to fetch balance first
    const balanceRes = await fetch('/api/balance');
    if (!balanceRes.ok) {
      console.error('Balance API error:', await balanceRes.text());
      throw new Error("Failed to fetch balance");
    }
    const balanceData = await balanceRes.json();
    
    // Try to fetch payment links
    const linksRes = await fetch('/api/payment-links');
    if (!linksRes.ok) {
      console.error('Payment links API error:', await linksRes.text());
      throw new Error("Failed to fetch payment links");
    }
    const linksData = await linksRes.json();
    
    return {
      balance: balanceData.balance || 0,
      links: Array.isArray(linksData.links) ? linksData.links : []
    };
  } catch (error) {
    console.error('Error in fetchDashboardData:', error);
    // Return default values if API fails
    return {
      balance: 0,
      links: []
    };
  }
}