/* ExploreXperience: static, local-first preview. No telemetry or authentication. */
'use strict';
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const number = (value, digits = 1) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const state = { page: 'home', selected: null, data: null, map: null, marker: null, dayLayer: null, view: 'all', live: false, activity: null };
const icon = name => `<svg aria-hidden="true" viewBox="0 0 ${name === 'bike' ? '32 32' : '24 24'}"><use href="#i-${name}"/></svg>`;
const pageNames = { home: 'Europa mit dem Rad', tour: 'Die Tour', live: 'Aktueller Standort', journal: 'Unterwegs', daily: 'Tagesvideos', film: 'Tourfilm', mapprivacy: 'Karten & Datenschutz' };

async function readJSON(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`Datei nicht verfügbar: ${file}`);
  return response.json();
}

function navigate() {
  const legacy = { '#daily-videos': '#/daily', '#tour-film': '#/film', '#/videos': '#/daily' };
  if (legacy[location.hash]) history.replaceState(null, '', legacy[location.hash]);
  if (location.hash && !location.hash.startsWith('#/')) return;
  const page = location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
  state.page = Object.hasOwn(pageNames, page) ? page : 'home';
  $$('[data-page]').forEach(section => { section.hidden = section.dataset.page !== state.page; });
  $$('[data-nav]').forEach(link => {
    if (link.dataset.nav === state.page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  $('#main-nav').classList.remove('open');
  $('.menu-toggle').setAttribute('aria-expanded', 'false');
  $('.menu-toggle').setAttribute('aria-label', 'Menü öffnen');
  if (state.page !== 'daily') $('#teaser-video').pause();
  document.title = `${pageNames[state.page]} — ExploreXperience`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (state.page === 'live') ensureMap().catch(showMapError);
}

$('.menu-toggle').addEventListener('click', () => {
  const open = $('#main-nav').classList.toggle('open');
  $('.menu-toggle').setAttribute('aria-expanded', String(open));
  $('.menu-toggle').setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    $('#main-nav').classList.remove('open');
    $('.menu-toggle').setAttribute('aria-expanded', 'false');
  }
});
window.addEventListener('hashchange', navigate);
const dialog = $('#about-dialog');
$('#about-button').addEventListener('click', () => dialog.showModal());
$('.dialog-close').addEventListener('click', () => dialog.close());
$('.dialog-done').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });

function renderAtlas(countries, route) {
  const mercator = latitude => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const west = -12 * Math.PI / 180, east = 11 * Math.PI / 180;
  const north = mercator(53.4), south = mercator(34.3);
  const scale = Math.min(440 / (east - west), 430 / (north - south));
  const offsetX = (500 - (east - west) * scale) / 2, offsetY = (530 - (north - south) * scale) / 2;
  const project = ([lon, lat]) => [(lon * Math.PI / 180 - west) * scale + offsetX, (north - mercator(lat)) * scale + offsetY];
  const pathFor = (points, step = 1, close = false) => {
    const result = points.filter((_, i) => i % step === 0 || i === points.length - 1).map(p => project(p).map(v => v.toFixed(2)).join(','));
    return result.length ? `M${result.join('L')}${close ? 'Z' : ''}` : '';
  };
  const countryPaths = countries.features.map(f => {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return polygons.map(p => `<path class="country-shape" d="${p.map(r => pathFor(r, 1, true)).join('')}"/>`).join('');
  }).join('');
  const routePaths = route.features.map(f => `<path class="atlas-route" d="${pathFor(f.geometry.coordinates, 3)}"/>`).join('');
  const names = [[2.2,47,'FRANKREICH'],[-4.7,39.5,'SPANIEN'],[8.6,51.5,'DE'],[-8.6,41,'PT']];
  const labels = names.map(([x,y,name]) => { const p = project([x,y]); return `<text x="${p[0]}" y="${p[1]}" text-anchor="middle">${name}</text>`; }).join('');
  const cities = [[6.963,50.941,'Köln',9,-7],[4.84,45.76,'Lyon',9,-6],[3.69,43.39,'Sète',10,13],[-9.14,38.71,'Lissabon',9,17],[-0.57,44.84,'Bordeaux',-62,-8]];
  const pins = cities.map(([x,y,name,dx,dy]) => { const p = project([x,y]); return `<circle class="atlas-dot" cx="${p[0]}" cy="${p[1]}" r="3.7"/><text class="city-label" x="${p[0]+dx}" y="${p[1]+dy}">${name}</text>`; }).join('');
  const sea = project([-10.2,45.2]);
  const svg = `<svg viewBox="0 0 500 530" role="img" aria-label="Geplante Rundreise von Köln über das Mittelmeer und Lissabon zurück nach Köln"><defs><pattern id="atlas-grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="#555d7e" stroke-opacity=".1" stroke-width=".6"/></pattern></defs><rect width="500" height="530" fill="url(#atlas-grid)"/>${countryPaths}${labels}<text class="sea-label" x="${sea[0]}" y="${sea[1]}" transform="rotate(-90 ${sea[0]} ${sea[1]})">ATLANTIK</text>${routePaths}${pins}</svg>`;
  $$('[data-atlas]').forEach((node, index) => { node.innerHTML = svg.replaceAll('atlas-grid', `atlas-grid-${index}`); });
}

