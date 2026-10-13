const settingsStore = window.AquaSmartSettings;
const form = document.getElementById('settings-form');
const feedback = document.getElementById('form-feedback');
const variableKeys = ['temperature', 'ph', 'oxygen'];

function field(id) { return document.getElementById(id); }

function showSettings() {
  const settings = settingsStore.load();
  for (const key of variableKeys) {
    field(`${key}-warning-min`).value = settings.thresholds[key].warning[0];
    field(`${key}-critical-min`).value = settings.thresholds[key].critical[0];
    if (key !== 'oxygen') {
      field(`${key}-warning-max`).value = settings.thresholds[key].warning[1];
      field(`${key}-critical-max`).value = settings.thresholds[key].critical[1];
    }
  }
  field('sampling-minutes').value = settings.samplingMinutes;
  field('notification-emails').value = settings.notificationEmails.join('\n');
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    feedback.textContent = 'Completa los campos obligatorios antes de guardar.';
    feedback.className = 'feedback-error';
    return;
  }

  const settings = settingsStore.load();
  for (const key of variableKeys) {
    settings.thresholds[key].warning[0] = Number(field(`${key}-warning-min`).value);
    settings.thresholds[key].critical[0] = Number(field(`${key}-critical-min`).value);
    if (key !== 'oxygen') {
      settings.thresholds[key].warning[1] = Number(field(`${key}-warning-max`).value);
      settings.thresholds[key].critical[1] = Number(field(`${key}-critical-max`).value);
    }
  }
  settings.samplingMinutes = Number(field('sampling-minutes').value);
  settings.notificationEmails = [...new Set(field('notification-emails').value
    .split(/[\n,;]+/).map(email => email.trim()).filter(Boolean))];

  const result = settingsStore.save(settings);
  feedback.textContent = result.ok ? 'Configuración guardada. Los cambios aparecerán al volver al panel.' : result.errors.join(' ');
  feedback.className = result.ok ? 'feedback-success' : 'feedback-error';
});

showSettings();
