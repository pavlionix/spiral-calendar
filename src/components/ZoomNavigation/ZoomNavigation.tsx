import React from 'react';
import { useCalendarStore } from '../../store/calendarStore';
import { t, getMonthName } from '../../utils/localization';
import './ZoomNavigation.css';

export const ZoomNavigation: React.FC = () => {
  const {
    zoomLevel,
    focusedYear,
    focusedMonth,
    focusedWeek,
    locale,
    zoomIn,
    resetView,
  } = useCalendarStore();

  const crumbs: { label: string; action: () => void }[] = [
    { label: t('allYears', locale), action: resetView },
  ];

  if (zoomLevel === 'year' || zoomLevel === 'month' || zoomLevel === 'week') {
    crumbs.push({
      label: String(focusedYear),
      action: () => zoomIn({ year: focusedYear }),
    });
  }

  if ((zoomLevel === 'month' || zoomLevel === 'week') && focusedMonth !== null) {
    crumbs.push({
      label: getMonthName(focusedMonth, locale),
      action: () => zoomIn({ year: focusedYear, month: focusedMonth! }),
    });
  }

  if (zoomLevel === 'week' && focusedWeek !== null) {
    crumbs.push({
      label: `${t('week', locale)} ${focusedWeek}`,
      action: () => {},
    });
  }

  return (
    <nav className="zoom-navigation">
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="breadcrumb-sep">›</span>}
          <button
            className={`breadcrumb-btn ${i === crumbs.length - 1 ? 'breadcrumb-btn--current' : ''}`}
            onClick={crumb.action}
            disabled={i === crumbs.length - 1}
          >
            {crumb.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};
