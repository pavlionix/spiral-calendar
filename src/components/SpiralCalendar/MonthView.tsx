import React, { useState } from 'react';
import { useCalendarStore } from '../../store/calendarStore';
import {
  getDaysInMonth, today, calendarDatesEqual, isInRange, normalizeRange,
} from '../../utils/dateUtils';
import { getMonthName, getWeekdayShort } from '../../utils/localization';
import { getEventsForDay, prevMonth, nextMonth } from '../../utils/eventUtils';
import { MONTH_COLORS } from '../../constants/colors';
import type { CalendarDate, DateRange, CalendarEvent } from '../../types/calendar';

// ── Layout ────────────────────────────────────────────────────────────────────
const TOP_PAD   = 20;
const TITLE_H   = 52;
const HEADER_H  = 28;
const GRID_TOP  = TOP_PAD + TITLE_H + HEADER_H;
const BOT_PAD   = 12;
const ROWS      = 6;
const CELL_W    = Math.floor((800 - 36) / 7);
const GRID_LEFT = (800 - CELL_W * 7) / 2;
const CELL_H    = Math.floor((800 - GRID_TOP - BOT_PAD) / ROWS);

const MAX_CHIPS = 3;
const CHIP_H    = 13;
const CHIP_GAP  = 2;

function firstIsoDow(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

// ── Event chip row ────────────────────────────────────────────────────────────
function EventChips({
  events,
  x,
  y,
  width,
}: {
  events: CalendarEvent[];
  x: number;
  y: number;
  width: number;
}) {
  const shown = events.slice(0, MAX_CHIPS);
  const extra = events.length - shown.length;

  return (
    <g pointerEvents="none">
      {shown.map((ev, i) => {
        const cy = y + i * (CHIP_H + CHIP_GAP);
        return (
          <g key={ev.id}>
            <rect
              x={x}
              y={cy}
              width={width}
              height={CHIP_H}
              rx={3}
              fill={ev.color}
              opacity={ev.completed ? 0.4 : 0.85}
            />
            <text
              x={x + 4}
              y={cy + CHIP_H / 2}
              dominantBaseline="central"
              fontSize={9}
              fontFamily="system-ui, sans-serif"
              fill="white"
              fontWeight="600"
              style={{ userSelect: 'none' }}
            >
              {ev.type === 'task' ? (ev.completed ? '✓ ' : '○ ') : ''}
              {ev.title.length > 10 ? ev.title.slice(0, 10) + '…' : ev.title}
            </text>
          </g>
        );
      })}
      {extra > 0 && (
        <text
          x={x + 3}
          y={y + shown.length * (CHIP_H + CHIP_GAP) + 10}
          fontSize={8}
          fontFamily="system-ui, sans-serif"
          fill="#6b7280"
          style={{ userSelect: 'none' }}
        >
          +{extra} more
        </text>
      )}
    </g>
  );
}

// ── Single day cell ───────────────────────────────────────────────────────────
interface DayCellProps {
  date: CalendarDate;
  col: number;
  row: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isAnchor: boolean;
  inRange: boolean;
  isStart: boolean;
  isEnd: boolean;
  events: CalendarEvent[];
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const DayCell: React.FC<DayCellProps> = ({
  date, col, row, isCurrentMonth,
  isToday, isSelected, isAnchor, inRange, isStart, isEnd,
  events, onClick, onMouseEnter, onMouseLeave,
}) => {
  const [hovered, setHovered] = useState(false);

  const x = GRID_LEFT + col * CELL_W;
  const y = GRID_TOP  + row * CELL_H;
  const isWknd = col >= 5;

  let fill = 'white';
  if (!isCurrentMonth)                   fill = '#f9fafb';
  else if (isAnchor || (isStart && isEnd)) fill = '#6366f1';
  else if (isStart || isEnd)             fill = '#818cf8';
  else if (isSelected)                   fill = '#e0e7ff';
  else if (inRange)                      fill = '#ede9fe';
  else if (isToday)                      fill = '#fef2f2';
  else if (hovered)                      fill = '#f5f3ff';
  else if (isWknd)                       fill = '#fafafa';

  const darkBg = fill === '#6366f1' || fill === '#818cf8';
  const textFill = darkBg ? 'white'
    : isToday && isCurrentMonth ? '#dc2626'
    : isWknd && isCurrentMonth  ? '#6b7280'
    : !isCurrentMonth           ? '#d1d5db'
    : '#374151';

  let stroke = '#e5e7eb';
  if (isToday && isCurrentMonth && !isSelected && !inRange && !isAnchor) stroke = '#fca5a5';
  else if (isSelected || isStart || isEnd || isAnchor) stroke = '#818cf8';

  // Chip area starts near the bottom of the day-number
  const chipY = y + 24;
  const chipW = CELL_W - 4;

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); onMouseEnter(); }}
      onMouseLeave={() => { setHovered(false); onMouseLeave(); }}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={CELL_W - 1}
        height={CELL_H - 1}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.5}
        rx={3}
      />
      <text
        x={x + CELL_W - 9}
        y={y + 18}
        textAnchor="end"
        dominantBaseline="auto"
        fontSize={14}
        fontFamily="system-ui, sans-serif"
        fill={textFill}
        fontWeight={isToday && isCurrentMonth ? '700' : '400'}
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {date.day}
      </text>
      {isCurrentMonth && events.length > 0 && (
        <EventChips events={events} x={x + 2} y={chipY} width={chipW} />
      )}
    </g>
  );
};

