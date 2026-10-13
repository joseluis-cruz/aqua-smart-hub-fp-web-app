# Conexión MySQL

## Configuración

La API usa PDO con el controlador `pdo_mysql`. Las credenciales se leen del
entorno del proceso PHP y nunca se envían al navegador:

- `DB_HOST`
- `DB_PORT` (opcional, por defecto `3306`)
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_CHARSET` (opcional, por defecto `utf8mb4`)

En PowerShell, para una ejecución local:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
$env:DB_NAME = 'aquasmart'
$env:DB_USER = 'aquasmart_readonly'
$env:DB_PASSWORD = '...'
php -S 127.0.0.1:8000 -t .
```

Se recomienda un usuario MySQL de solo lectura y permisos únicamente sobre las
tablas necesarias. `GET /api/health.php` comprueba configuración y conexión sin
mostrar detalles sensibles del error.

## Contrato de la API

`GET /api/dashboard.php` proporcionará las últimas lecturas:

```json
{
  "data": {
    "capturedAt": "2026-10-13T10:30:00+02:00",
    "tanks": [
      {
        "id": "1",
        "name": "Tanque 01",
        "description": "Zona norte",
        "readings": {
          "temperature": 24.7,
          "ph": 8.2,
          "oxygen": 84.6
        }
      }
    ],
    "notifications": []
  }
}
```

`GET /api/history.php?tank=1&range=day` proporcionará las series. `range` solo
admite `day`, `week`, `month` o `year`.

```json
{
  "data": {
    "tankId": "1",
    "range": "day",
    "series": {
      "temperature": [{ "capturedAt": "2026-10-13T10:30:00+02:00", "value": 24.7 }],
      "ph": [{ "capturedAt": "2026-10-13T10:30:00+02:00", "value": 8.2 }],
      "oxygen": [{ "capturedAt": "2026-10-13T10:30:00+02:00", "value": 84.6 }]
    }
  }
}
```

## Mapeo del esquema

La API consulta `mediciones` como tabla de serie temporal y la relaciona con
`tanques` y `magnitudes`. Los códigos se traducen así:

- `TEMP` → `temperature`, en °C.
- `PH` → `ph`.
- `OD` → `oxygen`, en mg/L.

Las fechas de `mediciones.ts` se interpretan como UTC, según la definición del
esquema. El endpoint de históricos toma como final del periodo la medición más
reciente del tanque; así también puede representar volcados que no contienen
datos del día actual. Para limitar el tráfico, agrupa las mediciones por minuto,
10 minutos, hora o 12 horas según el rango solicitado.

El campo `mediciones.simulado` no se descarta. Si alguna última lectura tiene
valor `1`, el panel muestra `MySQL · datos simulados` para distinguir el origen
real de la API de la naturaleza de las mediciones almacenadas.

