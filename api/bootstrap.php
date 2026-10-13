<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

/** @return never */
function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(static function (Throwable $exception): void {
    error_log(sprintf('[AquaSmart API] %s: %s', get_class($exception), $exception->getMessage()));
    jsonResponse([
        'error' => [
            'code' => 'INTERNAL_ERROR',
            'message' => 'No se pudo completar la petición.',
        ],
    ], 500);
});

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/MonitoringRepository.php';

