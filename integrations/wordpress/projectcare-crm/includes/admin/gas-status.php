<?php
defined('ABSPATH') || exit;

function pmc_page_gas(): void {
    if (!current_user_can('manage_options')) return;

    $notice = '';

    // Ping action
    $ping_result = null;
    if (isset($_POST['pmc_ping_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pmc_ping_nonce'])), 'pmc_gas_ping')) {
            $ping_result = pmc_gas_ping();
        }
    }

    // Account type save
    if (isset($_POST['pmc_gas_type_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pmc_gas_type_nonce'])), 'pmc_gas_account_type')) {
            update_option('pmc_gas_account_type', sanitize_text_field($_POST['gas_account_type'] ?? 'consumer'));
            $notice = 'GAS account type saved.';
        }
    }

    $window   = sanitize_text_field($_GET['window'] ?? 'today');
    $valid_windows = ['today', 'month', '3mo', '6mo', '9mo', 'year'];
    if (!in_array($window, $valid_windows, true)) $window = 'today';

    $all_data = pmc_gas_quota_windows();
    $data     = $all_data[$window] ?? $all_data['today'];
    $limits   = pmc_gas_quota_limits();
    $acct     = pmc_gas_account_type();
    $limit    = $limits[$acct];
    $safe_limit = pmc_gas_safe_daily_limit();

    // Compute runtime % used
    $daily_runtime_ms   = $data['total_duration_ms'];
    if ($window !== 'today' && $data['days_in_window'] > 0) {
        $daily_runtime_ms = $data['total_duration_ms'] / $data['days_in_window'];
    }
    $daily_runtime_min  = $daily_runtime_ms / 60000;
    $runtime_pct        = $limit['daily_min'] > 0 ? min(100, round($daily_runtime_min / $limit['daily_min'] * 100, 1)) : 0;

    // URL Fetch — treat each call as 1 fetch (approximate)
    $total_calls    = $data['total_calls'];
    $daily_calls    = $window === 'today' ? $total_calls : ($data['daily_avg_calls'] ?? 0);
    $url_fetch_pct  = $limit['url_fetch'] > 0 ? min(100, round($daily_calls / $limit['url_fetch'] * 100, 1)) : 0;

    $bar_runtime = _pmc_gas_bar($runtime_pct);
    $bar_fetch   = _pmc_gas_bar($url_fetch_pct);

    // Chart data
    $stats     = pmc_get_daily_stats($window === 'today' ? 1 : ($window === 'month' ? 30 : ($window === '3mo' ? 90 : ($window === '6mo' ? 180 : ($window === '9mo' ? 270 : 365)))));
    $chart_labels = array_column($stats, 'date');
    $chart_calls  = array_column($stats, 'calls');

    $base_url = admin_url('admin.php?page=pmc-crm-gas');
    ?>
    <div class="wrap">
        <h1>GAS Quota Status</h1>
        <?php if ($notice): ?>
            <div class="notice notice-success is-dismissible"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <!-- Tab strip -->
        <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid #ddd;padding-bottom:0">
            <?php foreach (['today' => 'Today','month' => 'This Month','3mo' => '3 Months','6mo' => '6 Months','9mo' => '9 Months','year' => '1 Year'] as $wk => $wl): ?>
                <a href="<?php echo esc_url(add_query_arg('window', $wk, $base_url)); ?>"
                   style="padding:8px 16px;text-decoration:none;border:1px solid #ddd;border-bottom:none;border-radius:4px 4px 0 0;<?php echo $window === $wk ? 'background:#fff;font-weight:bold;color:#2271b1' : 'background:#f0f0f0;color:#444'; ?>">
                    <?php echo esc_html($wl); ?>
                </a>
            <?php endforeach; ?>
        </div>

        <!-- Quota bars -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px;font-family:monospace">
            <h2 style="margin-top:0;font-size:15px;font-family:sans-serif">Quota Usage</h2>
            <p>Runtime used: <strong><?php echo esc_html($bar_runtime); ?></strong>
               <?php echo esc_html(round($daily_runtime_min, 1) . ' min / ' . $limit['daily_min'] . ' min daily limit'); ?></p>
            <p>URL Fetch:    <strong><?php echo esc_html($bar_fetch); ?></strong>
               <?php echo esc_html(number_format((int)$daily_calls) . ' / ' . number_format($limit['url_fetch']) . ' per day avg'); ?></p>
        </div>

        <!-- Metrics table -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Metrics — <?php echo esc_html($all_data[$window]['label'] ?? $window); ?></h2>
            <table class="widefat" style="max-width:600px">
                <tr><th>Total Calls</th>         <td><?php echo esc_html(number_format($data['total_calls'])); ?></td></tr>
                <tr><th>Total Runtime</th>        <td><?php echo esc_html(round($data['total_duration_ms'] / 60000, 1)); ?> min</td></tr>
                <tr><th>Avg Call Duration</th>    <td><?php echo esc_html(round($data['avg_duration_ms'])); ?> ms</td></tr>
                <tr><th>Failed Calls</th>         <td><?php echo esc_html($data['failed_calls']); ?></td></tr>
                <tr><th>Failure Rate</th>         <td><?php echo $data['total_calls'] > 0 ? esc_html(round($data['failed_calls'] / $data['total_calls'] * 100, 1)) . '%' : '—'; ?></td></tr>
                <tr><th>Unique Users</th>         <td><?php echo esc_html($data['unique_users']); ?></td></tr>
                <tr><th>Credits Consumed</th>     <td><?php echo esc_html(number_format($data['credits_consumed'])); ?></td></tr>
                <tr><th>Peak Day</th>             <td><?php echo esc_html($data['peak_day'] . ' (' . $data['peak_day_count'] . ' calls)'); ?></td></tr>
                <?php if (isset($data['calls_by_hour'])): ?>
                <tr><th>Peak Hour</th>            <td><?php
                    $peak_hr = 0; $peak_hr_cnt = 0;
                    foreach ($data['calls_by_hour'] as $hr => $cnt) { if ($cnt > $peak_hr_cnt) { $peak_hr = $hr; $peak_hr_cnt = $cnt; } }
                    echo esc_html($peak_hr . ':00 (' . $peak_hr_cnt . ' calls)');
                ?></td></tr>
                <?php endif; ?>
            </table>
        </div>

        <!-- Projection (not for Today) -->
        <?php if ($window !== 'today' && ($data['remaining_days'] ?? 0) > 0): ?>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Projection</h2>
            <?php
            $headroom_ok  = $data['daily_avg_calls'] < $safe_limit;
            $headroom_pct = $safe_limit > 0 ? round($data['daily_avg_calls'] / $safe_limit * 100, 1) : 0;
            ?>
            <table class="widefat" style="max-width:500px;font-family:monospace">
                <tr><th>Avg calls/day</th>       <td><?php echo esc_html($data['daily_avg_calls']); ?></td></tr>
                <tr><th>Days remaining</th>       <td><?php echo esc_html($data['remaining_days']); ?></td></tr>
                <tr><th>Projected total</th>      <td><?php echo esc_html(number_format($data['projected_total'])); ?> calls</td></tr>
                <tr><th>Projected runtime/day</th><td><?php echo esc_html($data['projected_runtime_min']); ?> min/day average</td></tr>
                <tr><th>Headroom</th>             <td style="color:<?php echo $headroom_ok ? '#0a6b0a' : '#b32d2e'; ?>;font-weight:bold">
                    <?php echo $headroom_ok ? 'HEALTHY' : 'WARNING'; ?> (safe limit: <?php echo esc_html(number_format($safe_limit)); ?>/day, using <?php echo esc_html($headroom_pct); ?>%)
                </td></tr>
            </table>
        </div>
        <?php endif; ?>

        <!-- Chart -->
        <?php if (!empty($chart_labels)): ?>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Call Volume Chart</h2>
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
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Calls',
                            data: calls,
                            backgroundColor: 'rgba(34, 113, 177, 0.6)',
                            borderColor: 'rgba(34, 113, 177, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        annotation: {},
                        legend: { position: 'top' }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        })();
        </script>
        <?php endif; ?>

        <!-- Top 5 users -->
        <?php if (!empty($data['top_users'])): ?>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Top 5 Users in Window</h2>
            <table class="widefat" style="max-width:500px">
                <thead><tr><th>Email</th><th>Calls</th></tr></thead>
                <tbody>
                <?php foreach ($data['top_users'] as $em => $cnt): ?>
                    <tr><td><?php echo esc_html($em); ?></td><td><?php echo esc_html($cnt); ?></td></tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>

        <!-- Quota reference -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px">
            <h2 style="margin-top:0;font-size:15px">Quota Reference</h2>
            <table class="widefat" style="max-width:500px">
                <thead><tr><th>Account Type</th><th>Daily Runtime (min)</th><th>URL Fetch / Day</th></tr></thead>
                <tbody>
                    <tr><td>Consumer (personal Gmail)</td><td>90</td><td>20,000</td></tr>
                    <tr><td>Workspace (Google Workspace)</td><td>360</td><td>100,000</td></tr>
                </tbody>
            </table>
            <p style="color:#666;font-size:12px;margin-top:8px">Quotas reset daily at midnight Pacific time (Google standard). Runtime is typically the binding constraint.</p>
        </div>

        <!-- Account type selector + Ping -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px">
            <h2 style="margin-top:0;font-size:15px">Account Type</h2>
            <form method="post">
                <?php wp_nonce_field('pmc_gas_account_type', 'pmc_gas_type_nonce'); ?>
                <label><input type="radio" name="gas_account_type" value="consumer"  <?php checked($acct, 'consumer'); ?>> Consumer (personal Gmail)</label><br>
                <label><input type="radio" name="gas_account_type" value="workspace" <?php checked($acct, 'workspace'); ?>> Workspace (Google Workspace)</label>
                <br><br>
                <?php submit_button('Save', 'secondary', '', false); ?>
            </form>
        </div>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px">
            <h2 style="margin-top:0;font-size:15px">Ping GAS</h2>
            <form method="post">
                <?php wp_nonce_field('pmc_gas_ping', 'pmc_ping_nonce'); ?>
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
function _pmc_gas_bar(float $pct): string {
    $filled = (int) round(min(100, $pct) / 5);
    return str_repeat('█', $filled) . str_repeat('░', 20 - $filled) . '  ' . round($pct, 1) . '%';
}
