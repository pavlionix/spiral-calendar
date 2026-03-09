import type { CalendarDate, CalendarEvent } from '../types/calendar';
import { calendarDateToDate, isInRange, calendarDateLessThan, getDaysInMonth } from './dateUtils';

/** Days between two CalendarDates (inclusive) */
export function eventDurationDays(event: CalendarEvent): number {
  const a = calendarDateToDate(event.startDate).getTime();
  const b = calendarDateToDate(event.endDate).getTime();
  return Math.round(Math.abs(b - a) / 86_400_000) + 1;
}

/** True if event spans more than one calendar month */
export function isLongEvent(event: CalendarEvent): boolean {
  return (
    event.startDate.year !== event.endDate.year ||
    event.startDate.month !== event.endDate.month
  );
}

/** Events whose date range overlaps a specific day */
export function getEventsForDay(
  events: CalendarEvent[],
  date: CalendarDate
): CalendarEvent[] {
  return events.filter((e) =>
    isInRange(date, { start: e.startDate, end: e.endDate })
  );
}

/** Events whose date range overlaps any day in a given month */
export function getEventsForMonth(
  events: CalendarEvent[],
  year: number,
  month: number
): CalendarEvent[] {
  const monthStart: CalendarDate = { year, month, day: 1 };
  const monthEnd: CalendarDate   = { year, month, day: getDaysInMonth(year, month) };
  return events.filter((e) => {
    // overlap test: not (event ends before month OR event starts after month)
    return (
      !calendarDateLessThan(e.endDate, monthStart) &&
      !calendarDateLessThan(monthEnd, e.startDate)
    );
  });
}

/**
 * Returns arc segments for rendering an event on the years view.
 * Each segment describes which year ring and which angular span to arc over.
 */
export function getEventArcSegments(
  event: CalendarEvent,
  years: number[]
): { yearIndex: number; startMonth: number; endMonth: number }[] {
  return years.flatMap((year, i) => {
    // Skip years fully outside the event range
    if (event.endDate.year < year || event.startDate.year > year) return [];
    const startMonth = event.startDate.year === year ? event.startDate.month : 1;
    const endMonth   = event.endDate.year   === year ? event.endDate.month   : 12;
    return [{ yearIndex: i, startMonth, endMonth }];
  });
}

/** Calendar month for prev/next navigation */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** Format "HH:MM" time string for display */
export function formatTime(t: string): string {
  return t || '';
}

/** Convert CalendarDate → "YYYY-MM-DD" for <input type="date"> */
export function toInputDate(d: CalendarDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** Convert "YYYY-MM-DD" from <input type="date"> → CalendarDate */
export function fromInputDate(s: string): CalendarDate {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
}
