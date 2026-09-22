<?php
/**
 * backend/config/env.php
 *
 * Minimal, dependency-free .env loader.
 *
 * PHP's built-in dev server (`php -S`) and many plain setups
 * do NOT read .env files automatically the way frameworks do.
 * This makes getenv()/$_ENV pick up values from a .env file at
 * the project root, without requiring Composer or a package.
 *
 * Safe to include multiple times; already-set real environment
 * variables (e.g. ones your host injects in production) are
 * never overwritten by .env values.
 */

if (!function_exists('load_dotenv')) {

    function load_dotenv(string $path): void
    {
        if (!is_readable($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {

            $line = trim($line);

            // Skip comments and malformed lines.
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            if (!str_contains($line, '=')) {
                continue;
            }

            [$name, $value] = explode('=', $line, 2);

            $name = trim($name);
            $value = trim($value);

            // Strip matching surrounding quotes, if present.
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            // Don't clobber a real environment variable that's
            // already set (e.g. by your host, Docker, systemd).
            if (getenv($name) !== false) {
                continue;
            }

            putenv("{$name}={$value}");
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

// Load the project-root .env once, as soon as this file is included.
load_dotenv(__DIR__ . '/../../.env');
