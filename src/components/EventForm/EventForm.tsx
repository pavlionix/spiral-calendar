import React, { useState, useEffect } from 'react';
import { useCalendarStore, nextEventColor } from '../../store/calendarStore';
import { EVENT_COLORS } from '../../constants/colors';
import { toInputDate, fromInputDate } from '../../utils/eventUtils';
import type { CalendarDate, EventType } from '../../types/calendar';
import './EventForm.css';

const REMINDER_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '1 day', value: 1440 },
];

interface FormState {
  title: string;
  type: EventType;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reminder: boolean;
  reminderMinutes: number;
  color: string;
}

function makeDefault(date: CalendarDate, color: string): FormState {
  const ds = toInputDate(date);
  return {
    title: '',
    type: 'event',
    startDate: ds,
    endDate: ds,
    startTime: '',
    endTime: '',
    reminder: false,
    reminderMinutes: 30,
    color,
  };
}

export const EventForm: React.FC = () => {
  const { formDate, editingEvent, events, addEvent, updateEvent, closeEventForm } =
    useCalendarStore();

  const isOpen = formDate !== null || editingEvent !== null;

  const [form, setForm] = useState<FormState>(() =>
    editingEvent
      ? {
          title: editingEvent.title,
          type: editingEvent.type,
          startDate: toInputDate(editingEvent.startDate),
          endDate: toInputDate(editingEvent.endDate),
          startTime: editingEvent.startTime,
          endTime: editingEvent.endTime,
          reminder: editingEvent.reminder,
          reminderMinutes: editingEvent.reminderMinutes,
          color: editingEvent.color,
        }
      : makeDefault(formDate ?? { year: 2026, month: 1, day: 1 }, nextEventColor(events))
  );

  // Re-init when form opens
  useEffect(() => {
    if (!isOpen) return;
    if (editingEvent) {
      setForm({
        title: editingEvent.title,
        type: editingEvent.type,
        startDate: toInputDate(editingEvent.startDate),
        endDate: toInputDate(editingEvent.endDate),
        startTime: editingEvent.startTime,
        endTime: editingEvent.endTime,
        reminder: editingEvent.reminder,
        reminderMinutes: editingEvent.reminderMinutes,
        color: editingEvent.color,
      });
    } else if (formDate) {
      setForm(makeDefault(formDate, nextEventColor(events)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingEvent?.id, formDate?.year, formDate?.month, formDate?.day]);

  if (!isOpen) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      type: form.type,
      startDate: fromInputDate(form.startDate),
      endDate: fromInputDate(form.endDate || form.startDate),
      startTime: form.startTime,
      endTime: form.endTime,
      reminder: form.reminder,
      reminderMinutes: form.reminderMinutes,
      color: form.color,
    };

    if (editingEvent) {
      updateEvent(editingEvent.id, payload);
    } else {
      addEvent(payload);
    }
  };

  return (
    <div className="ef-overlay" onClick={(e) => e.target === e.currentTarget && closeEventForm()}>
      <div className="ef-modal" role="dialog" aria-modal="true">
        <div className="ef-header">
          <h2 className="ef-title">{editingEvent ? 'Edit' : 'New'} item</h2>
          <button className="ef-close" onClick={closeEventForm} aria-label="Close">✕</button>
        </div>

        <form className="ef-form" onSubmit={handleSubmit}>
          {/* Type toggle */}
          <div className="ef-type-row">
            {(['event', 'task'] as EventType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`ef-type-btn ${form.type === t ? 'ef-type-btn--active' : ''}`}
                onClick={() => set('type', t)}
              >
                {t === 'event' ? '📅 Event' : '✅ Task'}
              </button>
            ))}
          </div>

          {/* Title */}
          <label className="ef-label">
            Title *
            <input
              className="ef-input"
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={form.type === 'task' ? 'Task description…' : 'Event name…'}
              autoFocus
              required
            />
          </label>

          {/* Dates */}
          <div className="ef-row">
            <label className="ef-label">
              Start date
              <input
                className="ef-input"
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  set('startDate', e.target.value);
                  if (e.target.value > form.endDate) set('endDate', e.target.value);
                }}
                required
              />
            </label>
            <label className="ef-label">
              End date
              <input
                className="ef-input"
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </label>
          </div>

          {/* Times */}
          <div className="ef-row">
            <label className="ef-label">
              Start time
              <input
                className="ef-input"
                type="time"
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
              />
            </label>
            <label className="ef-label">
              End time
              <input
                className="ef-input"
                type="time"
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
              />
            </label>
          </div>

          {/* Reminder */}
          <div className="ef-reminder-row">
            <label className="ef-checkbox-label">
              <input
                type="checkbox"
                checked={form.reminder}
                onChange={(e) => set('reminder', e.target.checked)}
              />
              Reminder
            </label>
            {form.reminder && (
              <select
                className="ef-select"
                value={form.reminderMinutes}
                onChange={(e) => set('reminderMinutes', Number(e.target.value))}
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} before</option>
                ))}
              </select>
            )}
          </div>

          {/* Color */}
          <div className="ef-color-row">
            <span className="ef-color-label">Color</span>
            <div className="ef-colors">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`ef-color-dot ${form.color === c ? 'ef-color-dot--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => set('color', c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="ef-actions">
            <button type="button" className="ef-btn ef-btn--cancel" onClick={closeEventForm}>
              Cancel
            </button>
            <button type="submit" className="ef-btn ef-btn--save">
              {editingEvent ? 'Save changes' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
