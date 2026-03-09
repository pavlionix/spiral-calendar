import React from 'react';
import { useCalendarStore } from '../../store/calendarStore';
import { formatCalendarDate, getWeekdayName, t } from '../../utils/localization';
import { getWeekNumber, calendarDateToDate } from '../../utils/dateUtils';
import './InfoPanel.css';

function daysBetween(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number }
): number {
  const dA = new Date(a.year, a.month - 1, a.day).getTime();
  const dB = new Date(b.year, b.month - 1, b.day).getTime();
  return Math.round(Math.abs(dB - dA) / (1000 * 60 * 60 * 24)) + 1;
}

export const InfoPanel: React.FC = () => {
  const {
    selectionMode,
    selectedDate,
    selectedRange,
    rangeAnchor,
    locale,
  } = useCalendarStore();

  if (selectionMode === 'single' && selectedDate) {
    const dow = calendarDateToDate(selectedDate).getDay();
    const weekday = getWeekdayName(dow, locale);
    const weekNum = getWeekNumber(selectedDate);

    return (
      <div className="info-panel">
        <div className="info-panel__label">{t('selectedDate', locale)}</div>
        <div className="info-panel__date">{formatCalendarDate(selectedDate, locale)}</div>
        <div className="info-panel__meta">
          {weekday} · {t('week', locale)} {weekNum}
        </div>
      </div>
    );
  }

  if (selectionMode === 'range') {
    if (selectedRange) {
      const count = daysBetween(selectedRange.start, selectedRange.end);
      return (
        <div className="info-panel">
          <div className="info-panel__label">{t('selectedRange', locale)}</div>
          <div className="info-panel__date">
            {formatCalendarDate(selectedRange.start, locale)}
          </div>
          <div className="info-panel__date info-panel__date--end">
            → {formatCalendarDate(selectedRange.end, locale)}
          </div>
          <div className="info-panel__meta">
            {count} {t('totalDays', locale)}
          </div>
        </div>
      );
    }

    if (rangeAnchor) {
      return (
        <div className="info-panel">
          <div className="info-panel__label">{t('selectedDate', locale)}</div>
          <div className="info-panel__date">{formatCalendarDate(rangeAnchor, locale)}</div>
          <div className="info-panel__hint">{t('clickToSetEnd', locale)}</div>
        </div>
      );
    }
  }

  return null;
};
