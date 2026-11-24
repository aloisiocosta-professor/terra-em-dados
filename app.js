const layerNames = {
  agua: 'Água e recursos hídricos',
  acessos: 'Estradas e acessibilidade',
  educacao: 'Educação',
  saude: 'Saúde',
  producao: 'Produção rural',
  ambiente: 'Meio ambiente',
  comunitarios: 'Espaços comunitários',
  infraestrutura: 'Infraestrutura e serviços'
};
const layerColors = {
  agua: '#1685a0', acessos: '#a34d2c', educacao: '#087ea4', saude: '#bd3448',
  producao: '#a27600', ambiente: '#367348', comunitarios: '#875184', infraestrutura: '#40516d'
};
const schoolPoint = [-5.3001571, -42.743763];
const initialCenter = schoolPoint;
const previewMap = L.map('previewMap', { zoomControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false }).setView(schoolPoint, 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(previewMap);
L.circleMarker(schoolPoint, { radius: 6, weight: 2, color: '#fffaf0', fillColor: '#b64d2c', fillOpacity: 1 }).addTo(previewMap);
const map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView(initialCenter, 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);

const categories = Object.keys(layerNames);
const layerGroups = new Map(categories.map(name => [name, L.layerGroup()]));
const recordGroups = new Map(categories.map(name => [name, L.layerGroup()]));
const records = [];
let activeLayer = '';
let pendingPoint = null;
let searchedLocation = '';
let loadedCenter = null;
let loadPromise = null;
let moveTimer = null;
const layerInputs = [...document.querySelectorAll('[data-layer]')];
const dialog = document.getElementById('recordDialog');
const status = document.getElementById('mapStatus');
const mapLocation = document.getElementById('mapLocation');
const hint = document.getElementById('searchHint');
const instruction = document.getElementById('mapInstruction');
const boundaryLayer = L.geoJSON(null, { style: { color: '#174c45', weight: 2.5, fillColor: '#8ea56d', fillOpacity: 0.2 } }).addTo(map);
const boundaryToggle = document.getElementById('boundaryToggle');
const boundaryStatus = document.getElementById('boundaryStatus');
const legendDisclaimer = document.getElementById('legendDisclaimer');

const schoolMarker = L.circleMarker(schoolPoint, { radius: 8, weight: 3, color: '#fffaf0', fillColor: '#c95d32', fillOpacity: 1 });
schoolMarker.bindPopup('<strong>CETI Lucas Meireles Alves</strong><br>Assentamento 17 de Abril · Teresina/PI<br><small>Localização associada ao mapa da SEDUC-PI</small><br><a href="https://seduc.pi.gov.br/noticias/noticia/13080/governador-rafael-fonteles-e-secretario-washington-bandeira-inauguram-reforma-e-moderniza-ao-de-escola-em-assentamento-na-zona-rural-de-teresina" target="_blank" rel="noreferrer">Consultar fonte institucional</a>');
layerGroups.get('educacao').addLayer(schoolMarker);

const boundaryQuery = 'https://pamgia.ibama.gov.br/server/rest/services/01_Publicacoes_Bases/assentamentos_incra/FeatureServer/1/query?geometry=-42.743763%2C-5.3001571&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=assentamento%2Cnome_proje%2Cmunicipio%2Cuf%2Carea_hecta%2Cnum_famili%2Ccd_sipra&returnGeometry=true&outSR=4326&f=geojson';
let boundaryPromise;
async function loadBoundary() {
  if (!boundaryPromise) boundaryPromise = fetch(boundaryQuery, { headers: { Accept: 'application/geo+json, application/json' } }).then(response => {
    if (!response.ok) throw new Error('Serviço geográfico indisponível');
    return response.json();
  }).then(data => {
    const match = (data.features ?? []).find(feature => /17 de abril/i.test(Object.values(feature.properties ?? {}).join(' ')));
    if (!match) throw new Error('Nenhum polígono retornado para o ponto de referência');
    const featureLayer = L.geoJSON(match, { style: { color: '#174c45', weight: 2.5, fillColor: '#8ea56d', fillOpacity: 0.2 } });
    const properties = match.properties ?? {};
    featureLayer.bindPopup('<strong>' + escapeHTML(properties.assentamento || properties.nome_proje || 'Assentamento 17 de Abril') + '</strong><br>' + escapeHTML(properties.municipio || 'Teresina') + ' · ' + escapeHTML(properties.uf || 'PI') + '<br><small>Polígono cadastral · camada creditada ao INCRA</small>');
    boundaryLayer.addLayer(featureLayer);
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
    if (await loadBoundary()) boundaryLayer.addTo(map);
  } else map.removeLayer(boundaryLayer);
});

const overpassEndpoint = 'https://ovp.dresel.systems/api-sa/interpreter';
const dataRadius = 2000;
const tagRules = [
  { category: 'agua', key: 'natural', values: '^(water|spring|hot_spring)$' },
  { category: 'agua', key: 'waterway' },
  { category: 'agua', key: 'water', values: '^(lake|pond|reservoir)$' },
  { category: 'agua', key: 'landuse', values: 'reservoir' },
  { category: 'acessos', key: 'highway', waysOnly: true },
  { category: 'educacao', key: 'amenity', values: '^(school|college|university|kindergarten|training)$' },
  { category: 'saude', key: 'amenity', values: '^(hospital|clinic|doctors|dentist|pharmacy)$' },
  { category: 'saude', key: 'healthcare' },
  { category: 'producao', key: 'landuse', values: '^(farmland|farmyard|orchard|vineyard|plant_nursery)$' },
  { category: 'ambiente', key: 'natural', values: '^(wood|scrub|wetland|grassland|heath)$' },
  { category: 'ambiente', key: 'landuse', values: '^(forest|grass|meadow)$' },
  { category: 'ambiente', key: 'leisure', values: '^(park|nature_reserve|garden)$' },
  { category: 'comunitarios', key: 'amenity', values: '^(community_centre|social_centre|social_facility|place_of_worship)$' },
  { category: 'comunitarios', key: 'leisure', values: '^(sports_centre|sports_hall)$' },
  { category: 'infraestrutura', key: 'amenity', values: '^(post_office|police|fire_station|drinking_water|water_point|toilets|waste_disposal|marketplace|bus_station)$' },
  { category: 'infraestrutura', key: 'man_made', values: '^(water_tower|water_well|communications_tower)$' },
  { category: 'infraestrutura', key: 'power', values: '^(substation|plant)$' }
];
const loadedCenters = new Map();
const loadingLayers = new Map();
let queryQueue = Promise.resolve();
function overpassQuery(center, category) {
  const around = `(around:${dataRadius},${center.lat.toFixed(5)},${center.lng.toFixed(5)})`;
  const rules = tagRules.filter(rule => rule.category === category);
  const selectors = rules.flatMap(rule => {
    const tag = rule.values ? `["${rule.key}"~"${rule.values}"]` : `["${rule.key}"]`;
    return rule.waysOnly ? [`way${around}${tag};`] : [`node${around}${tag};`, `way${around}${tag};`];
  });
  return `[out:json][timeout:15];(\n${selectors.join('\n')}\n);out body geom;`;
}
function categoryFor(tags) {
  if (tags.highway) return 'acessos';
  if (tags.natural && /^(water|spring|hot_spring)$/.test(tags.natural) || tags.waterway || tags.water || tags.landuse === 'reservoir') return 'agua';
  if (tags.amenity && /^(school|college|university|kindergarten|training)$/.test(tags.amenity)) return 'educacao';
  if (tags.amenity && /^(hospital|clinic|doctors|dentist|pharmacy)$/.test(tags.amenity) || tags.healthcare) return 'saude';
  if (tags.landuse && /^(farmland|farmyard|orchard|vineyard|plant_nursery)$/.test(tags.landuse)) return 'producao';
  if (tags.natural && /^(wood|scrub|wetland|grassland|heath)$/.test(tags.natural) || tags.leisure && /^(park|nature_reserve|garden)$/.test(tags.leisure) || tags.landuse && /^(forest|grass|meadow)$/.test(tags.landuse)) return 'ambiente';
  if (tags.amenity && /^(community_centre|social_centre|social_facility|place_of_worship)$/.test(tags.amenity) || tags.leisure && /^(sports_centre|sports_hall)$/.test(tags.leisure)) return 'comunitarios';
  if (tags.amenity && /^(post_office|police|fire_station|drinking_water|water_point|toilets|waste_disposal|marketplace|bus_station)$/.test(tags.amenity) || tags.man_made && /^(water_tower|water_well|communications_tower)$/.test(tags.man_made) || tags.power && /^(substation|plant)$/.test(tags.power)) return 'infraestrutura';
  return '';
}
function featureFromElement(element) {
  const tags = element.tags ?? {};
  let geometry;
  if (element.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    geometry = { type: 'Point', coordinates: [element.lon, element.lat] };
  } else if (element.type === 'way' && Array.isArray(element.geometry) && element.geometry.length > 1) {
    const coordinates = element.geometry.map(point => [point.lon, point.lat]);
    const closed = coordinates.length > 3 && coordinates[0][0] === coordinates.at(-1)[0] && coordinates[0][1] === coordinates.at(-1)[1];
    const areaLike = tags.area === 'yes' || (!tags.highway && (Boolean(tags.landuse || tags.leisure) || ['water', 'spring', 'hot_spring', 'wood', 'scrub', 'wetland', 'grassland', 'heath'].includes(tags.natural)));
    geometry = closed && areaLike ? { type: 'Polygon', coordinates: [coordinates] } : { type: 'LineString', coordinates };
  } else return null;
  return { type: 'Feature', id: `${element.type}/${element.id}`, properties: { ...tags, osm_type: element.type, osm_id: element.id }, geometry };
}
function styleForFeature(feature) {
  const category = categoryFor(feature.properties);
  const color = layerColors[category] || '#56766c';
  return { color, weight: category === 'acessos' ? 2.6 : 1.8, opacity: 0.88, fillColor: color, fillOpacity: 0.32 };
}
function popupForFeature(feature) {
  const tags = feature.properties;
  const label = tags.name || tags.highway || tags.natural || tags.waterway || tags.amenity || tags.healthcare || tags.landuse || tags.leisure || tags.man_made || tags.power || 'Feição OpenStreetMap';
  const detail = [tags.highway, tags.waterway, tags.amenity, tags.healthcare, tags.natural, tags.landuse, tags.leisure, tags.man_made, tags.power].filter(Boolean).join(' · ');
  return `<strong>${escapeHTML(label)}</strong>${detail ? `<br><small>${escapeHTML(detail)}</small>` : ''}<br><small>OpenStreetMap · ${escapeHTML(tags.osm_type)}/${escapeHTML(String(tags.osm_id))}</small>`;
}
function setLayerStatus(layer, text) {
  const target = document.querySelector(`[data-layer-status="${layer}"]`);
  if (target) target.textContent = text;
}
function errorStatus(error) {
  const code = String(error?.message ?? '').match(/HTTP \d+/)?.[0];
  return code ? `Indisponível (${code})` : 'Sem resposta do serviço';
}
async function requestOsmLayer(category, force = false) {
  const center = map.getCenter();
  const previousCenter = loadedCenters.get(category);
  if (!force && previousCenter && previousCenter.distanceTo(center) < 1000) return true;
  if (loadingLayers.has(category)) return loadingLayers.get(category);
  setLayerStatus(category, 'Carregando feições…');
  const request = fetch(overpassEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
    body: `data=${encodeURIComponent(overpassQuery(center, category))}`
  }).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(data => {
    if (data.remark) throw new Error('Consulta limitada pelo serviço');
    const group = layerGroups.get(category);
    group.clearLayers();
    if (category === 'educacao') group.addLayer(schoolMarker);
    const seen = new Set();
    let count = 0;
    for (const element of data.elements ?? []) {
      const feature = featureFromElement(element);
      if (!feature || seen.has(feature.id) || categoryFor(feature.properties) !== category) continue;
      seen.add(feature.id);
      L.geoJSON(feature, {
        style: styleForFeature,
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { ...styleForFeature(_feature), radius: 6 }),
        onEachFeature: (item, leafletLayer) => leafletLayer.bindPopup(popupForFeature(item))
      }).addTo(group);
      count += 1;
    }
    loadedCenters.set(category, center);
    setLayerStatus(category, category === 'educacao' ? `${count} OSM + 1 referência SEDUC-PI` : `${count} feições`);
    hint.textContent = `${layerNames[category]}: ${count} feições encontradas em raio de 2 km do centro do mapa. A cobertura OSM local pode variar.`;
    return true;
  }).catch(error => {
    setLayerStatus(category, errorStatus(error));
    hint.textContent = `Não foi possível consultar “${layerNames[category]}” agora. A fonte pública pode estar ocupada ou indisponível; tente novamente mais tarde.`;
    console.warn('Consulta temática OpenStreetMap falhou:', category, error?.message ?? error);
    return false;
  }).finally(() => { loadingLayers.delete(category); });
  loadingLayers.set(category, request);
  return request;
}
function loadOsmLayer(category, force = false) {
  const next = queryQueue.catch(() => {}).then(() => requestOsmLayer(category, force));
  queryQueue = next.catch(() => {});
  return next;
}
function updateLayerControls() {
  const selected = layerInputs.filter(input => input.checked);
  activeLayer = selected[0]?.dataset.layer ?? '';
  document.getElementById('layerCount').textContent = `${selected.length} ativa${selected.length === 1 ? '' : 's'}`;
  status.textContent = selected.length ? `${selected.length} filtro${selected.length === 1 ? '' : 's'} ativo${selected.length === 1 ? '' : 's'}` : 'Mapa de referência';
}
for (const input of layerInputs) {
  input.addEventListener('change', async () => {
    const group = layerGroups.get(input.dataset.layer);
    const recordsGroup = recordGroups.get(input.dataset.layer);
    if (input.checked) {
      group.addTo(map);
      recordsGroup.addTo(map);
      setLayerStatus(input.dataset.layer, 'Carregando dados…');
      updateLayerControls();
      await loadOsmLayer(input.dataset.layer);
    } else {
      map.removeLayer(group);
      map.removeLayer(recordsGroup);
      setLayerStatus(input.dataset.layer, 'Desativada');
      updateLayerControls();
    }
  });
}
map.on('moveend', () => {
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => {
    if (layerInputs.some(input => input.checked)) {
      const center = map.getCenter();
      const refreshed = categories.filter(category => layerInputs.some(input => input.checked && input.dataset.layer === category) && loadedCenters.get(category)?.distanceTo(center) > 1500);
      refreshed.reduce((queue, category) => queue.then(() => loadOsmLayer(category, true)), Promise.resolve());
    }
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
    list.innerHTML = '<div class="empty-state"><span>⌖</span><p>Nenhum ponto marcado ainda.</p><small>Ative um tema e clique no mapa para criar um registro demonstrativo.</small></div>';
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
    hint.textContent = 'Área aproximada pela busca. Confirme o local antes de usar qualquer informação.';
    setTimeout(() => map.invalidateSize(), 100);
  } catch { hint.textContent = 'A busca não está disponível agora. Confira sua conexão e tente novamente.'; }
});
document.getElementById('resetView').addEventListener('click', () => {
  map.setView(initialCenter, 14);
  mapLocation.textContent = 'Assentamento 17 de Abril · Teresina/PI';
  searchedLocation = '';
  setTimeout(() => map.invalidateSize(), 100);
});
document.getElementById('locateMe').addEventListener('click', () => {
  if (!navigator.geolocation) { hint.textContent = 'Este navegador não oferece geolocalização.'; return; }
  hint.textContent = 'Aguardando permissão de localização…';
  navigator.geolocation.getCurrentPosition(position => {
    map.setView([position.coords.latitude, position.coords.longitude], 14);
    mapLocation.textContent = 'Sua localização aproximada';
    status.textContent = 'Área aproximada';
    hint.textContent = 'A localização foi usada apenas para centralizar o mapa nesta sessão.';
  }, () => { hint.textContent = 'Não foi possível acessar a localização. Você pode buscar um lugar pelo nome.'; }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
});
setTimeout(() => { map.invalidateSize(); previewMap.invalidateSize(); }, 150);