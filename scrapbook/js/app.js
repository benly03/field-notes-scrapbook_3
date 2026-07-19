/* ============================================
   FIELD NOTES — map scrapbook
   ============================================ */

const state = {
  locations: [],
  markers: {},
  activeLocation: null,
  activePhotoIndex: 0,
};

const els = {
  map: null,
  indexPanel: document.getElementById('indexPanel'),
  indexList: document.getElementById('indexList'),
  indexToggle: document.getElementById('listToggle'),
  indexClose: document.getElementById('indexClose'),
  detailPanel: document.getElementById('detailPanel'),
  detailClose: document.getElementById('detailClose'),
  detailEyebrow: document.getElementById('detailEyebrow'),
  detailTitle: document.getElementById('detailTitle'),
  detailDate: document.getElementById('detailDate'),
  detailCoords: document.getElementById('detailCoords'),
  detailNote: document.getElementById('detailNote'),
  detailGallery: document.getElementById('detailGallery'),
  postmarkDate: document.getElementById('postmarkDate'),
  stopCount: document.getElementById('stopCount'),
  firstYear: document.getElementById('firstYear'),
  lightbox: document.getElementById('lightbox'),
  lightboxImg: document.getElementById('lightboxImg'),
  lightboxCaption: document.getElementById('lightboxCaption'),
  lightboxClose: document.getElementById('lightboxClose'),
  lightboxPrev: document.getElementById('lightboxPrev'),
  lightboxNext: document.getElementById('lightboxNext'),
};

init();

async function init() {
  const mapEl = document.getElementById('map');

  els.map = Globe()(mapEl)
    .backgroundColor('#12100c')
    .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
    .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
    .showAtmosphere(true)
    .atmosphereColor('#A6C8E8')
    .atmosphereAltitude(0.18)
    .width(window.innerWidth)
    .height(window.innerHeight)
    .htmlElementsData([])
    .htmlElement(makePinElement)
    .htmlAltitude(0.01);

  // idle spin disabled — globe only moves on user drag
  els.map.controls().autoRotate = false;
  els.map.pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 0);

  window.addEventListener('resize', () => {
    els.map.width(window.innerWidth).height(window.innerHeight);
  });

  try {
    const [locRes, countryRes] = await Promise.all([
      fetch('data/locations.json'),
      fetch('data/countries.geojson'),
    ]);
    state.locations = await locRes.json();
    const countries = await countryRes.json();
    els.map
      .polygonsData(countries.features)
      .polygonCapColor(() => 'rgba(0,0,0,0)')
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => 'rgba(231, 223, 201, 0.35)')
      .polygonAltitude(0.002);

    setupCountryLabels(countries.features);
  } catch (err) {
    console.error('Could not load map data', err);
    state.locations = state.locations || [];
  }

  renderMarkers();
  renderIndex();
  renderStats();
  bindUI();
}

function makePinElement(loc) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.innerHTML = `
    <svg viewBox="0 0 26 34">
      <path class="pin-head" d="M13 2c-6.1 0-11 4.9-11 11 0 8.2 11 19 11 19s11-10.8 11-19c0-6.1-4.9-11-11-11z"/>
      <circle class="pin-dot" cx="13" cy="13" r="4"/>
    </svg>
    <span class="pin-label">${escapeHtml(loc.name)}</span>
  `;
  el.style.cursor = 'pointer';
  el.style.pointerEvents = 'auto';
  el.addEventListener('click', e => {
    e.stopPropagation();
    openLocation(loc.id);
  });
  return el;
}

function renderMarkers() {
  els.map.htmlElementsData(state.locations);
}

/* ----- Country labels: visible only near current camera focus ----- */

// Labels hide completely above this altitude (i.e. when zoomed out to
// roughly a full-globe view). Below it, only countries within a shrinking
// angular radius of the camera's look-at point are shown.
const LABEL_HIDE_ALTITUDE = 1.0;
const LABEL_MIN_RADIUS_DEG = 6;
const LABEL_MAX_RADIUS_DEG = 40;

// Countries whose bounding box crosses the antimeridian (±180° longitude)
// produce a garbage bbox-center. Excluded rather than mislabeled.
const LABEL_EXCLUDE_NAMES = new Set(['Russia', 'Fiji', 'Antarctica']);

let countryLabelData = [];
let lastLabelPov = null;

function setupCountryLabels(features) {
  countryLabelData = features
    .filter(f => f.bbox && !LABEL_EXCLUDE_NAMES.has(f.properties.ADMIN))
    .map(f => ({
      name: f.properties.ADMIN || f.properties.NAME || '',
      lat: (f.bbox[1] + f.bbox[3]) / 2,
      lng: (f.bbox[0] + f.bbox[2]) / 2,
    }));

  els.map
    .labelsData([])
    .labelLat('lat')
    .labelLng('lng')
    .labelText('name')
    .labelSize(1.1)
    .labelDotRadius(0.25)
    .labelColor(() => 'rgba(231, 223, 201, 0.85)')
    .labelResolution(2)
    .labelAltitude(0.012);

  setInterval(updateVisibleCountryLabels, 400);
}

function angularDistanceDeg(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180;
  const phi1 = toRad(lat1), phi2 = toRad(lat2), dLambda = toRad(lng2 - lng1);
  const cosD = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.acos(Math.min(1, Math.max(-1, cosD))) * 180) / Math.PI;
}

