<?php
declare(strict_types=1);

final class Database
{
    private static ?PDO $connection = null;

    /** @return array<string, mixed> */
    private static function localConfig(): array
    {
        $path = dirname(__DIR__) . '/config.local.php';
        if (!is_file($path)) {
            return [];
        }
        $config = require $path;
        return is_array($config) ? $config : [];
    }

    private static function setting(string $environmentName, string $localName, ?string $default = null): ?string
    {
        $environmentValue = getenv($environmentName);
        if ($environmentValue !== false && $environmentValue !== '') {
            return (string) $environmentValue;
        }
        $local = self::localConfig();
        return array_key_exists($localName, $local) ? (string) $local[$localName] : $default;
    }

    public static function isConfigured(): bool
    {
        return self::setting('DB_HOST', 'host') !== null
            && self::setting('DB_NAME', 'database') !== null
            && self::setting('DB_USER', 'username') !== null;
    }

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }
        if (!self::isConfigured()) {
            throw new RuntimeException('La conexión MySQL no está configurada.');
        }

        $host = self::setting('DB_HOST', 'host');
        $port = (int) self::setting('DB_PORT', 'port', '3306');
        $database = self::setting('DB_NAME', 'database');
        $charset = self::setting('DB_CHARSET', 'charset', 'utf8mb4');
        $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";

        self::$connection = new PDO($dsn, self::setting('DB_USER', 'username'), self::setting('DB_PASSWORD', 'password', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        self::$connection->exec("SET time_zone = '+00:00'");
        return self::$connection;
    }
}

