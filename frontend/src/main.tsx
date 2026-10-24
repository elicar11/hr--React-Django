import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "@/app/App";
import { Toaster } from "@/components/ui/Toaster";
import { DemoSessionProvider } from "@/modules/auth/DemoSessionProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* TEMPORARY (F2): replaced by the real AuthProvider in F3. */}
    <DemoSessionProvider>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </DemoSessionProvider>
  </StrictMode>,
);