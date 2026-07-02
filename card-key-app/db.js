const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const CARD_KEY_COUNT = 6;
const CIRCLED_DIGITS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function cardKeyName(id) {
  return `カードキー${CIRCLED_DIGITS[id - 1] || id}`;
}

function defaultData() {
  return {
    cardKeys: Array.from({ length: CARD_KEY_COUNT }, (_, i) => ({ id: i + 1 })),
    loans: [],
    nextLoanId: 1,
    users: [],
    nextUserId: 1,
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const data = defaultData();
    save(data);
    return data;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const data = JSON.parse(raw);
  if (!data.users) data.users = [];
  if (!data.nextUserId) data.nextUserId = 1;
  return data;
}

function save(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { load, save, cardKeyName };
