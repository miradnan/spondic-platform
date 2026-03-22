import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CalendarProps = DayPickerProps;

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-navy",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-1 top-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-transparent text-muted hover:bg-cream-light hover:text-navy",
        button_next:
          "absolute right-1 top-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-transparent text-muted hover:bg-cream-light hover:text-navy",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-normal text-body hover:bg-cream-light hover:text-navy transition-colors aria-selected:opacity-100",
        selected:
          "bg-brand-blue text-white hover:bg-brand-blue-hover hover:text-white rounded-md",
        today: "bg-cream text-navy font-semibold",
        outside: "text-muted/50",
        disabled: "text-muted/30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />;
          }
          return <ChevronRight className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
export type { CalendarProps };
