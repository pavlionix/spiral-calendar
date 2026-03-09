import React from 'react';
import { useCalendarStore } from '../../store/calendarStore';
import { t } from '../../utils/localization';
import type { Locale, SelectionMode, ViewMode } from '../../types/calendar';
import './CalendarControls.css';

export const CalendarControls: React.FC = () => {
  const {
    history,
    locale,
    selectionMode,
    viewMode,
    goBack,
    goToToday,
    resetView,
    setSelectionMode,
    setViewMode,
    setLocale,
  } = useCalendarStore();

  const locales: Locale[] = ['en', 'ru', 'uk'];
  const modes: SelectionMode[] = ['single', 'range'];
  const views: ViewMode[] = ['circular', 'spiral'];

  return (
    <div className="calendar-controls">
      <div className="controls-row">
        <button
          className="ctrl-btn"
          onClick={goBack}
          disabled={history.length === 0}
          title={t('back', locale)}
        >
          ← {t('back', locale)}
        </button>
        <button className="ctrl-btn" onClick={goToToday} title={t('today', locale)}>
          {t('today', locale)}
        </button>
        <button className="ctrl-btn ctrl-btn--danger" onClick={resetView} title={t('reset', locale)}>
          {t('reset', locale)}
        </button>
      </div>

      <div className="controls-row">
        <span className="ctrl-label">Mode:</span>
        {modes.map((mode) => (
          <button
            key={mode}
            className={`ctrl-btn ctrl-btn--toggle ${selectionMode === mode ? 'ctrl-btn--active' : ''}`}
            onClick={() => setSelectionMode(mode)}
          >
            {mode === 'single' ? t('singleMode', locale) : t('rangeMode', locale)}
          </button>
        ))}
      </div>

      <div className="controls-row">
        <span className="ctrl-label">View:</span>
        {views.map((v) => (
          <button
            key={v}
            className={`ctrl-btn ctrl-btn--toggle ${viewMode === v ? 'ctrl-btn--active' : ''}`}
            onClick={() => setViewMode(v)}
          >
            {v === 'circular' ? t('circular', locale) : t('spiral', locale)}
          </button>
        ))}
      </div>

      <div className="controls-row">
        <span className="ctrl-label">Lang:</span>
        {locales.map((loc) => (
          <button
            key={loc}
            className={`ctrl-btn ctrl-btn--toggle ctrl-btn--locale ${locale === loc ? 'ctrl-btn--active' : ''}`}
            onClick={() => setLocale(loc)}
          >
            {loc.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};
