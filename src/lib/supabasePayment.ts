/**
 * ⚠️ DEPRECATED - DO NOT USE THESE FUNCTIONS
 * 
 * These functions bypass the backend and directly access Supabase.
 * This violates the architecture rules:
 * - Frontend should NEVER directly write to Supabase
 * - All data mutations must go through backend API
 * - Balance calculations must ONLY come from Privacy Cash SDK
 * 
 * Use the backend API endpoints instead:
 * - POST /links - create link
 * - GET /links/:id - get link details
 * - POST /links/:id/pay - deposit payment
 * - POST /links/:id/claim - withdraw payment
 * - GET /api/balance - get balance
 * 
 * This file is kept for reference only.
 */

import { supabase } from './supabaseClient';

// Create Payment Link
export async function createPaymentLink({ creator_id, link_id, amount, token }: any) {
  const { data, error } = await supabase
    .from('payment_links')
    .insert([{ creator_id, link_id, amount, token, status: 'active' }]);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

// Get All Payment Links
export async function getAllPaymentLinks() {
  const { data, error } = await supabase
    .from('payment_links')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Pay Link
export async function payLink({ link_id, payer_wallet, amount, tx_hash }: any) {
  // Update link status & payment count
  await supabase
    .from('payment_links')
    .update({ status: 'paid', payment_count: supabase.rpc('increment', { x: 1 }) })
    .eq('link_id', link_id);
  // Insert payment
  const { data, error } = await supabase
    .from('payments')
    .insert([{ link_id, payer_wallet, amount, tx_hash }]);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

// Get User Balance
export async function getUserBalance(user_id: string) {
  const { data, error } = await supabase
    .from('balances')
    .select('balance')
    .eq('user_id', user_id)
    .single();
  if (error) throw error;
  return data && data.balance !== undefined ? data.balance : 0;
}

// Update User Balance
export async function updateUserBalance(user_id: string, balance: number) {
  const { data, error } = await supabase
    .from('balances')
    .update({ balance })
    .eq('user_id', user_id);
  if (error) throw error;
  return data && (data as any[])[0] && (data as any[])[0].balance !== undefined ? (data as any[])[0].balance : 0;
}
