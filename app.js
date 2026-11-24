const layerNames = { ambiente: 'Recursos naturais', acessos: 'Estradas e acessos', comunidade: 'Serviços comunitários', producao: 'Áreas produtivas' };
const layerColors = { ambiente: '#438363', acessos: '#9a8742', comunidade: '#b57751', producao: '#83923c' };
const schoolPoint = [-5.3001571, -42.743763];
const initialCenter = schoolPoint;
const map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView(initialCenter, 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);

const layerGroups = new Map(Object.keys(layerNames).map(name => [name, L.layerGroup()]));
const recordGroups = new Map(Object.keys(layerNames).map(name => [name, L.layerGroup()]));
const records = [];
let activeLayer = '';
let pendingPoint = null;
let searchedLocation = '';
let loadedCenter = null;
let loadPromise = null;
let moveTimer = null;
const layerInputs = [...document.querySelectorAll('[data-layer]')];
const instruction = document.getElementById('mapInstruction');
const dialog = document.getElementById('recordDialog');
const status = document.getElementById('mapStatus');
const mapLocation = document.getElementById('mapLocation');
const hint = document.getElementById('searchHint');
const boundaryLayer = L.geoJSON(null, { style: { color: '#174c45', weight: 2.5, fillColor: '#8ea56d', fillOpacity: 0.2 } }).addTo(map);
const boundaryToggle = document.getElementById('boundaryToggle');
const boundaryStatus = document.getElementById('boundaryStatus');
const legendDisclaimer = document.getElementById('legendDisclaimer');
const schoolMarker = L.circleMarker(schoolPoint, { radius: 8, weight: 3, color: '#fffaf0', fillColor: '#c95d32', fillOpacity: 1 });
schoolMarker.bindPopup('<strong>CETI Lucas Meireles Alves</strong><br>Assentamento 17 de Abril · Teresina/PI<br><small>Localização vinculada pela SEDUC-PI</small><br><a href="https://seduc.pi.gov.br/noticias/noticia/13080/governador-rafael-fonteles-e-secretario-washington-bandeira-inauguram-reforma-e-moderniza-ao-de-escola-em-assentamento-na-zona-rural-de-teresina" target="_blank" rel="noreferrer">Consultar fonte institucional</a>');
layerGroups.get('comunidade').addLayer(schoolMarker);

const boundaryQuery = 'https://pamgia.ibama.gov.br/server/rest/services/01_Publicacoes_Bases/assentamentos_incra/FeatureServer/1/query?geometry=-42.743763%2C-5.3001571&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=assentamento%2Cnome_proje%2Cmunicipio%2Cuf%2Carea_hecta%2Cnum_famili%2Ccd_sipra&returnGeometry=true&outSR=4326&f=geojson';
let boundaryPromise;
async function loadBoundary() {
  if (!boundaryPromise) boundaryPromise = fetch(boundaryQuery, { headers: { Accept: 'application/geo+json, application/json' } }).then(response => {
    if (!response.ok) throw new Error('Serviço geográfico indisponível');
    return response.json();
  }).then(data => {
    const features = data.features ?? [];
    const match = features.find(feature => /17 de abril/i.test(Object.values(feature.properties ?? {}).join(' ')));
    if (!match) throw new Error('O serviço não retornou polígono para este ponto');
    const layer = L.geoJSON(match, { style: { color: '#174c45', weight: 2.5, fillColor: '#8ea56d', fillOpacity: 0.2 } }).addTo(boundaryLayer);
    const properties = match.properties ?? {};
    layer.bindPopup('<strong>' + escapeHTML(properties.assentamento || properties.nome_proje || 'Assentamento 17 de Abril') + '</strong><br>' + escapeHTML(properties.municipio || 'Teresina') + ' · ' + escapeHTML(properties.uf || 'PI') + '<br><small>Polígono cadastral · camada creditada ao INCRA</small>');
    boundaryStatus.textContent = 'Polígono carregado';
    legendDisclaimer.textContent = 'Perímetro cadastral INCRA';
    if (!boundaryToggle.checked) map.removeLayer(boundaryLayer);
    return true;
  }).catch(() => {
    boundaryStatus.textContent = 'Limite indisponível';
    legendDisclaimer.textContent = 'INCRA indisponível nesta sessão';
    return false;
  });
  return boundaryPromise;
}
loadBoundary();
boundaryToggle.addEventListener('change', async () => {
  if (boundaryToggle.checked) {
    const loaded = await loadBoundary();
    if (loaded) boundaryLayer.addTo(map);
  } else map.removeLayer(boundaryLayer);
});

