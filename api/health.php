<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (!Database::isConfigured()) {
    jsonResponse([
        'status' => 'configuration_required',
        'database' => 'mysql',
        'message' => 'Faltan DB_HOST, DB_NAME o DB_USER en el entorno de PHP.',
    ], 503);
}

try {
    Database::connection()->query('SELECT 1');
    jsonResponse(['status' => 'ok', 'database' => 'mysql']);
} catch (PDOException $exception) {
    error_log('[AquaSmart API] MySQL health check failed: ' . $exception->getMessage());
    jsonResponse([
        'status' => 'unavailable',
        'database' => 'mysql',
        'message' => 'MySQL no está disponible con la configuración actual.',
    ], 503);
}

