const express = require('express');
const path = require('path');
const { load, save } = require('./db');

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
    name: cardKey.name,
    status: loan ? '貸出中' : '在庫',
    currentLoan: loan,
  };
}

app.get('/api/card-keys', (req, res) => {
  const data = load();
  res.json(data.cardKeys.map((k) => cardKeyWithStatus(data, k)));
});

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const data = load();
  const results = data.cardKeys
    .map((k) => cardKeyWithStatus(data, k))
    .filter((k) => {
      if (!q) return true;
      const userMatch = k.currentLoan && k.currentLoan.user.toLowerCase().includes(q);
      return k.name.toLowerCase().includes(q) || Boolean(userMatch);
    });
  res.json(results);
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

app.listen(PORT, () => {
  console.log(`Card key management app listening on http://localhost:${PORT}`);
});
