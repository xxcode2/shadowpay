// ⚠️ DEPRECATED - DO NOT USE
// This file is an old example/demo and is NOT used by the production system
// The real backend is in /server/index.js
// This file contains fake balance increment logic and should be ignored

// Contoh Backend API (Node.js/Express) untuk ShadowPay
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create Payment Link
app.post('/api/payment-link', async (req, res) => {
  const { creator_id, link_id, amount, token } = req.body;
  const { data, error } = await supabase
    .from('payment_links')
    .insert([{ creator_id, link_id, amount, token, status: 'active' }]);
  if (error) return res.status(400).json({ error });
  res.json({ link: data[0] });
});

// Pay Link
app.post('/api/pay', async (req, res) => {
  const { link_id, payer_wallet, amount, tx_hash } = req.body;
  // Update link status & payment count
  await supabase
    .from('payment_links')
    .update({ status: 'paid', payment_count: supabase.raw('payment_count + 1') })
    .eq('link_id', link_id);
  // Insert payment
  const { data, error } = await supabase
    .from('payments')
    .insert([{ link_id, payer_wallet, amount, tx_hash }]);
  if (error) return res.status(400).json({ error });
  res.json({ payment: data[0] });
});

// Get User Balance
app.get('/api/balance/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase
    .from('balances')
    .select('balance')
    .eq('user_id', user_id)
    .single();
  if (error) return res.status(400).json({ error });
  res.json({ balance: data.balance });
});

// Update User Balance
app.post('/api/balance', async (req, res) => {
  const { user_id, balance } = req.body;
  const { data, error } = await supabase
    .from('balances')
    .update({ balance })
    .eq('user_id', user_id);
  if (error) return res.status(400).json({ error });
  res.json({ balance: data[0].balance });
});

// Confirm Payment (metadata sync)
app.post('/payments/confirm', async (req, res) => {
  const { link_id, tx_hash, amount, payer_wallet } = req.body;

  // Get payment link
  const { data: link, error: linkError } = await supabase
    .from('payment_links')
    .select('id, creator_id, link_usage_type, payment_count, status')
    .eq('link_id', link_id)
    .single();
  if (linkError || !link) return res.status(400).json({ error: 'Link not found' });

  // Insert payment
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert([{ link_id: link.id, payer_wallet, amount, tx_hash }]);
  if (paymentError) return res.status(400).json({ error: paymentError.message });

  // Update payment_links: increment payment_count, set status if one-time
  let newStatus = link.status;
  if (link.link_usage_type === 'one-time') newStatus = 'paid';
  const { error: updateLinkError } = await supabase
    .from('payment_links')
    .update({ payment_count: link.payment_count + 1, status: newStatus })
    .eq('id', link.id);
  if (updateLinkError) return res.status(400).json({ error: updateLinkError.message });

  // Update balances for creator
  const { data: balanceRow, error: balanceError } = await supabase
    .from('balances')
    .select('balance')
    .eq('user_id', link.creator_id)
    .single();
  let newBalance = amount;
  if (balanceRow && typeof balanceRow.balance === 'number') {
    newBalance = parseFloat(balanceRow.balance) + parseFloat(amount);
  }
  const { error: updateBalanceError } = await supabase
    .from('balances')
    .upsert([{ user_id: link.creator_id, balance: newBalance, updated_at: new Date() }], { onConflict: ['user_id'] });
  if (updateBalanceError) return res.status(400).json({ error: updateBalanceError.message });

  res.json({ success: true });
});

module.exports = app;
