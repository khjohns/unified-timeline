import React, { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];
const DAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
  const selectedDate = useMemo(() => value ? new Date(value + 'T00:00:00') : new Date(), [value]);
  const [viewDate, setViewDate] = useState(selectedDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Adjust to start week on Monday (0 = Sunday, 1 = Monday, etc.)
  let startDayOfWeek = firstDayOfMonth.getDay();
  if (startDayOfWeek === 0) startDayOfWeek = 7;
  startDayOfWeek -= 1;

  const prevMonthDays = new Date(year, month, 0).getDate();

  const calendarDays = useMemo(() => {
    const days = [];
    // Days from previous month
    for (let i = startDayOfWeek; i > 0; i--) {
      days.push({ day: prevMonthDays - i + 1, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i + 1) });
    }
    // Days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    // Days from next month
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  }, [year, month, startDayOfWeek, prevMonthDays, daysInMonth]);

  const changeMonth = (delta: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
  };

  const handleDateClick = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    onChange(dateString);
  };

  return (
    <div className="bg-card-bg rounded-lg shadow-lg border border-border-color p-3 w-72">
      <div className="flex justify-between items-center mb-3">
        <button onClick={() => changeMonth(-1)} type="button" className="p-1 rounded-full hover:bg-pri-light transition-colors"><ChevronLeftIcon className="w-5 h-5 text-muted" /></button>
        <div className="font-semibold text-ink">{`${MONTH_NAMES[month]} ${year}`}</div>
        <button onClick={() => changeMonth(1)} type="button" className="p-1 rounded-full hover:bg-pri-light transition-colors"><ChevronRightIcon className="w-5 h-5 text-muted" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {DAY_NAMES.map(day => <div key={day} className="font-medium text-muted">{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mt-2">
        {calendarDays.map(({ day, isCurrentMonth, date }, index) => {
          const isSelected = isCurrentMonth && value === date.toISOString().split('T')[0];
          const isToday = isCurrentMonth && date.getTime() === today.getTime();

          const baseClasses = "w-9 h-9 flex items-center justify-center rounded-full text-sm cursor-pointer transition-colors duration-150";
          let dayClasses = baseClasses;

          if (isCurrentMonth) {
            dayClasses += isSelected 
              ? ' bg-pri text-white font-semibold' 
              : ` text-ink-dim hover:bg-pri-light ${isToday ? 'border border-pri' : ''}`;
          } else {
            dayClasses += ' text-gray-300';
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleDateClick(date)}
              className={dayClasses}
              disabled={!isCurrentMonth}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DatePicker;
