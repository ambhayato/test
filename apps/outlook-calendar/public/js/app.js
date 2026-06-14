/* ── Outlook Calendar App ─────────────────────────────────────────────────── */

const USER_COLORS = ['#0078d4', '#107c10', '#c43d1c', '#8764b8', '#ca5010', '#038387'];

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  calendar: null,
  currentEvent: null,
  otherUsers: [],          // { email, name, color, active }
  miniCalDate: new Date(),
  searchTimer: null,
  myEmail: ''
};

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'APIエラー');
  return data;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.className = `toast align-items-center border-0 text-bg-${type}`;
  document.getElementById('toast-msg').textContent = msg;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3000 }).show();
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toLocalISO(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('ja-JP', { year:'numeric', month:'short', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit' });
}

function formatDateRange(start, end) {
  if (!start) return '';
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${s.toLocaleDateString('ja-JP',{year:'numeric',month:'short',day:'numeric',weekday:'short'})} ${s.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})} 〜 ${e.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`;
  }
  return `${formatDateTime(start)} 〜 ${formatDateTime(end)}`;
}

// ── Config / Settings ─────────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const cfg = await apiFetch('/api/config');
    if (cfg.configured) {
      document.getElementById('connection-status').textContent = '接続済み';
      document.getElementById('connection-status').className = 'badge bg-success';
      state.myEmail = cfg.username;
      document.getElementById('my-calendar-label').textContent = cfg.username;
    } else {
      openSettingsModal();
    }
    document.getElementById('cfg-host').value = cfg.host || '';
    document.getElementById('cfg-username').value = cfg.username || '';
    document.getElementById('cfg-auth').value = cfg.auth || 'ntlm';
  } catch (e) {
    console.error(e);
  }
}

function openSettingsModal() {
  bootstrap.Modal.getOrCreateInstance(document.getElementById('settingsModal')).show();
}

document.getElementById('btn-settings').addEventListener('click', openSettingsModal);

document.getElementById('btn-save-config').addEventListener('click', async () => {
  const host = document.getElementById('cfg-host').value.trim();
  const username = document.getElementById('cfg-username').value.trim();
  const password = document.getElementById('cfg-password').value;
  const auth = document.getElementById('cfg-auth').value;
  const errEl = document.getElementById('cfg-error');
  const okEl = document.getElementById('cfg-success');

  errEl.classList.add('d-none');
  okEl.classList.add('d-none');

  if (!host || !username || !password) {
    errEl.textContent = 'すべての必須項目を入力してください';
    errEl.classList.remove('d-none');
    return;
  }

  try {
    await apiFetch('/api/config', {
      method: 'POST',
      body: JSON.stringify({ host, username, password, auth })
    });
    state.myEmail = username;
    document.getElementById('connection-status').textContent = '接続済み';
    document.getElementById('connection-status').className = 'badge bg-success';
    document.getElementById('my-calendar-label').textContent = username;
    bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
    showToast('設定を保存しました');
    state.calendar?.refetchEvents();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('d-none');
  }
});

document.getElementById('btn-test-connection').addEventListener('click', async () => {
  const errEl = document.getElementById('cfg-error');
  const okEl = document.getElementById('cfg-success');
  errEl.classList.add('d-none');
  okEl.classList.add('d-none');

  const host = document.getElementById('cfg-host').value.trim();
  const username = document.getElementById('cfg-username').value.trim();
  const password = document.getElementById('cfg-password').value;
  const auth = document.getElementById('cfg-auth').value;

  if (!host || !username || !password) {
    errEl.textContent = 'すべての項目を入力してください';
    errEl.classList.remove('d-none');
    return;
  }

  const btn = document.getElementById('btn-test-connection');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>テスト中...';

  try {
    await apiFetch('/api/config', { method: 'POST', body: JSON.stringify({ host, username, password, auth }) });
    await apiFetch('/api/config/test', { method: 'POST' });
    okEl.textContent = '接続成功！';
    okEl.classList.remove('d-none');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('d-none');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-plug me-1"></i>接続テスト';
  }
});

// ── Event sources for FullCalendar ────────────────────────────────────────────
function buildEventSource(email, color, isMine) {
  return {
    id: email || 'mine',
    events: async (fetchInfo) => {
      const params = new URLSearchParams({
        start: fetchInfo.startStr,
        end: fetchInfo.endStr
      });
      const url = isMine
        ? `/api/events?${params}`
        : `/api/users/${encodeURIComponent(email)}/events?${params}`;
      try {
        const events = await apiFetch(url);
        return events.map(ev => ({
          id: ev.id,
          title: ev.title,
          start: ev.start,
          end: ev.end,
          allDay: ev.allDay,
          backgroundColor: color,
          borderColor: color,
          extendedProps: {
            changeKey: ev.changeKey,
            location: ev.location,
            body: ev.body,
            organizer: ev.organizer,
            organizerEmail: ev.organizerEmail,
            isRecurring: ev.isRecurring,
            ownerEmail: email || state.myEmail,
            isMine: !!isMine
          }
        }));
      } catch (e) {
        showToast(e.message, 'danger');
        return [];
      }
    },
    color
  };
}

// ── FullCalendar init ─────────────────────────────────────────────────────────
function initCalendar() {
  const calEl = document.getElementById('calendar');

  state.calendar = new FullCalendar.Calendar(calEl, {
    locale: 'ja',
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    height: 'auto',
    nowIndicator: true,
    selectable: true,
    editable: true,
    eventSources: [buildEventSource('', USER_COLORS[0], true)],

    // Click on date → new event
    dateClick(info) {
      openEventModal(null, info.date);
    },

    // Select time range → new event
    select(info) {
      openEventModal(null, info.start, info.end);
    },

    // Click event → detail panel
    eventClick(info) {
      showEventDetail(info.event);
    },

    // Drag-drop update
    eventDrop(info) {
      updateEventTime(info.event);
    },

    // Resize update
    eventResize(info) {
      updateEventTime(info.event);
    },

    // Sync mini-calendar navigation
    datesSet(info) {
      state.miniCalDate = info.view.currentStart;
      renderMiniCalendar();
    }
  });

  state.calendar.render();
}

async function updateEventTime(fcEvent) {
  if (!fcEvent.extendedProps.isMine) {
    fcEvent.revert?.();
    showToast('他のユーザーの予定は変更できません', 'warning');
    return;
  }
  try {
    await apiFetch(`/api/events/${fcEvent.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        changeKey: fcEvent.extendedProps.changeKey,
        title: fcEvent.title,
        start: fcEvent.start.toISOString(),
        end: (fcEvent.end || fcEvent.start).toISOString(),
        location: fcEvent.extendedProps.location,
        body: fcEvent.extendedProps.body
      })
    });
    showToast('予定を更新しました');
    state.calendar.refetchEvents();
  } catch (e) {
    fcEvent.revert?.();
    showToast(e.message, 'danger');
  }
}

