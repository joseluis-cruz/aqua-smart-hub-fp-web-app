-- =====================================================================
--  AquaSmartHub - Base de datos de monitorización de tanques de acuicultura
--  MySQL 8.0.16 o superior (InnoDB, utf8mb4, CHECK constraints)
--
--  Estructura:
--    unidades     -> catálogo de unidades (°C, pH, mg/L...)
--    magnitudes   -> qué se mide (temperatura, pH, oxígeno) y en qué unidad
--    tanques      -> los tanques / controladores HI520
--    mediciones   -> una fila por valor medido, con su timestamp
--
--  Cambiar una unidad = UPDATE en "unidades" o en "magnitudes",
--  sin tocar ni una fila de "mediciones".
-- =====================================================================

CREATE DATABASE IF NOT EXISTS aquasmarthub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE aquasmarthub;

-- La tabla antigua "lecturas" (versión anterior) ya no se usa.
-- Si la creaste antes y solo tiene datos de prueba, puedes borrarla:
-- DROP TABLE IF EXISTS lecturas;


-- ---------------------------------------------------------------------
--  1. UNIDADES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unidades (
  id            TINYINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  simbolo       VARCHAR(16)       NOT NULL COMMENT 'Lo que se muestra: °C, mg/L...',
  nombre        VARCHAR(64)       NOT NULL COMMENT 'Nombre completo',
  creado_en     DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modificado_en DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_unidades_simbolo (simbolo)
) ENGINE = InnoDB
  COMMENT = 'Catálogo de unidades de medida';


