import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { BrowserRouter } from "react-router";
import "@/i18n"; // sets the language before the first render
import { App } from "@/app/App";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { Toaster } from "@/components/ui/Toaster";
import { AuthProvider } from "@/modules/auth/AuthProvider";
import "./index.css";

/**
 * A new key remounts the whole application when the language changes:
 * every text, date and number is recomputed, without touching each component.
 */
function LocalizedApp() {
  const { i18n } = useTranslation();
  return <App key={i18n.language} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <LocalizedApp />
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);