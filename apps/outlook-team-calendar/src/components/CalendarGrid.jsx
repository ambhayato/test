import { useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ja } from "date-fns/locale";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SHOW_HOURS = HOURS.slice(7, 22); // 7:00~21:00

const STATUS_COLOR = {
  busy: "#ef4444",
  tentative: "#f59e0b",
  free: "#22c55e",
  oof: "#8b5cf6",
  workingElsewhere: "#06b6d4",
};

function avatarColor(name = "") {
  const COLORS = [
    "#4f46e5", "#0891b2", "#059669", "#d97706",
    "#dc2626", "#7c3aed", "#db2777", "#0284c7",
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function CalendarGrid({ users, eventsMap, weekStart }) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  if (users.length === 0) {
    return (
      <div className="empty-calendar">
        <p>左のパネルからメンバーを選択してください</p>
      </div>
    );
  }

  return (
    <div className="calendar-grid-wrapper">
      {/* Header: day columns */}
      <div className="calendar-header" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
        <div className="time-gutter" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`day-header ${isSameDay(day, new Date()) ? "today" : ""}`}
          >
            <span className="day-name">{format(day, "E", { locale: ja })}</span>
            <span className="day-num">{format(day, "M/d")}</span>
          </div>
        ))}
      </div>

      {/* Per-member rows */}
      <div className="members-rows">
        {users.map((user) => {
          const userEvents = eventsMap[user.id] || [];
          return (
            <MemberRow
              key={user.id}
              user={user}
              days={days}
              events={userEvents}
            />
          );
        })}
      </div>
    </div>
  );
}

function MemberRow({ user, days, events }) {
  const color = avatarColor(user.displayName);

  return (
    <div className="member-row">
      {/* Member label */}
      <div className="member-label">
        <div className="avatar-sm" style={{ backgroundColor: color }}>
          {initials(user.displayName)}
        </div>
        <span className="label-name">{user.displayName}</span>
      </div>

      {/* Day cells */}
      <div className="day-cells">
        {days.map((day) => {
          const dayEvents = events.filter((ev) => eventOnDay(ev, day));
          return (
            <DayCell key={day.toISOString()} day={day} events={dayEvents} color={color} />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({ day, events, color }) {
  const isToday = isSameDay(day, new Date());
  return (
    <div className={`day-cell ${isToday ? "today-cell" : ""}`}>
      {events.length === 0 && <span className="free-label">空き</span>}
      {events.map((ev) => (
        <EventChip key={ev.id} event={ev} color={color} />
      ))}
    </div>
  );
}

function EventChip({ event, color }) {
  const statusColor = STATUS_COLOR[event.showAs] || color;
  const start = event.isAllDay
    ? "終日"
    : format(parseISO(event.start.dateTime), "HH:mm");
  const end = event.isAllDay ? "" : format(parseISO(event.end.dateTime), "HH:mm");

  return (
    <div
      className="event-chip"
      style={{ borderLeftColor: statusColor, backgroundColor: `${statusColor}18` }}
      title={`${event.subject}\n${start}${end ? ` - ${end}` : ""}`}
    >
      <span className="event-time">{start}{end ? `–${end}` : ""}</span>
      <span className="event-title">{event.subject || "(タイトルなし)"}</span>
    </div>
  );
}

function eventOnDay(event, day) {
  if (event.isAllDay) {
    const start = startOfDay(parseISO(event.start.date || event.start.dateTime));
    const end = endOfDay(parseISO(event.end.date || event.end.dateTime));
    return isWithinInterval(day, { start, end });
  }
  return isSameDay(parseISO(event.start.dateTime), day);
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
