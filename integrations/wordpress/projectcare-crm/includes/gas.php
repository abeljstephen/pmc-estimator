<?php
defined('ABSPATH') || exit;

/**
 * Return quota data for all time windows.
 * Each window: label, from, to, plus all aggregate stats from pc_get_calls_in_window(),
 * plus projected_total, projected_runtime_min, daily_avg_calls, daily_avg_runtime_min.
 */
function pc_gas_quota_windows(): array {
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
        $stats   = pc_get_calls_in_window($w['from'], $w['to']);
        $days    = max(1, (int) ((strtotime($w['to']) - strtotime($w['from'])) / DAY_IN_SECONDS) + 1);
        $remaining_days = max(0, (int) ((strtotime(date('Y-m-d', strtotime('last day of this month')))
            - strtotime($today)) / DAY_IN_SECONDS));

        $daily_avg_calls      = $stats['total_calls'] / $days;
        $daily_avg_runtime_ms = $stats['total_duration_ms'] / $days;
        $daily_avg_runtime_min = $daily_avg_runtime_ms / 60000;
        $projected_total       = $stats['total_calls'] + ($daily_avg_calls * $remaining_days);
        $projected_runtime_min = $daily_avg_runtime_min; // average per day

        $peak = pc_get_peak_day($w['from'], $w['to']);

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
function pc_gas_quota_limits(): array {
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
function pc_gas_ping(): array {
    $endpoint = pc_setting('gas_endpoint', '');
    if (empty($endpoint)) {
        return ['ok' => false, 'latency_ms' => 0, 'response' => null, 'error' => 'GAS endpoint not configured'];
    }

    $start = microtime(true);
    $resp  = wp_remote_post($endpoint, [
        'headers'     => ['X-Projectcare-Secret' => pc_secret(), 'Content-Type' => 'application/json'],
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
function pc_gas_account_type(): string {
    return pc_setting('gas_account_type', 'consumer');
}

/**
 * Return the configured safe daily call ceiling.
 */
function pc_gas_safe_daily_limit(): int {
    return (int) pc_setting('gas_safe_daily_limit', '800');
}

/**
 * Return current stored credit costs (WP options, with hardcoded fallbacks).
 */
function pc_get_credit_costs(): array {
    return [
        'slim'          => max(1, (int) pc_setting('credit_cost_slim',          '1')),
        'baseline_only' => max(1, (int) pc_setting('credit_cost_baseline_only', '1')),
        'full_saco'     => max(1, (int) pc_setting('credit_cost_full_saco',     '2')),
        'saco_explain'  => max(1, (int) pc_setting('credit_cost_saco_explain',  '4')),
    ];
}

/**
 * Query average duration_ms per operation_type from the activity log.
 * Only successful calls with a recorded duration are included.
 */
function pc_get_avg_durations_by_op(): array {
    global $wpdb;
    $table = $wpdb->prefix . 'pc_activity';
    $rows  = $wpdb->get_results(
        "SELECT operation_type,
                ROUND(AVG(duration_ms)) AS avg_ms,
                MAX(duration_ms)        AS max_ms,
                COUNT(*)                AS sample_count
         FROM `{$table}`
         WHERE result = 'success' AND duration_ms > 0 AND operation_type != ''
         GROUP BY operation_type",
        ARRAY_A
    ) ?: [];
    $result = [];
    foreach ($rows as $r) {
        $result[$r['operation_type']] = [
            'avg_ms'       => (int) $r['avg_ms'],
            'max_ms'       => (int) $r['max_ms'],
            'sample_count' => (int) $r['sample_count'],
        ];
    }
    return $result;
}

/**
 * Calculate suggested credit costs from actual measured durations and quota limits.
 * Formula: ms_per_credit = (daily_quota_ms × safety%) / desired_calls_per_day
 *          cost = max(1, ceil(avg_ms / ms_per_credit))
 */
function pc_calculate_suggested_credits(): array {
    $acct          = pc_gas_account_type();
    $limits        = pc_gas_quota_limits();
    $daily_ms      = $limits[$acct]['daily_min'] * 60 * 1000;
    $safety        = 0.80;
    $desired_calls = max(1, (int) pc_setting('gas_desired_daily_calls', '200'));
    $ms_per_credit = ($daily_ms * $safety) / $desired_calls;

    $avg_durations = pc_get_avg_durations_by_op();
    $current_costs = pc_get_credit_costs();

    // Canonical ops we always show even if no data yet
    $ops = ['slim', 'baseline_only', 'full_saco', 'saco_explain'];
    $suggestions = [];
    foreach ($ops as $op) {
        $data = $avg_durations[$op] ?? null;
        $avg  = $data ? $data['avg_ms'] : 0;
        $suggestions[$op] = [
            'avg_ms'         => $avg,
            'max_ms'         => $data ? $data['max_ms'] : 0,
            'sample_count'   => $data ? $data['sample_count'] : 0,
            'suggested_cost' => $avg > 0 ? max(1, (int) ceil($avg / $ms_per_credit)) : null,
            'current_cost'   => $current_costs[$op] ?? 1,
        ];
    }

    return [
        'suggestions'     => $suggestions,
        'ms_per_credit'   => (int) round($ms_per_credit),
        'daily_ms_budget' => (int) round($daily_ms * $safety),
        'desired_calls'   => $desired_calls,
        'account_type'    => $acct,
    ];
}

/**
 * Total credits served in the current calendar month.
 */
function pc_get_monthly_credits_served(): int {
    global $wpdb;
    $table = $wpdb->prefix . 'pc_activity';
    return (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COALESCE(SUM(credits_cost),0) FROM `{$table}`
         WHERE created_at BETWEEN %s AND %s",
        date('Y-m-01') . ' 00:00:00',
        date('Y-m-d')  . ' 23:59:59'
    ));
}

/**
 * Gross margin analysis per active plan.
 * Revenue side: price_min_cents minus Stripe fees (2.9% + $0.30).
 * Cost side:    monthly_infra_cost / credits_served_this_month.
 */
function pc_get_margin_data(): array {
    $monthly_infra   = (float) pc_setting('monthly_infra_cost', '0');
    $credits_served  = pc_get_monthly_credits_served();
    $cost_per_credit = $credits_served > 0 ? $monthly_infra / $credits_served : 0;

    $result = [];
    foreach (pc_get_plans() as $p) {
        if (!(int) $p['is_active']) continue;
        $price    = $p['price_min_cents'] / 100;
        $credits  = (int) $p['credits'];
        $unlimited = $credits >= 999999;

        $stripe_fee    = $price > 0 ? round($price * 0.029 + 0.30, 2) : 0;
        $net_revenue   = round($price - $stripe_fee, 2);
        $rev_per_credit = (!$unlimited && $credits > 0) ? round($net_revenue / $credits, 4) : 0;
        $gross_margin   = ($rev_per_credit > 0 && $cost_per_credit > 0)
            ? round(($rev_per_credit - $cost_per_credit) / $rev_per_credit * 100, 1)
            : null;

        $result[] = [
            'slug'            => $p['slug'],
            'label'           => $p['label'],
            'gas_tier'        => $p['gas_tier'] ?? 'full',
            'price'           => $price,
            'credits'         => $credits,
            'unlimited'       => $unlimited,
            'stripe_fee'      => $stripe_fee,
            'net_revenue'     => $net_revenue,
            'rev_per_credit'  => $rev_per_credit,
            'cost_per_credit' => round($cost_per_credit, 4),
            'gross_margin_pct'=> $gross_margin,
        ];
    }

    return [
        'plans'           => $result,
        'monthly_infra'   => $monthly_infra,
        'credits_served'  => $credits_served,
        'cost_per_credit' => round($cost_per_credit, 4),
    ];
}

/**
 * Per-user breakdown for a given date range.
 * Returns up to $limit rows ordered by calls desc.
 */
function pc_get_user_breakdown(string $from, string $to, int $limit = 25): array {
    global $wpdb;
    $table = $wpdb->prefix . 'pc_activity';
    return $wpdb->get_results($wpdb->prepare(
        "SELECT email,
                COUNT(*)                                                      AS calls,
                COALESCE(SUM(credits_cost),0)                                 AS credits,
                ROUND(COALESCE(AVG(duration_ms),0))                          AS avg_ms,
                ROUND(COALESCE(SUM(duration_ms),0)/60000, 2)                 AS total_min,
                SUM(result != 'success')                                      AS failed,
                MAX(created_at)                                               AS last_call,
                GROUP_CONCAT(DISTINCT operation_type ORDER BY operation_type SEPARATOR ', ') AS op_types
         FROM `{$table}`
         WHERE action IN ('validate','deduct')
           AND created_at BETWEEN %s AND %s
           AND email != ''
         GROUP BY email
         ORDER BY calls DESC
         LIMIT %d",
        $from . ' 00:00:00',
        $to   . ' 23:59:59',
        $limit
    ), ARRAY_A) ?: [];
}
