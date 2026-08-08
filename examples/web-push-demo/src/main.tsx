import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ElaanProvider } from "@elaanio/react";
import { API_BASE, mintContactToken } from "./config";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ElaanProvider apiBase={API_BASE} tokenProvider={mintContactToken}>
      <App />
    </ElaanProvider>
  </StrictMode>,
);
