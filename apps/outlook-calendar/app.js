'use strict';

// =============================================
//  State
// =============================================
let msalInstance  = null;
let currentAccount = null;
let allUsers       = [];
let selectedUsers  = [];   // max 6
let currentView    = 'week';
let currentDate    = new Date();

const COLORS = [
  '#0078d4','#107c10','#c4314b','#8764b8','#ca5010','#00b7c3'
];

// =============================================
//  Config (localStorage)
// =============================================
function loadConfig() {
  // config.js may expose window.OUTLOOK_CALENDAR_CONFIG
  if (window.OUTLOOK_CALENDAR_CONFIG &&
      window.OUTLOOK_CALENDAR_CONFIG.clientId &&
      window.OUTLOOK_CALENDAR_CONFIG.tenantId) {
    return window.OUTLOOK_CALENDAR_CONFIG;
  }
  const s = localStorage.getItem('oc-config');
  return s ? JSON.parse(s) : null;
}

function saveConfig(clientId, tenantId) {
  localStorage.setItem('oc-config', JSON.stringify({ clientId, tenantId }));
}

// =============================================
//  MSAL
// =============================================
const SCOPES = ['User.ReadBasic.All', 'Calendars.Read'];

async function initMSAL() {
  const cfg = loadConfig();
  if (!cfg) {
    showEl('config-note');
    return;
  }

  const msalCfg = {
    auth: {
      clientId:    cfg.clientId,
      authority:   `https://login.microsoftonline.com/${cfg.tenantId}`,
      redirectUri: window.location.href.split('#')[0].split('?')[0],
    },
    cache: { cacheLocation: 'sessionStorage' },
  };

  try {
    msalInstance = new msal.PublicClientApplication(msalCfg);
    await msalInstance.initialize();

    const resp = await msalInstance.handleRedirectPromise();
    if (resp) {
      currentAccount = resp.account;
    } else {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) currentAccount = accounts[0];
    }
  } catch (e) {
    showToast('MSAL 初期化エラー: ' + e.message, true);
    return;
  }

  if (currentAccount) {
    onSignedIn();
  }
}

async function signIn() {
  if (!msalInstance) {
    showConfigModal();
    return;
  }
  try {
    await msalInstance.loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
  } catch (e) {
    showToast('サインインエラー: ' + e.message, true);
  }
}

async function signOut() {
  if (!msalInstance || !currentAccount) return;
  await msalInstance.logoutRedirect({ account: currentAccount });
}

async function getToken() {
  const req = { scopes: SCOPES, account: currentAccount };
  try {
    const resp = await msalInstance.acquireTokenSilent(req);
    return resp.accessToken;
  } catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect(req);
    }
    throw e;
  }
}

