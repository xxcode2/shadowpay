// Pay a link (stub, to be implemented)
import { supabase } from './supabaseClient';
import { PaymentLink, AmountType, LinkUsageType, Token } from './types';

// Full Supabase sync logic for on-chain payment
export async function payLink(linkId: string, payer_wallet: string, amount: number, tx_hash?: string): Promise<{ success: boolean }> {
  // 1. Fetch payment link by linkId
  const { data: links, error: linkError } = await supabase
    .from('payment_links')
    .select('*')
    .eq('link_id', linkId)
    .limit(1);
  if (linkError) throw linkError;
  const link: any = links && links[0];
  if (!link) throw new Error('Payment link not found');
  if (link.status !== 'active') throw new Error('Link is not active');
  if (link.link_usage_type === 'one-time' && link.payment_count >= 1) throw new Error('One-time link already used');

  // 2-6. Use a transaction (via PostgREST RPC or manual, here manual for clarity)
  // Insert payment, increment payment_count, update balance, set status if needed
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert([{ link_id: link.id, payer_wallet, amount, tx_hash }])
    .select();
  if (paymentError) throw paymentError;

  // 3. Increment payment_count
  const newPaymentCount = (link.payment_count || 0) + 1;
  let updateFields: any = { payment_count: newPaymentCount };
  // 5. If one-time, set status = 'paid'
  if (link.link_usage_type === 'one-time') {
    updateFields.status = 'paid';
  }
  const { error: updateLinkError } = await supabase
    .from('payment_links')
    .update(updateFields)
    .eq('id', link.id);
  if (updateLinkError) throw updateLinkError;

  // 4. Update balances (add amount to creator)
  // Try update first
  const { data: balData, error: balError } = await supabase
    .from('balances')
    .select('balance')
    .eq('user_id', link.creator_id)
    .single();
  if (balError && balError.code !== 'PGRST116') throw balError; // PGRST116 = no rows
  let newBalance = amount;
  if (balData && typeof balData.balance === 'number') {
    newBalance = Number(balData.balance) + Number(amount);
    const { error: updBalError } = await supabase
      .from('balances')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', link.creator_id);
    if (updBalError) throw updBalError;
  } else {
    // Insert new balance row
    const { error: insBalError } = await supabase
      .from('balances')
      .insert([{ user_id: link.creator_id, balance: amount, updated_at: new Date().toISOString() }]);
    if (insBalError) throw insBalError;
  }

  return { success: true };
}
import { createPaymentLink, getAllPaymentLinks } from './supabasePayment';
// ...existing code...

export async function createPrivateLink(opts: {
  amount?: string;
  token?: string;
  amountType?: AmountType;
  linkUsageType?: LinkUsageType;
  expiresIn?: number; // milliseconds, optional
  creator_id: string;
}): Promise<PaymentLink> {
  const linkId = Math.random().toString(36).slice(2, 9);
  const url = `${window.location.origin}/pay/${linkId}`;
  await createPaymentLink({
    creator_id: opts.creator_id,
    link_id: linkId,
    amount: opts.amount,
    token: (opts.token || 'SOL') as Token,
  });
  return {
    linkId,
    url,
    amountType: opts.amountType || 'fixed',
    linkUsageType: opts.linkUsageType || 'one-time',
    amount: opts.amount,
    token: (opts.token || 'SOL') as Token,
    status: 'active',
    createdAt: Date.now(),
    paymentCount: 0,
    expiresAt: opts.expiresIn ? Date.now() + opts.expiresIn : undefined
  };
}

export async function getLinkDetails(linkId?: string | null): Promise<PaymentLink | null> {
  if (!linkId) return null;
  const links = await getAllPaymentLinks();
  return links.find((l: any) => l.linkId === linkId) || null;
}

// ...existing code...