function showMapError(error) {
  console.warn('Die lokale Kartenansicht ist nicht verfügbar.', error);
  $('#map-fallback').hidden = false;
  $('#live-notice p').textContent = 'Die Kartendaten konnten nicht geladen werden. Die Seite bitte über die lokale Vorschau-Adresse öffnen und erneut versuchen.';
}

const dataReady = Promise.all([readJSON('data/route.json'), readJSON('data/countries.json'), readJSON('data/demo.json'), readJSON('data/live.json'), readJSON('data/places.json')])
  .then(([route, countries, demo, live, places]) => {
    state.data = { route, countries, demo, places };
    state.activity = live.activity || null;
    renderAtlas(countries, route);
    const selector = $('#demo-location');
    for (const item of demo) {
      const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.name} · Demo`; selector.append(option);
    }
    state.selected = demo.find(item => item.name === 'Sète') || demo[0];
    selector.value = state.selected.id;
    if (live.mode === 'live') {
      if (validLive(live)) { state.live = true; state.selected = normalizeLive(live); selector.disabled = true; }
      else $('#live-notice p').textContent = 'Die Live-Datei ist unvollständig. Deshalb wird ausdrücklich ein Demostand angezeigt.';
    }
    updateMetrics();
    return state.data;
  });
// Keep loading failures visible without an unhandled rejection before opening the map.
dataReady.catch(showMapError);

function validLive(data) {
  return data.position && Number.isFinite(data.position.latitude) && Number.isFinite(data.position.longitude)
    && Math.abs(data.position.latitude) <= 90 && Math.abs(data.position.longitude) <= 180
    && Number.isFinite(Date.parse(data.measured_at)) && data.stats
    && Number.isFinite(data.stats.today_km) && data.stats.today_km >= 0
    && Number.isFinite(data.stats.total_km) && data.stats.total_km >= data.stats.today_km;
}
function normalizeLive(data) {
  return { ...data.stats, position: data.position, name: String(data.place?.name || 'Standort ohne Ortsangabe'), country: String(data.place?.country || ''),
    measured_at: data.measured_at, temperature_c: data.weather?.temperature_c, weather: String(data.weather?.description || 'Keine Wetterdaten'),
    wind_kmh: data.weather?.wind_kmh, duration: data.stats.recording_duration || '–', average_kmh: data.stats.average_kmh, demo: false };
}

function withUnit(selector, value, unit, digits = 1) {
  const node = $(selector); node.replaceChildren(document.createTextNode(Number.isFinite(value) ? number(value, digits) : '–'));
  const small = document.createElement('small'); small.textContent = unit; node.append(small);
}

function updateMetrics() {
  const item = state.selected; if (!item) return;
  $('#location-name').textContent = item.name;
  $('#location-country').textContent = item.country;
  withUnit('#today-km', item.today_km, 'km'); withUnit('#total-km', item.total_km, 'km');
  const percent = Math.min(100, Math.max(0, item.total_km / 7491.5 * 100));
  $('#tour-progress').style.width = `${percent}%`;
  $('#progress-label').textContent = `${number(percent, 0)} % von rund 7.492 geplanten km${state.live ? '' : ' · Demo'}`;
  $('#ride-duration').textContent = `${item.duration}${item.duration !== '–' ? ' h' : ''}`;
  $('#ride-average').textContent = Number.isFinite(item.average_kmh) ? `${number(item.average_kmh)} km/h` : '–';
  $('#weather-temp').textContent = Number.isFinite(item.temperature_c) ? `${number(item.temperature_c, 0)}°` : '–';
  $('#weather-text').textContent = item.weather;
  $('#weather-wind').textContent = Number.isFinite(item.wind_kmh) ? `Wind ${number(item.wind_kmh, 0)} km/h` : 'Wind nicht verfügbar';
  $('#position-time').textContent = state.live ? `Gemessen: ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(item.measured_at))} Uhr` : 'Beispielmeldung · 14:00 Uhr (Demo)';
  if (state.live) {
    const age = Math.max(0, Math.floor((Date.now() - Date.parse(item.measured_at)) / 60000));
    $('.demo-badge').replaceChildren(document.createTextNode(age > 120 ? 'LETZTER BEKANNTER STAND' : 'STANDORTMELDUNG'));
    $('.location-card .eyebrow').textContent = 'LETZTER GEMELDETER STANDORT';
    $('#live-notice p').textContent = `Letzte Standortmessung vor ${age} Minuten. Aktualisierung ungefähr stündlich; die Anzeige ist keine Position in Echtzeit.`;
    $('.map-badge span:last-child').textContent = 'GEMELDETER STANDORT';
    $('.weather-card p small').textContent = 'Wetter am Standort';
    $('.ride-small-stats>div:last-child>span').firstChild.textContent = 'Ø laut Meldung';
    $('.demo-selector>label').textContent = 'Live-Daten verbunden';
    $('.demo-selector>small').textContent = 'Der Demowechsel ist bei echten Daten deaktiviert.';
    $('#demo-location').replaceChildren(new Option('Echter gemeldeter Standort', 'live'));
    $('#show-day').disabled = true; $('#show-day').title = 'Ohne veröffentlichten Tagestrack ist kein tatsächlicher Tagesverlauf darstellbar.';
    $('.map-bottom>span:nth-child(2)').hidden = true;
  }
  if (state.map) updateMarker();
}

let mapPromise;
function ensureMap() {
  if (mapPromise) return mapPromise.then(() => { state.map.invalidateSize(); });
  mapPromise = dataReady.then(() => {
    if (!window.L) throw new Error('Kartenbibliothek fehlt');
    const map = L.map('live-map', { zoomControl: false, minZoom: 3, maxZoom: 10, zoomSnap: .25, scrollWheelZoom: true, attributionControl: false }).setView([44, -1], 5);
    state.map = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addAttribution('Übersicht: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>').addAttribution('Orte: <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>').addTo(map);
    L.geoJSON(state.data.countries, { interactive: false, style: { color: '#464b60', weight: 1, fillColor: '#212638', fillOpacity: .9 } }).addTo(map);
    state.routeLayer = L.geoJSON(state.data.route, { style: { color: '#ffb06b', weight: 2.4, opacity: .85 }, onEachFeature: (feature, layer) => {
      const node = document.createElement('span'); node.textContent = feature.properties.name; layer.bindPopup(node);
    } }).addTo(map);
    state.placeLayer = L.layerGroup().addTo(map);
    map.on('moveend', renderPlaces);
    renderPlaces();
    updateMarker(); fitView('all');
    setTimeout(() => map.invalidateSize(), 100);
  });
  return mapPromise;
}

function updateMarker() {
  const map = state.map, item = state.selected;
  const point = [item.position.latitude, item.position.longitude];
  if (!state.marker) state.marker = L.marker(point, { zIndexOffset: 1000, icon: L.divIcon({ className: '', html: `<div class="rider-marker"><span class="sleep-bubbles" aria-hidden="true"><b>Z</b><b>z</b><b>z</b></span><img src="assets/rider-comic.png" alt="Comic-Radfahrer auf einem HEPHA Trekking 7"></div>`, iconSize: [88,88], iconAnchor: [44,81], popupAnchor: [0,-122] }) }).addTo(map);
  else state.marker.setLatLng(point);
  const popup = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = `${item.name}${state.live ? '' : ' · Demo'}`;
  const description = document.createElement('div'); description.textContent = state.live ? 'Letzte gemeldete Position' : 'Simulierter Standort auf der geplanten Route';
  popup.append(title, description); state.marker.bindPopup(popup);
  updateSleepStatus();
  if (state.dayLayer) map.removeLayer(state.dayLayer);
  state.dayLayer = L.featureGroup();
  if (!state.live) {
    const start = Math.max(0, item.total_km - item.today_km), end = item.total_km;
    for (const feature of state.data.route.features) {
      const points = feature.geometry.coordinates.filter((_, i) => feature.properties.km[i] >= start && feature.properties.km[i] <= end).map(([lon,lat]) => [lat,lon]);
      if (points.length > 1) L.polyline(points, { color: '#85bfff', weight: 4.5, opacity: 1 }).addTo(state.dayLayer);
    }
    state.dayLayer.addTo(map);
  }
}

function fitView(view) {
  if (!state.map) return;
  state.view = view;
  const day = view === 'day' && !state.live && state.dayLayer?.getLayers().length;
  const bounds = day ? state.dayLayer.getBounds() : state.routeLayer.getBounds();
  state.map.fitBounds(bounds, { padding: [40, 48], maxZoom: day ? 8 : 6, animate: false });
  $('#show-all').classList.toggle('active', !day); $('#show-all').setAttribute('aria-pressed', String(!day));
  $('#show-day').classList.toggle('active', Boolean(day)); $('#show-day').setAttribute('aria-pressed', String(Boolean(day)));
}

$('#show-all').addEventListener('click', () => fitView('all'));
$('#show-day').addEventListener('click', () => fitView('day'));
$('#show-position').addEventListener('click', () => {
  if (state.map && state.selected) { state.map.setView([state.selected.position.latitude, state.selected.position.longitude], 8, { animate: false }); state.marker.openPopup(); }
});
$('#demo-location').addEventListener('change', event => {
  if (state.live || !state.data) return;
  state.selected = state.data.demo.find(item => item.id === event.target.value) || state.data.demo[0];
  updateMetrics(); fitView(state.view);
});
// Local labels work without an external connection. Place names are inserted as text.
function renderPlaces() {
  if (!state.map || !state.placeLayer) return;
  state.placeLayer.clearLayers();
  const bounds = state.map.getBounds(), zoom = state.map.getZoom(), size = state.map.getSize();
  const boxes = [], names = new Set(), minPopulation = zoom < 5 ? 150000 : zoom < 6 ? 60000 : zoom < 7 ? 20000 : 0;
  for (const [name, lat, lon, population] of state.data.places) {
    if (population < minPopulation || !bounds.contains([lat, lon]) || names.has(name.toLocaleLowerCase())) continue;
    const p = state.map.latLngToContainerPoint([lat, lon]);
    const w = Math.max(28, name.length * 6.1) + 16, h = 23;
    const box = { x: p.x - w/2, y: p.y - h/2, w, h };
    if (box.x < 4 || box.x + w > size.x - 4 || box.y < 22 || box.y + h > size.y - 20) continue;
    if (boxes.some(b => box.x < b.x+b.w && box.x+w > b.x && box.y < b.y+b.h && box.y+h > b.y)) continue;
    boxes.push(box);
    names.add(name.toLocaleLowerCase());
    const label = document.createElement('div');
    const text = document.createElement('span'); text.textContent = name;
    label.append(text);
    L.marker([lat,lon], {interactive:false, keyboard:false, icon:L.divIcon({className:'place-label', html:label, iconSize:[w,h], iconAnchor:[w/2,h/2]})}).addTo(state.placeLayer);
    if (boxes.length >= 180) break;
  }
}

// A replaced public live.json becomes visible without redeploying application code.
setInterval(async () => {
  if (state.page !== 'live') return;
  try {
    const data = await readJSON('data/live.json');
    state.activity = data.activity || null;
    updateSleepStatus();
    if (data.mode === 'live' && validLive(data)) {
      state.live = true; state.selected = normalizeLive(data); $('#demo-location').disabled = true; updateMetrics();
    }
  } catch { /* Keep the last known display and its measurement timestamp. */ }
}, 60_000);

navigate();

$('#teaser-video').addEventListener('error', () => { $('#video-error').hidden = false; });

function updateSleepStatus() {
  const status = SleepPolicy.resolve(state.activity);
  const marker = state.marker?.getElement();
  if (marker) {
    marker.classList.toggle('is-sleeping', status.sleeping);
    marker.title = status.sleeping ? 'Schläft · ' + (status.manual ? 'manuell' : 'Nachtzeit 22–06 Uhr') : 'Letzter Standort';
  }
  $('#sleep-status').textContent = status.sleeping ? `Zzz · ${status.manual ? 'Schlafstatus manuell aktiviert' : 'Nachtzeit 22–06 Uhr'}${state.live ? '' : ' · Demo'}` : '';
}
// Runs independently of GPS uploads; also updates after a suspended tab becomes visible.
setInterval(updateSleepStatus, 15_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateSleepStatus(); });
