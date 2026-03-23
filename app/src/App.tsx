import { useEffect } from "react";
import { Show, RedirectToSignIn, SignIn, SignUp } from "@clerk/react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "./components/Layout.tsx";
import { OrgGate } from "./components/OrgGate.tsx";
// import { PlanGate } from "./components/PlanGate.tsx"; // Disabled — let free users in directly
import { PlanGuard } from "./components/PlanGuard.tsx";
import { AdminGuard } from "./components/AdminGuard.tsx";
import { AdminLayout } from "./components/AdminLayout.tsx";
import { ToastProvider } from "./components/Toast.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { ScrollToTop } from "./components/ScrollToTop.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { RfpNew } from "./pages/RfpNew.tsx";
import { RfpView } from "./pages/RfpView.tsx";
import { ChatLayout } from "./components/ChatLayout.tsx";
import { Chat } from "./pages/Chat.tsx";
import { KnowledgeBase } from "./pages/KnowledgeBase.tsx";
import { Analytics } from "./pages/Analytics.tsx";
import { Settings } from "./pages/Settings.tsx";
import { Notifications } from "./pages/Notifications.tsx";
import { AdminMembers } from "./pages/admin/AdminMembers.tsx";
import { AdminOrganization } from "./pages/admin/AdminOrganization.tsx";
import { AdminTeams } from "./pages/admin/AdminTeams.tsx";
import { AdminAudit } from "./pages/admin/AdminAudit.tsx";
import { AdminBilling } from "./pages/admin/AdminBilling.tsx";
import { AdminIntegrations } from "./pages/admin/AdminIntegrations.tsx";
import { SharedChat } from "./pages/SharedChat.tsx";
import { BrandingProvider } from "./contexts/BrandingContext.tsx";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <OrgGate>
          <PlanGuard>
            {children}
          </PlanGuard>
        </OrgGate>
      </Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}

export default function App() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);

  return (
    <ErrorBoundary>
    <ToastProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/sign-in/*" element={<ClerkSignIn />} />
        <Route path="/sign-up/*" element={<ClerkSignUp />} />
        {/* Public shared chat — no auth required */}
        <Route path="/shared/chat/:token" element={<SharedChat />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <BrandingProvider>
                <Layout />
              </BrandingProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="rfp/new" element={<RfpNew />} />
          <Route path="rfp/:id" element={<RfpView />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="chat" element={<ChatLayout />}>
            <Route index element={<Chat />} />
            <Route path=":id" element={<Chat />} />
          </Route>
          <Route path="analytics" element={<Analytics />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          {/* Redirect old /audit route to admin */}
          <Route path="audit" element={<Navigate to="/admin/audit" replace />} />
          {/* Admin routes */}
          <Route
            path="admin"
            element={
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            }
          >
            <Route index element={<Navigate to="/admin/members" replace />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="organization" element={<AdminOrganization />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="teams" element={<AdminTeams />} />
            <Route path="integrations" element={<AdminIntegrations />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
    </ErrorBoundary>
  );
}

function ClerkSignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}

function ClerkSignUp() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
