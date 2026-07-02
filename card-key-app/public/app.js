const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const cardKeyGrid = document.getElementById('card-key-grid');
const loanForm = document.getElementById('loan-form');
const loanCardKeySelect = document.getElementById('loan-card-key');
const loanUserInput = document.getElementById('loan-user');
const userDatalist = document.getElementById('user-datalist');
const loanUseDateInput = document.getElementById('loan-use-date');
const loanDueDateInput = document.getElementById('loan-due-date');
const loanMessage = document.getElementById('loan-message');
const historyCardKeySelect = document.getElementById('history-card-key');
const historyBody = document.getElementById('history-body');
const userForm = document.getElementById('user-form');
const userNameInput = document.getElementById('user-name-input');
const userMessage = document.getElementById('user-message');
const userListEl = document.getElementById('user-list');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'エラーが発生しました');
  }
  return body;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function switchView(viewName) {
  views.forEach((v) => v.classList.toggle('active', v.id === `view-${viewName}`));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
}

function goToLoanForm(cardKeyId) {
  switchView('loan');
  loanCardKeySelect.value = String(cardKeyId);
}

navItems.forEach((item) => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

function renderCardKeys(cardKeys) {
  cardKeyGrid.innerHTML = '';
  cardKeys.forEach((k) => {
    const isAvailable = k.status === '在庫';
    const div = document.createElement('div');
    div.className = `card ${isAvailable ? 'status-available' : 'status-loaned'}`;

    const line1 = k.currentLoan ? `利用者: ${escapeHtml(k.currentLoan.user)}` : '';
    const line2 = k.currentLoan ? `利用日: ${k.currentLoan.useDate}` : '';
    const line3 = k.currentLoan ? `返却予定日: ${k.currentLoan.dueDate}` : '';

    div.innerHTML = `
      <div class="card-name">${escapeHtml(k.name)}</div>
      <div class="card-status">${isAvailable ? '' : k.status}</div>
      <div class="card-detail">
        <div>${line1 || '&nbsp;'}</div>
        <div>${line2 || '&nbsp;'}</div>
        <div>${line3 || '&nbsp;'}</div>
      </div>
      <div class="card-action"></div>
    `;

    const actionEl = div.querySelector('.card-action');
    const btn = document.createElement('button');
    if (k.currentLoan) {
      btn.className = 'secondary';
      btn.textContent = '返却する';
      btn.addEventListener('click', () => returnLoan(k.currentLoan.id));
    } else {
      btn.textContent = '貸出登録へ';
      btn.addEventListener('click', () => goToLoanForm(k.id));
    }
    actionEl.appendChild(btn);

    cardKeyGrid.appendChild(div);
  });
}

async function loadCardKeys() {
  const cardKeys = await api('/api/card-keys');
  renderCardKeys(cardKeys);
  return cardKeys;
}

async function populateCardKeySelects() {
  const cardKeys = await api('/api/card-keys');

  loanCardKeySelect.innerHTML = cardKeys
    .filter((k) => k.status === '在庫')
    .map((k) => `<option value="${k.id}">${escapeHtml(k.name)}</option>`)
    .join('') || '<option value="">貸出可能なカードキーがありません</option>';

  const currentHistorySelection = historyCardKeySelect.value;
  historyCardKeySelect.innerHTML = cardKeys
    .map((k) => `<option value="${k.id}">${escapeHtml(k.name)}</option>`)
    .join('');
  if (currentHistorySelection) {
    historyCardKeySelect.value = currentHistorySelection;
  }
}

async function loadHistory() {
  const id = historyCardKeySelect.value;
  if (!id) {
    historyBody.innerHTML = '';
    return;
  }
  const history = await api(`/api/card-keys/${id}/history`);
  historyBody.innerHTML = '';

  if (history.length === 0) {
    historyBody.innerHTML = '<tr><td colspan="6">利用履歴はありません</td></tr>';
    return;
  }

  history.forEach((loan) => {
    const tr = document.createElement('tr');
    const status = loan.returnDate ? '返却済み' : '貸出中';
    tr.innerHTML = `
      <td>${escapeHtml(loan.user)}</td>
      <td>${loan.useDate}</td>
      <td>${loan.dueDate}</td>
      <td>${loan.returnDate || '-'}</td>
      <td>${status}</td>
      <td></td>
    `;
    if (!loan.returnDate) {
      const btn = document.createElement('button');
      btn.textContent = '返却する';
      btn.addEventListener('click', () => returnLoan(loan.id));
      tr.lastElementChild.appendChild(btn);
    }
    historyBody.appendChild(tr);
  });
}

async function returnLoan(loanId) {
  try {
    await api(`/api/loans/${loanId}/return`, {
      method: 'PUT',
      body: JSON.stringify({ returnDate: todayStr() }),
    });
    await refreshAll();
  } catch (err) {
    alert(err.message);
  }
}

async function loadUsers() {
  const users = await api('/api/users');

  userDatalist.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.name)}"></option>`)
    .join('');

  userListEl.innerHTML = '';
  if (users.length === 0) {
    userListEl.innerHTML = '<li class="user-list-empty">登録されている利用者はいません</li>';
    return;
  }
  users.forEach((u) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(u.name)}</span>`;
    const btn = document.createElement('button');
    btn.className = 'secondary';
    btn.textContent = '削除';
    btn.addEventListener('click', () => deleteUser(u.id));
    li.appendChild(btn);
    userListEl.appendChild(li);
  });
}

async function deleteUser(id) {
  try {
    await api(`/api/users/${id}`, { method: 'DELETE' });
    await loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

async function refreshAll() {
  await loadCardKeys();
  await populateCardKeySelects();
  await loadHistory();
  await loadUsers();
}

historyCardKeySelect.addEventListener('change', loadHistory);

loanForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loanMessage.textContent = '';
  loanMessage.className = 'message';

  const cardKeyId = loanCardKeySelect.value;
  if (!cardKeyId) {
    loanMessage.textContent = '貸出可能なカードキーがありません';
    loanMessage.classList.add('error');
    return;
  }

  try {
    await api(`/api/card-keys/${cardKeyId}/loans`, {
      method: 'POST',
      body: JSON.stringify({
        user: loanUserInput.value,
        useDate: loanUseDateInput.value,
        dueDate: loanDueDateInput.value,
      }),
    });
    loanMessage.textContent = '貸出登録しました';
    loanMessage.classList.add('success');
    loanForm.reset();
    loanUseDateInput.value = todayStr();
    await refreshAll();
  } catch (err) {
    loanMessage.textContent = err.message;
    loanMessage.classList.add('error');
  }
});

userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  userMessage.textContent = '';
  userMessage.className = 'message';

  try {
    await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: userNameInput.value }),
    });
    userForm.reset();
    await loadUsers();
  } catch (err) {
    userMessage.textContent = err.message;
    userMessage.classList.add('error');
  }
});

loanUseDateInput.value = todayStr();
switchView('dashboard');
refreshAll();
