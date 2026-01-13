import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

export function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "⚠️ Supabase credentials not set. Using file-based storage (not persistent in Railway)."
    );
    return null;
  }

  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("✅ Supabase connected for persistent link storage");
  }

  return supabase;
}

/**
 * Load all links from Supabase or return empty object
 */
export async function loadLinksFromSupabase() {
  const client = initSupabase();
  if (!client) return {};

  try {
    const { data, error } = await client
      .from("payment_links")
      .select("*");

    if (error) {
      console.error("Supabase loadLinks error:", error);
      return {};
    }

    // Convert array to object keyed by id
    const map = {};
    (data || []).forEach((link) => {
      map[link.id] = link;
    });
    return map;
  } catch (err) {
    console.error("Error loading links from Supabase:", err);
    return {};
  }
}

/**
 * Save link to Supabase
 */
export async function saveLinkToSupabase(link) {
  const client = initSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("payment_links")
      .upsert([link], { onConflict: "id" })
      .select();

    if (error) {
      console.error("Supabase saveLink error:", error);
      return null;
    }

    return data?.[0] || null;
  } catch (err) {
    console.error("Error saving link to Supabase:", err);
    return null;
  }
}

/**
 * Save all links to Supabase
 */
export async function saveLinksToSupabase(linksMap) {
  const client = initSupabase();
  if (!client) return false;

  try {
    const linksArray = Object.values(linksMap);
    
    if (linksArray.length === 0) {
      return true; // Nothing to save
    }

    const { error } = await client
      .from("payment_links")
      .upsert(linksArray, { onConflict: "id" });

    if (error) {
      console.error("Supabase saveLinks error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error saving links to Supabase:", err);
    return false;
  }
}

/**
 * Get user's links from Supabase
 */
export async function getUserLinksFromSupabase(userId) {
  const client = initSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("payment_links")
      .select("*")
      .eq("creator_id", userId);

    if (error) {
      console.error("Supabase getUserLinks error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error loading user links from Supabase:", err);
    return [];
  }
}

/**
 * Get user's balance from Supabase
 */
export async function getUserBalanceFromSupabase(userId) {
  const client = initSupabase();
  if (!client) return 0;

  try {
    const { data, error } = await client
      .from("payment_links")
      .select("amount")
      .eq("creator_id", userId)
      .eq("paid", true);

    if (error) {
      console.error("Supabase getUserBalance error:", error);
      return 0;
    }

    let total = 0;
    (data || []).forEach((link) => {
      total += parseFloat(link.amount) || 0;
    });

    return total;
  } catch (err) {
    console.error("Error calculating user balance from Supabase:", err);
    return 0;
  }
}
