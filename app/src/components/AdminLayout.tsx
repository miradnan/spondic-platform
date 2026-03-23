import { Outlet } from "react-router-dom";

export function AdminLayout() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
      <Outlet />
    </div>
  );
}
