/* Datos locales de desarrollo con la estructura prevista para la futura API. */
const settings = window.AquaSmartSettings.load();
const thresholds = settings.thresholds;
const samplingMinutes = settings.samplingMinutes;
const samplesPerDay = 1440 / samplingMinutes;

const tanks = [
  { id: 't1', name: 'Tanque 01', description: 'Zona norte', temperatureRange: [24.0, 28.6], oxygenDayDrop: 5.2, oxygenCorrection: { minutesAgo: 900, rise: 5 }, readings: { temperature: 0, ph: 8.2, oxygen: 84.6 }, seed: 3 },
  { id: 't2', name: 'Tanque 02', description: 'Zona norte', temperatureRange: [24.6, 31.0], oxygenDayDrop: 6.4, oxygenCorrection: { minutesAgo: 660, rise: 6 }, readings: { temperature: 0, ph: 8.5, oxygen: 76.2 }, seed: 7 },
  { id: 't3', name: 'Tanque 03', description: 'Zona sur', temperatureRange: [25.2, 32.0], oxygenDayDrop: 7.1, oxygenCorrection: { minutesAgo: 420, rise: 7 }, readings: { temperature: 0, ph: 8.7, oxygen: 61.4 }, seed: 11 },
  { id: 't4', name: 'Tanque 04', description: 'Zona sur', temperatureRange: [24.3, 29.4], oxygenDayDrop: 22.0, readings: { temperature: 0, ph: 6.3, oxygen: 2.8 }, seed: 17 }
];

const ranges = {
  day: { count: samplesPerDay + 1, labels: ['−24 h', '−18 h', '−12 h', '−6 h', '16:45'], title: 'últimas 24 horas hasta el 23 de junio a las 16:45' },
  week: { count: 7 * samplesPerDay + 1, labels: ['Hace 7 d', 'Hace 5 d', 'Hace 3 d', 'Ayer', '16:45'], title: 'última semana' },
  month: { count: 30 * samplesPerDay + 1, labels: ['Hace 30 d', 'Hace 22 d', 'Hace 15 d', 'Hace 7 d', '16:45'], title: 'último mes' },
  year: { count: 365 * samplesPerDay + 1, labels: ['Hace 12 m', 'Hace 9 m', 'Hace 6 m', 'Hace 3 m', '16:45'], title: 'último año' }
};

let selectedTank = tanks[0];
let selectedRange = 'day';
const byId = id => document.getElementById(id);
const format = value => value.toFixed(1).replace('.', ',');
const display = (value, unit) => `${format(value)}${unit ? ` ${unit}` : ''}`;

/* Perfil diario continuo: valle a las 07:00 y un solo pico a las 15:00. */
function temperatureAt(tank, minuteOfDay) {
  const hour = minuteOfDay / 60;
  const phase = (hour - 7 + 24) % 24;
  const [minimum, maximum] = tank.temperatureRange;
  const smooth = fraction => fraction * fraction * (3 - 2 * fraction);
  return phase <= 8
    ? minimum + (maximum - minimum) * smooth(phase / 8)
    : maximum - (maximum - minimum) * smooth((phase - 8) / 16);
}

const latestMinuteOfDay = 16 * 60 + 45;
for (const tank of tanks) tank.readings.temperature = Math.round(temperatureAt(tank, latestMinuteOfDay) * 10) / 10;

function level(value, config) {
  const [criticalMin, criticalMax] = config.critical;
  const [warningMin, warningMax] = config.warning;
  if (value <= criticalMin || (criticalMax !== null && value >= criticalMax)) return 'critical';
  if (value <= warningMin || (warningMax !== null && value >= warningMax)) return 'warning';
  return 'normal';
}

function tankAlerts(tank) {
  return Object.entries(tank.readings).filter(([key, value]) => level(value, thresholds[key]) !== 'normal')
    .map(([key, value]) => ({ tank, key, value, severity: level(value, thresholds[key]) }));
}

function statusPill(severity) {
  const labels = { normal: '● Normal', warning: '● Informativa', critical: '● Crítica' };
  return `<span class="status-pill ${severity}">${labels[severity]}</span>`;
}