// =============================================
//  Graph API helpers
// =============================================
async function graphGet(path) {
  const token = await getToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function graphPost(path, body) {
  const token = await getToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// =============================================
//  User loading
// =============================================
async function loadUsers() {
  const listEl = document.getElementById('user-list');
  listEl.innerHTML = '<div class="loading"></div>';
  try {
    let users = [];
    let url = '/users?$select=id,displayName,mail,userPrincipalName,jobTitle&$top=999&$orderby=displayName';
    while (url) {
      const data = await graphGet(url);
      const batch = (data.value || []).filter(u => u.mail || u.userPrincipalName);
      users = users.concat(batch);
      const next = data['@odata.nextLink'];
      url = next ? next.replace('https://graph.microsoft.com/v1.0', '') : null;
    }
    allUsers = users;
    renderUserList(allUsers);
  } catch (e) {
    listEl.innerHTML = `<div class="error">ユーザー取得エラー: ${esc(e.message)}</div>`;
  }
}

// =============================================
//  Schedule fetching  (getSchedule API)
// =============================================
async function fetchSchedules(users, start, end) {
  if (!users.length) return {};
  const emails = users.map(u => u.mail || u.userPrincipalName);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const body = {
    schedules: emails,
    startTime: { dateTime: toLocalISONoZ(start), timeZone: tz },
    endTime:   { dateTime: toLocalISONoZ(end),   timeZone: tz },
    availabilityViewInterval: 30,
  };

  try {
    const data = await graphPost('/me/calendar/getSchedule', body);
    const result = {};
    (data.value || []).forEach((sched, i) => {
      result[emails[i].toLowerCase()] = sched.scheduleItems || [];
    });
    return result;
  } catch (e) {
    showToast('スケジュール取得エラー: ' + e.message, true);
    return {};
  }
}

// =============================================
//  Date utilities
// =============================================
function weekStart(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=Sun
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function weekEnd(d) {
  const dt = weekStart(d);
  dt.setDate(dt.getDate() + 6);
  dt.setHours(23, 59, 59, 999);
  return dt;
}
function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function monthEnd(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function toLocalISONoZ(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

// Parse schedule item dateTime (returned in the timezone we requested → local)
function parseItemDT(dt) {
  if (!dt) return null;
  // If no tz marker assume it's already in local time (as returned by getSchedule when we sent local tz)
  if (/Z$|[+-]\d{2}:\d{2}$/.test(dt)) return new Date(dt);
  // Try interpreting as local
  return new Date(dt);
}

// =============================================
//  UI helpers
// =============================================
function showEl(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function hideEl(id)  { document.getElementById(id)?.classList.add('hidden'); }
function esc(s)      { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initials(n) {
  if (!n) return '?';
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : n.slice(0,2).toUpperCase();
}
function userColor(index) { return COLORS[index % COLORS.length]; }

let toastTimer;
function showToast(msg, isErr = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isErr ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// =============================================
//  User list rendering
// =============================================
function renderUserList(users) {
  const el = document.getElementById('user-list');
  if (!users.length) {
    el.innerHTML = '<div class="empty">ユーザーが見つかりません</div>';
    return;
  }
  el.innerHTML = users.map(u => {
    const sel = selectedUsers.some(s => s.id === u.id);
    const idx = selectedUsers.findIndex(s => s.id === u.id);
    const color = sel ? userColor(idx) : '#a19f9d';
    return `
      <div class="user-item${sel ? ' selected' : ''}" data-id="${esc(u.id)}" role="checkbox" aria-checked="${sel}" tabindex="0">
        <div class="user-avatar" style="background:${color}">${esc(initials(u.displayName))}</div>
        <div class="user-info">
          <div class="user-name">${esc(u.displayName)}</div>
          <div class="user-email">${esc(u.mail || u.userPrincipalName)}</div>
        </div>
        <div class="check-icon">${sel ? '&#10003;' : ''}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.user-item').forEach(item => {
    const toggle = () => toggleUser(item.dataset.id);
    item.addEventListener('click', toggle);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
}

function toggleUser(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;
  const idx = selectedUsers.findIndex(u => u.id === id);
  if (idx >= 0) {
    selectedUsers.splice(idx, 1);
  } else {
    if (selectedUsers.length >= 6) {
      showToast('最大 6 名まで選択できます');
      return;
    }
    selectedUsers.push(user);
  }
  const q = document.getElementById('user-search').value.toLowerCase();
  renderUserList(q ? allUsers.filter(u =>
    u.displayName.toLowerCase().includes(q) ||
    (u.mail || '').toLowerCase().includes(q)
  ) : allUsers);
  renderChips();
  refreshCalendar();
}

// =============================================
//  Selected users chips
// =============================================
function renderChips() {
  const bar   = document.getElementById('selected-bar');
  const chips = document.getElementById('user-chips');
  if (!selectedUsers.length) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  chips.innerHTML = selectedUsers.map((u, i) =>
    `<span class="chip" style="background:${userColor(i)}">
       ${esc(u.displayName)}
       <button class="chip-remove" data-id="${esc(u.id)}" title="削除" aria-label="${esc(u.displayName)}を削除">&#10005;</button>
     </span>`
  ).join('');
  chips.querySelectorAll('.chip-remove').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); toggleUser(btn.dataset.id); })
  );
}

// =============================================
//  Header date label
// =============================================
const JA_DAYS = ['日','月','火','水','木','金','土'];

function updateDateLabel() {
  const el = document.getElementById('date-label');
  if (currentView === 'day') {
    el.textContent = currentDate.toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    });
  } else if (currentView === 'week') {
    const s = weekStart(currentDate), e = weekEnd(currentDate);
    el.textContent = `${s.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'})} ～ ${e.toLocaleDateString('ja-JP',{month:'long',day:'numeric'})}`;
  } else {
    el.textContent = currentDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  }
}

function navigate(dir) {
  if (currentView === 'day')   currentDate = addDays(currentDate, dir);
  else if (currentView === 'week')  currentDate = addDays(currentDate, dir * 7);
  else currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
  updateDateLabel();
  refreshCalendar();
}

// =============================================
//  Calendar refresh (top-level)
// =============================================
async function refreshCalendar() {
  const wrap = document.getElementById('calendar-wrap');

  if (!selectedUsers.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128101;</div>
        <p>「メンバー選択」からメンバーを追加すると<br>横並びで予定を確認できます</p>
        <button class="btn btn-primary" id="empty-select-btn">&#43; メンバーを選択する</button>
      </div>`;
    document.getElementById('empty-select-btn')?.addEventListener('click', openPanel);
    return;
  }

  wrap.innerHTML = '<div class="loading"></div>';

  let start, end;
  const now = currentDate;
  if (currentView === 'day') {
    start = new Date(now); start.setHours(0,0,0,0);
    end   = new Date(now); end.setHours(23,59,59,999);
  } else if (currentView === 'week') {
    start = weekStart(now);
    end   = weekEnd(now);
  } else {
    start = monthStart(now);
    end   = monthEnd(now);
  }

  const schedules = await fetchSchedules(selectedUsers, start, end);

  if (currentView === 'day')        renderDayView(wrap, schedules, start);
  else if (currentView === 'week')  renderWeekView(wrap, schedules, start);
  else                              renderMonthView(wrap, schedules);
}

// =============================================
//  Day View
// =============================================
const HOUR_START = 7;
const HOUR_END   = 21;
const HOUR_H     = 60; // px per hour

function renderDayView(wrap, schedules, date) {
  const hours = range(HOUR_START, HOUR_END);
  const totalH = hours.length * HOUR_H;
  const today  = new Date();

  // Time axis
  const timeAxis = `
    <div class="time-axis">
      <div class="time-axis-spacer"></div>
      ${hours.map(h => `
        <div class="time-slot" style="height:${HOUR_H}px">
          <span>${pad2(h)}:00</span>
        </div>`).join('')}
    </div>`;

  // User columns
  const userCols = selectedUsers.map((u, ci) => {
    const email = (u.mail || u.userPrincipalName).toLowerCase();
    const items = (schedules[email] || []).filter(it => {
      const s = parseItemDT(it.start?.dateTime);
      return s && sameDay(s, date);
    });
    return `
      <div class="day-col">
        <div class="day-col-header">
          <div class="col-avatar" style="background:${userColor(ci)}">${esc(initials(u.displayName))}</div>
          <div class="col-name" title="${esc(u.displayName)}">${esc(u.displayName)}</div>
        </div>
        <div class="events-grid" style="height:${totalH}px">
          ${hours.map(h => `
            <div class="hour-line" style="top:${(h-HOUR_START)*HOUR_H}px"></div>
            <div class="half-hour-line" style="top:${(h-HOUR_START)*HOUR_H + HOUR_H/2}px"></div>
          `).join('')}
          ${items.map(it => eventBlock(it, HOUR_START, HOUR_H)).join('')}
        </div>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="calendar-view day-view">
      ${timeAxis}
      <div class="users-cols" style="display:flex;flex:1;overflow-x:auto">
        ${userCols}
      </div>
    </div>`;
}

// =============================================
//  Week View
// =============================================
function renderWeekView(wrap, schedules, start) {
  const hours  = range(HOUR_START, HOUR_END);
  const totalH = hours.length * HOUR_H;
  const today  = new Date();
  const days   = range(0,7).map(i => addDays(start, i));

  const timeAxis = `
    <div class="time-axis">
      <div class="time-axis-spacer"></div>
      ${hours.map(h => `
        <div class="time-slot" style="height:${HOUR_H}px">
          <span>${pad2(h)}:00</span>
        </div>`).join('')}
    </div>`;

  const userBlocks = selectedUsers.map((u, ci) => {
    const email = (u.mail || u.userPrincipalName).toLowerCase();
    const items = schedules[email] || [];

    const dayHeaders = days.map(d => {
      const isTod = sameDay(d, today);
      const isWe  = d.getDay() === 0 || d.getDay() === 6;
      return `
        <div class="day-header${isTod?' today':''}${isWe?' weekend':''}">
          <span class="d-name">${JA_DAYS[d.getDay()]}</span>
          <span class="d-num">${d.getDate()}</span>
        </div>`;
    }).join('');

    const dayCols = days.map(d => {
      const isTod = sameDay(d, today);
      const isWe  = d.getDay() === 0 || d.getDay() === 6;
      const dayItems = items.filter(it => {
        const s = parseItemDT(it.start?.dateTime);
        return s && sameDay(s, d);
      });
      return `
        <div class="week-day-col${isTod?' today':''}${isWe?' weekend':''}">
          <div class="events-grid" style="height:${totalH}px">
            ${hours.map(h => `
              <div class="hour-line" style="top:${(h-HOUR_START)*HOUR_H}px"></div>
              <div class="half-hour-line" style="top:${(h-HOUR_START)*HOUR_H + HOUR_H/2}px"></div>
            `).join('')}
            ${dayItems.map(it => eventBlock(it, HOUR_START, HOUR_H)).join('')}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="user-block">
        <div class="user-block-header">
          <div class="col-avatar" style="background:rgba(255,255,255,.25)">${esc(initials(u.displayName))}</div>
          ${esc(u.displayName)}
        </div>
        <div class="day-headers-row">${dayHeaders}</div>
        <div class="day-cols-row" style="display:flex;flex:1">${dayCols}</div>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="calendar-view week-view">
      ${timeAxis}
      <div class="users-blocks" style="display:flex;overflow-x:auto;flex:1">
        ${userBlocks}
      </div>
    </div>`;
}

// =============================================
//  Month View
// =============================================
function renderMonthView(wrap, schedules) {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // Calendar grid start (Mon of week containing 1st)
  const first   = new Date(year, month, 1);
  const dow     = first.getDay(); // 0=Sun
  const calStart = addDays(first, -(dow === 0 ? 6 : dow - 1));

  // Collect up to 6 weeks
  const calDays = [];
  let d = new Date(calStart);
  while (calDays.length < 42) {
    calDays.push(new Date(d));
    d = addDays(d, 1);
    if (calDays.length >= 28 && d.getMonth() !== month && d.getDay() === 1) break;
  }

  const WD = ['月','火','水','木','金','土','日'];

  const grids = selectedUsers.map((u, ci) => {
    const email = (u.mail || u.userPrincipalName).toLowerCase();
    const items = schedules[email] || [];

    const weeks = [];
    for (let i = 0; i < calDays.length; i += 7) {
      const week = calDays.slice(i, i+7);
      weeks.push(`
        <div class="month-week-row">
          ${week.map(day => {
            const inMonth = day.getMonth() === month;
            const isTod   = sameDay(day, today);
            const isWe    = day.getDay() === 0 || day.getDay() === 6;
            const dayItems = items.filter(it => {
              const s = parseItemDT(it.start?.dateTime);
              return s && sameDay(s, day);
            });
            const visible = dayItems.slice(0,3);
            const more    = dayItems.length - 3;
            return `
              <div class="month-day${!inMonth?' other-month':''}${isTod?' today':''}${isWe?' weekend':''}">
                <div class="d-num">${day.getDate()}</div>
                <div class="day-events">
                  ${visible.map(it => {
                    const title = it.subject || statusLabel(it.status);
                    return `<div class="month-event ${esc(it.status||'busy')}" title="${esc(title)}">${esc(title)}</div>`;
                  }).join('')}
                  ${more > 0 ? `<div class="more-events">+${more}件</div>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>`);
    }

    return `
      <div class="user-month-block">
        <div class="month-user-header" style="background:${userColor(ci)}">
          <div class="col-avatar" style="background:rgba(255,255,255,.25)">${esc(initials(u.displayName))}</div>
          ${esc(u.displayName)}
        </div>
        <div class="weekday-row">
          ${WD.map((w,i) => `<div class="weekday-cell${i>=5?' weekend':''}">${w}</div>`).join('')}
        </div>
        <div class="month-grid">${weeks.join('')}</div>
      </div>`;
  }).join('');

  wrap.innerHTML = `<div class="calendar-view month-view">${grids}</div>`;
}

// =============================================
//  Event block (time-grid views)
// =============================================
function eventBlock(item, hourStart, hourH) {
  const s = parseItemDT(item.start?.dateTime);
  const e = parseItemDT(item.end?.dateTime);
  if (!s || !e) return '';

  const startMin = (s.getHours() - hourStart) * 60 + s.getMinutes();
  const durMin   = Math.max((e - s) / 60000, 15);

  if (startMin < 0 || startMin >= (HOUR_END - hourStart) * 60) return '';

  const top    = startMin * (hourH / 60);
  const height = Math.max(durMin * (hourH / 60), 18);
  const status = item.status || 'busy';
  const title  = item.subject || statusLabel(status);
  const timeStr = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;

  return `
    <div class="event-block ${esc(status)}"
         style="top:${top}px;height:${height}px"
         title="${esc(title)} ${timeStr}">
      <div class="event-title">${esc(title)}</div>
      ${height > 28 ? `<div class="event-time">${timeStr}</div>` : ''}
    </div>`;
}

function statusLabel(s) {
  return { busy:'予定あり', tentative:'仮予定', oof:'外出中', free:'空き', workingElsewhere:'別の場所で作業中' }[s] || s || '';
}

// =============================================
//  Misc helpers
// =============================================
function range(from, to) {
  const r = [];
  for (let i = from; i < to; i++) r.push(i);
  return r;
}
function pad2(n) { return String(n).padStart(2,'0'); }

// =============================================
//  Panel open/close
// =============================================
function openPanel() {
  document.getElementById('user-panel').classList.remove('hidden');
  document.getElementById('panel-overlay').classList.remove('hidden');
  document.getElementById('user-search').focus();
  if (!allUsers.length) loadUsers();
}
function closePanel() {
  document.getElementById('user-panel').classList.add('hidden');
  document.getElementById('panel-overlay').classList.add('hidden');
}

// =============================================
//  Config modal
// =============================================
function showConfigModal() {
  document.getElementById('redirect-uri-hint').textContent =
    window.location.href.split('#')[0].split('?')[0];
  const cfg = loadConfig();
  if (cfg) {
    document.getElementById('cfg-client-id').value = cfg.clientId || '';
    document.getElementById('cfg-tenant-id').value = cfg.tenantId || '';
  }
  document.getElementById('config-modal').classList.remove('hidden');
}
function hideConfigModal() {
  document.getElementById('config-modal').classList.add('hidden');
}

// =============================================
//  Sign-in callback
// =============================================
function onSignedIn() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  const name = currentAccount?.name || currentAccount?.username || '';
  document.getElementById('signed-in-name').textContent = name;
  updateDateLabel();
  refreshCalendar();
}

// =============================================
//  Event wiring
// =============================================
document.addEventListener('DOMContentLoaded', async () => {

  // Config modal
  document.getElementById('open-config-btn').addEventListener('click', showConfigModal);
  document.getElementById('config-close-btn').addEventListener('click', hideConfigModal);
  document.getElementById('config-cancel-btn').addEventListener('click', hideConfigModal);

  document.getElementById('config-save-btn').addEventListener('click', async () => {
    const clientId = document.getElementById('cfg-client-id').value.trim();
    const tenantId = document.getElementById('cfg-tenant-id').value.trim();
    const errEl = document.getElementById('config-error');
    const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRx.test(clientId) || !uuidRx.test(tenantId)) {
      errEl.textContent = 'クライアント ID / テナント ID は GUID 形式で入力してください';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    saveConfig(clientId, tenantId);
    hideConfigModal();
    await initMSAL();
    if (!currentAccount) signIn();
  });

  // Login screen
  document.getElementById('login-btn').addEventListener('click', async () => {
    const cfg = loadConfig();
    if (!cfg) { showConfigModal(); return; }
    await initMSAL();
    if (!currentAccount) signIn();
  });

  // Sign out
  document.getElementById('logout-btn').addEventListener('click', signOut);

  // View tabs
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      updateDateLabel();
      refreshCalendar();
    });
  });

  // Date navigation
  document.getElementById('prev-btn').addEventListener('click', () => navigate(-1));
  document.getElementById('next-btn').addEventListener('click', () => navigate(1));
  document.getElementById('today-btn').addEventListener('click', () => {
    currentDate = new Date();
    updateDateLabel();
    refreshCalendar();
  });

  // User panel
  document.getElementById('user-select-btn').addEventListener('click', openPanel);
  document.getElementById('close-panel-btn').addEventListener('click', closePanel);
  document.getElementById('panel-overlay').addEventListener('click', closePanel);

  document.getElementById('user-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = q
      ? allUsers.filter(u =>
          u.displayName.toLowerCase().includes(q) ||
          (u.mail || '').toLowerCase().includes(q))
      : allUsers;
    renderUserList(filtered);
  });

  // Clear all
  document.getElementById('clear-all-btn')?.addEventListener('click', () => {
    selectedUsers = [];
    renderChips();
    renderUserList(allUsers);
    refreshCalendar();
  });

  // Keyboard: Escape closes panel
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanel();
  });

  // Bootstrap
  await initMSAL();
});
