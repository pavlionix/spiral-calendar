import React from 'react';
import { useCalendarStore } from '../../store/calendarStore';
import { formatCalendarDate, getWeekdayName } from '../../utils/localization';
import { getWeekNumber, calendarDateToDate } from '../../utils/dateUtils';
import { getEventsForDay } from '../../utils/eventUtils';
import type { CalendarEvent } from '../../types/calendar';
import './DayPanel.css';

export const DayPanel: React.FC = () => {
  const {
    selectedDay,
    events,
    locale,
    setSelectedDay,
    openNewEvent,
    openEditEvent,
    deleteEvent,
    toggleComplete,
  } = useCalendarStore();

  if (!selectedDay) return null;

  const dayEvents = getEventsForDay(events, selectedDay);
  const dow = calendarDateToDate(selectedDay).getDay(); // 0=Sun
  const weekdayName = getWeekdayName(dow, locale);
  const formattedDate = formatCalendarDate(selectedDay, locale);
  const weekNum = getWeekNumber(selectedDay);

  const tasks   = dayEvents.filter((e) => e.type === 'task');
  const evts    = dayEvents.filter((e) => e.type === 'event');

  function renderEvent(ev: CalendarEvent) {
    const timeStr =
      ev.startTime ? (ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime) : '';

    return (
      <div key={ev.id} className={`dp-item dp-item--event ${ev.completed ? 'dp-item--done' : ''}`}>
        <span className="dp-dot" style={{ background: ev.color }} />
        <div className="dp-item-body">
          <span className="dp-item-title">{ev.title}</span>
          {timeStr && <span className="dp-item-time">{timeStr}</span>}
          {ev.reminder && <span className="dp-item-reminder">🔔</span>}
        </div>
        <div className="dp-item-actions">
          <button className="dp-act-btn" onClick={() => openEditEvent(ev)} title="Edit">✏️</button>
          <button className="dp-act-btn dp-act-btn--del" onClick={() => deleteEvent(ev.id)} title="Delete">🗑</button>
        </div>
      </div>
    );
  }

  function renderTask(ev: CalendarEvent) {
    return (
      <div key={ev.id} className={`dp-item dp-item--task ${ev.completed ? 'dp-item--done' : ''}`}>
        <button
          className={`dp-checkbox ${ev.completed ? 'dp-checkbox--checked' : ''}`}
          onClick={() => toggleComplete(ev.id)}
          aria-label={ev.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {ev.completed ? '✓' : ''}
        </button>
        <div className="dp-item-body">
          <span className="dp-item-title">{ev.title}</span>
          {ev.startTime && <span className="dp-item-time">{ev.startTime}</span>}
          {ev.reminder && <span className="dp-item-reminder">🔔</span>}
        </div>
        <div className="dp-item-actions">
          <button className="dp-act-btn" onClick={() => openEditEvent(ev)} title="Edit">✏️</button>
          <button className="dp-act-btn dp-act-btn--del" onClick={() => deleteEvent(ev.id)} title="Delete">🗑</button>
        </div>
      </div>
    );
  }

  return (
    <div className="day-panel">
      {/* Header */}
      <div className="dp-header">
        <div className="dp-date-info">
          <div className="dp-weekday">{weekdayName}</div>
          <div className="dp-date">{formattedDate}</div>
          <div className="dp-week-num">W{weekNum}</div>
        </div>
        <button className="dp-close" onClick={() => setSelectedDay(null)} aria-label="Close">✕</button>
      </div>

      {/* Events section */}
      {evts.length > 0 && (
        <div className="dp-section">
          <div className="dp-section-title">Events</div>
          {evts.map(renderEvent)}
        </div>
      )}

      {/* Tasks section */}
      {tasks.length > 0 && (
        <div className="dp-section">
          <div className="dp-section-title">Tasks</div>
          {tasks.map(renderTask)}
        </div>
      )}

      {dayEvents.length === 0 && (
        <div className="dp-empty">No events for this day</div>
      )}

      {/* Add button */}
      <button className="dp-add-btn" onClick={() => openNewEvent(selectedDay)}>
        + Add event or task
      </button>
    </div>
  );
};
