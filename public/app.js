const app = document.getElementById('app');
const identityInput = document.getElementById('identity-input');

identityInput.value = localStorage.getItem('plotbid_name') || '';
identityInput.addEventListener('input', () => {
  localStorage.setItem('plotbid_name', identityInput.value);
});

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function pageHeader(title, subtitle) {
  return el('div', { class: 'page-header' }, [
    el('h1', {}, title),
    subtitle ? el('p', {}, subtitle) : null,
  ]);
}

async function api(path, options) {
  const res = await fetch(path, options);
  let body = null;
  try { body = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error((body && body.error) || `request failed (${res.status})`);
  return body;
}

let statesCache = null;
async function getStates() {
  if (!statesCache) statesCache = await api('/api/states');
  return statesCache;
}

function errorBox(message) {
  return el('div', { class: 'error-box' }, message);
}

function statusBadge(status) {
  return el('span', { class: `badge${status === 'sold' ? ' sold' : ''}` }, status === 'sold' ? 'Sold' : 'Active');
}

// ---------- Browse ----------

async function renderBrowse() {
  app.replaceChildren(el('div', { class: 'empty' }, 'Loading…'));
  const states = await getStates();

  const stateSelect = el('select', { id: 'filter-state' }, [
    el('option', { value: '' }, 'All states'),
    ...Object.keys(states).map((s) => el('option', { value: s }, s)),
  ]);

  const statusSelect = el('select', { id: 'filter-status' }, [
    el('option', { value: '' }, 'Active & sold'),
    el('option', { value: 'active' }, 'Active only'),
    el('option', { value: 'sold' }, 'Sold only'),
  ]);

  const sortSelect = el('select', { id: 'filter-sort' }, [
    el('option', { value: 'newest' }, 'Newest first'),
    el('option', { value: 'price_asc' }, 'Price: low to high'),
    el('option', { value: 'price_desc' }, 'Price: high to low'),
    el('option', { value: 'most_bids' }, 'Most bids'),
  ]);

  const grid = el('div', { class: 'grid' });

  async function load() {
    grid.replaceChildren(el('div', { class: 'empty' }, 'Loading…'));
    const params = new URLSearchParams();
    if (stateSelect.value) params.set('state', stateSelect.value);
    if (statusSelect.value) params.set('status', statusSelect.value);
    if (sortSelect.value) params.set('sort', sortSelect.value);
    let listings;
    try {
      listings = await api('/api/listings?' + params.toString());
    } catch (err) {
      grid.replaceChildren(errorBox(err.message));
      return;
    }
    if (listings.length === 0) {
      grid.replaceChildren(el('div', { class: 'empty' }, 'No listings match these filters.'));
      return;
    }
    grid.replaceChildren(...listings.map(listingCard));
  }

  stateSelect.addEventListener('change', load);
  statusSelect.addEventListener('change', load);
  sortSelect.addEventListener('change', load);

  app.replaceChildren(
    pageHeader('Browse properties', 'Plots and land parcels across South India, open for bidding.'),
    el('div', { class: 'toolbar' }, [stateSelect, statusSelect, sortSelect]),
    grid
  );
  load();
}

function listingCard(listing) {
  const thumb = el('div', { class: 'thumb' }, [
    statusBadge(listing.status),
    ...(listing.images[0] ? [] : ['No photo']),
  ]);
  if (listing.images[0]) thumb.style.backgroundImage = `url(${listing.images[0]})`;

  const bidInfo = listing.bid_count > 0
    ? `${listing.bid_count} bid${listing.bid_count === 1 ? '' : 's'} · highest ${money(listing.highest_bid)}`
    : 'No bids yet';

  return el('a', { class: 'card', href: `#/listing/${listing.id}` }, [
    thumb,
    el('div', { class: 'body' }, [
      el('h3', {}, listing.title),
      el('div', { class: 'loc' }, `${listing.district}, ${listing.state} · ${listing.acres} acres`),
      el('div', { class: 'loc' }, bidInfo),
      el('div', { class: 'price' }, `Min ${money(listing.min_price)}`),
    ]),
  ]);
}

// ---------- Post a property ----------

async function renderNew() {
  const states = await getStates();

  const stateSelect = el('select', { name: 'state', required: 'required' }, [
    el('option', { value: '' }, 'Select a state'),
    ...Object.keys(states).map((s) => el('option', { value: s }, s)),
  ]);
  const districtSelect = el('select', { name: 'district', required: 'required' }, [
    el('option', { value: '' }, 'Select a state first'),
  ]);
  stateSelect.addEventListener('change', () => {
    const list = states[stateSelect.value] || [];
    districtSelect.replaceChildren(
      el('option', { value: '' }, list.length ? 'Select a district' : 'Select a state first'),
      ...list.map((d) => el('option', { value: d }, d))
    );
  });

  const ownerInput = el('input', { type: 'text', name: 'owner_name', required: 'required', maxlength: '60', value: identityInput.value });
  const titleInput = el('input', { type: 'text', name: 'title', required: 'required', maxlength: '120', placeholder: 'e.g. 5 acre farmland near Coimbatore highway' });
  const acresInput = el('input', { name: 'acres', type: 'number', min: '0.01', step: '0.01', required: 'required' });
  const priceInput = el('input', { name: 'min_price', type: 'number', min: '1', step: '1', required: 'required', placeholder: 'Minimum price in INR' });
  const descInput = el('textarea', { name: 'description', rows: '4', maxlength: '2000', placeholder: 'Access road, water source, survey number, nearby landmarks…' });
  const filesInput = el('input', { name: 'images', type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: 'multiple' });

  const submitBtn = el('button', { type: 'submit', class: 'full' }, 'Post listing');
  const msgBox = el('div');

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      msgBox.replaceChildren();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting…';
      try {
        const fd = new FormData(form);
        const created = await api('/api/listings', { method: 'POST', body: fd });
        localStorage.setItem('plotbid_name', ownerInput.value);
        location.hash = `#/listing/${created.id}`;
      } catch (err) {
        msgBox.replaceChildren(errorBox(err.message));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post listing';
      }
    },
  }, [
    el('label', {}, 'Your name (owner)'),
    ownerInput,

    el('label', {}, 'Title'),
    titleInput,

    el('div', { class: 'row2' }, [
      el('div', {}, [el('label', {}, 'State'), stateSelect]),
      el('div', {}, [el('label', {}, 'District'), districtSelect]),
    ]),

    el('div', { class: 'row2' }, [
      el('div', {}, [el('label', {}, 'Acres'), acresInput]),
      el('div', {}, [el('label', {}, 'Minimum price (INR)'), priceInput]),
    ]),

    el('label', {}, 'Description'),
    descInput,

    el('label', {}, 'Photos (up to 6, JPG/PNG/WebP)'),
    filesInput,

    el('div', { style: 'margin-top:22px;' }, [submitBtn]),
    msgBox,
  ]);

  app.replaceChildren(
    pageHeader('Post a property', 'Prototype scope: South India only. Bids are non-binding expressions of interest — closing a sale still needs an offline/legal process.'),
    el('div', { class: 'panel', style: 'max-width:560px;' }, [form])
  );
}

