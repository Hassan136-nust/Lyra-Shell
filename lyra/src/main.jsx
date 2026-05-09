import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const reportFrontendError = async (message, source = "window") => {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("log_frontend_error", { message, source });
  } catch {
    // The browser build can run outside Tauri during Vite development.
  }
};

window.addEventListener("error", (event) => {
  reportFrontendError(
    `${event.message || "unknown error"} at ${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`,
    "window.error",
  );
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
  reportFrontendError(reason, "unhandledrejection");
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
