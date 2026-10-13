(function () {
  const storageKey = 'aquasmart-hub-fp-settings-v1';
  const samplingOptions = [5, 10, 15, 30, 60];
  const defaults = {
    samplingMinutes: 15,
    notificationEmails: [],
    thresholds: {
      temperature: { typical: [10, 25], warning: [7.5, 30], critical: [5, 35], unit: '°C', label: 'Temperatura' },
      ph: { typical: [7.5, 9], warning: [7, 9.5], critical: [6.5, 10], unit: '', label: 'pH' },
      oxygen: { typical: [10, 100], warning: [5, null], critical: [3, null], unit: '%', label: 'Saturación de oxígeno' }
    }
  };

  const copy = value => JSON.parse(JSON.stringify(value));

  function validate(settings) {
    const errors = [];
    if (!samplingOptions.includes(settings.samplingMinutes)) errors.push('Selecciona una frecuencia de muestreo válida.');
    for (const key of ['temperature', 'ph']) {
      const limits = settings.thresholds?.[key];
      if (!limits || !Array.isArray(limits.warning) || !Array.isArray(limits.critical)
          || limits.warning.length !== 2 || limits.critical.length !== 2
          || ![...limits.warning, ...limits.critical].every(Number.isFinite)
          || !(limits.critical[0] < limits.warning[0] && limits.warning[0] < limits.warning[1]
            && limits.warning[1] < limits.critical[1])) {
        errors.push(`Revisa los límites de ${key === 'ph' ? 'pH' : 'temperatura'}: crítico mínimo < aviso mínimo < aviso máximo < crítico máximo.`);
      }
    }
    const oxygen = settings.thresholds?.oxygen;
    if (!oxygen || !Array.isArray(oxygen.warning) || !Array.isArray(oxygen.critical)
        || !Number.isFinite(oxygen.warning[0]) || !Number.isFinite(oxygen.critical[0])
        || !(0 <= oxygen.critical[0] && oxygen.critical[0] < oxygen.warning[0] && oxygen.warning[0] <= 100)) {
      errors.push('En oxígeno, el mínimo crítico debe ser menor que el informativo y ambos deben estar entre 0 y 100 %.');
    }
    if (!Array.isArray(settings.notificationEmails)
        || settings.notificationEmails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      errors.push('Revisa las direcciones de correo electrónico.');
    }
    return errors;
  }

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (!stored) return copy(defaults);
      const settings = copy(defaults);
      settings.samplingMinutes = stored.samplingMinutes;
      settings.notificationEmails = stored.notificationEmails;
      for (const key of Object.keys(settings.thresholds)) {
        settings.thresholds[key].warning = stored.thresholds?.[key]?.warning;
        settings.thresholds[key].critical = stored.thresholds?.[key]?.critical;
      }
      return validate(settings).length ? copy(defaults) : settings;
    } catch {
      return copy(defaults);
    }
  }

  function save(settings) {
    const errors = validate(settings);
    if (errors.length) return { ok: false, errors };
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
      return { ok: true, errors: [] };
    } catch {
      return { ok: false, errors: ['No se pudieron guardar los cambios en este navegador.'] };
    }
  }

  window.AquaSmartSettings = { defaults, samplingOptions, load, save, validate };
}());
