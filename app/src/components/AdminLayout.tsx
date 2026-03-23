import { Outlet } from "react-router-dom";

export function AdminLayout() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <Outlet />
    </div>
  );
}