// ── Month grid view ───────────────────────────────────────────────────────────
interface MonthViewProps { year: number; month: number; }

export const MonthView: React.FC<MonthViewProps> = ({ year, month }) => {
  const {
    selectionMode, selectedDate, selectedRange, rangeAnchor, hoverDate, locale,
    events, selectDate, setHoverDate, setSelectedDay, zoomIn,
  } = useCalendarStore();

  const todayDate    = today();
  const daysInMonth  = getDaysInMonth(year, month);
  const monthName    = getMonthName(month, locale);
  const accentColor  = MONTH_COLORS[month];

  const startDow = firstIsoDow(year, month);
  const prev     = prevMonth(year, month);
  const next     = nextMonth(year, month);
  const prevDays = getDaysInMonth(prev.year, prev.month);

  // Build 6×7 flat cell array with real dates (prev/next month cells are clickable too)
  const cells: { date: CalendarDate; isCurrentMonth: boolean }[] = [];

  for (let i = 0; i < startDow; i++) {
    cells.push({
      date: { ...prev, day: prevDays - startDow + 1 + i },
      isCurrentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: { year, month, day: d }, isCurrentMonth: true });
  }
  let nd = 1;
  while (cells.length < 42) {
    cells.push({ date: { ...next, day: nd++ }, isCurrentMonth: false });
  }

  // Live range
  let liveRange: DateRange | null = selectedRange;
  if (selectionMode === 'range' && rangeAnchor && hoverDate) {
    liveRange = normalizeRange(rangeAnchor, hoverDate);
  }

  const dowHeaders = Array.from({ length: 7 }, (_, i) => getWeekdayShort(i, locale));

  function handleDayClick(date: CalendarDate, isCurrent: boolean) {
    if (!isCurrent) {
      // Navigate to that month
      zoomIn({ year: date.year, month: date.month });
      return;
    }
    selectDate(date);
    setSelectedDay(date);
  }

  return (
    <g>
      {/* Title area */}
      <rect x={GRID_LEFT} y={TOP_PAD} width={CELL_W * 7} height={TITLE_H}
        fill={accentColor} opacity={0.45} rx={5} />
      <text x={400} y={TOP_PAD + TITLE_H / 2} textAnchor="middle"
        dominantBaseline="central" fontSize={22} fontFamily="system-ui, sans-serif"
        fill="#1f2937" fontWeight="700" pointerEvents="none"
        style={{ userSelect: 'none' }}>
        {monthName} {year}
      </text>

      {/* Weekday headers */}
      {dowHeaders.map((label, i) => (
        <text key={i}
          x={GRID_LEFT + i * CELL_W + CELL_W / 2}
          y={TOP_PAD + TITLE_H + HEADER_H / 2}
          textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontFamily="system-ui, sans-serif"
          fill={i >= 5 ? '#9ca3af' : '#6b7280'} fontWeight="600"
          pointerEvents="none" style={{ userSelect: 'none', letterSpacing: '0.06em' }}>
          {label.toUpperCase()}
        </text>
      ))}

      {/* Day cells */}
      {cells.map(({ date, isCurrentMonth }, idx) => {
        const col = idx % 7;
        const row = Math.floor(idx / 7);
        const isToday    = calendarDatesEqual(date, todayDate);
        const isSelected = selectionMode === 'single' && calendarDatesEqual(date, selectedDate);
        const isAnchor   = calendarDatesEqual(date, rangeAnchor);
        const inRange    = liveRange !== null && isInRange(date, liveRange);
        const isStart    = liveRange !== null && calendarDatesEqual(date, liveRange.start);
        const isEnd      = liveRange !== null && calendarDatesEqual(date, liveRange.end);
        const dayEvents  = isCurrentMonth ? getEventsForDay(events, date) : [];

        return (
          <DayCell
            key={idx}
            date={date}
            col={col}
            row={row}
            isCurrentMonth={isCurrentMonth}
            isToday={isToday}
            isSelected={isSelected}
            isAnchor={isAnchor}
            inRange={inRange}
            isStart={isStart}
            isEnd={isEnd}
            events={dayEvents}
            onClick={() => handleDayClick(date, isCurrentMonth)}
            onMouseEnter={() => isCurrentMonth && setHoverDate(date)}
            onMouseLeave={() => setHoverDate(null)}
          />
        );
      })}
    </g>
  );
};
