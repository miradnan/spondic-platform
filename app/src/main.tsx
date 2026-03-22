import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import App from "./App";
import "./i18n";
import "./index.css";

const businessName = import.meta.env.VITE_BUSINESS_NAME ?? "Spondic";
if (typeof document !== "undefined") {
  document.title = `${businessName} — RFP Response Assistant`;
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  console.warn("Missing VITE_CLERK_PUBLISHABLE_KEY — auth will not work.");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey || ""}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
);
