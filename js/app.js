const settings = window.AquaSmartSettings.load();
const thresholds = settings.thresholds;
const samplingMinutes = settings.samplingMinutes;
const api = window.AquaSmartApi;
const ranges = {
  day: ['−24 h', '−18 h', '−12 h', '−6 h'],
  week: ['Hace 7 d', 'Hace 5 d', 'Hace 3 d', 'Ayer'],
  month: ['Hace 30 d', 'Hace 22 d', 'Hace 15 d', 'Hace 7 d'],
  year: ['Hace 12 m', 'Hace 9 m', 'Hace 6 m', 'Hace 3 m']
};

let tanks = [], notifications = [], selectedTank = null, selectedRange = 'day', latestCapture = null, historyRequest = 0;
const historyCache = new Map();
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const format = value => Number(value).toFixed(1).replace('.', ',');
const display = (value, unit) => `${format(value)}${unit ? ` ${unit}` : ''}`;

function level(value, config) {
  const [criticalMin, criticalMax] = config.critical;
  const [warningMin, warningMax] = config.warning;
  if (value <= criticalMin || (criticalMax !== null && value >= criticalMax)) return 'critical';
  if (value <= warningMin || (warningMax !== null && value >= warningMax)) return 'warning';
  return 'normal';
}

function tankAlerts(tank) {
  return Object.entries(tank.readings).filter(([key, value]) => thresholds[key] && level(value, thresholds[key]) !== 'normal')
    .map(([key, value]) => ({ tank, key, value, severity: level(value, thresholds[key]) }));
}

function statusPill(severity) {
  return `<span class="status-pill ${severity}">${{ normal: '● Normal', warning: '● Informativa', critical: '● Crítica' }[severity]}</span>`;
}

function setDataStatus(message, type = '') {
  byId('data-source-status').textContent = message;
  byId('data-source-status').className = `data-source-status ${type}`.trim();
}

function renderSummary() {
  const alerts = tanks.flatMap(tankAlerts);
  const critical = alerts.filter(alert => alert.severity === 'critical').length;
  const average = key => tanks.reduce((sum, tank) => sum + tank.readings[key], 0) / tanks.length;
  const cards = [
    ['◉', 'Tanques monitorizados', tanks.length, `Muestreo cada ${samplingMinutes} minutos`],
    ['♧', 'Alertas activas', alerts.length, `${critical} críticas · ${alerts.length - critical} informativas`, alerts.length ? 'warning' : ''],
    ['<img class="thermometer-icon" src="assets/thermometer.svg" alt="">', 'Temperatura media', `${format(average('temperature'))} <small>°C</small>`, `Media de ${tanks.length} tanques`],
    ['O₂', 'Oxígeno medio', `${format(average('oxygen'))} <small>mg/L</small>`, 'Concentración media']
  ];
  byId('summary-cards').innerHTML = cards.map(([icon, title, value, note, kind]) => `<article class="summary-card ${kind || ''}"><div class="summary-top"><span>${title}</span><span class="summary-icon">${icon}</span></div><div class="summary-number">${value}</div><div class="summary-note">${note}</div></article>`).join('');
  byId('nav-alert-count').textContent = alerts.length;
  byId('tank-count').textContent = `${tanks.length} tanques`;
  byId('alert-count').textContent = `${alerts.length} alertas`;
}

function renderTanks() {
  byId('tank-list').innerHTML = tanks.map(tank => {
    const alerts = tankAlerts(tank);
    const severity = alerts.some(alert => alert.severity === 'critical') ? 'critical' : alerts.length ? 'warning' : 'normal';
    const selected = selectedTank.id === tank.id;
    return `<button type="button" class="tank-card ${selected ? 'selected' : ''}" data-tank="${escapeHtml(tank.id)}" aria-pressed="${selected}"><div class="tank-top"><span class="tank-name">${escapeHtml(tank.name)}</span>${statusPill(severity)}</div><p class="tank-description">${escapeHtml(tank.description)}</p><div class="tank-bottom"><span><span class="mini-icon"><img class="thermometer-icon" src="assets/thermometer.svg" alt=""></span> <strong>${display(tank.readings.temperature, '°C')}</strong></span><span><span class="mini-icon ph-text">pH</span> <strong>${format(tank.readings.ph)}</strong></span><span><span class="mini-icon oxygen-text">O₂</span> <strong>${display(tank.readings.oxygen, 'mg/L')}</strong></span></div></button>`;
  }).join('');
}