function updateVisibleCountryLabels() {
  const pov = els.map.pointOfView();

  // Skip recompute if the camera hasn't meaningfully moved since last check
  if (
    lastLabelPov &&
    Math.abs(pov.lat - lastLabelPov.lat) < 0.3 &&
    Math.abs(pov.lng - lastLabelPov.lng) < 0.3 &&
    Math.abs(pov.altitude - lastLabelPov.altitude) < 0.02
  ) {
    return;
  }
  lastLabelPov = { lat: pov.lat, lng: pov.lng, altitude: pov.altitude };

  if (pov.altitude > LABEL_HIDE_ALTITUDE) {
    els.map.labelsData([]);
    return;
  }

  const radius = Math.min(
    LABEL_MAX_RADIUS_DEG,
    Math.max(LABEL_MIN_RADIUS_DEG, pov.altitude * LABEL_MAX_RADIUS_DEG)
  );

  const visible = countryLabelData.filter(
    c => angularDistanceDeg(pov.lat, pov.lng, c.lat, c.lng) <= radius
  );
  els.map.labelsData(visible);
}

function renderIndex() {
  els.indexList.innerHTML = '';
  const sorted = [...state.locations].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  sorted.forEach(loc => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.innerHTML = `<span class="idx-name">${escapeHtml(loc.name)}</span>
                     <span class="idx-meta">${formatDate(loc.date)} · ${(loc.photos || []).length} photos</span>`;
    li.addEventListener('click', () => {
      closeIndex();
      openLocation(loc.id);
    });
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter') { closeIndex(); openLocation(loc.id); }
    });
    els.indexList.appendChild(li);
  });
}

function renderStats() {
  els.stopCount.textContent = `${state.locations.length} stop${state.locations.length === 1 ? '' : 's'} logged`;
  const years = state.locations.map(l => (l.date || '').slice(0, 4)).filter(Boolean).sort();
  els.firstYear.textContent = years[0] || '—';
}

function openLocation(id) {
  const loc = state.locations.find(l => l.id === id);
  if (!loc) return;
  state.activeLocation = loc;

  els.map.controls().autoRotate = false;
  els.map.pointOfView({ lat: loc.lat, lng: loc.lng, altitude: loc.altitude || 0.5 }, 1200);

  els.detailEyebrow.textContent = loc.region || 'Location';
  els.detailTitle.textContent = loc.name;
  els.detailDate.textContent = formatDate(loc.date);
  els.detailCoords.textContent = `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}`;
  els.detailNote.textContent = loc.note || '';
  els.postmarkDate.textContent = (loc.date || '').slice(0, 7) || '—';

  els.detailGallery.innerHTML = '';
  const photos = loc.photos || [];
  if (photos.length === 0) {
    els.detailGallery.innerHTML = `<p class="empty-gallery">No photos added yet. Drop images into
      images/${loc.id}/ and list them in data/locations.json.</p>`;
  } else {
    photos.forEach((photo, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'photo-wrap';
      wrap.innerHTML = `<img src="${photo.src}" alt="${escapeHtml(photo.caption || loc.name)}" loading="lazy">`;
      wrap.addEventListener('click', () => openLightbox(loc, i));
      els.detailGallery.appendChild(wrap);
    });
  }

  els.detailPanel.classList.add('open');
  els.detailPanel.setAttribute('aria-hidden', 'false');
}

function closeDetail() {
  els.detailPanel.classList.remove('open');
  els.detailPanel.setAttribute('aria-hidden', 'true');
  state.activeLocation = null;
}

function openIndex() {
  els.indexPanel.classList.add('open');
  els.indexPanel.setAttribute('aria-hidden', 'false');
  els.indexToggle.setAttribute('aria-expanded', 'true');
}
function closeIndex() {
  els.indexPanel.classList.remove('open');
  els.indexPanel.setAttribute('aria-hidden', 'true');
  els.indexToggle.setAttribute('aria-expanded', 'false');
}

function openLightbox(loc, index) {
  state.activePhotoIndex = index;
  showLightboxPhoto(loc);
  els.lightbox.classList.add('open');
  els.lightbox.setAttribute('aria-hidden', 'false');
}
function showLightboxPhoto(loc) {
  const photo = loc.photos[state.activePhotoIndex];
  els.lightboxImg.src = photo.src;
  els.lightboxImg.alt = photo.caption || loc.name;
  els.lightboxCaption.textContent = photo.caption || '';
}
function closeLightbox() {
  els.lightbox.classList.remove('open');
  els.lightbox.setAttribute('aria-hidden', 'true');
  els.lightboxImg.src = '';
}
function stepLightbox(delta) {
  const loc = state.activeLocation;
  if (!loc || !loc.photos.length) return;
  state.activePhotoIndex = (state.activePhotoIndex + delta + loc.photos.length) % loc.photos.length;
  showLightboxPhoto(loc);
}

function bindUI() {
  els.indexToggle.addEventListener('click', () => {
    els.indexPanel.classList.contains('open') ? closeIndex() : openIndex();
  });
  els.indexClose.addEventListener('click', closeIndex);
  els.detailClose.addEventListener('click', closeDetail);
  els.lightboxClose.addEventListener('click', closeLightbox);
  els.lightboxPrev.addEventListener('click', () => stepLightbox(-1));
  els.lightboxNext.addEventListener('click', () => stepLightbox(1));
  els.lightbox.addEventListener('click', e => {
    if (e.target === els.lightbox) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (els.lightbox.classList.contains('open')) closeLightbox();
      else if (els.detailPanel.classList.contains('open')) closeDetail();
      else if (els.indexPanel.classList.contains('open')) closeIndex();
    }
    if (els.lightbox.classList.contains('open')) {
      if (e.key === 'ArrowLeft') stepLightbox(-1);
      if (e.key === 'ArrowRight') stepLightbox(1);
    }
  });
}

function formatDate(iso) {
  if (!iso) return 'Undated';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
