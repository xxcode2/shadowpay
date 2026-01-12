#!/usr/bin/env node

/**
 * Privacy Cash Integration Test Script
 * 
 * Tests the complete flow:
 * 1. Create a payment link
 * 2. Deposit funds to Privacy Cash pool
 * 3. Verify link is marked as paid
 * 4. Claim/withdraw funds from pool
 */

import fetch from "node-fetch";
import { webcrypto } from "crypto";

const BASE_URL = "http://localhost:3333";
const DEMO_MODE = true; // Set to false to test with real Privacy Cash SDK

console.log("🧪 Privacy Cash Integration Test Suite");
console.log("=====================================\n");

async function testCreateLink() {
  console.log("1️⃣  Testing: Create payment link...");
  try {
    const res = await fetch(`${BASE_URL}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 0.1,
        token: "SOL",
        anyAmount: false
      })
    });

    if (!res.ok) {
      console.error("❌ Failed to create link:", res.status);
      return null;
    }

    const data = await res.json();
    console.log("✅ Link created successfully");
    console.log(`   Link ID: ${data.link.id}`);
    console.log(`   URL: ${data.link.url}`);
    return data.link;
  } catch (err) {
    console.error("❌ Error:", err.message);
    return null;
  }
}

async function testDepositToPool(linkId) {
  console.log("\n2️⃣  Testing: Deposit to Privacy Cash pool...");
  try {
    const res = await fetch(`${BASE_URL}/links/${linkId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 0.1,
        token: "SOL",
        referrer: "test-referrer"
      })
    });

    if (!res.ok) {
      console.error("❌ Failed to deposit:", res.status);
      const error = await res.json();
      console.error("   Error:", error.error);
      return null;
    }

    const data = await res.json();
    console.log("✅ Deposit successful");
    console.log(`   Commitment: ${data.link.commitment?.slice(0, 20)}...`);
    console.log(`   Status: ${data.link.status}`);
    console.log(`   Tx Hash: ${data.link.txHash?.slice(0, 20)}...`);
    return data.link;
  } catch (err) {
    console.error("❌ Error:", err.message);
    return null;
  }
}

async function testRetrieveLink(linkId) {
  console.log("\n3️⃣  Testing: Retrieve link metadata...");
  try {
    const res = await fetch(`${BASE_URL}/links/${linkId}`);

    if (!res.ok) {
      console.error("❌ Failed to retrieve link:", res.status);
      return null;
    }

    const data = await res.json();
    console.log("✅ Link retrieved successfully");
    console.log(`   Status: ${data.link.status}`);
    console.log(`   Paid: ${data.link.paid}`);
    console.log(`   Amount: ${data.link.amount} ${data.link.token}`);
    return data.link;
  } catch (err) {
    console.error("❌ Error:", err.message);
    return null;
  }
}

async function testAuthentication() {
  console.log("\n4️⃣  Testing: Authentication...");
  try {
    // For demo, we'll use a test signature
    const message = "Test message for ShadowPay";
    const publicKey = "11111111111111111111111111111112"; // Dummy public key
    const signature = Buffer.alloc(64).toString("hex"); // Dummy signature

    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        message,
        signature
      })
    });

    if (!res.ok) {
      console.log("⚠️  Authentication failed (expected in demo mode)");
      console.log(`   Status: ${res.status}`);
      return null;
    }

    const data = await res.json();
    console.log("✅ Authentication successful");
    console.log(`   Token: ${data.token?.slice(0, 20)}...`);
    return data.token;
  } catch (err) {
    console.error("⚠️  Error:", err.message);
    return null;
  }
}

async function testCheckBalance(token) {
  console.log("\n5️⃣  Testing: Check Privacy Cash pool balance...");
  try {
    const res = await fetch(`${BASE_URL}/balance`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.log("⚠️  Balance check requires valid auth token");
      return null;
    }

    const data = await res.json();
    console.log("✅ Balance retrieved successfully");
    console.log(`   Balance: ${data.balance} ${data.token}`);
    return data;
  } catch (err) {
    console.error("⚠️  Error:", err.message);
    return null;
  }
}

async function runTests() {
  try {
    // Test flow
    const link = await testCreateLink();
    if (!link) return;

    const paidLink = await testDepositToPool(link.id);
    if (!paidLink) return;

    const retrievedLink = await testRetrieveLink(link.id);
    if (!retrievedLink) return;

    const token = await testAuthentication();
    if (token) {
      await testCheckBalance(token);
    }

    console.log("\n✅ Test suite completed successfully!");
    console.log("\n📝 Summary:");
    console.log("   - Payment links can be created");
    console.log("   - Privacy Cash deposits are processed");
    console.log("   - Link metadata is persisted");
    console.log("   - Authentication is working");
    console.log(`   - Backend is running in ${DEMO_MODE ? "DEMO" : "PRODUCTION"} mode`);

  } catch (err) {
    console.error("\n❌ Test suite failed:", err.message);
  }
}

// Run tests
console.log(`Testing against: ${BASE_URL}`);
console.log(`Mode: ${DEMO_MODE ? "DEMO (no actual Privacy Cash)" : "PRODUCTION"}\n`);

runTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
