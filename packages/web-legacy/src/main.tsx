import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.info("[sw] registered", reg.scope);
      })
      .catch((err: unknown) => {
        console.warn("[sw] registration failed", err);
      });
  });
}
