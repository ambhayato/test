import { useState, useMemo } from "react";

export default function MemberSelector({ users, selectedIds, onChange }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.mail?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleUser = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const selectAll = () => onChange(filtered.map((u) => u.id));
  const clearAll = () => onChange([]);

  return (
    <div className="member-selector">
      <div className="selector-header">
        <h3>メンバー選択</h3>
        <span className="selected-count">{selectedIds.length}名選択中</span>
      </div>
      <input
        className="search-input"
        type="text"
        placeholder="名前・メール・部署で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="selector-actions">
        <button className="btn btn-sm" onClick={selectAll}>
          全選択
        </button>
        <button className="btn btn-sm" onClick={clearAll}>
          クリア
        </button>
      </div>
      <div className="member-list">
        {filtered.map((user) => (
          <label key={user.id} className="member-item">
            <input
              type="checkbox"
              checked={selectedIds.includes(user.id)}
              onChange={() => toggleUser(user.id)}
            />
            <div className="member-avatar" style={{ backgroundColor: avatarColor(user.displayName) }}>
              {initials(user.displayName)}
            </div>
            <div className="member-info">
              <span className="member-name">{user.displayName}</span>
              <span className="member-mail">{user.mail}</span>
              {user.department && (
                <span className="member-dept">{user.department}</span>
              )}
            </div>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="empty-msg">該当するメンバーが見つかりません</p>
        )}
      </div>
    </div>
  );
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const COLORS = [
  "#4f46e5", "#0891b2", "#059669", "#d97706",
  "#dc2626", "#7c3aed", "#db2777", "#0284c7",
];

function avatarColor(name = "") {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}
