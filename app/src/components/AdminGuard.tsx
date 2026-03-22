import { useOrganization } from "@clerk/react";
import { Navigate } from "react-router-dom";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { membership } = useOrganization();
  const isAdmin = membership?.role === "org:admin";

  if (!membership) return null; // loading
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
