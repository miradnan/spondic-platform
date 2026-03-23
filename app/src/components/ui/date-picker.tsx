import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { Calendar } from "./calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  disablePast?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
  disablePast = false,
  minDate,
  maxDate: _maxDate,
}: DatePickerProps) {
  const disabledDays = disablePast
    ? { before: minDate ?? new Date() }
    : minDate
      ? { before: minDate }
      : undefined;
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm transition-colors",
            "hover:border-body/30 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue",
            "disabled:cursor-not-allowed disabled:opacity-50",
            value ? "text-heading" : "text-muted",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted" />
          <span className="flex-1 text-left truncate">
            {value ? format(value, "PPP") : placeholder}
          </span>
          {value && (
            <span
              role="button"
              tabIndex={-1}
              className="shrink-0 rounded p-0.5 text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange(undefined);
                }
              }}
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="bottom">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(day: Date | undefined) => {
            if (day) {
              onChange(day);
              setOpen(false);
            }
          }}
          onDayClick={(day: Date) => {
            onChange(day);
            setOpen(false);
          }}
          disabled={disabledDays}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
DatePicker.displayName = "DatePicker";

export { DatePicker };
export type { DatePickerProps };