function renderSummary() {
  const alerts = tanks.flatMap(tankAlerts);
  const critical = alerts.filter(alert => alert.severity === 'critical').length;
  const avgTemp = tanks.reduce((sum, tank) => sum + tank.readings.temperature, 0) / tanks.length;
  const avgOxygen = tanks.reduce((sum, tank) => sum + tank.readings.oxygen, 0) / tanks.length;
  const cards = [
    ['◉', 'Tanques monitorizados', tanks.length, `Muestreo cada ${samplingMinutes} minutos`],
    ['♧', 'Alertas activas', alerts.length, `${critical} críticas · ${alerts.length - critical} informativas`, alerts.length ? 'warning' : ''],
    ['<img class="thermometer-icon" src="assets/thermometer.svg" alt="">', 'Temperatura media', `${format(avgTemp)} <small>°C</small>`, 'Media de los cuatro tanques'],
    ['O₂', 'Oxígeno medio', `${format(avgOxygen)} <small>%</small>`, 'Saturación media']
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
    return `<button type="button" class="tank-card ${selected ? 'selected' : ''}" data-tank="${tank.id}" aria-pressed="${selected}"><div class="tank-top"><span class="tank-name">${tank.name}</span>${statusPill(severity)}</div><p class="tank-description">${tank.description}</p><div class="tank-bottom"><span><span class="mini-icon"><img class="thermometer-icon" src="assets/thermometer.svg" alt=""></span> <strong>${display(tank.readings.temperature, '°C')}</strong></span><span><span class="mini-icon ph-text">pH</span> <strong>${format(tank.readings.ph)}</strong></span><span><span class="mini-icon oxygen-text">O₂</span> <strong>${display(tank.readings.oxygen, '%')}</strong></span></div></button>`;
  }).join('');
}

/* Oscilaciones irregulares sobre una caída neta. La muestra final coincide
   exactamente con la lectura actual y la serie es coherente entre periodos. */
function oxygenAt(tank, samplesAgo) {
  const minutesAgo = samplesAgo * samplingMinutes;
  const daysAgo = minutesAgo / 1440;
  const trend = tank.readings.oxygen + tank.oxygenDayDrop * Math.min(daysAgo, 1)
    + Math.max(daysAgo - 1, 0) * 0.01;
  const irregular = offset => {
    const ripple = Math.sin(offset * 0.29 + tank.seed) * 0.48
      + Math.sin(offset * 0.71 + tank.seed * 1.7) * 0.34
      + Math.sin(offset * 1.83 + tank.seed * 0.4) * 0.18;
    const random = Math.sin(offset * 12.9898 + tank.seed * 78.233) * 43758.5453;
    return ripple + (random - Math.floor(random) - 0.5) * 0.5;
  };
  const relativeQuarterHours = -minutesAgo / 15;
  const fluctuation = (irregular(relativeQuarterHours) - irregular(0)) * Math.min(1, daysAgo * 4);
  const correction = tank.oxygenCorrection;
  const correctiveRise = correction
    ? correction.rise * Math.exp(-0.5 * ((minutesAgo - correction.minutesAgo) / 60) ** 2)
    : 0;
  return Math.max(0, trend + fluctuation + correctiveRise);
}

/* El pH del tanque 4 partió de un nivel normal y descendió durante el día. */
function criticalTankPhAt(tank, samplesAgo) {
  const minutesAgo = samplesAgo * samplingMinutes;
  const daysAgo = minutesAgo / 1440;
  const trend = tank.readings.ph + 1.9 * Math.min(daysAgo, 1)
    + Math.max(daysAgo - 1, 0) * 0.001;
  const ripple = (Math.sin(minutesAgo / 15 * 0.19 + tank.seed) - Math.sin(tank.seed))
    * 0.07 * Math.min(1, daysAgo * 4);
  return trend + ripple;
}

/* Cada punto representa una muestra con el intervalo configurado. En periodos largos
   se agrupan las muestras en columnas, conservando mínimos y máximos visibles. */
