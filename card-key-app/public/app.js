const cardKeyGrid = document.getElementById('card-key-grid');
const searchInput = document.getElementById('search-input');
const loanForm = document.getElementById('loan-form');
const loanCardKeySelect = document.getElementById('loan-card-key');
const loanUserInput = document.getElementById('loan-user');
const loanUseDateInput = document.getElementById('loan-use-date');
const loanDueDateInput = document.getElementById('loan-due-date');
const loanMessage = document.getElementById('loan-message');
const historyCardKeySelect = document.getElementById('history-card-key');
const historyBody = document.getElementById('history-body');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'エラーが発生しました');
  }
  return body;
}

function renderCardKeys(cardKeys) {
  cardKeyGrid.innerHTML = '';
  cardKeys.forEach((k) => {
    const div = document.createElement('div');
    div.className = `card ${k.status === '在庫' ? 'status-available' : 'status-loaned'}`;

    const detail = k.currentLoan
      ? `<div class="card-detail">利用者: ${escapeHtml(k.currentLoan.user)}<br>利用日: ${k.currentLoan.useDate}<br>返却予定日: ${k.currentLoan.dueDate}</div>`
      : '';

    div.innerHTML = `
      <div class="card-name">${escapeHtml(k.name)}</div>
      <div class="card-status">${k.status}</div>
      ${detail}
    `;

    if (k.currentLoan) {
      const btn = document.createElement('button');
      btn.className = 'return-btn secondary';
      btn.textContent = '返却する';
      btn.addEventListener('click', () => returnLoan(k.currentLoan.id));
      div.appendChild(btn);
    }

    cardKeyGrid.appendChild(div);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadCardKeys(query) {
  const path = query ? `/api/search?q=${encodeURIComponent(query)}` : '/api/card-keys';
  const cardKeys = await api(path);
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

async function refreshAll() {
  const query = searchInput.value.trim();
  await loadCardKeys(query);
  await populateCardKeySelects();
  await loadHistory();
}

searchInput.addEventListener('input', () => {
  loadCardKeys(searchInput.value.trim());
});

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

loanUseDateInput.value = todayStr();
refreshAll();
