const express = require('express');
const path = require('path');
const { load, save, cardKeyName } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function findCardKey(data, id) {
  return data.cardKeys.find((k) => k.id === id);
}

function currentLoanFor(data, cardKeyId) {
  return data.loans.find((l) => l.cardKeyId === cardKeyId && !l.returnDate) || null;
}

function cardKeyWithStatus(data, cardKey) {
  const loan = currentLoanFor(data, cardKey.id);
  return {
    id: cardKey.id,
    name: cardKeyName(cardKey.id),
    status: loan ? '貸出中' : '在庫',
    currentLoan: loan,
  };
}

app.get('/api/card-keys', (req, res) => {
  const data = load();
  res.json(data.cardKeys.map((k) => cardKeyWithStatus(data, k)));
});

app.get('/api/card-keys/:id/history', (req, res) => {
  const id = Number(req.params.id);
  const data = load();
  const cardKey = findCardKey(data, id);
  if (!cardKey) return res.status(404).json({ error: 'カードキーが見つかりません' });

  const history = data.loans
    .filter((l) => l.cardKeyId === id)
    .sort((a, b) => b.useDate.localeCompare(a.useDate) || b.id - a.id);
  res.json(history);
});

app.post('/api/card-keys/:id/loans', (req, res) => {
  const id = Number(req.params.id);
  const { user, useDate, dueDate } = req.body || {};

  if (!user || !String(user).trim()) {
    return res.status(400).json({ error: '利用者を入力してください' });
  }
  if (!DATE_RE.test(useDate)) {
    return res.status(400).json({ error: '利用日の形式が正しくありません' });
  }
  if (!DATE_RE.test(dueDate)) {
    return res.status(400).json({ error: '返却予定日の形式が正しくありません' });
  }
  if (dueDate < useDate) {
    return res.status(400).json({ error: '返却予定日は利用日より後の日付にしてください' });
  }

  const data = load();
  const cardKey = findCardKey(data, id);
  if (!cardKey) return res.status(404).json({ error: 'カードキーが見つかりません' });
  if (currentLoanFor(data, id)) {
    return res.status(409).json({ error: 'このカードキーは現在貸出中です' });
  }

  const loan = {
    id: data.nextLoanId++,
    cardKeyId: id,
    user: String(user).trim(),
    useDate,
    dueDate,
    returnDate: null,
  };
  data.loans.push(loan);
  save(data);
  res.status(201).json(loan);
});

app.put('/api/loans/:id/return', (req, res) => {
  const id = Number(req.params.id);
  const { returnDate } = req.body || {};

  if (!DATE_RE.test(returnDate)) {
    return res.status(400).json({ error: '返却日の形式が正しくありません' });
  }

  const data = load();
  const loan = data.loans.find((l) => l.id === id);
  if (!loan) return res.status(404).json({ error: '貸出記録が見つかりません' });
  if (loan.returnDate) return res.status(409).json({ error: 'すでに返却済みです' });
  if (returnDate < loan.useDate) {
    return res.status(400).json({ error: '返却日は利用日より後の日付にしてください' });
  }

  loan.returnDate = returnDate;
  save(data);
  res.json(loan);
});

app.get('/api/users', (req, res) => {
  const data = load();
  res.json(data.users);
});

app.post('/api/users', (req, res) => {
  const { name } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return res.status(400).json({ error: '利用者名を入力してください' });
  }

  const data = load();
  if (data.users.some((u) => u.name === trimmed)) {
    return res.status(409).json({ error: 'この利用者はすでに登録されています' });
  }

  const user = { id: data.nextUserId++, name: trimmed };
  data.users.push(user);
  save(data);
  res.status(201).json(user);
});

app.delete('/api/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = load();
  const index = data.users.findIndex((u) => u.id === id);
  if (index === -1) return res.status(404).json({ error: '利用者が見つかりません' });

  data.users.splice(index, 1);
  save(data);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Card key management app listening on http://localhost:${PORT}`);
});
