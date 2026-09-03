const express = require('express');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const { db, id } = require('./lib/db');
const { STATES } = require('./lib/states');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXT_BY_MIME[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => cb(null, Boolean(EXT_BY_MIME[file.mimetype])),
});

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function serializeListing(row) {
  return { ...row, acres: row.acres, images: JSON.parse(row.images) };
}

const SORTS = {
  newest: 'l.created_at DESC',
  price_asc: 'l.min_price ASC',
  price_desc: 'l.min_price DESC',
  most_bids: 'bid_count DESC, l.created_at DESC',
};

// ---- reference data ----

app.get('/api/states', (req, res) => {
  res.json(STATES);
});

// ---- listings ----

app.get('/api/listings', (req, res) => {
  const { state, status, sort } = req.query;
  let sql = `
    SELECT l.*,
      (SELECT COUNT(*) FROM bids b WHERE b.listing_id = l.id) AS bid_count,
      (SELECT MAX(amount) FROM bids b WHERE b.listing_id = l.id) AS highest_bid
    FROM listings l WHERE 1=1`;
  const params = [];
  if (state) {
    if (!STATES[state]) return badRequest(res, 'unknown state');
    sql += ' AND l.state = ?';
    params.push(state);
  }
  if (status) {
    if (!['active', 'sold'].includes(status)) return badRequest(res, 'unknown status');
    sql += ' AND l.status = ?';
    params.push(status);
  }
  const orderBy = SORTS[sort] || SORTS.newest;
  sql += ` ORDER BY ${orderBy}`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(serializeListing));
});

app.get('/api/listings/:id', (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'not found' });
  const bids = db
    .prepare('SELECT * FROM bids WHERE listing_id = ? ORDER BY amount DESC, created_at ASC')
    .all(req.params.id);
  res.json({ ...serializeListing(listing), bids });
});

app.post('/api/listings', upload.array('images', 6), (req, res) => {
  const { title, state, district, acres, description, min_price, owner_name } = req.body;

  if (!title || !title.trim() || title.length > 120) return badRequest(res, 'title is required (max 120 chars)');
  if (!owner_name || !owner_name.trim() || owner_name.length > 60) return badRequest(res, 'owner_name is required');
  if (!STATES[state]) return badRequest(res, 'state must be a South Indian state for this prototype');
  if (!STATES[state].includes(district)) return badRequest(res, 'district must belong to the selected state');

  const acresNum = Number(acres);
  if (!Number.isFinite(acresNum) || acresNum <= 0 || acresNum > 100000) return badRequest(res, 'acres must be a positive number');

  const minPriceNum = Number(min_price);
  if (!Number.isInteger(minPriceNum) || minPriceNum <= 0) return badRequest(res, 'min_price must be a positive whole number (INR)');

  const desc = (description || '').slice(0, 2000);
  const images = (req.files || []).map((f) => `/uploads/${f.filename}`);

  const listing = {
    id: id(),
    title: title.trim(),
    state,
    district,
    acres: acresNum,
    description: desc,
    min_price: minPriceNum,
    images: JSON.stringify(images),
    owner_name: owner_name.trim(),
    status: 'active',
    winning_bid_id: null,
    created_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO listings (id, title, state, district, acres, description, min_price, images, owner_name, status, winning_bid_id, created_at)
     VALUES (:id, :title, :state, :district, :acres, :description, :min_price, :images, :owner_name, :status, :winning_bid_id, :created_at)`
  ).run(listing);

  res.status(201).json(serializeListing(listing));
});

// ---- per-user activity ----

app.get('/api/me', (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return badRequest(res, 'name is required');

  const listings = db
    .prepare(
      `SELECT l.*,
        (SELECT COUNT(*) FROM bids b WHERE b.listing_id = l.id) AS bid_count,
        (SELECT MAX(amount) FROM bids b WHERE b.listing_id = l.id) AS highest_bid
      FROM listings l WHERE l.owner_name = ? ORDER BY l.created_at DESC`
    )
    .all(name)
    .map(serializeListing);

  const bids = db
    .prepare(
      `SELECT b.*, l.title AS listing_title, l.status AS listing_status, l.winning_bid_id AS listing_winning_bid_id,
        (SELECT MAX(amount) FROM bids b2 WHERE b2.listing_id = b.listing_id) AS listing_highest_bid
       FROM bids b JOIN listings l ON b.listing_id = l.id
       WHERE b.bidder_name = ? ORDER BY b.created_at DESC`
    )
    .all(name);

  res.json({ listings, bids });
});

// ---- bids ----

app.post('/api/listings/:id/bids', (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'not found' });
  if (listing.status !== 'active') return badRequest(res, 'this listing is no longer accepting bids');

  const { bidder_name, amount } = req.body;
  if (!bidder_name || !bidder_name.trim() || bidder_name.length > 60) return badRequest(res, 'bidder_name is required');

  const amountNum = Number(amount);
  if (!Number.isInteger(amountNum) || amountNum <= 0) return badRequest(res, 'amount must be a positive whole number (INR)');
  if (amountNum < listing.min_price) return badRequest(res, `bid must be at least the minimum price (₹${listing.min_price})`);

  const highest = db
    .prepare('SELECT MAX(amount) as max FROM bids WHERE listing_id = ?')
    .get(req.params.id).max;
  if (highest && amountNum <= highest) return badRequest(res, `bid must be higher than the current highest bid (₹${highest})`);

  const bid = {
    id: id(),
    listing_id: req.params.id,
    bidder_name: bidder_name.trim(),
    amount: amountNum,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO bids (id, listing_id, bidder_name, amount, created_at) VALUES (:id, :listing_id, :bidder_name, :amount, :created_at)`
  ).run(bid);

  res.status(201).json(bid);
});

// ---- sell (owner accepts the highest bid) ----
// Prototype-only identity check: owner_name must match the listing's owner_name.
// This is not real authentication and is not meant to survive beyond the prototype stage.
app.post('/api/listings/:id/sell', (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'not found' });
  if (listing.status !== 'active') return badRequest(res, 'this listing is already closed');

  const { owner_name } = req.body;
  if (!owner_name || owner_name.trim() !== listing.owner_name) {
    return res.status(403).json({ error: 'only the listing owner can accept a bid' });
  }

  const topBid = db
    .prepare('SELECT * FROM bids WHERE listing_id = ? ORDER BY amount DESC, created_at ASC LIMIT 1')
    .get(req.params.id);
  if (!topBid) return badRequest(res, 'there are no bids to accept yet');

  db.prepare('UPDATE listings SET status = ?, winning_bid_id = ? WHERE id = ?').run('sold', topBid.id, req.params.id);

  res.json({ ...serializeListing({ ...listing, status: 'sold', winning_bid_id: topBid.id }), winning_bid: topBid });
});

const PORT = process.env.PORT || 4243;
app.listen(PORT, () => {
  console.log(`plotbid prototype running at http://localhost:${PORT}`);
});
