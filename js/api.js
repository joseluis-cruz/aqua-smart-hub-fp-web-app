(function () {
  async function request(path, parameters = {}) {
    const url = new URL(path, window.location.href);
    for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);

    let response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    } catch {
      throw new Error('No se ha podido contactar con el servidor de datos.');
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('El servidor ha devuelto una respuesta no válida.');
    }
    if (!response.ok) throw new Error(payload.error?.message || 'No se pudieron cargar los datos.');
    return payload.data;
  }

  window.AquaSmartApi = {
    dashboard: () => request('api/dashboard.php'),
    history: (tank, range) => request('api/history.php', { tank, range })
  };
}());
