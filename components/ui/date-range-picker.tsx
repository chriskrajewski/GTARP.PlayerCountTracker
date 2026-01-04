"use client"

import * as React from "react"
import { format, startOfDay, subDays, subMonths, subYears, startOfMonth, endOfDay } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { DateRange, DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// ═══════════════════════════════════════════════════════════════════════════
// PRESET DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

interface DatePreset {
  label: string
  getValue: () => DateRange
}

const datePresets: DatePreset[] = [
  {
    label: "Today",
    getValue: () => {
      const today = new Date()
      return {
        from: startOfDay(today),
        to: endOfDay(today),
      }
    },
  },
  {
    label: "1 Day",
    getValue: () => ({
      from: subDays(new Date(), 1),
      to: new Date(),
    }),
  },
  {
    label: "7 Days",
    getValue: () => ({
      from: subDays(new Date(), 7),
      to: new Date(),
    }),
  },
  {
    label: "Month to Date",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: new Date(),
    }),
  },
  {
    label: "1 Month",
    getValue: () => ({
      from: subMonths(new Date(), 1),
      to: new Date(),
    }),
  },
  {
    label: "3 Months",
    getValue: () => ({
      from: subMonths(new Date(), 3),
      to: new Date(),
    }),
  },
  {
    label: "1 Year",
    getValue: () => ({
      from: subYears(new Date(), 1),
      to: new Date(),
    }),
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// DATE RANGE PICKER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  className?: string
  placeholder?: string
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
  placeholder = "Select date range",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(dateRange)

  // Sync temp range when prop changes
  React.useEffect(() => {
    setTempRange(dateRange)
  }, [dateRange])

  const handlePresetClick = (preset: DatePreset) => {
    setTempRange(preset.getValue())
  }

  const handleApply = () => {
    onDateRangeChange(tempRange)
    setIsOpen(false)
  }

  const handleCancel = () => {
    setTempRange(dateRange)
    setIsOpen(false)
  }

  const handleClear = () => {
    setTempRange(undefined)
    onDateRangeChange(undefined)
    setIsOpen(false)
  }

  const formatDisplayDate = () => {
    if (!dateRange?.from) return placeholder
    if (!dateRange.to) return format(dateRange.from, "MMM d, yyyy")
    return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-start text-left font-normal border text-white h-9",
            !dateRange && "text-gray-500",
            className
          )}
          style={{
            background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
            borderColor: 'rgba(168, 85, 247, 0.15)',
          }}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-cyan-400" />
          <span className="truncate text-sm">{formatDisplayDate()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0" 
        align="start"
        style={{
          background: 'linear-gradient(135deg, rgba(14, 14, 16, 0.98) 0%, rgba(10, 10, 12, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(0, 217, 255, 0.15)',
          boxShadow: '0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 217, 255, 0.05)',
          width: 'auto',
          maxWidth: '95vw',
        }}
      >
        <div className="p-3">
          {/* Calendar Section */}
          <DayPicker
            mode="range"
            defaultMonth={tempRange?.from}
            selected={tempRange}
            onSelect={setTempRange}
            numberOfMonths={2}
            showOutsideDays
            className="rounded-lg"
            style={{
              background: 'transparent',
              fontSize: '0.8rem',
            }}
            classNames={{
              months: "flex flex-col sm:flex-row gap-3",
              month: "space-y-2",
              caption: "flex justify-center pt-0.5 relative items-center text-white",
              caption_label: "text-xs font-medium text-white",
              nav: "space-x-1 flex items-center",
              nav_button: cn(
                "h-6 w-6 bg-[#18181b] border border-[#26262c] rounded p-0 opacity-70 hover:opacity-100 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all inline-flex items-center justify-center text-gray-400 hover:text-cyan-400"
              ),
              nav_button_previous: "absolute left-0",
              nav_button_next: "absolute right-0",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "text-gray-500 rounded w-7 font-normal text-[0.65rem]",
              row: "flex w-full mt-1",
              cell: cn(
                "relative h-7 w-7 text-center text-xs p-0",
                "focus-within:relative focus-within:z-20",
                "[&:has([aria-selected])]:bg-cyan-500/20",
                "[&:has([aria-selected].day-range-end)]:rounded-r-md",
                "[&:has([aria-selected].day-range-start)]:rounded-l-md",
                "first:[&:has([aria-selected])]:rounded-l-md",
                "last:[&:has([aria-selected])]:rounded-r-md"
              ),
              day: cn(
                "h-7 w-7 p-0 font-normal rounded text-gray-300 text-xs",
                "hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors",
                "inline-flex items-center justify-center",
                "aria-selected:opacity-100"
              ),
              day_range_start: "day-range-start bg-cyan-500 text-black hover:bg-cyan-400 rounded-l-md",
              day_range_end: "day-range-end bg-cyan-500 text-black hover:bg-cyan-400 rounded-r-md",
              day_selected: "bg-cyan-500 text-black hover:bg-cyan-400 hover:text-black focus:bg-cyan-500 focus:text-black font-medium",
              day_today: "bg-cyan-500/20 text-cyan-400 font-medium",
              day_outside: "day-outside text-gray-600 opacity-50",
              day_disabled: "text-gray-600 opacity-50",
              day_range_middle: "aria-selected:bg-cyan-500/20 aria-selected:text-cyan-400",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: () => <ChevronLeft className="h-3 w-3" />,
              IconRight: () => <ChevronRight className="h-3 w-3" />,
            }}
          />

          {/* Date Display Fields */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-800">
            <div className="space-y-0.5">
              <label className="text-[0.65rem] text-gray-400">Start date</label>
              <div 
                className="px-2 py-1.5 rounded text-xs text-white border"
                style={{
                  background: 'rgba(24, 24, 27, 0.9)',
                  borderColor: 'rgba(0, 217, 255, 0.2)',
                }}
              >
                {tempRange?.from ? format(tempRange.from, "yyyy/MM/dd") : "—"}
              </div>
            </div>
            <div className="space-y-0.5">
              <label className="text-[0.65rem] text-gray-400">End date</label>
              <div 
                className="px-2 py-1.5 rounded text-xs text-white border"
                style={{
                  background: 'rgba(24, 24, 27, 0.9)',
                  borderColor: 'rgba(0, 217, 255, 0.2)',
                }}
              >
                {tempRange?.to ? format(tempRange.to, "yyyy/MM/dd") : "—"}
              </div>
            </div>
          </div>

          {/* Quick Select Presets */}
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-[0.65rem] text-gray-400 mb-1.5">Quick Select</p>
            <div className="flex flex-wrap gap-1.5">
              {datePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className="px-2 py-1 text-[0.65rem] font-medium rounded border transition-all hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-400"
                  style={{
                    background: 'rgba(24, 24, 27, 0.9)',
                    borderColor: 'rgba(168, 85, 247, 0.2)',
                    color: '#d1d5db',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
            <button
              onClick={handleClear}
              className="text-[0.7rem] text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-2.5 py-1 text-[0.7rem] text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1 text-[0.7rem] font-medium rounded bg-cyan-500 text-black hover:bg-cyan-400 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
