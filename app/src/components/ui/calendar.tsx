import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

type CalendarProps = DayPickerProps;

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-4", className)}
      classNames={{
        root: "relative",
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center items-center h-10",
        caption_label: "text-sm font-semibold text-heading",
        nav: "absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10",
        button_previous:
          "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-body shadow-sm hover:bg-cream hover:text-heading transition-colors",
        button_next:
          "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-body shadow-sm hover:bg-cream hover:text-heading transition-colors",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted w-10 font-medium text-xs uppercase tracking-wider",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button:
          "inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-normal text-body hover:bg-brand-blue/10 hover:text-brand-blue transition-colors cursor-pointer",
        selected:
          "[&>button]:bg-brand-blue [&>button]:text-white [&>button]:hover:bg-brand-blue-hover [&>button]:hover:text-white [&>button]:font-medium rounded-lg",
        today: "bg-cream-light rounded-lg font-semibold text-heading ring-1 ring-brand-blue/30",
        outside: "text-muted/40 hover:bg-transparent hover:text-muted/40",
        disabled: "opacity-30 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent [&>button]:hover:text-muted [&>button]:line-through",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className="h-4 w-4" />;
          }
          return <ChevronRightIcon className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
export type { CalendarProps };