function plotValues(values) {
  if (values.length <= 180) return values;
  const result = [];
  for (let bucket = 0; bucket < 90; bucket++) {
    const slice = values.slice(Math.floor(bucket * values.length / 90), Math.floor((bucket + 1) * values.length / 90));
    result.push(Math.min(...slice), Math.max(...slice));
  }
  result[result.length - 1] = values[values.length - 1];
  return result;
}

function chartSvg(values, config, key, range) {
  const width = 560, height = 200, left = 35, right = 10, top = 13, bottom = 29;
  const innerW = width - left - right, innerH = height - top - bottom;
  const lines = [...config.warning, ...config.critical].filter(value => value !== null);
  const min = Math.floor(Math.min(...values, ...lines) - (key === 'oxygen' ? 3 : 1));
  const max = Math.ceil(Math.max(...values, ...lines) + (key === 'oxygen' ? 3 : 1));
  const x = index => left + index * innerW / Math.max(1, values.length - 1);
  const y = value => top + (max - value) * innerH / Math.max(1, max - min);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const color = { temperature: '#4dd8ee', ph: '#69a9ff', oxygen: '#6bdfc6' }[key];
  const ticks = [max, (max + min) / 2, min].map(value => `<g><line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" stroke="#264467" stroke-dasharray="3 5"/><text x="0" y="${y(value) + 3}" fill="#7893b2" font-size="10">${format(value)}</text></g>`).join('');
  const thresholdLines = [['warning', '#ffbd71'], ['critical', '#ff6d83']].map(([severity, stroke]) => config[severity].filter(value => value !== null).map(value => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" stroke="${stroke}" stroke-opacity=".8" stroke-dasharray="5 5"/>`).join('')).join('');
  const time = latestCapture && !Number.isNaN(latestCapture.getTime()) ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(latestCapture) : 'Ahora';
  const labels = [...ranges[range], time].map((label, index) => `<text x="${left + index * innerW / 4}" y="${height - 5}" text-anchor="middle" fill="${index === 4 ? '#62d9ee' : '#7893b2'}" font-size="10">${label}</text>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="gradient-${key}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${ticks}${thresholdLines}<polygon points="${left},${top + innerH} ${points} ${left + innerW},${top + innerH}" fill="url(#gradient-${key})"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${labels}</svg>`;
}

function limitsText(config) {
  const unit = config.unit ? ` ${config.unit}` : '';
  const pair = (min, max) => max === null ? `≤ ${format(min)}${unit}` : `${format(min)} / ${format(max)}${unit}`;
  return `<span>Habitual: <strong>${format(config.typical[0])}–${format(config.typical[1])}${unit}</strong></span><span class="limit-key warning-key">Informativa: ${pair(...config.warning)}</span><span class="limit-key critical-key">Crítica: ${pair(...config.critical)}</span>`;
}

function showHistoryMessage(message, error = false) {
  for (const key of Object.keys(thresholds)) byId(`${key}-chart`).innerHTML = `<div class="${error ? 'data-error' : 'loading-panel'}">${escapeHtml(message)}</div>`;
}

async function renderHistory() {
  const requestId = ++historyRequest;
  byId('selected-tank-name').textContent = selectedTank.name;
  showHistoryMessage('Cargando historial…');
  const cacheKey = `${selectedTank.id}:${selectedRange}`;
  try {
    const data = historyCache.get(cacheKey) || await api.history(selectedTank.id, selectedRange);
    if (requestId !== historyRequest) return;
    historyCache.set(cacheKey, data);
    if (!data?.series) throw new Error('El historial recibido no tiene el formato esperado.');
    for (const key of Object.keys(thresholds)) {
      if (!Array.isArray(data.series[key])) throw new Error(`Falta la serie ${key} en el historial.`);
      const values = plotValues(data.series[key].map(point => Number(typeof point === 'object' ? point.value : point)).filter(Number.isFinite));
      const config = thresholds[key], value = selectedTank.readings[key];
      byId(`${key}-value`).textContent = format(value);
      byId(`${key}-status`).innerHTML = statusPill(level(value, config));
      byId(`${key}-chart`).innerHTML = values.length ? chartSvg(values, config, key, selectedRange) : '<div class="loading-panel">No hay muestras para este periodo.</div>';
      byId(`${key}-limits`).innerHTML = limitsText(config);
    }
  } catch (error) {
    if (requestId === historyRequest) showHistoryMessage(error.message, true);
  }
}

function renderAlerts() {
  const alerts = tanks.flatMap(tankAlerts).sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
  byId('alert-list').innerHTML = alerts.length ? alerts.map(({ tank, key, value, severity }) => {
    const config = thresholds[key], below = value <= config[severity][0], limit = below ? config[severity][0] : config[severity][1];
    return `<article class="alert-item ${severity}"><span class="alert-symbol">!</span><div><strong>${escapeHtml(config.label)} ${below ? 'por debajo' : 'por encima'} del límite · ${escapeHtml(tank.name)}</strong><p>Valor: ${display(value, config.unit)} · Límite: ${display(limit, config.unit)}</p></div>${statusPill(severity)}</article>`;
  }).join('') : '<div class="empty-alert">Todos los valores están dentro de los rangos de alerta.</div>';
}

function renderNotifications() {
  const formatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  byId('notification-count').textContent = `${notifications.length} notificaciones`;
  byId('notification-list').innerHTML = notifications.length ? notifications.map(item => {
    const date = new Date(item.createdAt);
    return `<article class="notification-item"><span class="notification-icon">✉</span><div class="notification-detail"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message || '')}</p></div><time datetime="${date.toISOString()}">${formatter.format(date)}</time></article>`;
  }).join('') : '<div class="empty-alert">No hay notificaciones registradas.</div>';
}

function validateDashboard(data) {
  if (!data || !Array.isArray(data.tanks)) throw new Error('La respuesta del panel no tiene el formato esperado.');
  return data.tanks.map(tank => {
    const readings = Object.fromEntries(Object.keys(thresholds).map(key => [key, Number(tank.readings?.[key])]));
    if (!tank.id || Object.values(readings).some(value => !Number.isFinite(value))) throw new Error('Una lectura recibida es incompleta o no numérica.');
    return { id: String(tank.id), name: String(tank.name || tank.id), description: String(tank.description || ''), readings };
  });
}

function showDashboardError(message) {
  const error = `<div class="data-error">${escapeHtml(message)}</div>`;
  for (const id of ['summary-cards', 'tank-list', 'alert-list', 'notification-list']) byId(id).innerHTML = error;
  showHistoryMessage(message, true);
  setDataStatus('Sin datos', 'error');
}

async function loadDashboard() {
  try {
    const data = await api.dashboard();
    tanks = validateDashboard(data);
    if (!tanks.length) throw new Error('No hay tanques con lecturas disponibles.');
    notifications = Array.isArray(data.notifications) ? data.notifications : [];
    latestCapture = new Date(data.capturedAt);
    selectedTank = tanks[0];
    setDataStatus(data.containsSimulatedData ? 'MySQL · datos simulados' : 'MySQL conectado', data.containsSimulatedData ? '' : 'online');
    if (!Number.isNaN(latestCapture.getTime())) {
      const date = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(latestCapture);
      byId('current-time').innerHTML = `<strong>${date}</strong><small>● ÚLTIMA CAPTURA RECIBIDA</small>`;
    }
    renderSummary(); renderTanks(); renderAlerts(); renderNotifications(); await renderHistory();
  } catch (error) { showDashboardError(error.message); }
}

function selectNavItem(hash) {
  const links = document.querySelectorAll('.nav-list .nav-item');
  const selected = Array.from(links).find(link => link.getAttribute('href') === hash) || links[0];
  links.forEach(link => { link.classList.toggle('active', link === selected); link.toggleAttribute('aria-current', link === selected); });
}

document.querySelector('.nav-list').addEventListener('click', event => { const link = event.target.closest('.nav-item'); if (link) selectNavItem(link.getAttribute('href')); });
window.addEventListener('hashchange', () => selectNavItem(window.location.hash));
byId('tank-list').addEventListener('click', event => {
  const button = event.target.closest('[data-tank]');
  if (!button) return;
  selectedTank = tanks.find(tank => tank.id === button.dataset.tank); renderTanks(); renderHistory();
});
document.querySelector('.range-switch').addEventListener('click', event => {
  const button = event.target.closest('[data-range]');
  if (!button || !selectedTank) return;
  selectedRange = button.dataset.range;
  document.querySelectorAll('[data-range]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  renderHistory();
});

selectNavItem(window.location.hash || '#inicio');
document.querySelectorAll('[data-sampling-minutes]').forEach(item => { item.textContent = samplingMinutes; });
byId('summary-cards').innerHTML = '<div class="loading-panel">Cargando lecturas…</div>';
byId('tank-list').innerHTML = '<div class="loading-panel">Cargando tanques…</div>';
showHistoryMessage('Esperando datos…');
loadDashboard();
