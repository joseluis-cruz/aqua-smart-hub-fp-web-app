<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$tankId = filter_var($_GET['tank'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1],
]);
$range = (string) ($_GET['range'] ?? 'day');
$validRanges = ['day', 'week', 'month', 'year'];

if ($tankId === false || !in_array($range, $validRanges, true)) {
    jsonResponse([
        'error' => [
            'code' => 'INVALID_PARAMETERS',
            'message' => 'Se requiere un tanque y un rango válido.',
        ],
    ], 400);
}
if (!Database::isConfigured()) {
    jsonResponse([
        'error' => [
            'code' => 'DATABASE_NOT_CONFIGURED',
            'message' => 'La conexión MySQL todavía no está configurada.',
        ],
    ], 503);
}

$repository = new MonitoringRepository(Database::connection());
$history = $repository->history((string) $tankId, $range);
if ($history === null) {
    jsonResponse([
        'error' => [
            'code' => 'TANK_WITHOUT_DATA',
            'message' => 'El tanque solicitado no tiene mediciones.',
        ],
    ], 404);
}
jsonResponse(['data' => $history]);

