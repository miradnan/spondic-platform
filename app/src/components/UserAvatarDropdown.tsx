import { useUser, useClerk } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import {
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.tsx";
import { useState } from "react";

export function UserAvatarDropdown() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const avatarUrl = user.imageUrl;
  const initials = [user.firstName?.[0], user.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 transition-opacity hover:opacity-80"
          aria-label="User menu"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-white text-xs font-semibold">
              {initials}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-64 p-0">
        {/* User info */}
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-heading truncate">{fullName}</p>
          <p className="text-xs text-muted truncate">{email}</p>
        </div>

        {/* Menu items */}
        <div className="py-1">
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-body hover:bg-cream-light transition-colors"
          >
            <Cog6ToothIcon className="h-4 w-4 text-muted" />
            User Settings
          </button>
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