// ---------- Listing detail ----------

function gallery(images, title) {
  if (images.length === 0) {
    return el('div', {}, [el('div', { class: 'gallery-main empty-state' }, 'No photos')]);
  }

  const mainImg = el('img', { src: images[0], alt: title });
  const main = el('div', { class: 'gallery-main' }, [mainImg]);

  if (images.length === 1) return el('div', {}, [main]);

  const thumbs = images.map((src, i) =>
    el('img', {
      src,
      alt: `${title} photo ${i + 1}`,
      class: i === 0 ? 'active' : '',
      onclick: (e) => {
        mainImg.src = src;
        thumbs.forEach((t) => t.classList.remove('active'));
        e.target.classList.add('active');
      },
    })
  );

  return el('div', {}, [main, el('div', { class: 'gallery-thumbs' }, thumbs)]);
}

async function renderDetail(id) {
  app.replaceChildren(el('div', { class: 'empty' }, 'Loading…'));
  let listing;
  try {
    listing = await api(`/api/listings/${id}`);
  } catch (err) {
    app.replaceChildren(errorBox(err.message));
    return;
  }

  const specs = el('dl', { class: 'specs' }, [
    el('dt', {}, 'Location'), el('dd', {}, `${listing.district}, ${listing.state}`),
    el('dt', {}, 'Size'), el('dd', {}, `${listing.acres} acres`),
    el('dt', {}, 'Posted by'), el('dd', {}, listing.owner_name),
  ]);

  const bidListEl = el('ul', { class: 'bid-list' },
    listing.bids.length
      ? listing.bids.map((b, i) => el('li', { class: i === 0 ? 'top' : '' }, [
          el('span', {}, b.bidder_name),
          el('span', {}, money(b.amount)),
        ]))
      : [el('li', {}, 'No bids yet')]
  );

  const right = [
    statusBadge(listing.status),
    el('h1', { class: 'detail-title' }, listing.title),
    el('div', { class: 'detail-price' }, [
      el('span', { class: 'label' }, 'Minimum price'),
      money(listing.min_price),
    ]),
    specs,
    listing.description ? el('p', { class: 'description' }, listing.description) : null,
  ];

  if (listing.status === 'sold') {
    const winner = listing.bids.find((b) => b.id === listing.winning_bid_id);
    right.push(el('div', { class: 'sold-banner' },
      winner ? ['Sold to ', el('strong', {}, winner.bidder_name), ` for ${money(winner.amount)}.`] : 'Sold.'
    ));
  }

  right.push(el('div', { class: 'section-title' }, `Bids (${listing.bids.length})`), bidListEl);

  if (listing.status === 'active') {
    const amountInput = el('input', { type: 'number', min: String(listing.min_price), step: '1', placeholder: `min ${listing.min_price}`, required: 'required' });
    const bidderInput = el('input', { type: 'text', maxlength: '60', required: 'required', value: identityInput.value, placeholder: 'Your name' });
    const bidMsg = el('div');
    const bidBtn = el('button', { type: 'submit', class: 'full' }, 'Place bid');

    const bidForm = el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        bidMsg.replaceChildren();
        bidBtn.disabled = true;
        try {
          await api(`/api/listings/${id}/bids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bidder_name: bidderInput.value, amount: Number(amountInput.value) }),
          });
          localStorage.setItem('plotbid_name', bidderInput.value);
          renderDetail(id);
        } catch (err) {
          bidMsg.replaceChildren(errorBox(err.message));
          bidBtn.disabled = false;
        }
      },
    }, [
      el('label', {}, 'Your name'),
      bidderInput,
      el('label', {}, 'Bid amount (INR)'),
      amountInput,
      el('div', { style: 'margin-top:16px;' }, [bidBtn]),
      bidMsg,
    ]);

    right.push(el('div', { class: 'bid-panel' }, [
      el('div', { class: 'section-title' }, 'Place a bid'),
      bidForm,
    ]));

    const isOwner = identityInput.value.trim() && identityInput.value.trim() === listing.owner_name;
    if (isOwner && listing.bids.length > 0) {
      const sellMsg = el('div');
      let armed = false;
      const sellBtn = el('button', {
        type: 'button',
        class: 'full',
        onclick: async () => {
          if (!armed) {
            armed = true;
            sellBtn.textContent = 'Click again to confirm';
            sellBtn.classList.add('secondary');
            return;
          }
          sellBtn.disabled = true;
          try {
            await api(`/api/listings/${id}/sell`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ owner_name: identityInput.value }),
            });
            renderDetail(id);
          } catch (err) {
            sellMsg.replaceChildren(errorBox(err.message));
            sellBtn.disabled = false;
          }
        },
      }, `Accept highest bid (${money(listing.bids[0].amount)}) & sell`);
      right.push(el('div', { class: 'owner-panel' }, [
        el('div', { class: 'section-title' }, 'Owner actions'),
        sellBtn,
        sellMsg,
      ]));
    }
  }

  app.replaceChildren(
    el('a', { href: '#/', class: 'back-link' }, '← Back to listings'),
    el('div', { class: 'detail-grid' }, [
      gallery(listing.images, listing.title),
      el('div', { class: 'stack' }, right),
    ])
  );
}

// ---------- my activity ----------

async function renderMe() {
  const name = identityInput.value.trim();
  if (!name) {
    app.replaceChildren(
      pageHeader('My activity'),
      el('div', { class: 'panel' }, el('p', { class: 'hint', style: 'margin:0;' }, 'Enter your name in the "Your name" box at the top right to see the listings you posted and the bids you have placed.'))
    );
    return;
  }

  app.replaceChildren(el('div', { class: 'empty' }, 'Loading…'));
  let data;
  try {
    data = await api(`/api/me?name=${encodeURIComponent(name)}`);
  } catch (err) {
    app.replaceChildren(errorBox(err.message));
    return;
  }

  const listingsPanel = el('div', { class: 'panel' }, [
    el('div', { class: 'section-title' }, `Listings you posted (${data.listings.length})`),
    data.listings.length
      ? el('div', { class: 'grid' }, data.listings.map(listingCard))
      : el('div', { class: 'empty' }, "You haven't posted a property yet."),
  ]);

  const bidRows = data.bids.map((b) => {
    let statusText;
    if (b.listing_status === 'sold') {
      statusText = b.id === b.listing_winning_bid_id ? 'You won this listing' : 'Sold to another bidder';
    } else {
      statusText = b.amount === b.listing_highest_bid ? 'Currently the highest bid' : 'Outbid';
    }
    return el('li', {}, [
      el('a', { href: `#/listing/${b.listing_id}` }, b.listing_title),
      el('span', {}, `${money(b.amount)} · ${statusText}`),
    ]);
  });

  const bidsPanel = el('div', { class: 'panel' }, [
    el('div', { class: 'section-title' }, `Bids you placed (${data.bids.length})`),
    data.bids.length
      ? el('ul', { class: 'bid-list' }, bidRows)
      : el('div', { class: 'empty' }, "You haven't placed a bid yet."),
  ]);

  app.replaceChildren(pageHeader('My activity', `Signed in as ${name}`), el('div', { class: 'stack' }, [listingsPanel, bidsPanel]));
}

// ---------- router ----------

function setActiveNav(route) {
  document.querySelectorAll('nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === route);
  });
}

function route() {
  const hash = location.hash.slice(1) || '/';
  if (hash === '/') { setActiveNav('/'); renderBrowse(); return; }
  if (hash === '/new') { setActiveNav('/new'); renderNew(); return; }
  if (hash === '/me') { setActiveNav('/me'); renderMe(); return; }
  const m = hash.match(/^\/listing\/([^/]+)$/);
  if (m) { setActiveNav(''); renderDetail(m[1]); return; }
  setActiveNav('/');
  renderBrowse();
}

window.addEventListener('hashchange', route);
route();
