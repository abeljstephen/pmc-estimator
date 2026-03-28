<?php
defined('ABSPATH') || exit;

/**
 * Return quota data for all time windows.
 * Each window: label, from, to, plus all aggregate stats from pmc_get_calls_in_window(),
 * plus projected_total, projected_runtime_min, daily_avg_calls, daily_avg_runtime_min.
 */
function pmc_gas_quota_windows(): array {
    $today = date('Y-m-d');
    $windows = [
        'today' => ['label' => 'Today',     'from' => $today,                                      'to' => $today],
        'month' => ['label' => 'This Month', 'from' => date('Y-m-01'),                              'to' => $today],
        '3mo'   => ['label' => '3 Months',   'from' => date('Y-m-d', strtotime('-3 months')),       'to' => $today],
        '6mo'   => ['label' => '6 Months',   'from' => date('Y-m-d', strtotime('-6 months')),       'to' => $today],
        '9mo'   => ['label' => '9 Months',   'from' => date('Y-m-d', strtotime('-9 months')),       'to' => $today],
        'year'  => ['label' => '1 Year',     'from' => date('Y-m-d', strtotime('-1 year')),         'to' => $today],
    ];

    $result = [];
    foreach ($windows as $key => $w) {
        $stats   = pmc_get_calls_in_window($w['from'], $w['to']);
        $days    = max(1, (int) ((strtotime($w['to']) - strtotime($w['from'])) / DAY_IN_SECONDS) + 1);
        $remaining_days = max(0, (int) ((strtotime(date('Y-m-d', strtotime('last day of this month')))
            - strtotime($today)) / DAY_IN_SECONDS));

        $daily_avg_calls      = $stats['total_calls'] / $days;
        $daily_avg_runtime_ms = $stats['total_duration_ms'] / $days;
        $daily_avg_runtime_min = $daily_avg_runtime_ms / 60000;
        $projected_total       = $stats['total_calls'] + ($daily_avg_calls * $remaining_days);
        $projected_runtime_min = $daily_avg_runtime_min; // average per day

        $peak = pmc_get_peak_day($w['from'], $w['to']);

        $result[$key] = array_merge($w, $stats, [
            'days_in_window'         => $days,
            'remaining_days'         => $remaining_days,
            'daily_avg_calls'        => round($daily_avg_calls, 1),
            'daily_avg_runtime_min'  => round($daily_avg_runtime_min, 2),
            'projected_total'        => (int) round($projected_total),
            'projected_runtime_min'  => round($projected_runtime_min, 2),
            'peak_day'               => $peak['date'],
            'peak_day_count'         => $peak['count'],
        ]);
    }
    return $result;
}

/**
 * Return GAS quota limits for consumer and workspace accounts.
 */
function pmc_gas_quota_limits(): array {
    return [
        'consumer' => [
            'daily_min'   => 90,       // 90 minutes runtime per day
            'url_fetch'   => 20000,    // URL Fetch calls per day
        ],
        'workspace' => [
            'daily_min'   => 360,      // 360 minutes runtime per day
            'url_fetch'   => 100000,   // URL Fetch calls per day
        ],
    ];
}

/**
 * Send a lightweight ping to the GAS endpoint.
 * Returns [ok, latency_ms, response, error].
 */
function pmc_gas_ping(): array {
    $endpoint = pmc_setting('gas_endpoint', '');
    if (empty($endpoint)) {
        return ['ok' => false, 'latency_ms' => 0, 'response' => null, 'error' => 'GAS endpoint not configured'];
    }

    $start = microtime(true);
    $resp  = wp_remote_post($endpoint, [
        'headers'     => ['X-PMC-Secret' => pmc_secret(), 'Content-Type' => 'application/json'],
        'body'        => wp_json_encode(['action' => 'ping']),
        'timeout'     => 10,
        'sslverify'   => true,
    ]);
    $latency = (int) round((microtime(true) - $start) * 1000);

    if (is_wp_error($resp)) {
        return ['ok' => false, 'latency_ms' => $latency, 'response' => null, 'error' => $resp->get_error_message()];
    }

    $code = wp_remote_retrieve_response_code($resp);
    $body = wp_remote_retrieve_body($resp);
    return [
        'ok'         => ($code >= 200 && $code < 300),
        'latency_ms' => $latency,
        'response'   => json_decode($body, true) ?? $body,
        'error'      => $code >= 400 ? 'HTTP ' . $code : null,
    ];
}

/**
 * Return the configured GAS account type: 'consumer' or 'workspace'.
 */
function pmc_gas_account_type(): string {
    return pmc_setting('gas_account_type', 'consumer');
}

/**
 * Return the configured safe daily call ceiling.
 */
function pmc_gas_safe_daily_limit(): int {
    return (int) pmc_setting('gas_safe_daily_limit', '800');
}
