import { format, addWeeks, subWeeks, isThisWeek } from "date-fns";
import { ja } from "date-fns/locale";

export default function WeekNavigator({ weekStart, onChange }) {
  const label = format(weekStart, "yyyy年M月d日", { locale: ja }) +
    " 〜 " +
    format(addWeeks(weekStart, 1), "M月d日(週)");

  return (
    <div className="week-navigator">
      <button className="btn btn-icon" onClick={() => onChange(subWeeks(weekStart, 1))}>
        ‹
      </button>
      <span className="week-label">{label}</span>
      <button className="btn btn-icon" onClick={() => onChange(addWeeks(weekStart, 1))}>
        ›
      </button>
      {!isThisWeek(weekStart, { weekStartsOn: 1 }) && (
        <button
          className="btn btn-sm today-btn"
          onClick={() => onChange(thisWeekMonday())}
        >
          今週
        </button>
      )}
    </div>
  );
}

function thisWeekMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