const overpassEndpoint = 'https://overpass-api.de/api/interpreter';
const dataRadius = 3000;
const communityTags = new Set(['school', 'clinic', 'hospital', 'community_centre', 'place_of_worship', 'library', 'marketplace']);
function overpassQuery(center) {
  const lat = center.lat.toFixed(5);
  const lon = center.lng.toFixed(5);
  const around = `(around:${dataRadius},${lat},${lon})`;
  const filters = [
    ['highway', null],
    ['natural', '^(water|wood|scrub|wetland)$'],
    ['waterway', null],
    ['leisure', '^(park|nature_reserve|garden)$'],
    ['landuse', '^(forest|grass|meadow)$'],
    ['amenity', '^(school|clinic|hospital|community_centre|place_of_worship|library|marketplace)$'],
    ['landuse', '^(farmland|orchard|vineyard|plant_nursery|farmyard)$']
  ];
  const selectors = filters.flatMap(([key, value]) => {
    const tag = value ? `["${key}"~"${value}"]` : `["${key}"]`;
    return [`node${around}${tag};`, `way${around}${tag};`];
  });
  return `[out:json][timeout:25];(\n${selectors.join('\n')}\n);out body geom;`;
}
function featureFromElement(element) {
  const tags = element.tags ?? {};
  let geometry;
  if (element.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    geometry = { type: 'Point', coordinates: [element.lon, element.lat] };
  } else if (element.type === 'way' && Array.isArray(element.geometry) && element.geometry.length > 1) {
    const coordinates = element.geometry.map(point => [point.lon, point.lat]);
    const closed = coordinates.length > 3 && coordinates[0][0] === coordinates.at(-1)[0] && coordinates[0][1] === coordinates.at(-1)[1];
    const hasAreaTag = Boolean(tags.landuse || tags.leisure || ['water', 'wood', 'scrub', 'wetland'].includes(tags.natural));
    geometry = closed && hasAreaTag
      ? { type: 'Polygon', coordinates: [coordinates] }
      : { type: 'LineString', coordinates };
  } else return null;
  return { type: 'Feature', id: `${element.type}/${element.id}`, properties: { ...tags, osm_type: element.type, osm_id: element.id }, geometry };
}
function categoryFor(tags) {
  if (tags.highway) return 'acessos';
  if (tags.amenity && communityTags.has(tags.amenity)) return 'comunidade';
  if (tags.landuse && /^(farmland|orchard|vineyard|plant_nursery|farmyard)$/.test(tags.landuse)) return 'producao';
  if (tags.natural || tags.waterway || tags.leisure || (tags.landuse && /^(forest|grass|meadow)$/.test(tags.landuse))) return 'ambiente';
  return '';
}
function featureStyle(feature) {
  const tags = feature.properties;
  const category = categoryFor(tags);
  if (category === 'acessos') return { color: '#a34d2c', weight: /^(primary|secondary|tertiary|trunk)$/.test(tags.highway) ? 3 : 2, opacity: 0.85 };
  if (category === 'producao') return { color: '#987329', weight: 1.5, fillColor: '#d8b95e', fillOpacity: 0.35 };
  if (category === 'comunidade') return { color: '#fffaf0', weight: 2, fillColor: '#b57751', fillOpacity: 0.95 };
  const water = tags.waterway || tags.natural === 'water';
  return { color: water ? '#4389a0' : '#438363', weight: water ? 2.5 : 1.5, fillColor: water ? '#91c7d0' : '#75a477', fillOpacity: 0.32 };
}
function featurePopup(feature) {
  const tags = feature.properties;
  const label = tags.name || tags.highway || tags.natural || tags.waterway || tags.amenity || tags.landuse || tags.leisure || 'Feição OpenStreetMap';
  const detail = [tags.highway, tags.amenity, tags.natural, tags.waterway, tags.landuse, tags.leisure].filter(Boolean).join(' · ');
  return `<strong>${escapeHTML(label)}</strong>${detail ? `<br><small>${escapeHTML(detail)}</small>` : ''}<br><small>OpenStreetMap · ${escapeHTML(tags.osm_type)}/${escapeHTML(String(tags.osm_id))}</small>`;
}
function setLayerStatus(layer, text) {
  const target = document.querySelector(`[data-layer-status="${layer}"]`);
  if (target) target.textContent = text;
}
function setAllLayerStatuses(text) {
  for (const layer of Object.keys(layerNames)) setLayerStatus(layer, text);
}
async function loadOsmLayers(force = false) {
  const center = map.getCenter();
  if (!force && loadedCenter && loadedCenter.distanceTo(center) < 1000) return true;
  if (loadPromise) return loadPromise;
  setAllLayerStatuses('Carregando…');
  loadPromise = fetch(overpassEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
    body: `data=${encodeURIComponent(overpassQuery(center))}`
  }).then(response => {
    if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
    return response.json();
  }).then(data => {
    if (data.remark) throw new Error('Overpass limitou a consulta');
    for (const group of layerGroups.values()) group.clearLayers();
    layerGroups.get('comunidade').addLayer(schoolMarker);
    const seen = new Set();
    const counts = Object.fromEntries(Object.keys(layerNames).map(layer => [layer, 0]));
    for (const element of data.elements ?? []) {
      const feature = featureFromElement(element);
      if (!feature || seen.has(feature.id)) continue;
      seen.add(feature.id);
      const category = categoryFor(feature.properties);
      if (!category) continue;
      const geo = L.geoJSON(feature, {
        style: featureStyle,
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { ...featureStyle(_feature), radius: 6 }),
        onEachFeature: (item, leafletLayer) => leafletLayer.bindPopup(featurePopup(item))
      });
      geo.addTo(layerGroups.get(category));
      counts[category] += 1;
    }
    loadedCenter = center;
    for (const layer of Object.keys(layerNames)) setLayerStatus(layer, `${counts[layer]} itens`);
    hint.textContent = `Camadas OpenStreetMap carregadas em um raio de ${(dataRadius / 1000).toLocaleString('pt-BR')} km do centro do mapa. Cobertura local pode variar.`;
    return true;
  }).catch(() => {
    setAllLayerStatuses('Dados indisponíveis');
    hint.textContent = 'As camadas OpenStreetMap não puderam ser carregadas nesta sessão. Tente novamente mais tarde; a cobertura e a disponibilidade variam.';
    return false;
  }).finally(() => { loadPromise = null; });
  return loadPromise;
}
function updateLayerControls() {
  const selected = layerInputs.filter(input => input.checked);
  activeLayer = selected[0]?.dataset.layer ?? '';
  document.getElementById('layerCount').textContent = `${selected.length} ativas`;
  status.textContent = selected.length ? `${selected.length} camada${selected.length === 1 ? '' : 's'} ativa${selected.length === 1 ? '' : 's'}` : 'Visão geral';
}
for (const input of layerInputs) {
  input.addEventListener('change', async () => {
    const layer = input.dataset.layer;
    const group = layerGroups.get(layer);
    const recordsGroup = recordGroups.get(layer);
    if (input.checked) {
      group.addTo(map);
      recordsGroup.addTo(map);
      await loadOsmLayers();
    } else {
      map.removeLayer(group);
      map.removeLayer(recordsGroup);
    }
    updateLayerControls();
  });
}
map.on('moveend', () => {
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => {
    const enabled = layerInputs.some(input => input.checked);
    if (enabled && loadedCenter && loadedCenter.distanceTo(map.getCenter()) > 1500) loadOsmLayers(true);
  }, 900);
});