// ── Event detail panel ────────────────────────────────────────────────────────
function showEventDetail(fcEvent) {
  state.currentEvent = fcEvent;
  const panel = document.getElementById('event-detail-panel');

  document.getElementById('detail-title').textContent = fcEvent.title;
  document.getElementById('detail-datetime').textContent =
    formatDateRange(fcEvent.start, fcEvent.end);

  const loc = fcEvent.extendedProps.location;
  const locRow = document.getElementById('detail-location-row');
  if (loc) {
    document.getElementById('detail-location').textContent = loc;
    locRow.style.display = '';
  } else {
    locRow.style.display = 'none';
  }

  const org = fcEvent.extendedProps.organizer;
  const orgRow = document.getElementById('detail-organizer-row');
  if (org) {
    document.getElementById('detail-organizer').textContent = org;
    orgRow.style.display = '';
  } else {
    orgRow.style.display = 'none';
  }

  const body = fcEvent.extendedProps.body;
  const bodyRow = document.getElementById('detail-body-row');
  if (body && body.trim()) {
    document.getElementById('detail-body').textContent = body;
    bodyRow.style.display = '';
  } else {
    bodyRow.style.display = 'none';
  }

  const isMine = fcEvent.extendedProps.isMine;
  document.getElementById('btn-detail-edit').style.display = isMine ? '' : 'none';
  document.getElementById('btn-detail-delete').style.display = isMine ? '' : 'none';

  panel.classList.add('open');
}

