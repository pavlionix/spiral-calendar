import React from 'react';
import { DayArc } from '../DayArc';
import { WEEK_VIEW_INNER_R, WEEK_VIEW_OUTER_R, SVG_CX, SVG_CY } from '../../constants/geometry';
import type { CalendarDate, DateRange } from '../../types/calendar';
import { useCalendarStore } from '../../store/calendarStore';
import { getDaysInWeek, today, calendarDatesEqual } from '../../utils/dateUtils';
import { t } from '../../utils/localization';

interface WeekViewProps {
  year: number;
  month: number;
  weekNumber: number;
}

export const WeekView: React.FC<WeekViewProps> = ({ year, month, weekNumber }) => {
  const {
    selectionMode,
    selectedDate,
    selectedRange,
    rangeAnchor,
    hoverDate,
    locale,
    selectDate,
    setHoverDate,
  } = useCalendarStore();

  const todayDate = today();
  const days: CalendarDate[] = getDaysInWeek(year, month, weekNumber);
  const totalDays = days.length;

  return (
    <g>
      {/* Center label */}
      <text
        x={SVG_CX}
        y={SVG_CY - 12}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={16}
        fontFamily="system-ui, sans-serif"
        fill="#444"
        fontWeight="700"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {t('week', locale)} {weekNumber}
      </text>
      <text
        x={SVG_CX}
        y={SVG_CY + 12}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontFamily="system-ui, sans-serif"
        fill="#666"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {year}
      </text>

      {days.map((date, i) => (
        <DayArc
          key={`${date.year}-${date.month}-${date.day}`}
          date={date}
          dayIndex={i}
          totalDays={totalDays}
          innerR={WEEK_VIEW_INNER_R}
          outerR={WEEK_VIEW_OUTER_R}
          isToday={calendarDatesEqual(date, todayDate)}
          selectedDate={selectedDate}
          selectedRange={selectedRange as DateRange | null}
          rangeAnchor={rangeAnchor}
          hoverDate={hoverDate}
          selectionMode={selectionMode}
          onClick={() => selectDate(date)}
          onMouseEnter={() => setHoverDate(date)}
          onMouseLeave={() => setHoverDate(null)}
          showLabel={true}
        />
      ))}
    </g>
  );
};