function historyFor(tank, key, range) {
  const count = ranges[range].count;
  const base = tank.readings[key];
  const amplitude = { ph: 0.16 }[key];
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    if (key === 'temperature') {
      const minuteOfDay = ((latestMinuteOfDay - (count - 1 - i) * samplingMinutes) % 1440 + 1440) % 1440;
      values[i] = temperatureAt(tank, minuteOfDay);
      continue;
    }
    if (key === 'oxygen') { values[i] = oxygenAt(tank, count - 1 - i); continue; }
    if (key === 'ph' && tank.id === 't4') { values[i] = criticalTankPhAt(tank, count - 1 - i); continue; }
    if (i === count - 1) { values[i] = base; continue; }
    const position = i / (count - 1);
    const slowWave = Math.sin(position * Math.PI * 8 + tank.seed) * 0.55;
    const shortWave = Math.sin(i * 0.27 + tank.seed) * 0.23;
    const trend = (position - 1) * amplitude * 0.7;
    values[i] = Math.max(0, base + (slowWave + shortWave) * amplitude + trend);
  }
  return values;
}

function plotValues(values) {
  if (values.length <= 180) return Array.from(values);
  const result = [];
  const buckets = 90;
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = Math.floor(bucket * values.length / buckets);
    const end = Math.floor((bucket + 1) * values.length / buckets);
    let low = Infinity, high = -Infinity;
    for (let i = start; i < end; i++) { low = Math.min(low, values[i]); high = Math.max(high, values[i]); }
    result.push(low, high);
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
  const x = i => left + i * innerW / (values.length - 1);
  const y = value => top + (max - value) * innerH / (max - min);
  const points = values.map((value, i) => `${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const area = `${left},${top + innerH} ${points} ${left + innerW},${top + innerH}`;
  const color = { temperature: '#4dd8ee', ph: '#69a9ff', oxygen: '#6bdfc6' }[key];
  const id = `gradient-${key}`;
  const ticks = [max, (max + min) / 2, min].map(value => `<g><line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" stroke="#264467" stroke-dasharray="3 5"/><text x="0" y="${y(value) + 3}" fill="#7893b2" font-size="10">${format(value)}</text></g>`).join('');
  const thresholdLines = [['warning', '#ffbd71'], ['critical', '#ff6d83']].map(([severity, stroke]) => config[severity].filter(value => value !== null).map(value => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" stroke="${stroke}" stroke-opacity=".8" stroke-dasharray="5 5"/>`).join('')).join('');
  const labels = ranges[range].labels.map((label, i) => `<text x="${left + i * innerW / 4}" y="${height - 5}" text-anchor="middle" fill="${i === 4 ? '#62d9ee' : '#7893b2'}" font-size="10" font-weight="${i === 4 ? '700' : '400'}">${label}</text>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${ticks}${thresholdLines}<polygon points="${area}" fill="url(#${id})"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="4" fill="${color}" stroke="#102343" stroke-width="2"/>${labels}</svg>`;
}

function limitsText(config) {
  const unit = config.unit ? ` ${config.unit}` : '';
  const [warningMin, warningMax] = config.warning;
  const [criticalMin, criticalMax] = config.critical;
  const pair = (min, max) => max === null ? `≤ ${format(min)}${unit}` : `${format(min)} / ${format(max)}${unit}`;
  return `<span>Habitual: <strong>${format(config.typical[0])}–${format(config.typical[1])}${unit}</strong></span><span class="limit-key warning-key">Informativa: ${pair(warningMin, warningMax)}</span><span class="limit-key critical-key">Crítica: ${pair(criticalMin, criticalMax)}</span>`;
}

function renderHistory() {
  byId('selected-tank-name').textContent = selectedTank.name;
  for (const key of Object.keys(thresholds)) {
    const config = thresholds[key];
    const value = selectedTank.readings[key];
    const severity = level(value, config);
    const values = plotValues(historyFor(selectedTank, key, selectedRange));
    byId(`${key}-value`).textContent = format(value);
    byId(`${key}-status`).innerHTML = statusPill(severity);
    byId(`${key}-chart`).innerHTML = chartSvg(values, config, key, selectedRange);
    byId(`${key}-chart`).setAttribute('aria-label', `${config.label} de ${selectedTank.name} durante ${ranges[selectedRange].title}; muestras cada ${samplingMinutes} minutos`);
    byId(`${key}-limits`).innerHTML = limitsText(config);
  }
}

function renderAlerts() {
  const alerts = tanks.flatMap(tankAlerts).sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
  byId('alert-list').innerHTML = alerts.length ? alerts.map(({ tank, key, value, severity }) => {
    const config = thresholds[key];
    const direction = value <= config[severity][0] ? 'por debajo' : 'por encima';
    const limit = direction === 'por debajo' ? config[severity][0] : config[severity][1];
    return `<article class="alert-item ${severity}"><span class="alert-symbol">!</span><div><strong>${config.label} ${direction} del límite · ${tank.name}</strong><p>Valor: ${display(value, config.unit)} · Límite ${severity === 'critical' ? 'crítico' : 'informativo'}: ${display(limit, config.unit)}</p></div>${statusPill(severity)}</article>`;
  }).join('') : '<div class="empty-alert">Todos los valores están dentro de los rangos de alerta.</div>';
}

function renderNotifications() {
  const latestCapture = new Date(2026, 5, 23, 16, 45);
  const dateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const notifications = [];

  for (const tank of tanks) {
    for (const { key } of tankAlerts(tank)) {
      const config = thresholds[key];
      const samples = historyFor(tank, key, 'day');
      const notifiedLevels = new Set();
      let previousLevel = level(samples[0], config);

      for (let index = 1; index < samples.length; index++) {
        const severity = level(samples[index], config);
        if (severity !== previousLevel && severity !== 'normal' && !notifiedLevels.has(severity)) {
          const capturedAt = new Date(latestCapture.getTime() - (samples.length - 1 - index) * samplingMinutes * 60 * 1000);
          notifications.push({ tank, key, severity, value: samples[index], capturedAt });
          notifiedLevels.add(severity);
        }
        previousLevel = severity;
      }
    }
  }

  notifications.sort((a, b) => b.capturedAt - a.capturedAt);
  byId('notification-count').textContent = `${notifications.length} notificaciones`;
  byId('notification-list').innerHTML = notifications.length ? notifications.map(({ tank, key, severity, value, capturedAt }) => {
    const config = thresholds[key];
    return `<article class="notification-item"><span class="notification-icon" aria-hidden="true">✉</span><div class="notification-detail"><strong>Correo de alerta ${severity === 'critical' ? 'crítica' : 'informativa'} · ${tank.name}</strong><p>${config.label}: ${display(value, config.unit)} · Umbral alcanzado</p></div><time datetime="${capturedAt.toISOString()}">${dateFormatter.format(capturedAt)}</time></article>`;
  }).join('') : '<div class="empty-alert">No se han generado notificaciones durante las últimas 24 horas.</div>';
}

function selectNavItem(hash) {
  const links = document.querySelectorAll('.nav-list .nav-item');
  const selected = Array.from(links).find(link => link.getAttribute('href') === hash) || links[0];
  links.forEach(link => {
    const active = link === selected;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

document.querySelector('.nav-list').addEventListener('click', event => {
  const link = event.target.closest('.nav-item');
  if (link) selectNavItem(link.getAttribute('href'));
});
window.addEventListener('hashchange', () => selectNavItem(window.location.hash));
selectNavItem(window.location.hash || '#inicio');

byId('tank-list').addEventListener('click', event => {
  const button = event.target.closest('[data-tank]');
  if (!button) return;
  selectedTank = tanks.find(tank => tank.id === button.dataset.tank);
  renderTanks();
  renderHistory();
});
document.querySelector('.range-switch').addEventListener('click', event => {
  const button = event.target.closest('[data-range]');
  if (!button) return;
  selectedRange = button.dataset.range;
  document.querySelectorAll('[data-range]').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  renderHistory();
});

byId('current-time').innerHTML = '<strong>23 de junio de 2026 · 16:45 h</strong><small>● ÚLTIMA CAPTURA RECIBIDA</small>';
document.querySelectorAll('[data-sampling-minutes]').forEach(item => { item.textContent = samplingMinutes; });
renderSummary();
renderTanks();
renderHistory();
renderAlerts();
renderNotifications();
