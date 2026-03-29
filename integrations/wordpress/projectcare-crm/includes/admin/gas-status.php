<?php
defined('ABSPATH') || exit;

function pc_page_gas(): void {
    if (!current_user_can('manage_options')) return;

    $notice = '';

    // ── POST HANDLERS ──────────────────────────────────────────────────────────

    // Ping
    $ping_result = null;
    if (isset($_POST['pc_ping_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pc_ping_nonce'])), 'pc_gas_ping')) {
            $ping_result = pc_gas_ping();
        }
    }

    // Account type save
    if (isset($_POST['pc_gas_type_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pc_gas_type_nonce'])), 'pc_gas_account_type')) {
            update_option('pc_gas_account_type', sanitize_text_field($_POST['gas_account_type'] ?? 'consumer'));
            $notice = 'GAS account type saved.';
        }
    }

    // Benchmark
    $benchmark_result = null;
    if (isset($_POST['pc_benchmark_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pc_benchmark_nonce'])), 'pc_gas_benchmark')) {
            $endpoint = pc_setting('gas_endpoint', '');
            if (empty($endpoint)) {
                $benchmark_result = ['ok' => false, 'error' => 'GAS endpoint not configured in Settings'];
            } else {
                $start = microtime(true);
                $resp  = wp_remote_post($endpoint, [
                    'headers'   => ['X-Projectcare-Secret' => pc_secret(), 'Content-Type' => 'application/json'],
                    'body'      => wp_json_encode(['action' => 'benchmark']),
                    'timeout'   => 30,
                    'sslverify' => true,
                ]);
                $latency = (int) round((microtime(true) - $start) * 1000);
                if (is_wp_error($resp)) {
                    $benchmark_result = ['ok' => false, 'error' => $resp->get_error_message()];
                } else {
                    $body = json_decode(wp_remote_retrieve_body($resp), true) ?? [];
                    $benchmark_result = array_merge(['latency_ms' => $latency], $body);
                }
            }
        }
    }

    // Apply calibrated credit costs
    if (isset($_POST['pc_apply_costs_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pc_apply_costs_nonce'])), 'pc_apply_costs')) {
            $ops = ['slim', 'baseline_only', 'full_saco', 'saco_explain'];
            foreach ($ops as $op) {
                $val = absint($_POST['credit_cost_' . $op] ?? 0);
                if ($val > 0) update_option('pc_credit_cost_' . $op, $val);
            }
            $notice = 'Credit costs updated.';
        }
    }

    // ── DATE RANGE RESOLUTION ──────────────────────────────────────────────────
    // Custom date range takes priority over preset window tabs.
    $date_from_raw = sanitize_text_field($_GET['date_from'] ?? '');
    $date_to_raw   = sanitize_text_field($_GET['date_to']   ?? '');
    $using_custom  = false;

    if ($date_from_raw && $date_to_raw
        && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_from_raw)
        && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_to_raw)
        && $date_from_raw <= $date_to_raw) {
        $custom_from  = $date_from_raw;
        $custom_to    = $date_to_raw;
        $using_custom = true;
    }

    $window      = sanitize_text_field($_GET['window'] ?? 'today');
    $valid_windows = ['today', 'month', '3mo', '6mo', '9mo', 'year'];
    if (!in_array($window, $valid_windows, true)) $window = 'today';

    $all_data = pc_gas_quota_windows();
    $limits   = pc_gas_quota_limits();
    $acct     = pc_gas_account_type();
    $limit    = $limits[$acct];
    $safe_limit = pc_gas_safe_daily_limit();

    if ($using_custom) {
        $data = pc_get_calls_in_window($custom_from, $custom_to);
        $days = max(1, (int) ((strtotime($custom_to) - strtotime($custom_from)) / DAY_IN_SECONDS) + 1);
        $data['days_in_window']        = $days;
        $data['label']                 = $custom_from . ' → ' . $custom_to;
        $data['daily_avg_calls']       = round($data['total_calls'] / $days, 1);
        $data['daily_avg_runtime_min'] = round($data['total_duration_ms'] / $days / 60000, 2);
        $peak = pc_get_peak_day($custom_from, $custom_to);
        $data['peak_day']   = $peak['date'];
        $data['peak_day_count'] = $peak['count'];
        $data['remaining_days'] = 0;
        $data['projected_total'] = 0;
        $data['projected_runtime_min'] = 0;
    } else {
        $data = $all_data[$window];
    }

    // Resolve display from/to for breakdown query
    $breakdown_from = $using_custom ? $custom_from : ($all_data[$window]['from'] ?? date('Y-m-d'));
    $breakdown_to   = $using_custom ? $custom_to   : ($all_data[$window]['to']   ?? date('Y-m-d'));

    // ── QUOTA METRICS ──────────────────────────────────────────────────────────
    $daily_runtime_ms = $data['total_duration_ms'];
    if (!$using_custom && $window !== 'today' && $data['days_in_window'] > 0) {
        $daily_runtime_ms = $data['total_duration_ms'] / $data['days_in_window'];
    }
    $daily_runtime_min = $daily_runtime_ms / 60000;
    $runtime_pct       = $limit['daily_min'] > 0
        ? min(100, round($daily_runtime_min / $limit['daily_min'] * 100, 1)) : 0;

    $daily_calls   = (!$using_custom && $window !== 'today') ? ($data['daily_avg_calls'] ?? 0) : $data['total_calls'];
    $url_fetch_pct = $limit['url_fetch'] > 0
        ? min(100, round($daily_calls / $limit['url_fetch'] * 100, 1)) : 0;

    $bar_runtime = _pc_gas_bar($runtime_pct);
    $bar_fetch   = _pc_gas_bar($url_fetch_pct);

    // ── CALIBRATION DATA ───────────────────────────────────────────────────────
    $calibration     = pc_calculate_suggested_credits();
    $margin_data     = pc_get_margin_data();
    $user_breakdown  = pc_get_user_breakdown($breakdown_from, $breakdown_to);

    // Chart data
    $chart_days = match(true) {
        $using_custom => max(1, (int) ceil((strtotime($custom_to) - strtotime($custom_from)) / DAY_IN_SECONDS) + 1),
        $window === 'today' => 1,
        $window === 'month' => 30,
        $window === '3mo'   => 90,
        $window === '6mo'   => 180,
        $window === '9mo'   => 270,
        default             => 365,
    };
    $stats        = pc_get_daily_stats($chart_days);
    $chart_labels = array_column($stats, 'date');
    $chart_calls  = array_column($stats, 'calls');
    $chart_ms     = array_column($stats, 'duration_ms');

    $base_url = admin_url('admin.php?page=pmc-crm-gas');
    ?>
    <div class="wrap">
        <h1>GAS Quota &amp; Pricing Status</h1>
        <?php if ($notice): ?>
            <div class="notice notice-success is-dismissible"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <!-- ── Tab strip ── -->
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;border-bottom:1px solid #ddd;padding-bottom:0">
            <?php foreach (['today' => 'Today','month' => 'This Month','3mo' => '3 Months','6mo' => '6 Months','9mo' => '9 Months','year' => '1 Year'] as $wk => $wl): ?>
                <a href="<?php echo esc_url(add_query_arg('window', $wk, $base_url)); ?>"
                   style="padding:8px 14px;text-decoration:none;border:1px solid #ddd;border-bottom:none;border-radius:4px 4px 0 0;<?php echo (!$using_custom && $window === $wk) ? 'background:#fff;font-weight:bold;color:#2271b1' : 'background:#f0f0f0;color:#444'; ?>">
                    <?php echo esc_html($wl); ?>
                </a>
            <?php endforeach; ?>
        </div>

        <!-- ── Custom date range ── -->
        <form method="get" action="" style="margin-bottom:20px;background:#fff;border:1px solid #ddd;border-radius:6px;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <input type="hidden" name="page" value="pmc-crm-gas">
            <strong style="font-size:13px">Custom range:</strong>
            <label style="font-size:13px">From
                <input type="date" name="date_from" value="<?php echo esc_attr($date_from_raw ?: date('Y-m-01')); ?>" style="margin-left:4px">
            </label>
            <label style="font-size:13px">To
                <input type="date" name="date_to" value="<?php echo esc_attr($date_to_raw ?: date('Y-m-d')); ?>" style="margin-left:4px">
            </label>
            <button type="submit" class="button button-secondary">Apply</button>
            <?php if ($using_custom): ?>
                <a href="<?php echo esc_url($base_url); ?>" class="button button-link">Clear</a>
                <span style="color:#2271b1;font-weight:bold;font-size:12px">Custom range active: <?php echo esc_html($custom_from . ' → ' . $custom_to); ?></span>
            <?php endif; ?>
        </form>

        <!-- ── Quota bars ── -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px;font-family:monospace">
            <h2 style="margin-top:0;font-size:15px;font-family:sans-serif">Quota Usage — <?php echo esc_html($data['label'] ?? $window); ?></h2>
            <p>Runtime:   <strong><?php echo esc_html($bar_runtime); ?></strong>
               <?php echo esc_html(round($daily_runtime_min, 1) . ' min / ' . $limit['daily_min'] . ' min daily limit (' . $acct . ')'); ?></p>
            <p>URL Fetch: <strong><?php echo esc_html($bar_fetch); ?></strong>
               <?php echo esc_html(number_format((int) $daily_calls) . ' / ' . number_format($limit['url_fetch']) . ' per day'); ?></p>
        </div>

        <!-- ── Metrics table ── -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Metrics — <?php echo esc_html($data['label'] ?? $window); ?></h2>
            <table class="widefat" style="max-width:620px">
                <tr><th>Total Calls</th>       <td><?php echo esc_html(number_format((int) $data['total_calls'])); ?></td></tr>
                <tr><th>Total Runtime</th>      <td><?php echo esc_html(round($data['total_duration_ms'] / 60000, 1)); ?> min</td></tr>
                <tr><th>Avg Call Duration</th>  <td><?php echo esc_html(round($data['avg_duration_ms'])); ?> ms</td></tr>
                <tr><th>Failed Calls</th>        <td><?php echo esc_html((int) $data['failed_calls']); ?></td></tr>
                <tr><th>Failure Rate</th>        <td><?php echo $data['total_calls'] > 0 ? esc_html(round($data['failed_calls'] / $data['total_calls'] * 100, 1)) . '%' : '—'; ?></td></tr>
                <tr><th>Unique Users</th>        <td><?php echo esc_html((int) $data['unique_users']); ?></td></tr>
                <tr><th>Credits Consumed</th>    <td><?php echo esc_html(number_format((int) $data['credits_consumed'])); ?></td></tr>
                <tr><th>Peak Day</th>            <td><?php echo esc_html($data['peak_day'] . ' (' . $data['peak_day_count'] . ' calls)'); ?></td></tr>
                <?php if (isset($data['calls_by_hour'])): $peak_hr = 0; $peak_hr_cnt = 0;
                    foreach ($data['calls_by_hour'] as $hr => $cnt) { if ($cnt > $peak_hr_cnt) { $peak_hr = $hr; $peak_hr_cnt = $cnt; } } ?>
                <tr><th>Peak Hour</th>           <td><?php echo esc_html($peak_hr . ':00 (' . $peak_hr_cnt . ' calls)'); ?></td></tr>
                <?php endif; ?>
            </table>
        </div>

        <!-- ── Projection ── -->
        <?php if (!$using_custom && $window !== 'today' && ($data['remaining_days'] ?? 0) > 0): ?>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Projection</h2>
            <?php $headroom_ok = $data['daily_avg_calls'] < $safe_limit;
                  $headroom_pct = $safe_limit > 0 ? round($data['daily_avg_calls'] / $safe_limit * 100, 1) : 0; ?>
            <table class="widefat" style="max-width:500px;font-family:monospace">
                <tr><th>Avg calls/day</th>        <td><?php echo esc_html($data['daily_avg_calls']); ?></td></tr>
                <tr><th>Days remaining</th>        <td><?php echo esc_html($data['remaining_days']); ?></td></tr>
                <tr><th>Projected total</th>       <td><?php echo esc_html(number_format($data['projected_total'])); ?> calls</td></tr>
                <tr><th>Projected runtime/day</th> <td><?php echo esc_html($data['projected_runtime_min']); ?> min/day avg</td></tr>
                <tr><th>Headroom</th>
                    <td style="color:<?php echo $headroom_ok ? '#0a6b0a' : '#b32d2e'; ?>;font-weight:bold">
                        <?php echo $headroom_ok ? 'HEALTHY' : 'WARNING'; ?>
                        (safe limit: <?php echo esc_html(number_format($safe_limit)); ?>/day, using <?php echo esc_html($headroom_pct); ?>%)
                    </td></tr>
            </table>
        </div>
        <?php endif; ?>

        <!-- ── Chart ── -->
        <?php if (!empty($chart_labels)): ?>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Call Volume</h2>
            <canvas id="pmc-gas-chart" height="80"></canvas>
        </div>
        <script>
        (function() {
            var labels = <?php echo wp_json_encode($chart_labels); ?>;
            var calls  = <?php echo wp_json_encode($chart_calls); ?>;
            var limit  = <?php echo esc_js($safe_limit); ?>;
            var ctx    = document.getElementById('pmc-gas-chart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: { labels: labels, datasets: [{
                    label: 'Calls', data: calls,
                    backgroundColor: 'rgba(34,113,177,0.6)', borderColor: 'rgba(34,113,177,1)', borderWidth: 1
                }]},
                options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
            });
        })();
        </script>
        <?php endif; ?>

        <!-- ── User breakdown ── -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">User Breakdown — <?php echo esc_html($data['label'] ?? ($breakdown_from . ' → ' . $breakdown_to)); ?></h2>
            <?php if (empty($user_breakdown)): ?>
                <p style="color:#666">No call data for this period.</p>
            <?php else: ?>
            <table class="widefat" style="font-size:12px">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th style="text-align:right">Calls</th>
                        <th style="text-align:right">Credits</th>
                        <th style="text-align:right">Avg ms</th>
                        <th style="text-align:right">Total min</th>
                        <th style="text-align:right">Failed</th>
                        <th>Op Types</th>
                        <th>Last Call</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($user_breakdown as $row): ?>
                    <tr>
                        <td><?php echo esc_html($row['email']); ?></td>
                        <td style="text-align:right"><?php echo esc_html((int)$row['calls']); ?></td>
                        <td style="text-align:right"><?php echo esc_html((int)$row['credits']); ?></td>
                        <td style="text-align:right"><?php echo esc_html(number_format((int)$row['avg_ms'])); ?></td>
                        <td style="text-align:right"><?php echo esc_html($row['total_min']); ?></td>
                        <td style="text-align:right;color:<?php echo (int)$row['failed'] > 0 ? '#b32d2e' : '#666'; ?>">
                            <?php echo esc_html((int)$row['failed']); ?>
                        </td>
                        <td style="color:#666"><?php echo esc_html($row['op_types'] ?? '—'); ?></td>
                        <td style="color:#666;white-space:nowrap"><?php echo esc_html(substr($row['last_call'] ?? '', 0, 16)); ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>

        <!-- ── Calibration ── -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Credit Cost Calibration
                <?php echo pc_tip('Formula: ms_per_credit = (daily_quota_ms × 80%) ÷ desired_calls. Suggested cost = ceil(avg_ms ÷ ms_per_credit). Set "Desired daily calls" in Settings.'); ?>
            </h2>
            <p style="color:#666;font-size:12px;margin-top:0">
                Account: <strong><?php echo esc_html($acct); ?></strong> &nbsp;|&nbsp;
                Daily budget: <strong><?php echo esc_html(number_format($calibration['daily_ms_budget'])); ?> ms</strong> (80% of <?php echo esc_html($limit['daily_min']); ?> min) &nbsp;|&nbsp;
                Desired calls: <strong><?php echo esc_html($calibration['desired_calls']); ?>/day</strong> &nbsp;|&nbsp;
                ms/credit: <strong><?php echo esc_html(number_format($calibration['ms_per_credit'])); ?> ms</strong>
                <br>To change desired calls or account type, update <a href="<?php echo esc_url(admin_url('admin.php?page=pmc-crm-settings')); ?>">Settings</a>.
            </p>

            <?php
            $has_any_data = false;
            foreach ($calibration['suggestions'] as $s) { if ($s['sample_count'] > 0) { $has_any_data = true; break; } }
            ?>

            <?php if (!$has_any_data): ?>
                <p style="color:#666">No activity log data yet. Run Benchmark below to measure GAS overhead, or make some API calls first so the activity log has real durations to calibrate from.</p>
            <?php else: ?>
            <form method="post" style="margin-bottom:0">
                <?php wp_nonce_field('pc_apply_costs', 'pc_apply_costs_nonce'); ?>
                <table class="widefat" style="max-width:700px;margin-bottom:12px">
                    <thead>
                        <tr>
                            <th>Operation</th>
                            <th style="text-align:right">Avg ms (<?php echo esc_html($has_any_data ? 'measured' : 'no data'); ?>)</th>
                            <th style="text-align:right">Samples</th>
                            <th style="text-align:right">Suggested</th>
                            <th style="text-align:right">Current</th>
                            <th>Apply</th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php
                    $op_labels = ['slim' => 'Slim (PERT)', 'baseline_only' => 'Baseline only', 'full_saco' => 'Full SACO', 'saco_explain' => 'SACO + Explain'];
                    foreach ($calibration['suggestions'] as $op => $s):
                        $suggested = $s['suggested_cost'];
                        $current   = $s['current_cost'];
                        $changed   = $suggested !== null && $suggested !== $current;
                    ?>
                    <tr style="<?php echo $changed ? 'background:#fffbe6' : ''; ?>">
                        <td><?php echo esc_html($op_labels[$op] ?? $op); ?></td>
                        <td style="text-align:right;font-family:monospace">
                            <?php echo $s['avg_ms'] > 0 ? esc_html(number_format($s['avg_ms'])) : '<span style="color:#999">—</span>'; ?>
                        </td>
                        <td style="text-align:right;color:#666"><?php echo esc_html($s['sample_count'] ?: '—'); ?></td>
                        <td style="text-align:right;font-weight:bold;color:<?php echo $changed ? '#b32d2e' : '#0a6b0a'; ?>">
                            <?php echo $suggested !== null ? esc_html($suggested) : '<span style="color:#999">—</span>'; ?>
                        </td>
                        <td style="text-align:right"><?php echo esc_html($current); ?></td>
                        <td>
                            <input type="number" name="credit_cost_<?php echo esc_attr($op); ?>"
                                   value="<?php echo esc_attr($suggested ?? $current); ?>"
                                   min="1" style="width:55px">
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <?php submit_button('Apply Credit Costs', 'primary', '', false); ?>
            </form>
            <?php endif; ?>

            <!-- Benchmark button -->
            <form method="post" style="margin-top:16px;padding-top:16px;border-top:1px solid #eee">
                <?php wp_nonce_field('pc_gas_benchmark', 'pc_benchmark_nonce'); ?>
                <?php submit_button('Run GAS Benchmark', 'secondary', '', false); ?>
                <span style="color:#666;font-size:12px;margin-left:8px">Times PERT compute + WP round-trip overhead from GAS. Takes ~2s.</span>
            </form>
            <?php if ($benchmark_result !== null): ?>
            <div style="margin-top:12px;padding:10px;background:#f0f8ff;border:1px solid #cce;font-family:monospace;font-size:12px">
                <?php if (!empty($benchmark_result['ok'])): ?>
                    <strong style="color:#0a6b0a">OK</strong><br>
                    PERT compute (5 tasks): <strong><?php echo esc_html($benchmark_result['slim_compute_ms'] ?? '?'); ?> ms</strong><br>
                    WP round-trip overhead: <strong><?php echo esc_html($benchmark_result['wp_roundtrip_ms'] ?? '?'); ?> ms</strong><br>
                    Total latency (admin→GAS→admin): <strong><?php echo esc_html($benchmark_result['latency_ms'] ?? '?'); ?> ms</strong><br>
                    Daily exec count today: <?php echo esc_html($benchmark_result['daily_exec_count'] ?? '?'); ?>
                <?php else: ?>
                    <strong style="color:#b32d2e">Failed:</strong> <?php echo esc_html($benchmark_result['error'] ?? 'Unknown error'); ?>
                <?php endif; ?>
            </div>
            <?php endif; ?>
        </div>

        <!-- ── Margin dashboard ── -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Gross Margin by Plan
                <?php echo pc_tip('Revenue/credit = (price − Stripe fee) ÷ credits. Cost/credit = monthly infra cost ÷ credits served this month. Set monthly infra cost in Settings.'); ?>
            </h2>
            <?php if ($margin_data['monthly_infra'] <= 0): ?>
                <p style="color:#666">Set <strong>Monthly infrastructure cost</strong> in
                    <a href="<?php echo esc_url(admin_url('admin.php?page=pmc-crm-settings')); ?>">Settings</a>
                    to enable margin calculation.
                </p>
            <?php endif; ?>
            <p style="color:#666;font-size:12px;margin-top:0">
                Month-to-date credits served: <strong><?php echo esc_html(number_format($margin_data['credits_served'])); ?></strong> &nbsp;|&nbsp;
                Infra cost: <strong>$<?php echo esc_html(number_format($margin_data['monthly_infra'], 2)); ?>/mo</strong> &nbsp;|&nbsp;
                Cost/credit: <strong>$<?php echo esc_html($margin_data['cost_per_credit']); ?></strong>
                <?php if ($margin_data['credits_served'] === 0): ?>
                    <span style="color:#b32d2e"> (no credits served yet this month)</span>
                <?php endif; ?>
            </p>
            <table class="widefat" style="max-width:820px">
                <thead>
                    <tr>
                        <th>Plan</th>
                        <th>Tier</th>
                        <th style="text-align:right">Price</th>
                        <th style="text-align:right">Credits</th>
                        <th style="text-align:right">Stripe fee</th>
                        <th style="text-align:right">Net revenue</th>
                        <th style="text-align:right">Rev/credit</th>
                        <th style="text-align:right">Cost/credit</th>
                        <th style="text-align:right">Gross margin</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($margin_data['plans'] as $p):
                    $margin = $p['gross_margin_pct'];
                    $margin_color = $margin === null ? '#999' : ($margin >= 50 ? '#0a6b0a' : ($margin >= 0 ? '#996633' : '#b32d2e'));
                ?>
                <tr>
                    <td><strong><?php echo esc_html($p['label']); ?></strong></td>
                    <td><span style="font-size:11px;background:#f0f0f0;padding:1px 5px;border-radius:3px"><?php echo esc_html($p['gas_tier']); ?></span></td>
                    <td style="text-align:right"><?php echo $p['price'] > 0 ? '$' . esc_html(number_format($p['price'], 2)) : '<span style="color:#666">free</span>'; ?></td>
                    <td style="text-align:right"><?php echo $p['unlimited'] ? '<span style="color:#666">∞</span>' : esc_html(number_format($p['credits'])); ?></td>
                    <td style="text-align:right;color:#666"><?php echo $p['price'] > 0 ? '$' . esc_html($p['stripe_fee']) : '—'; ?></td>
                    <td style="text-align:right"><?php echo $p['price'] > 0 ? '$' . esc_html($p['net_revenue']) : '—'; ?></td>
                    <td style="text-align:right;font-family:monospace"><?php echo (!$p['unlimited'] && $p['rev_per_credit'] > 0) ? '$' . esc_html($p['rev_per_credit']) : '<span style="color:#999">—</span>'; ?></td>
                    <td style="text-align:right;font-family:monospace"><?php echo $margin_data['cost_per_credit'] > 0 ? '$' . esc_html($margin_data['cost_per_credit']) : '<span style="color:#999">—</span>'; ?></td>
                    <td style="text-align:right;font-weight:bold;color:<?php echo esc_attr($margin_color); ?>">
                        <?php echo $margin !== null ? esc_html($margin) . '%' : '—'; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <?php if (!empty($margin_data['plans'])): ?>
            <p style="color:#666;font-size:11px;margin-top:8px">
                Stripe fee = price × 2.9% + $0.30 per transaction. Gross margin = (rev/credit − cost/credit) ÷ rev/credit.
                Cost/credit updates automatically as credits are served each month.
            </p>
            <?php endif; ?>
        </div>

        <!-- ── Quota reference ── -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Quota Reference</h2>
            <table class="widefat" style="max-width:500px">
                <thead><tr><th>Account Type</th><th>Daily Runtime (min)</th><th>URL Fetch / Day</th></tr></thead>
                <tbody>
                    <tr><td>Consumer (personal Gmail)</td><td>90</td><td>20,000</td></tr>
                    <tr><td>Workspace (Google Workspace)</td><td>360</td><td>100,000</td></tr>
                </tbody>
            </table>
            <p style="color:#666;font-size:12px;margin-top:8px">
                Quotas reset daily at midnight Pacific time. Runtime is typically the binding constraint.
                Verify current limits at <code>script.google.com/home/userlimits</code> and update
                <code>pc_gas_quota_limits()</code> in gas.php if they differ.
            </p>
        </div>

        <!-- ── Account type + Ping ── -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px">
            <h2 style="margin-top:0;font-size:15px">Account Type</h2>
            <form method="post">
                <?php wp_nonce_field('pc_gas_account_type', 'pc_gas_type_nonce'); ?>
                <label><input type="radio" name="gas_account_type" value="consumer"  <?php checked($acct, 'consumer'); ?>> Consumer (personal Gmail)</label><br>
                <label><input type="radio" name="gas_account_type" value="workspace" <?php checked($acct, 'workspace'); ?>> Workspace (Google Workspace)</label>
                <br><br>
                <?php submit_button('Save', 'secondary', '', false); ?>
            </form>
        </div>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px">
            <h2 style="margin-top:0;font-size:15px">Ping GAS</h2>
            <form method="post">
                <?php wp_nonce_field('pc_gas_ping', 'pc_ping_nonce'); ?>
                <?php submit_button('Ping GAS Endpoint', 'secondary', '', false); ?>
            </form>
            <?php if ($ping_result !== null): ?>
                <div style="margin-top:12px;padding:10px;background:#f0f8ff;border:1px solid #cce">
                    <strong>Result:</strong> <?php echo $ping_result['ok'] ? '<span style="color:#0a6b0a">OK</span>' : '<span style="color:#b32d2e">FAIL</span>'; ?><br>
                    <strong>Latency:</strong> <?php echo esc_html($ping_result['latency_ms']); ?>ms<br>
                    <?php if ($ping_result['error']): ?>
                        <strong>Error:</strong> <?php echo esc_html($ping_result['error']); ?>
                    <?php endif; ?>
                    <?php if ($ping_result['response']): ?>
                        <strong>Response:</strong> <pre style="font-size:11px;overflow:auto"><?php echo esc_html(wp_json_encode($ping_result['response'], JSON_PRETTY_PRINT)); ?></pre>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </div>
        </div>
    </div>
    <?php
}

/** Internal: render a text quota bar. */
function _pc_gas_bar(float $pct): string {
    $filled = (int) round(min(100, $pct) / 5);
    return str_repeat('█', $filled) . str_repeat('░', 20 - $filled) . '  ' . round($pct, 1) . '%';
}
