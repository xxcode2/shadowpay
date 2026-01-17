
// DEPRECATED: All manual ZK/Merkle/circuit logic removed.
// Use the official Privacy Cash SDK fork directly.

// Example usage (browser):
//
// import { deposit } from 'privacy-cash-sdk-browser-fork';
//
// const wasm = await fetch('/circuits/transaction2.wasm').then(r => r.arrayBuffer());
// const zkey = await fetch('/circuits/transaction2.zkey').then(r => r.arrayBuffer());
//
// await deposit({
//   amount: lamports,
//   signer: walletAdapter,
//   prover: {
//     wasm: new Uint8Array(wasm),
//     zkey: new Uint8Array(zkey),
//   },
// });