document.getElementById('btn-detail-close').addEventListener('click', () => {
  document.getElementById('event-detail-panel').classList.remove('open');
  state.currentEvent = null;
});

document.getElementById('btn-detail-edit').addEventListener('click', () => {
  if (state.currentEvent) {
    document.getElementById('event-detail-panel').classList.remove('open');
    openEventModal(state.currentEvent);
  }
});

document.getElementById('btn-detail-delete').addEventListener('click', async () => {
  if (!state.currentEvent) return;
  if (!confirm(`「${state.currentEvent.title}」を削除しますか？`)) return;
  try {
    await apiFetch(
      `/api/events/${state.currentEvent.id}?changeKey=${encodeURIComponent(state.currentEvent.extendedProps.changeKey || '')}`,
      { method: 'DELETE' }
    );
    document.getElementById('event-detail-panel').classList.remove('open');
    showToast('予定を削除しました');
    state.calendar.refetchEvents();
  } catch (e) {
    showToast(e.message, 'danger');
  }
});

// ── Event create/edit modal ───────────────────────────────────────────────────
function openEventModal(fcEvent, startDate, endDate) {
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('eventModal'));
  const isEdit = !!fcEvent;

  document.getElementById('eventModalTitle').textContent = isEdit ? '予定を編集' : '新しい予定';
  document.getElementById('ev-error').classList.add('d-none');

  if (isEdit) {
    document.getElementById('ev-id').value = fcEvent.id;
    document.getElementById('ev-change-key').value = fcEvent.extendedProps.changeKey || '';
    document.getElementById('ev-title').value = fcEvent.title;
    document.getElementById('ev-start').value = toLocalISO(fcEvent.start);
    document.getElementById('ev-end').value = toLocalISO(fcEvent.end || fcEvent.start);
    document.getElementById('ev-location').value = fcEvent.extendedProps.location || '';
    document.getElementById('ev-body').value = fcEvent.extendedProps.body || '';
    document.getElementById('ev-allday').checked = fcEvent.allDay;
    document.getElementById('ev-attendees').value = '';
  } else {
    document.getElementById('ev-id').value = '';
    document.getElementById('ev-change-key').value = '';
    document.getElementById('ev-title').value = '';
    const s = startDate || new Date();
    const e = endDate || new Date(s.getTime() + 60 * 60 * 1000);
    document.getElementById('ev-start').value = toLocalISO(s);
    document.getElementById('ev-end').value = toLocalISO(e);
    document.getElementById('ev-location').value = '';
    document.getElementById('ev-body').value = '';
    document.getElementById('ev-allday').checked = false;
    document.getElementById('ev-attendees').value = '';
  }

  modal.show();
}

document.getElementById('btn-new-event').addEventListener('click', () => openEventModal(null));

