import { createRoot } from "react-dom/client";
import "./index.css";

async function mount() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    console.error("Root element not found");
    return;
  }

  try {
    const { default: App } = await import("./App.tsx");
    createRoot(rootEl).render(<App />);
  } catch (err) {
    console.error("Failed to load app:", err);
    rootEl.innerHTML = `
      <div style="padding:24px;font-family:Inter,system-ui,sans-serif;color:#111">
        <h2 style="color:#b91c1c">Application failed to load</h2>
        <pre style="white-space:pre-wrap;color:#111">${String(err)}</pre>
      </div>
    `;
  }
}

mount();
