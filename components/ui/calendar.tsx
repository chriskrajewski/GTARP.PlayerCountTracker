"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      style={{
        background: 'linear-gradient(135deg, rgba(14, 14, 16, 0.98) 0%, rgba(10, 10, 12, 0.98) 100%)',
        borderRadius: '12px',
      }}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center text-white",
        caption_label: "text-sm font-medium text-white",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-7 w-7 bg-[#18181b] border border-[#26262c] rounded-md p-0 opacity-70 hover:opacity-100 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all inline-flex items-center justify-center text-gray-400 hover:text-cyan-400"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-cyan-500/20 [&:has([aria-selected])]:bg-cyan-500/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors inline-flex items-center justify-center"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-cyan-500 text-black hover:bg-cyan-400 hover:text-black focus:bg-cyan-500 focus:text-black font-medium",
        day_today: "bg-cyan-500/20 text-cyan-400 font-medium",
        day_outside:
          "day-outside text-gray-600 opacity-50 aria-selected:bg-cyan-500/30 aria-selected:text-gray-400 aria-selected:opacity-30",
        day_disabled: "text-gray-600 opacity-50",
        day_range_middle:
          "aria-selected:bg-cyan-500/20 aria-selected:text-cyan-400",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
