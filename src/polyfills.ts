/**
 * Browser polyfills for Privacy Cash SDK
 * 
 * Privacy Cash SDK requires Node.js modules (Buffer, crypto, fs, etc.)
 * This file provides browser-compatible polyfills for essential modules.
 * 
 * NOTE: Some SDK features may not work fully in browser due to:
 * - fs module (filesystem) cannot be polyfilled
 * - Worker threads unavailable
 * - node-localstorage limitations
 */

import { Buffer } from 'buffer';

// Expose Buffer globally
if (typeof window !== 'undefined') {
  window.global = window;
  window.Buffer = Buffer;
  window.process = window.process || {
    env: {},
    version: '',
    nextTick: (fn: Function) => setTimeout(fn, 0),
    cwd: () => '/',
    platform: 'browser',
  };
}

export {};
