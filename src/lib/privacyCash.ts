import { supabase } from './supabaseClient';
import { PaymentLink, AmountType, LinkUsageType, Token } from './types';

/**
 * ⚠️ DEPRECATED - DO NOT USE
 * 
 * This function directly writes to Supabase which violates architecture rules.
 * Use the backend API endpoint instead: POST /links/:id/pay
 * 
 * Kept for backwards compatibility only.
 */
export async function payLink(linkId: string, payer_wallet: string, amount: number, tx_hash?: string): Promise<{ success: boolean }> {
  // STEP 1: Validate & fetch payment link
  if (!linkId || !payer_wallet || !amount) {
    throw new Error("linkId, payer_wallet, and amount are required");
  }
  
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  try {
    // Fetch payment link by link_id
    const { data: links, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('link_id', linkId)
      .limit(1);
    
    if (linkError) {
      console.error("Error fetching link:", linkError);
      throw new Error(`Failed to fetch payment link: ${linkError.message}`);
    }
    
    if (!links || links.length === 0) {
      throw new Error(`Payment link not found: ${linkId}`);
    }

    const link: any = links[0];

    // Validate link status
    if (link.status !== 'active') {
      throw new Error(`Link is not active. Current status: ${link.status}`);
    }

    // Validate one-time link hasn't been used
    if (link.link_usage_type === 'one-time' && link.payment_count >= 1) {
      throw new Error('One-time link has already been paid. Cannot reuse.');
    }

    // STEP 2: Insert payment record (on-chain proof)
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        link_id: link.id,
        payer_wallet,
        amount,
        tx_hash: tx_hash || null,
        paid_at: new Date().toISOString(),
      }])
      .select();

    if (paymentError) {
      console.error("Error inserting payment:", paymentError);
      throw new Error(`Failed to record payment: ${paymentError.message}`);
    }

    if (!payment || payment.length === 0) {
      throw new Error("Payment record created but could not be retrieved");
    }

    console.log("✅ Payment recorded:", payment[0]);

    // STEP 3: Increment payment_count & update status if needed
    const newPaymentCount = (link.payment_count || 0) + 1;
    const updateFields: any = { 
      payment_count: newPaymentCount,
      updated_at: new Date().toISOString(),
    };

    // STEP 5: If one-time link, mark as paid after first payment
    if (link.link_usage_type === 'one-time') {
      updateFields.status = 'paid';
    }

    const { error: updateLinkError } = await supabase
      .from('payment_links')
      .update(updateFields)
      .eq('id', link.id);

    if (updateLinkError) {
      console.error("Error updating payment_links:", updateLinkError);
      throw new Error(`Failed to update link: ${updateLinkError.message}`);
    }

    console.log(`✅ Link updated: payment_count=${newPaymentCount}, status=${updateFields.status || link.status}`);

    // STEP 4: Balance update REMOVED
    // Balance is NOT stored in database
    // Balance is ONLY fetched from Privacy Cash SDK via backend /api/balance endpoint
    // This prevents fake balance increments and ensures single source of truth

    // STEP 5: Return success
    console.log(`✅ Payment synced successfully for link ${linkId}`);
    return { success: true };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ payLink failed:", message);
    throw err;
  }
}

/**
 * Create a private receive link via backend API
 * 
 * CRITICAL: This calls the backend to create the link
 * Frontend does NOT directly insert to Supabase
 */
export async function createPrivateLink(opts: {
  amount?: string;
  token?: string;
  amountType?: AmountType;
  linkUsageType?: LinkUsageType;
  expiresIn?: number;
  creator_id: string;
}): Promise<PaymentLink> {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  
  const res = await fetch(`${apiUrl}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: opts.amount,
      token: opts.token || 'SOL',
      creator_id: opts.creator_id
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create link');
  }

  const data = await res.json();
  const link = data.link;

  return {
    linkId: link.id,
    url: data.url,
    amountType: opts.amountType || 'fixed',
    linkUsageType: opts.linkUsageType || 'one-time',
    amount: opts.amount,
    token: (opts.token || 'SOL') as Token,
    status: link.status,
    createdAt: link.created_at,
    paymentCount: link.payment_count || 0,
    expiresAt: opts.expiresIn ? Date.now() + opts.expiresIn : undefined
  };
}

/**
 * Get link details from backend API
 * 
 * CRITICAL: Fetches link metadata from backend
 * Frontend does NOT directly query Supabase
 */
export async function getLinkDetails(linkId?: string | null): Promise<PaymentLink | null> {
  if (!linkId) return null;
  
  const apiUrl = import.meta.env.VITE_API_URL || '';
  
  try {
    const res = await fetch(`${apiUrl}/links/${linkId}`);
    
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const link = data.link;

    return {
      linkId: link.id,
      url: `${window.location.origin}/pay/${link.id}`,
      amountType: 'fixed',
      linkUsageType: 'one-time',
      amount: link.amount?.toString(),
      token: (link.token || 'SOL') as Token,
      status: link.status,
      createdAt: link.created_at,
      paymentCount: link.payment_count || 0
    };
  } catch (err) {
    console.error('Failed to fetch link details:', err);
    return null;
  }
}
