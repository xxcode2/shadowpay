// src/lib/api.ts

const getApiUrl = () => {
  // Use VITE_API_URL env var - must be absolute URL like http://localhost:3333
  const url = import.meta.env.VITE_API_URL;
  if (!url) {
    console.error('❌ CRITICAL: VITE_API_URL not set! Add to .env.development:');
    console.error('   VITE_API_URL=http://localhost:3333');
    return '';
  }
  return url;
};

export async function fetchPrivateBalance(user_id: string): Promise<number> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error('API URL not configured');
  
  const res = await fetch(`${apiUrl}/balance?user_id=${user_id}`);
  if (!res.ok) throw new Error("Failed to fetch balance");
  const data = await res.json();
  return data.balance;
}

export async function withdrawFromBackend(opts: { user_id: string; amount: number; token: string; recipient: string }): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return { success: false, error: 'API URL not configured' };
  
  const res = await fetch(`${apiUrl}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) return { success: false, error: "Failed to withdraw" };
  return res.json();
}

// Add the missing fetchDashboardData function with better error handling
export async function fetchDashboardData(userId?: string): Promise<{ balance: number; links: any[] }> {
  try {
    // Use provided userId or empty string (for cases where not connected)
    const userIdForFetch = userId || '';
    
    if (!userIdForFetch) {
      console.warn('No user_id available - returning empty data');
      return {
        balance: 0,
        links: []
      };
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) throw new Error('API URL not configured');

    console.log(`📡 Fetching dashboard from: ${apiUrl}`);

    // Try to fetch balance first
    const balanceUrl = `${apiUrl}/balance?user_id=${encodeURIComponent(userIdForFetch)}`;
    console.log(`📡 Balance URL: ${balanceUrl}`);
    const balanceRes = await fetch(balanceUrl);
    
    if (!balanceRes.ok) {
      const rawText = await balanceRes.text();
      console.error('❌ Balance API error (status=' + balanceRes.status + '):', rawText.substring(0, 200));
      throw new Error(`Balance API failed with status ${balanceRes.status}`);
    }
    
    const balanceData = await balanceRes.json();
    console.log('✅ Balance fetched:', balanceData);
    
    // Try to fetch payment links
    const linksUrl = `${apiUrl}/payment-links?user_id=${encodeURIComponent(userIdForFetch)}`;
    console.log(`📡 Links URL: ${linksUrl}`);
    const linksRes = await fetch(linksUrl);
    
    if (!linksRes.ok) {
      const rawText = await linksRes.text();
      console.error('❌ Links API error (status=' + linksRes.status + '):', rawText.substring(0, 200));
      throw new Error(`Links API failed with status ${linksRes.status}`);
    }
    
    const linksData = await linksRes.json();
    console.log('✅ Links fetched:', linksData);
    
    // Normalize links data: convert 'id' to 'linkId' to match frontend types
    const normalizedLinks = (Array.isArray(linksData.links) ? linksData.links : (Array.isArray(linksData) ? linksData : []))
      .map((link: any) => ({
        ...link,
        linkId: link.linkId || link.id,  // Support both 'id' and 'linkId' fields
        url: link.url || `/pay/${link.id || link.linkId}`
      }));
    
    return {
      balance: balanceData.balance || 0,
      links: normalizedLinks
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