map.on('click', event => {
  if (!activeLayer) {
    hint.textContent = 'Ative um filtro antes de marcar um ponto demonstrativo.';
    document.querySelector('.layer-list').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  pendingPoint = event.latlng;
  document.getElementById('dialogCoords').textContent = `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)} · ${layerNames[activeLayer]}`;
  document.getElementById('recordTitle').value = '';
  document.getElementById('recordNote').value = '';
  dialog.showModal();
  document.getElementById('recordTitle').focus();
});
document.getElementById('recordForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel' || !pendingPoint) return;
  event.preventDefault();
  const title = document.getElementById('recordTitle').value.trim();
  if (!title) return;
  const item = { title, note: document.getElementById('recordNote').value.trim(), layer: activeLayer, point: pendingPoint };
  records.push(item);
  const marker = L.circleMarker(item.point, { radius: 7, weight: 2, color: '#fff', fillColor: layerColors[item.layer], fillOpacity: 1 }).bindPopup(`<strong>${escapeHTML(item.title)}</strong><br><small>${escapeHTML(layerNames[item.layer])}</small>${item.note ? `<br>${escapeHTML(item.note)}` : ''}`);
  marker.addTo(recordGroups.get(item.layer));
  renderRecords();
  dialog.close();
  pendingPoint = null;
});
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function renderRecords() {
  const list = document.getElementById('recordList');
  const clear = document.getElementById('clearRecords');
  clear.disabled = records.length === 0;
  if (!records.length) {
    list.innerHTML = '<div class="empty-state"><span>⌖</span><p>Nenhum ponto marcado ainda.</p><small>Ative um filtro e clique no mapa para criar um registro demonstrativo.</small></div>';
    return;
  }
  list.innerHTML = records.map((record, index) => `<div class="record"><i class="record-bullet" style="background:${layerColors[record.layer]}"></i><div><strong>${escapeHTML(record.title)}</strong><small>${escapeHTML(layerNames[record.layer])} · ${record.point.lat.toFixed(3)}, ${record.point.lng.toFixed(3)}</small></div><button class="record-focus" data-index="${index}" aria-label="Centralizar ${escapeHTML(record.title)}">↗</button></div>`).join('');
  list.querySelectorAll('.record-focus').forEach(button => button.addEventListener('click', () => {
    const record = records[Number(button.dataset.index)];
    const input = layerInputs.find(item => item.dataset.layer === record.layer);
    if (input && !input.checked) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
    map.setView(record.point, Math.max(map.getZoom(), 14));
    recordGroups.get(record.layer).eachLayer(marker => { if (marker.getLatLng?.().equals(record.point)) marker.openPopup(); });
  }));
}
document.getElementById('clearRecords').addEventListener('click', () => {
  records.splice(0);
  for (const group of recordGroups.values()) group.clearLayers();
  renderRecords();
});
document.getElementById('searchForm').addEventListener('submit', async event => {
  event.preventDefault();
  const query = document.getElementById('placeSearch').value.trim();
  if (!query) return;
  hint.textContent = 'Buscando localidade…';
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Busca indisponível');
    const results = await response.json();
    if (!results.length) { hint.textContent = 'Não encontramos esse lugar. Tente informar cidade e estado.'; return; }
    const result = results[0];
    searchedLocation = result.name || query;
    map.setView([Number(result.lat), Number(result.lon)], 13);
    mapLocation.textContent = searchedLocation;
    status.textContent = 'Área aproximada';
    instruction.classList.add('hidden');
    hint.textContent = 'Área aproximada pela busca. Confirme o local antes de usar qualquer informação.';
    setTimeout(() => map.invalidateSize(), 100);
  } catch {
    hint.textContent = 'A busca não está disponível agora. Confira sua conexão e tente novamente.';
  }
});
document.getElementById('resetView').addEventListener('click', () => {
  map.setView(initialCenter, 14);
  mapLocation.textContent = 'Assentamento 17 de Abril · Teresina/PI';
  searchedLocation = '';
  instruction.classList.add('hidden');
  setTimeout(() => map.invalidateSize(), 100);
});
document.getElementById('locateMe').addEventListener('click', () => {
  if (!navigator.geolocation) { hint.textContent = 'Este navegador não oferece geolocalização.'; return; }
  hint.textContent = 'Aguardando permissão de localização…';
  navigator.geolocation.getCurrentPosition(position => {
    const point = [position.coords.latitude, position.coords.longitude];
    map.setView(point, 14);
    mapLocation.textContent = 'Sua localização aproximada';
    status.textContent = 'Área aproximada';
    instruction.classList.add('hidden');
    hint.textContent = 'A localização foi usada apenas para centralizar o mapa nesta sessão.';
  }, () => {
    hint.textContent = 'Não foi possível acessar a localização. Você pode buscar um lugar pelo nome.';
  }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
});
setTimeout(() => map.invalidateSize(), 150);
