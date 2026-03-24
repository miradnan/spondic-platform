import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  color?: "white" | "brand" | "navy" | "current";
  className?: string;
}

const sizeClasses = {
  xs: "h-3 w-3 border-[1.5px]",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

const colorClasses = {
  white: "border-white border-t-transparent",
  brand: "border-brand-blue border-t-transparent",
  navy: "border-navy border-t-transparent",
  current: "border-current border-t-transparent",
};

export function Spinner({ size = "sm", color = "brand", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full",
        sizeClasses[size],
        colorClasses[color],
        className,
      )}
    />
  );
}
