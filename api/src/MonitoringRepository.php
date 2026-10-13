<?php
declare(strict_types=1);

final class MonitoringRepository
{
    private const CODE_TO_KEY = [
        'TEMP' => 'temperature',
        'PH' => 'ph',
        'OD' => 'oxygen',
    ];

    public function __construct(private PDO $database)
    {
    }

    /** @return array<string, mixed> */
    public function dashboard(): array
    {
        $sql = <<<'SQL'
            SELECT tanque_id, codigo, nombre, magnitud_codigo, valor, ts, simulado
            FROM (
                SELECT t.id AS tanque_id, t.codigo, t.nombre,
                       g.codigo AS magnitud_codigo, m.valor, m.ts, m.simulado,
                       ROW_NUMBER() OVER (
                           PARTITION BY t.id, g.id
                           ORDER BY m.ts DESC, m.id DESC
                       ) AS posicion
                FROM tanques t
                JOIN mediciones m ON m.tanque_id = t.id
                JOIN magnitudes g ON g.id = m.magnitud_id
                WHERE t.activo = 1 AND g.codigo IN ('TEMP', 'PH', 'OD')
            ) ultimas
            WHERE posicion = 1
            ORDER BY tanque_id, magnitud_codigo
            SQL;
        $rows = $this->database->query($sql)->fetchAll();

        $tanks = [];
        $latestTimestamp = null;
        $containsSimulatedData = false;
        foreach ($rows as $row) {
            $tankId = (string) $row['tanque_id'];
            if (!isset($tanks[$tankId])) {
                $tanks[$tankId] = [
                    'id' => $tankId,
                    'name' => (string) $row['nombre'],
                    'description' => 'Código ' . (string) $row['codigo'],
                    'readings' => [],
                ];
            }
            $key = self::CODE_TO_KEY[(string) $row['magnitud_codigo']] ?? null;
            if ($key !== null) {
                $tanks[$tankId]['readings'][$key] = (float) $row['valor'];
            }
            $latestTimestamp = $latestTimestamp === null || $row['ts'] > $latestTimestamp ? $row['ts'] : $latestTimestamp;
            $containsSimulatedData = $containsSimulatedData || (bool) $row['simulado'];
        }

        $completeTanks = array_values(array_filter($tanks, static fn (array $tank): bool =>
            count(array_intersect_key($tank['readings'], array_flip(['temperature', 'ph', 'oxygen']))) === 3
        ));

        return [
            'capturedAt' => $latestTimestamp === null ? null : $this->utcTimestamp($latestTimestamp),
            'containsSimulatedData' => $containsSimulatedData,
            'tanks' => $completeTanks,
            'notifications' => [],
        ];
    }

    /** @return array<string, mixed>|null */
    public function history(string $tankId, string $range): ?array
    {
        $periods = [
            'day' => ['-1 day', 60],
            'week' => ['-7 days', 600],
            'month' => ['-1 month', 3600],
            'year' => ['-1 year', 43200],
        ];
        [$period, $bucketSeconds] = $periods[$range];

        $latestStatement = $this->database->prepare('SELECT MAX(ts) FROM mediciones WHERE tanque_id = :tank');
        $latestStatement->execute(['tank' => $tankId]);
        $latest = $latestStatement->fetchColumn();
        if ($latest === false || $latest === null) {
            return null;
        }

        $to = new DateTimeImmutable((string) $latest, new DateTimeZone('UTC'));
        $from = $to->modify($period);
        $sql = "
            SELECT g.codigo,
                   FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(m.ts) / {$bucketSeconds}) * {$bucketSeconds}) AS bucket_ts,
                   AVG(m.valor) AS valor
            FROM mediciones m
            JOIN magnitudes g ON g.id = m.magnitud_id
            WHERE m.tanque_id = :tank
              AND m.ts BETWEEN :from_ts AND :to_ts
              AND g.codigo IN ('TEMP', 'PH', 'OD')
            GROUP BY g.codigo, bucket_ts
            ORDER BY bucket_ts, g.codigo";
        $statement = $this->database->prepare($sql);
        $statement->execute([
            'tank' => $tankId,
            'from_ts' => $from->format('Y-m-d H:i:s.v'),
            'to_ts' => $to->format('Y-m-d H:i:s.v'),
        ]);

        $series = ['temperature' => [], 'ph' => [], 'oxygen' => []];
        foreach ($statement->fetchAll() as $row) {
            $key = self::CODE_TO_KEY[(string) $row['codigo']] ?? null;
            if ($key !== null) {
                $series[$key][] = [
                    'capturedAt' => $this->utcTimestamp((string) $row['bucket_ts']),
                    'value' => (float) $row['valor'],
                ];
            }
        }

        return [
            'tankId' => $tankId,
            'range' => $range,
            'from' => $from->format('Y-m-d\TH:i:s.v\Z'),
            'to' => $to->format('Y-m-d\TH:i:s.v\Z'),
            'series' => $series,
        ];
    }

    private function utcTimestamp(string $timestamp): string
    {
        return (new DateTimeImmutable($timestamp, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    }
}
