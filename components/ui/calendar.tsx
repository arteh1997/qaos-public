"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsMobile(e.matches);
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  month: controlledMonth,
  defaultMonth,
  onMonthChange: onMonthChangeProp,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const [view, setView] = React.useState<"days" | "months" | "years">("days");
  const [displayDate, setDisplayDate] = React.useState<Date>(
    () => controlledMonth || defaultMonth || new Date(),
  );
  const [yearRangeStart, setYearRangeStart] = React.useState(
    () =>
      Math.floor(
        (controlledMonth || defaultMonth || new Date()).getFullYear() / 12,
      ) * 12,
  );

  React.useEffect(() => {
    if (controlledMonth) setDisplayDate(controlledMonth);
  }, [controlledMonth]);

  const handleMonthChange = React.useCallback(
    (newMonth: Date) => {
      setDisplayDate(newMonth);
      onMonthChangeProp?.(newMonth);
    },
    [onMonthChangeProp],
  );

  const isMobile = useIsMobile();
  const defaultClassNames = getDefaultClassNames();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const containerClass = cn(
    "bg-background p-3 [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
    className,
  );

  // Years view — 4×3 grid of years with paging
  if (view === "years") {
    const years = Array.from({ length: 12 }, (_, i) => yearRangeStart + i);
    return (
      <div data-slot="calendar" className={containerClass}>
        <div className="flex items-center justify-between mb-3">
          <Button
            variant={buttonVariant}
            size="icon"
            className="size-8 p-0"
            onClick={() => setYearRangeStart((y) => y - 12)}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-medium select-none">
            {yearRangeStart} – {yearRangeStart + 11}
          </span>
          <Button
            variant={buttonVariant}
            size="icon"
            className="size-8 p-0"
            onClick={() => setYearRangeStart((y) => y + 12)}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {years.map((year) => (
            <Button
              key={year}
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 font-normal",
                year === currentYear && "bg-accent text-accent-foreground",
              )}
              onClick={() => {
                setDisplayDate(new Date(year, displayDate.getMonth(), 1));
                setView("months");
              }}
            >
              {year}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Months view — 4×3 grid of month names, year clickable to drill into years
  if (view === "months") {
    return (
      <div data-slot="calendar" className={containerClass}>
        <div className="flex items-center justify-between mb-3">
          <Button
            variant={buttonVariant}
            size="icon"
            className="size-8 p-0"
            onClick={() =>
              setDisplayDate(
                (d) => new Date(d.getFullYear() - 1, d.getMonth(), 1),
              )
            }
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <button
            type="button"
            className="text-sm font-medium select-none hover:text-primary transition-colors cursor-pointer"
            onClick={() => {
              setYearRangeStart(
                Math.floor(displayDate.getFullYear() / 12) * 12,
              );
              setView("years");
            }}
          >
            {displayDate.getFullYear()}
          </button>
          <Button
            variant={buttonVariant}
            size="icon"
            className="size-8 p-0"
            onClick={() =>
              setDisplayDate(
                (d) => new Date(d.getFullYear() + 1, d.getMonth(), 1),
              )
            }
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTH_NAMES.map((month, index) => (
            <Button
              key={month}
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 font-normal",
                index === currentMonth &&
                  displayDate.getFullYear() === currentYear &&
                  "bg-accent text-accent-foreground",
              )}
              onClick={() => {
                const newDate = new Date(displayDate.getFullYear(), index, 1);
                setDisplayDate(newDate);
                onMonthChangeProp?.(newDate);
                setView("days");
              }}
            >
              {month}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Days view — existing DayPicker with clickable caption for drill-down
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      month={displayDate}
      onMonthChange={handleMonthChange}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months,
        ),
        month: cn("flex flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between pointer-events-none",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none pointer-events-auto",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none pointer-events-auto",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          "absolute bg-popover inset-0 opacity-0",
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          isMobile
            ? "text-muted-foreground rounded-md w-(--cell-size) text-center font-normal text-[0.8rem] select-none"
            : "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none",
          defaultClassNames.weekday,
        ),
        week: cn(
          isMobile ? "flex mt-2" : "flex w-full mt-2",
          defaultClassNames.week,
        ),
        week_number_header: cn(
          "select-none w-(--cell-size)",
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          "text-[0.8rem] select-none text-muted-foreground",
          defaultClassNames.week_number,
        ),
        day: cn(
          isMobile
            ? "relative w-(--cell-size) h-(--cell-size) p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-md group/day select-none [&:first-child[data-selected=true]_button]:rounded-l-md"
            : cn(
                "relative w-full h-full p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none",
                props.showWeekNumber
                  ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-md"
                  : "[&:first-child[data-selected=true]_button]:rounded-l-md",
              ),
          defaultClassNames.day,
        ),
        range_start: cn(
          "rounded-l-md bg-accent",
          defaultClassNames.range_start,
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          );
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            );
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            );
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          );
        },
        CaptionLabel: ({ children }) => (
          <button
            type="button"
            className="text-sm font-medium select-none cursor-pointer hover:text-primary transition-colors"
            onClick={() => setView("months")}
          >
            {children}
          </button>
        ),
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
