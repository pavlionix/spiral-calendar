import {
  getDaysInMonth as dateFnsDaysInMonth,
  getISOWeek,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isWeekend as dateFnsIsWeekend,
} from 'date-fns';
import type { CalendarDate, DateRange } from '../types/calendar';

export function calendarDateToDate(d: CalendarDate): Date {
  return new Date(d.year, d.month - 1, d.day);
}

export function dateToCalendarDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function getDaysInMonth(year: number, month: number): number {
  return dateFnsDaysInMonth(new Date(year, month - 1, 1));
}

export function getWeekNumber(date: CalendarDate): number {
  return getISOWeek(calendarDateToDate(date));
}

export interface WeekData {
  weekNumber: number;
  days: CalendarDate[];
}

export function getWeeksInMonth(year: number, month: number): WeekData[] {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const weekStarts = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 }
  );

  return weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const clampedStart = weekStart < monthStart ? monthStart : weekStart;
    const clampedEnd = weekEnd > monthEnd ? monthEnd : weekEnd;

    const days = eachDayOfInterval({ start: clampedStart, end: clampedEnd }).map(
      dateToCalendarDate
    );

    return {
      weekNumber: getISOWeek(weekStart < monthStart ? monthStart : weekStart),
      days,
    };
  });
}

export function getDaysInWeek(year: number, month: number, weekNumber: number): CalendarDate[] {
  const weeksData = getWeeksInMonth(year, month);
  const week = weeksData.find((w) => w.weekNumber === weekNumber);
  if (week) return week.days;

  // Fallback: find by week index
  return weeksData[0]?.days ?? [];
}

export function calendarDatesEqual(a: CalendarDate | null, b: CalendarDate | null): boolean {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function calendarDateLessThan(a: CalendarDate, b: CalendarDate): boolean {
  if (a.year !== b.year) return a.year < b.year;
  if (a.month !== b.month) return a.month < b.month;
  return a.day < b.day;
}

export function normalizeRange(a: CalendarDate, b: CalendarDate): DateRange {
  if (calendarDateLessThan(a, b)) {
    return { start: a, end: b };
  }
  return { start: b, end: a };
}

export function isInRange(date: CalendarDate, range: DateRange): boolean {
  return !calendarDateLessThan(date, range.start) && !calendarDateLessThan(range.end, date);
}

export function isRangeStart(date: CalendarDate, range: DateRange): boolean {
  return calendarDatesEqual(date, range.start);
}

export function isRangeEnd(date: CalendarDate, range: DateRange): boolean {
  return calendarDatesEqual(date, range.end);
}

export function today(): CalendarDate {
  return dateToCalendarDate(new Date());
}

export function isWeekend(date: CalendarDate): boolean {
  return dateFnsIsWeekend(calendarDateToDate(date));
}

export function startOfWeekForDate(date: CalendarDate): Date {
  return startOfWeek(calendarDateToDate(date), { weekStartsOn: 1 });
}
