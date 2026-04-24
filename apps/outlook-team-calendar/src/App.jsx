import { useState, useEffect, useCallback } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { addDays, startOfWeek } from "date-fns";
import { getDomainUsers, getTeamCalendarEvents } from "./graphService";
import LoginPage from "./components/LoginPage";
import MemberSelector from "./components/MemberSelector";
import CalendarGrid from "./components/CalendarGrid";
import WeekNavigator from "./components/WeekNavigator";
import "./App.css";

function thisMonday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return startOfWeek(d, { weekStartsOn: 1 });
}

export default function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [weekStart, setWeekStart] = useState(thisMonday);
  const [eventsMap, setEventsMap] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingUsers(true);
    getDomainUsers(instance)
      .then((data) => {
        setUsers(data);
        const me = accounts[0]?.username;
        const meUser = data.find((u) => u.mail?.toLowerCase() === me?.toLowerCase());
        if (meUser) setSelectedIds([meUser.id]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingUsers(false));
  }, [isAuthenticated, instance, accounts]);

  const fetchEvents = useCallback(async () => {
    if (selectedIds.length === 0) {
      setEventsMap({});
      return;
    }
    setLoadingEvents(true);
    try {
      const endDate = addDays(weekStart, 7);
      const results = await getTeamCalendarEvents(instance, selectedIds, weekStart, endDate);
      const map = {};
      results.forEach(({ userId, events }) => {
        map[userId] = events;
      });
      setEventsMap(map);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingEvents(false);
    }
  }, [instance, selectedIds, weekStart]);

  useEffect(() => {
    if (isAuthenticated) fetchEvents();
  }, [isAuthenticated, fetchEvents]);

  const handleSignOut = () => {
    instance.logoutPopup().catch(console.error);
  };

  const selectedUsers = users.filter((u) => selectedIds.includes(u.id));

  if (!isAuthenticated) return <LoginPage />;

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="btn btn-icon sidebar-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          title="サイドバー切り替え"
        >
          ☰
        </button>
        <h1 className="app-title">📅 チームカレンダービューアー</h1>
        <div className="topbar-right">
          {loadingEvents && <span className="loading-badge">読み込み中...</span>}
          <span className="user-email">{accounts[0]?.username}</span>
          <button className="btn btn-sm" onClick={handleSignOut}>
            サインアウト
          </button>
        </div>
      </header>

      <div className="main-layout">
        {sidebarOpen && (
          <aside className="sidebar">
            {loadingUsers ? (
              <div className="loading-msg">メンバー読み込み中...</div>
            ) : (
              <MemberSelector
                users={users}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
              />
            )}
          </aside>
        )}

        <main className="calendar-area">
          {error && (
            <div className="error-banner">
              ⚠️ エラー: {error}
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}
          <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
          <div className="legend">
            <span className="legend-item busy">予定あり(busy)</span>
            <span className="legend-item tentative">仮予定</span>
            <span className="legend-item oof">外出中</span>
            <span className="legend-item free">空き</span>
          </div>
          <CalendarGrid
            users={selectedUsers}
            eventsMap={eventsMap}
            weekStart={weekStart}
          />
        </main>
      </div>
    </div>
  );
}
