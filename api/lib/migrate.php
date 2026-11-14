<?php
declare(strict_types=1);

/** Applies any api/migrations/*.sql files that have not run yet. Cheap no-op once up to date. */
function run_migrations(): void
{
    $dir = dirname(__DIR__) . '/migrations';
    $files = glob($dir . '/*.sql') ?: [];
    sort($files);
    $latest = $files ? basename(end($files)) : '';

    $marker = dirname(__DIR__) . '/.schema-version';
    $stamp = $latest . ' ' . hash('sha256', config('db_host', 'localhost') . '|' . config('db_port', '') . '|' . config('db_name', ''));
    if ($latest !== '' && is_file($marker) && trim((string) @file_get_contents($marker)) === $stamp) {
        return;
    }

    $pdo = db();
    $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(191) NOT NULL PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $applied = array_flip($pdo->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
    foreach ($files as $file) {
        $version = basename($file);
        if (isset($applied[$version])) {
            continue;
        }
        $sql = (string) file_get_contents($file);
        $sql = preg_replace('/^\s*--.*$/m', '', $sql);
        foreach (preg_split('/;\s*(\r?\n|$)/', $sql) as $statement) {
            if (trim($statement) !== '') {
                $pdo->exec($statement);
            }
        }
        q('INSERT INTO schema_migrations (version) VALUES (?)', [$version]);
    }
    @file_put_contents($marker, $stamp);
}

function schema_version(): ?string
{
    try {
        return q_val('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
    } catch (Throwable $e) {
        return null;
    }
}
