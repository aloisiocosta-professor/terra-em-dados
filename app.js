const layerNames = { ambiente: 'Recursos naturais', acessos: 'Estradas e acessos', comunidade: 'Serviços comunitários', producao: 'Áreas produtivas' };
const layerColors = { ambiente: '#438363', acessos: '#9a8742', comunidade: '#b57751', producao: '#83923c' };
const schoolPoint = [-5.3001571, -42.743763];
const initialCenter = schoolPoint;
const map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView(initialCenter, 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);

const schoolMarker = L.circleMarker(schoolPoint, { radius: 8, weight: 3, color: '#fffaf0', fillColor: '#c95d32', fillOpacity: 1 }).addTo(map);
schoolMarker.bindPopup('<strong>CETI Lucas Meireles Alves</strong><br>Assentamento 17 de Abril · Teresina/PI<br><small>Localização vinculada pela SEDUC-PI</small><br><a href="https://seduc.pi.gov.br/noticias/noticia/13080/governador-rafael-fonteles-e-secretario-washington-bandeira-inauguram-reforma-e-moderniza-ao-de-escola-em-assentamento-na-zona-rural-de-teresina" target="_blank" rel="noreferrer">Consultar fonte institucional</a>');
const boundaryLayer = L.geoJSON(null, { style: { color: '#174c45', weight: 2.5, fillColor: '#8ea56d', fillOpacity: 0.2 } }).addTo(map);
const boundaryToggle = document.getElementById('boundaryToggle');
const boundaryStatus = document.getElementById('boundaryStatus');
const legendDisclaimer = document.getElementById('legendDisclaimer');
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

const layers = new Map();
const records = [];
let activeLayer = '';
let pendingPoint = null;
let searchedLocation = '';
const layerInputs = [...document.querySelectorAll('[data-layer]')];
const instruction = document.getElementById('mapInstruction');
const dialog = document.getElementById('recordDialog');
const status = document.getElementById('mapStatus');
const mapLocation = document.getElementById('mapLocation');
const hint = document.getElementById('searchHint');

for (const input of layerInputs) {
  layers.set(input.dataset.layer, L.layerGroup().addTo(map));
  input.addEventListener('change', () => {
    activeLayer = layerInputs.find(item => item.checked)?.dataset.layer ?? '';
    document.getElementById('layerCount').textContent = `${layerInputs.filter(item => item.checked).length} ativas`;
    document.getElementById('mapStatus').textContent = activeLayer ? `Camada: ${layerNames[activeLayer]}` : 'Visão geral';
  });
}

map.on('click', event => {
  if (!activeLayer) {
    hint.textContent = 'Ative uma camada antes de marcar um ponto.';
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
  marker.addTo(layers.get(item.layer));
  renderRecords();
  dialog.close();
  pendingPoint = null;
});

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function renderRecords() {
  const list = document.getElementById('recordList');
  const clear = document.getElementById('clearRecords');
  clear.disabled = records.length === 0;
  if (!records.length) {
    list.innerHTML = '<div class="empty-state"><span>⌖</span><p>Nenhum ponto marcado ainda.</p><small>Escolha uma camada e clique no mapa para criar um registro demonstrativo.</small></div>';
    return;
  }
  list.innerHTML = records.map((record, index) => `<div class="record"><i class="record-bullet" style="background:${layerColors[record.layer]}"></i><div><strong>${escapeHTML(record.title)}</strong><small>${escapeHTML(layerNames[record.layer])} · ${record.point.lat.toFixed(3)}, ${record.point.lng.toFixed(3)}</small></div><button class="record-focus" data-index="${index}" aria-label="Centralizar ${escapeHTML(record.title)}">↗</button></div>`).join('');
  list.querySelectorAll('.record-focus').forEach(button => button.addEventListener('click', () => {
    const record = records[Number(button.dataset.index)];
    map.setView(record.point, Math.max(map.getZoom(), 14));
    layers.get(record.layer).eachLayer(marker => { if (marker.getLatLng?.().equals(record.point)) marker.openPopup(); });
  }));
}

document.getElementById('clearRecords').addEventListener('click', () => {
  records.splice(0);
  for (const group of layers.values()) group.clearLayers();
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
    if (!results.length) {
      hint.textContent = 'Não encontramos esse lugar. Tente informar cidade e estado.';
      return;
    }
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
  status.textContent = 'Visão geral';
  searchedLocation = '';
  instruction.classList.add('hidden');
  setTimeout(() => map.invalidateSize(), 100);
});

document.getElementById('locateMe').addEventListener('click', () => {
  if (!navigator.geolocation) {
    hint.textContent = 'Este navegador não oferece geolocalização.';
    return;
  }
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
