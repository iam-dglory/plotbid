// Demo data so the prototype is browsable out of the box.
// Uses fixed IDs + INSERT OR IGNORE so re-running (e.g. on every server start) never duplicates rows.

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

const LISTINGS = [
  {
    id: 'seed-1',
    title: '8 acre agricultural land near Madurai bypass',
    state: 'Tamil Nadu',
    district: 'Madurai',
    acres: 8,
    description: 'Two borewells, red soil suited for cotton and pulses. 200 ft road frontage on the bypass road.',
    min_price: 3200000,
    images: ['/seed/farmland.svg', '/seed/vacant.svg'],
    owner_name: 'Karthik Subramanian',
    created_at: daysAgo(6),
    bids: [],
  },
  {
    id: 'seed-2',
    title: '3 acre coconut orchard, Mysuru outskirts',
    state: 'Karnataka',
    district: 'Mysuru',
    acres: 3,
    description: '120 bearing coconut trees, drip irrigation installed, gated plot with a small caretaker shed.',
    min_price: 9500000,
    images: ['/seed/orchard.svg', '/seed/farmland.svg'],
    owner_name: 'Lakshmi Narayan',
    created_at: daysAgo(5),
    bids: [
      { id: 'seed-2-b1', bidder_name: 'Ramesh Chetty', amount: 9800000, created_at: daysAgo(4) },
      { id: 'seed-2-b2', bidder_name: 'Suresh Reddy', amount: 10200000, created_at: daysAgo(3) },
    ],
  },
  {
    id: 'seed-3',
    title: '2 acre coastal plot facing the beach road',
    state: 'Andhra Pradesh',
    district: 'Visakhapatnam',
    acres: 2,
    description: 'Rare beach-facing plot, five minutes from RK Beach. Ideal for a resort or holiday home.',
    min_price: 18000000,
    images: ['/seed/coastal.svg'],
    owner_name: 'Anitha Menon',
    created_at: daysAgo(7),
    bids: [
      { id: 'seed-3-b1', bidder_name: 'Vikram Rao', amount: 18500000, created_at: daysAgo(6) },
      { id: 'seed-3-b2', bidder_name: 'Kavya Nair', amount: 19800000, created_at: daysAgo(4) },
      { id: 'seed-3-b3', bidder_name: 'Ganesh Iyer', amount: 21000000, created_at: daysAgo(2) },
    ],
  },
  {
    id: 'seed-4',
    title: '10 acre plotted residential layout, Hyderabad outskirts',
    state: 'Telangana',
    district: 'Rangareddy',
    acres: 10,
    description: 'DTCP-approved layout, internal roads and drainage already laid, close to ORR exit 5.',
    min_price: 45000000,
    images: ['/seed/residential.svg', '/seed/vacant.svg'],
    owner_name: 'Vikram Rao',
    created_at: daysAgo(12),
    bids: [
      { id: 'seed-4-b1', bidder_name: 'Meena Pillai', amount: 46000000, created_at: daysAgo(10) },
      { id: 'seed-4-b2', bidder_name: 'Divya Krishnan', amount: 48500000, created_at: daysAgo(8) },
    ],
    sold: true,
    winning_bid_id: 'seed-4-b2',
  },
  {
    id: 'seed-5',
    title: '1.5 acre riverside plot near Kochi backwaters',
    state: 'Kerala',
    district: 'Ernakulam',
    acres: 1.5,
    description: 'Backwater frontage, ideal for a homestay. Road access and electricity connection available.',
    min_price: 12000000,
    images: ['/seed/riverside.svg'],
    owner_name: 'Divya Krishnan',
    created_at: daysAgo(3),
    bids: [
      { id: 'seed-5-b1', bidder_name: 'Karthik Subramanian', amount: 12500000, created_at: daysAgo(1) },
    ],
  },
  {
    id: 'seed-6',
    title: '4 acre commercial-zoned land on ECR extension',
    state: 'Puducherry',
    district: 'Puducherry',
    acres: 4,
    description: 'Commercial zoning, high visibility on the ECR extension road. Suited for a showroom or warehouse.',
    min_price: 26000000,
    images: ['/seed/commercial.svg'],
    owner_name: 'Ganesh Iyer',
    created_at: daysAgo(2),
    bids: [],
  },
  {
    id: 'seed-7',
    title: '12 acre hillside farmland with mango orchard',
    state: 'Karnataka',
    district: 'Belagavi',
    acres: 12,
    description: '400 mango trees plus open farmland, a natural spring on the property, scenic hillside views.',
    min_price: 15000000,
    images: ['/seed/hillside.svg', '/seed/orchard.svg'],
    owner_name: 'Kavya Nair',
    created_at: daysAgo(15),
    bids: [
      { id: 'seed-7-b1', bidder_name: 'Anitha Menon', amount: 15400000, created_at: daysAgo(13) },
      { id: 'seed-7-b2', bidder_name: 'Ramesh Chetty', amount: 16200000, created_at: daysAgo(11) },
      { id: 'seed-7-b3', bidder_name: 'Suresh Reddy', amount: 17100000, created_at: daysAgo(9) },
    ],
    sold: true,
    winning_bid_id: 'seed-7-b3',
  },
  {
    id: 'seed-8',
    title: '5 acre vacant agricultural plot, road-facing',
    state: 'Telangana',
    district: 'Warangal',
    acres: 5,
    description: 'Level plot, road-facing on both sides. Borewell yet to be dug but groundwater is good in the area.',
    min_price: 6000000,
    images: ['/seed/vacant.svg', '/seed/farmland.svg'],
    owner_name: 'Ramesh Chetty',
    created_at: daysAgo(1),
    bids: [
      { id: 'seed-8-b1', bidder_name: 'Lakshmi Narayan', amount: 6300000, created_at: daysAgo(0.5) },
    ],
  },
];

function seed(db) {
  const insertListing = db.prepare(
    `INSERT OR IGNORE INTO listings (id, title, state, district, acres, description, min_price, images, owner_name, status, winning_bid_id, created_at)
     VALUES (:id, :title, :state, :district, :acres, :description, :min_price, :images, :owner_name, :status, :winning_bid_id, :created_at)`
  );
  const insertBid = db.prepare(
    `INSERT OR IGNORE INTO bids (id, listing_id, bidder_name, amount, created_at) VALUES (:id, :listing_id, :bidder_name, :amount, :created_at)`
  );

  for (const l of LISTINGS) {
    insertListing.run({
      id: l.id,
      title: l.title,
      state: l.state,
      district: l.district,
      acres: l.acres,
      description: l.description,
      min_price: l.min_price,
      images: JSON.stringify(l.images),
      owner_name: l.owner_name,
      status: l.sold ? 'sold' : 'active',
      winning_bid_id: l.winning_bid_id || null,
      created_at: l.created_at,
    });
    for (const b of l.bids) {
      insertBid.run({ id: b.id, listing_id: l.id, bidder_name: b.bidder_name, amount: b.amount, created_at: b.created_at });
    }
  }
}

module.exports = { seed };