document.getElementById('btn-save-event').addEventListener('click', async () => {
  const id = document.getElementById('ev-id').value;
  const changeKey = document.getElementById('ev-change-key').value;
  const title = document.getElementById('ev-title').value.trim();
  const start = document.getElementById('ev-start').value;
  const end = document.getElementById('ev-end').value;
  const location = document.getElementById('ev-location').value.trim();
  const body = document.getElementById('ev-body').value.trim();
  const allDay = document.getElementById('ev-allday').checked;
  const attendeesRaw = document.getElementById('ev-attendees').value.trim();
  const attendees = attendeesRaw ? attendeesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const errEl = document.getElementById('ev-error');

  errEl.classList.add('d-none');
  if (!title || !start || !end) {
    errEl.textContent = 'タイトル、開始日時、終了日時は必須です';
    errEl.classList.remove('d-none');
    return;
  }
  if (new Date(start) >= new Date(end)) {
    errEl.textContent = '終了日時は開始日時より後にしてください';
    errEl.classList.remove('d-none');
    return;
  }

  const btn = document.getElementById('btn-save-event');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>保存中...';

  try {
    if (id) {
      await apiFetch(`/api/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          changeKey, title,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          location, body
        })
      });
      showToast('予定を更新しました');
    } else {
      await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          location, body, attendees, allDay
        })
      });
      showToast('予定を作成しました');
    }
    bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
    state.calendar.refetchEvents();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('d-none');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>保存';
  }
});

// ── Other users ───────────────────────────────────────────────────────────────
function renderOtherUsersList() {
  const list = document.getElementById('other-users-list');
  list.innerHTML = '';
  state.otherUsers.forEach((user, idx) => {
    const div = document.createElement('div');
    div.className = `user-item${user.active ? '' : ' inactive'}`;
    div.innerHTML = `
      <span class="user-color-dot" style="background:${user.color}"></span>
      <span class="user-name" title="${user.email}">${user.name || user.email}</span>
      <button class="btn-icon btn-remove-user" data-idx="${idx}" title="削除" style="color:#888;font-size:11px;">×</button>
      <input type="checkbox" class="form-check-input user-toggle" ${user.active ? 'checked' : ''}>
    `;
    div.querySelector('.user-toggle').addEventListener('change', e => {
      state.otherUsers[idx].active = e.target.checked;
      div.classList.toggle('inactive', !e.target.checked);
      toggleUserEventSource(user, e.target.checked);
    });
    div.querySelector('.btn-remove-user').addEventListener('click', () => {
      removeOtherUser(idx);
    });
    list.appendChild(div);
  });
}

function addOtherUser(email, name) {
  const color = USER_COLORS[(state.otherUsers.length + 1) % USER_COLORS.length];
  const user = { email, name: name || email, color, active: true };
  state.otherUsers.push(user);
  state.calendar.addEventSource(buildEventSource(email, color, false));
  renderOtherUsersList();
}

function removeOtherUser(idx) {
  const user = state.otherUsers[idx];
  const src = state.calendar.getEventSourceById(user.email);
  if (src) src.remove();
  state.otherUsers.splice(idx, 1);
  renderOtherUsersList();
}

function toggleUserEventSource(user, active) {
  const src = state.calendar.getEventSourceById(user.email);
  if (!src) return;
  if (active) {
    src.refetch();
  } else {
    state.calendar.getEvents()
      .filter(e => e.extendedProps.ownerEmail === user.email)
      .forEach(e => e.remove());
  }
}

document.getElementById('btn-add-user').addEventListener('click', () => {
  document.getElementById('add-user-name').value = '';
  document.getElementById('add-user-email').value = '';
  document.getElementById('add-user-error').classList.add('d-none');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('addUserModal')).show();
});

document.getElementById('btn-confirm-add-user').addEventListener('click', () => {
  const email = document.getElementById('add-user-email').value.trim();
  const name = document.getElementById('add-user-name').value.trim();
  const errEl = document.getElementById('add-user-error');
  errEl.classList.add('d-none');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = '有効なメールアドレスを入力してください';
    errEl.classList.remove('d-none');
    return;
  }
  if (state.otherUsers.find(u => u.email === email)) {
    errEl.textContent = 'このユーザーはすでに追加されています';
    errEl.classList.remove('d-none');
    return;
  }

  addOtherUser(email, name);
  bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
  showToast(`${name || email} のカレンダーを追加しました`);
});

// ── View switcher ─────────────────────────────────────────────────────────────
document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.calendar.changeView(btn.dataset.view);
  });
});

// ── Refresh ───────────────────────────────────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click', () => {
  state.calendar.refetchEvents();
  showToast('更新しました');
});

// ── Search ────────────────────────────────────────────────────────────────────
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  const q = searchInput.value.trim();
  if (!q) { searchResults.innerHTML = ''; searchResults.classList.remove('visible'); return; }
  state.searchTimer = setTimeout(() => performSearch(q), 400);
});

document.getElementById('btn-clear-search').addEventListener('click', () => {
  searchInput.value = '';
  searchResults.innerHTML = '';
  searchResults.classList.remove('visible');
});

document.addEventListener('click', e => {
  if (!e.target.closest('#search-input') && !e.target.closest('#search-results') && !e.target.closest('#btn-clear-search')) {
    searchResults.classList.remove('visible');
  }
});

async function performSearch(q) {
  try {
    const events = await apiFetch(`/api/events/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(events);
  } catch (e) {
    searchResults.innerHTML = `<div class="p-3 text-danger">${e.message}</div>`;
    searchResults.classList.add('visible');
  }
}

function renderSearchResults(events) {
  if (events.length === 0) {
    searchResults.innerHTML = '<div class="p-3 text-muted">該当する予定が見つかりません</div>';
    searchResults.classList.add('visible');
    return;
  }
  searchResults.innerHTML = events.slice(0, 20).map(ev => `
    <div class="search-result-item" data-start="${ev.start}" data-id="${ev.id}">
      <div class="search-result-title">${escapeHtml(ev.title)}</div>
      <div class="search-result-meta">
        ${formatDateTime(ev.start)}
        ${ev.location ? ` · ${escapeHtml(ev.location)}` : ''}
      </div>
    </div>
  `).join('');
  searchResults.classList.add('visible');

  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const start = new Date(item.dataset.start);
      state.calendar.gotoDate(start);
      state.calendar.changeView('timeGridDay');
      document.querySelector('[data-view="timeGridDay"]').click();
      searchResults.classList.remove('visible');
      searchInput.value = '';
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ── Mini calendar ─────────────────────────────────────────────────────────────
function renderMiniCalendar() {
  const container = document.getElementById('mini-calendar');
  const date = state.miniCalDate;
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  let html = `
    <div class="mini-cal-header">
      <button class="btn btn-sm btn-outline-secondary py-0 px-1" id="mini-prev">‹</button>
      <span class="mini-cal-title">${year}年 ${month + 1}月</span>
      <button class="btn btn-sm btn-outline-secondary py-0 px-1" id="mini-next">›</button>
    </div>
    <div class="mini-cal-grid">
      ${dayLabels.map(d => `<div class="mini-cal-day-label">${d}</div>`).join('')}
  `;

  for (let i = 0; i < firstDay; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    html += `<div class="mini-cal-day${isToday ? ' today' : ''}" data-date="${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}">${d}</div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.mini-cal-day').forEach(el => {
    el.addEventListener('click', () => {
      state.calendar.gotoDate(el.dataset.date);
    });
  });

  document.getElementById('mini-prev').addEventListener('click', () => {
    state.miniCalDate = new Date(year, month - 1, 1);
    renderMiniCalendar();
  });
  document.getElementById('mini-next').addEventListener('click', () => {
    state.miniCalDate = new Date(year, month + 1, 1);
    renderMiniCalendar();
  });
}

// ── My calendar toggle ────────────────────────────────────────────────────────
document.querySelector('#my-calendar-item .user-toggle').addEventListener('change', e => {
  const src = state.calendar.getEventSourceById('mine');
  if (!src) return;
  if (e.target.checked) {
    src.refetch();
  } else {
    state.calendar.getEvents()
      .filter(ev => ev.extendedProps.isMine)
      .forEach(ev => ev.remove());
  }
  document.getElementById('my-calendar-item').classList.toggle('inactive', !e.target.checked);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  initCalendar();
  renderMiniCalendar();
  await loadConfig();
}

boot();