-- ---------------------------------------------------------------------
--  2. MAGNITUDES (variables de proceso)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS magnitudes (
  id            TINYINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo        VARCHAR(32)       NOT NULL COMMENT 'Código interno estable: TEMP, PH, OD',
  nombre        VARCHAR(64)       NOT NULL,
  unidad_id     TINYINT UNSIGNED  NOT NULL,
  decimales     TINYINT UNSIGNED  NOT NULL DEFAULT 2,
  rango_min     DECIMAL(10,3)     NULL COMMENT 'Límite inferior aceptable (alarmas/informes)',
  rango_max     DECIMAL(10,3)     NULL COMMENT 'Límite superior aceptable',
  creado_en     DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modificado_en DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_magnitudes_codigo (codigo),
  KEY idx_magnitudes_unidad (unidad_id),
  CONSTRAINT fk_magnitudes_unidad
    FOREIGN KEY (unidad_id) REFERENCES unidades (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_magnitudes_rango
    CHECK (rango_min IS NULL OR rango_max IS NULL OR rango_min < rango_max)
) ENGINE = InnoDB
  COMMENT = 'Variables que se miden y su unidad';


-- ---------------------------------------------------------------------
--  3. TANQUES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tanques (
  id             TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo         VARCHAR(16)      NOT NULL COMMENT 'T1, T2, T3',
  nombre         VARCHAR(64)      NOT NULL,
  esclavo_modbus TINYINT UNSIGNED NULL COMMENT 'slaveAddress del HI520',
  activo         TINYINT(1)       NOT NULL DEFAULT 1,
  creado_en      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modificado_en  DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tanques_codigo (codigo),
  UNIQUE KEY uq_tanques_esclavo (esclavo_modbus)
) ENGINE = InnoDB
  COMMENT = 'Tanques monitorizados';


-- ---------------------------------------------------------------------
--  4. MEDICIONES (tabla de hechos / serie temporal)
--     ts se guarda SIEMPRE en UTC (se inserta con UTC_TIMESTAMP(3)).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mediciones (
  id           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  ts           DATETIME(3)      NOT NULL COMMENT 'Instante de la medida, UTC, milisegundos',
  tanque_id    TINYINT UNSIGNED NOT NULL,
  magnitud_id  TINYINT UNSIGNED NOT NULL,
  valor        DECIMAL(10,3)    NOT NULL,
  muestra      INT UNSIGNED     NULL COMMENT 'Contador de muestra del PLC',
  simulado     TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '1 = dato simulado',
  PRIMARY KEY (id),
  UNIQUE KEY uq_mediciones_punto (tanque_id, magnitud_id, ts),
  KEY idx_mediciones_ts (ts),
  KEY idx_mediciones_magnitud_ts (magnitud_id, ts),
  CONSTRAINT fk_mediciones_tanque
    FOREIGN KEY (tanque_id) REFERENCES tanques (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_mediciones_magnitud
    FOREIGN KEY (magnitud_id) REFERENCES magnitudes (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB
  COMMENT = 'Valores medidos, una fila por tanque/magnitud/instante';


-- ---------------------------------------------------------------------
--  5. DATOS INICIALES
--     IDs fijos: Node-RED los usa (TEMP=1, PH=2, OD=3 / T1=1, T2=2, T3=3)
-- ---------------------------------------------------------------------
INSERT INTO unidades (id, simbolo, nombre) VALUES
  (1, '°C',   'Grados Celsius'),
  (2, 'pH',   'Unidades de pH'),
  (3, 'mg/L', 'Miligramos por litro'),
  (4, '%',    'Porcentaje de saturación'),
  (5, 'mV',   'Milivoltios')
ON DUPLICATE KEY UPDATE simbolo = VALUES(simbolo), nombre = VALUES(nombre);

INSERT INTO magnitudes (id, codigo, nombre, unidad_id, decimales, rango_min, rango_max) VALUES
  (1, 'TEMP', 'Temperatura',       1, 2, 22.000, 27.000),
  (2, 'PH',   'pH',                2, 2,  7.500,  8.200),
  (3, 'OD',   'Oxígeno disuelto',  3, 2,  5.000,  9.000)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), unidad_id = VALUES(unidad_id),
                        decimales = VALUES(decimales),
                        rango_min = VALUES(rango_min), rango_max = VALUES(rango_max);

INSERT INTO tanques (id, codigo, nombre, esclavo_modbus) VALUES
  (1, 'T1', 'Tanque 1', 1),
  (2, 'T2', 'Tanque 2', 2),
  (3, 'T3', 'Tanque 3', 3)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), esclavo_modbus = VALUES(esclavo_modbus);


-- ---------------------------------------------------------------------
--  6. VISTAS DE CONSULTA
-- ---------------------------------------------------------------------

-- Formato largo, legible, con unidad y hora local de España
CREATE OR REPLACE VIEW v_mediciones AS
SELECT
  m.id,
  m.ts                                                   AS ts_utc,
  COALESCE(CONVERT_TZ(m.ts, '+00:00', 'Europe/Madrid'),
           CONVERT_TZ(m.ts, '+00:00', 'SYSTEM'))       AS ts_local,
  t.codigo                                               AS tanque,
  g.codigo                                               AS magnitud_codigo,
  g.nombre                                               AS magnitud,
  m.valor,
  u.simbolo                                              AS unidad,
  (m.valor < g.rango_min OR m.valor > g.rango_max)       AS fuera_rango,
  m.simulado
FROM mediciones m
JOIN tanques    t ON t.id = m.tanque_id
JOIN magnitudes g ON g.id = m.magnitud_id
JOIN unidades   u ON u.id = g.unidad_id;
-- Si el servidor no tiene cargadas las zonas horarias (habitual en Windows),
-- ts_local usa la zona horaria del sistema operativo.

-- Formato ancho: una fila por tanque e instante (cómodo para Excel/gráficas)
CREATE OR REPLACE VIEW v_mediciones_ancho AS
SELECT
  COALESCE(CONVERT_TZ(m.ts, '+00:00', 'Europe/Madrid'),
           CONVERT_TZ(m.ts, '+00:00', 'SYSTEM'))  AS ts_local,
  m.ts                                              AS ts_utc,
  t.codigo                                          AS tanque,
  MAX(CASE WHEN g.codigo = 'TEMP' THEN m.valor END) AS temperatura,
  MAX(CASE WHEN g.codigo = 'PH'   THEN m.valor END) AS ph,
  MAX(CASE WHEN g.codigo = 'OD'   THEN m.valor END) AS oxigeno,
  MAX(m.simulado)                                   AS simulado
FROM mediciones m
JOIN tanques    t ON t.id = m.tanque_id
JOIN magnitudes g ON g.id = m.magnitud_id
GROUP BY m.ts, t.codigo;

-- Último valor de cada tanque y magnitud
CREATE OR REPLACE VIEW v_ultimo_valor AS
SELECT
  t.codigo  AS tanque,
  g.nombre  AS magnitud,
  m.valor,
  u.simbolo AS unidad,
  m.ts      AS ts_utc
FROM mediciones m
JOIN (
  SELECT tanque_id, magnitud_id, MAX(ts) AS ts
  FROM mediciones
  GROUP BY tanque_id, magnitud_id
) ult ON ult.tanque_id = m.tanque_id
     AND ult.magnitud_id = m.magnitud_id
     AND ult.ts = m.ts
JOIN tanques    t ON t.id = m.tanque_id
JOIN magnitudes g ON g.id = m.magnitud_id
JOIN unidades   u ON u.id = g.unidad_id;


-- ---------------------------------------------------------------------
--  7. USUARIO DE APLICACIÓN PARA NODE-RED (mínimos privilegios)
--     Cambia la contraseña antes de ejecutarlo.
-- ---------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'nodered'@'localhost' IDENTIFIED BY 'CambiaEstaClave_2026!';
GRANT SELECT ON aquasmarthub.*            TO 'nodered'@'localhost';
GRANT INSERT ON aquasmarthub.mediciones   TO 'nodered'@'localhost';
FLUSH PRIVILEGES;


-- =====================================================================
--  EJEMPLOS DE USO
-- =====================================================================

-- Insert manual de una medida (lo que hace Node-RED, pero de 9 en 9):
-- INSERT INTO mediciones (ts, tanque_id, magnitud_id, valor, muestra, simulado)
-- VALUES (UTC_TIMESTAMP(3), 1, 1, 24.31, 1, 1);

-- Cambiar la unidad del oxígeno a % de saturación:
-- UPDATE magnitudes SET unidad_id = 4, rango_min = 70, rango_max = 110 WHERE codigo = 'OD';

-- Lecturas del tanque 2 de la última hora:
-- SELECT * FROM v_mediciones
-- WHERE tanque = 'T2' AND ts_utc >= UTC_TIMESTAMP() - INTERVAL 1 HOUR
-- ORDER BY ts_utc;

-- Media horaria de temperatura por tanque, hoy:
-- SELECT tanque, DATE_FORMAT(ts_utc, '%Y-%m-%d %H:00') AS hora, ROUND(AVG(valor), 2) AS media
-- FROM v_mediciones
-- WHERE magnitud_codigo = 'TEMP' AND ts_utc >= UTC_DATE()
-- GROUP BY tanque, hora ORDER BY hora, tanque;

-- Borrar los datos simulados cuando vuelva el RS485:
-- DELETE FROM mediciones WHERE simulado = 1;
