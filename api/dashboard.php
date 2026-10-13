<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (!Database::isConfigured()) {
    jsonResponse([
        'error' => [
            'code' => 'DATABASE_NOT_CONFIGURED',
            'message' => 'La conexión MySQL todavía no está configurada.',
        ],
    ], 503);
}

$repository = new MonitoringRepository(Database::connection());
jsonResponse(['data' => $repository->dashboard()]);

