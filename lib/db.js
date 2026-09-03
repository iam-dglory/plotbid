const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'plotbid.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    acres REAL NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    min_price INTEGER NOT NULL,
    images TEXT NOT NULL DEFAULT '[]',
    owner_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    winning_bid_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    bidder_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (listing_id) REFERENCES listings(id)
  );
`);

function id() {
  return crypto.randomUUID();
}

require('./seed').seed(db);

module.exports = { db, id };
