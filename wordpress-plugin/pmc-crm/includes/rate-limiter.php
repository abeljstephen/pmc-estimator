<?php
defined('ABSPATH') || exit;

/**
 * Per-IP transient-based rate limiter.
 * Reads limits from pmc_settings options: pmc_rl_{action}_max and pmc_rl_{action}_window.
 * Falls back to provided $max and $window defaults.
 *
 * Returns true (allow) or false (block).
 */
function pmc_rate_limit(string $action, int $max = 20, int $window = 60): bool {
    $ip      = pmc_get_ip();
    $opt_max = (int) pmc_setting('rl_' . $action . '_max', (string) $max);
    $opt_win = (int) pmc_setting('rl_' . $action . '_window', (string) $window);
    if ($opt_max > 0) $max    = $opt_max;
    if ($opt_win > 0) $window = $opt_win;

    $key   = 'pmc_rl_' . $action . '_' . md5($ip);
    $count = (int) get_transient($key);
    if ($count >= $max) {
        error_log('[PMC CRM] Rate limit hit: action=' . $action . ' ip=' . $ip);
        return false;
    }
    set_transient($key, $count + 1, $window);
    return true;
}

/**
 * Global rate limiter across all IPs.
 * Max reads from pmc_global_rate_limit option (0 = disabled).
 * Returns true (allow) or false (block).
 */
function pmc_global_rate_limit(int $max_per_minute = 0): bool {
    $opt_max = (int) pmc_setting('global_rate_limit', (string) $max_per_minute);
    if ($opt_max <= 0) return true; // disabled

    $key   = 'pmc_global_rl_' . date('YmdHi');
    $count = (int) get_transient($key);
    if ($count >= $opt_max) {
        error_log('[PMC CRM] Global rate limit hit: count=' . $count . ' max=' . $opt_max);
        return false;
    }
    set_transient($key, $count + 1, 60);
    return true;
}

/**
 * Return the client IP address.
 */
function pmc_get_ip(): string {
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}
