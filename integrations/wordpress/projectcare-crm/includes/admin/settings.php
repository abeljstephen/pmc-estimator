<?php
defined('ABSPATH') || exit;

function pc_page_settings(): void {
    if (!current_user_can('manage_options')) return;

    $notice = '';

    if (isset($_POST['pc_save_settings_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pc_save_settings_nonce'])), 'pc_save_settings')) {
            $fields = [
                // API Secrets
                'api_secret'             => 'sanitize_text_field',
                'stripe_hook_secret'     => 'sanitize_text_field',
                'stripe_link'            => 'esc_url_raw',
                // Notifications
                'admin_email'            => 'sanitize_email',
                'notify_new_trial'       => 'absint',
                'notify_new_sub'         => 'absint',
                'notify_webhook_errors'  => 'absint',
                // Rate limits
                'rl_trial_max'           => 'absint',
                'rl_trial_window'        => 'absint',
                'rl_validate_max'        => 'absint',
                'rl_validate_window'     => 'absint',
                'rl_deduct_max'          => 'absint',
                'rl_deduct_window'       => 'absint',
                'rl_session_max'         => 'absint',
                'rl_session_window'      => 'absint',
                'global_rate_limit'      => 'absint',
                // Feature flags
                'trial_paused'           => 'absint',
                'promos_enabled'         => 'absint',
                'sessions_enabled'       => 'absint',
                // GAS
                'gas_account_type'          => 'sanitize_text_field',
                'gas_safe_daily_limit'      => 'absint',
                'gas_endpoint'              => 'esc_url_raw',
                'gas_desired_daily_calls'   => 'absint',
                // Credit costs
                'credit_cost_slim'          => 'absint',
                'credit_cost_baseline_only' => 'absint',
                'credit_cost_full_saco'     => 'absint',
                'credit_cost_saco_explain'  => 'absint',
                // Pricing & margin
                'monthly_infra_cost'        => 'sanitize_text_field',
                // FluentCRM
                'fluentcrm_sync'         => 'absint',
            ];

            foreach ($fields as $key => $sanitizer) {
                $raw = $_POST['pc_' . $key] ?? '';
                if ($sanitizer === 'absint') {
                    $val = isset($_POST['pc_' . $key]) ? 1 : 0;
                    // For numeric fields, use the actual value
                    if (in_array($key, ['rl_trial_max','rl_trial_window','rl_validate_max','rl_validate_window',
                        'rl_deduct_max','rl_deduct_window','rl_session_max','rl_session_window',
                        'global_rate_limit','gas_safe_daily_limit','gas_desired_daily_calls',
                        'credit_cost_slim','credit_cost_baseline_only','credit_cost_full_saco','credit_cost_saco_explain'], true)) {
                        $val = absint($raw);
                    }
                } else {
                    $val = call_user_func($sanitizer, wp_unslash($raw));
                }
                update_option('pc_' . $key, $val);
            }
            $notice = 'Settings saved.';
        }
    }

    $site = get_site_url();
    $has_secret    = pc_secret()      !== '';
    $has_stripe    = pc_stripe_hook() !== '';
    $has_link      = pc_stripe_link() !== 'https://buy.stripe.com/YOUR_LINK';
    $has_email     = pc_admin_email() !== '';
    $has_fluentcrm = pc_fluentcrm_available();
    ?>
    <div class="wrap">
        <h1>ProjectCare CRM Settings</h1>
        <?php if ($notice): ?>
            <div class="notice notice-success is-dismissible"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('pc_save_settings', 'pc_save_settings_nonce'); ?>

            <!-- API Secrets -->
            <h2>API Secrets</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th><label>GAS API Secret <?php echo pc_tip('Secret sent in X-Projectcare-Secret header from GAS to WordPress'); ?></label></th>
                    <td><input type="password" name="pc_api_secret" value="<?php echo esc_attr(pc_secret()); ?>" class="regular-text" autocomplete="off"></td>
                </tr>
                <tr>
                    <th><label>Stripe Webhook Secret <?php echo pc_tip('whsec_... value from Stripe Dashboard webhook settings'); ?></label></th>
                    <td><input type="password" name="pc_stripe_hook_secret" value="<?php echo esc_attr(pc_stripe_hook()); ?>" class="regular-text" autocomplete="off"></td>
                </tr>
                <tr>
                    <th><label>Stripe Payment Link</label></th>
                    <td><input type="url" name="pc_stripe_link" value="<?php echo esc_attr(pc_stripe_link()); ?>" class="regular-text"></td>
                </tr>
                <tr>
                    <th><label>GAS Endpoint URL <?php echo pc_tip('The GAS web app deploy URL used for pings'); ?></label></th>
                    <td><input type="url" name="pc_gas_endpoint" value="<?php echo esc_attr(pc_setting('gas_endpoint')); ?>" class="regular-text"></td>
                </tr>
            </table>

            <!-- Notifications -->
            <h2>Notifications</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th><label>Admin Email</label></th>
                    <td><input type="email" name="pc_admin_email" value="<?php echo esc_attr(pc_admin_email()); ?>" class="regular-text"></td>
                </tr>
                <tr>
                    <th>New trial notification</th>
                    <td><label><input type="checkbox" name="pc_notify_new_trial" value="1" <?php checked(pc_setting('notify_new_trial', '1'), '1'); ?>> Send admin email on new trial</label></td>
                </tr>
                <tr>
                    <th>New subscription notification</th>
                    <td><label><input type="checkbox" name="pc_notify_new_sub" value="1" <?php checked(pc_setting('notify_new_sub', '1'), '1'); ?>> Send admin email on new subscription</label></td>
                </tr>
                <tr>
                    <th>Webhook error alerts</th>
                    <td><label><input type="checkbox" name="pc_notify_webhook_errors" value="1" <?php checked(pc_setting('notify_webhook_errors', '1'), '1'); ?>> Send admin email on webhook errors</label></td>
                </tr>
            </table>

            <!-- Rate Limits -->
            <h2>Rate Limits (per IP)</h2>
            <table class="form-table" role="presentation">
                <?php
                $rl_fields = [
                    ['trial',    'Trial endpoint',    5,  60],
                    ['validate', 'Validate endpoint', 30, 60],
                    ['deduct',   'Deduct endpoint',   30, 60],
                    ['session',  'Session endpoints', 20, 60],
                ];
                foreach ($rl_fields as [$key, $label, $def_max, $def_win]):
                ?>
                <tr>
                    <th><?php echo esc_html($label); ?></th>
                    <td>
                        Max: <input type="number" name="pc_rl_<?php echo esc_attr($key); ?>_max" value="<?php echo esc_attr(pc_setting('rl_' . $key . '_max', (string)$def_max)); ?>" min="1" style="width:60px">
                        requests per
                        <input type="number" name="pc_rl_<?php echo esc_attr($key); ?>_window" value="<?php echo esc_attr(pc_setting('rl_' . $key . '_window', (string)$def_win)); ?>" min="1" style="width:60px"> seconds
                    </td>
                </tr>
                <?php endforeach; ?>
                <tr>
                    <th>Global calls/min (0 = disabled)</th>
                    <td><input type="number" name="pc_global_rate_limit" value="<?php echo esc_attr(pc_setting('global_rate_limit', '0')); ?>" min="0" class="small-text">
                    <?php echo pc_tip('Across all IPs. 0 disables the global limit.'); ?></td>
                </tr>
            </table>

            <!-- Feature Flags -->
            <h2>Feature Flags</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th>Trial issuance</th>
                    <td><label><input type="checkbox" name="pc_trial_paused" value="1" <?php checked(pc_setting('trial_paused'), '1'); ?>>
                        Pause trial issuance (maintenance mode)</label></td>
                </tr>
                <tr>
                    <th>Promo codes</th>
                    <td><label><input type="checkbox" name="pc_promos_enabled" value="1" <?php checked(pc_setting('promos_enabled', '1'), '1'); ?>>
                        Enable promo code redemption</label></td>
                </tr>
                <tr>
                    <th>Session save/load</th>
                    <td><label><input type="checkbox" name="pc_sessions_enabled" value="1" <?php checked(pc_setting('sessions_enabled', '1'), '1'); ?>>
                        Enable session save/load endpoints</label></td>
                </tr>
            </table>

            <!-- GAS Configuration -->
            <h2>GAS Configuration</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th>Account type</th>
                    <td>
                        <label><input type="radio" name="pc_gas_account_type" value="consumer"  <?php checked(pc_gas_account_type(), 'consumer'); ?>> Consumer (personal Gmail)</label>&nbsp;&nbsp;
                        <label><input type="radio" name="pc_gas_account_type" value="workspace" <?php checked(pc_gas_account_type(), 'workspace'); ?>> Workspace (Google Workspace)</label>
                    </td>
                </tr>
                <tr>
                    <th>Safe daily call ceiling</th>
                    <td><input type="number" name="pc_gas_safe_daily_limit" value="<?php echo esc_attr(pc_gas_safe_daily_limit()); ?>" min="1" class="small-text">
                    <?php echo pc_tip('Calls above this threshold trigger headroom warnings on the GAS Status page'); ?></td>
                </tr>
            </table>

            <!-- Credit Costs -->
            <h2>Credit Costs <?php echo pc_tip('Costs deducted per API call type. GAS reads these from /validate on every call — update here, no clasp push needed.'); ?></h2>
            <table class="form-table" role="presentation">
                <?php
                $cost_fields = [
                    ['slim',          'Slim tier (PERT only)',   1, '~2s per call'],
                    ['baseline_only', 'Baseline only',           1, '~2s per call'],
                    ['full_saco',     'Full SACO',               2, '~60–90s per call'],
                    ['saco_explain',  'SACO + Explain',          4, '~120s per call'],
                ];
                foreach ($cost_fields as [$key, $label, $default, $note]):
                ?>
                <tr>
                    <th><label><?php echo esc_html($label); ?></label></th>
                    <td>
                        <input type="number" name="pc_credit_cost_<?php echo esc_attr($key); ?>"
                               value="<?php echo esc_attr(pc_setting('credit_cost_' . $key, (string)$default)); ?>"
                               min="1" style="width:60px"> credits
                        <span style="color:#666;font-size:12px;margin-left:8px"><?php echo esc_html($note); ?></span>
                    </td>
                </tr>
                <?php endforeach; ?>
            </table>

            <!-- Capacity & Pricing -->
            <h2>Capacity & Pricing</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th><label>Desired daily API calls <?php echo pc_tip('Target number of full-tier API calls per day. Used to compute ms_per_credit in the calibration formula.'); ?></label></th>
                    <td><input type="number" name="pc_gas_desired_daily_calls"
                               value="<?php echo esc_attr(pc_setting('gas_desired_daily_calls', '200')); ?>"
                               min="1" class="small-text"> calls/day</td>
                </tr>
                <tr>
                    <th><label>Monthly infrastructure cost ($) <?php echo pc_tip('Total fixed monthly costs: hosting + Google Workspace + domain (amortized). Used to compute gross margin per plan.'); ?></label></th>
                    <td><input type="number" name="pc_monthly_infra_cost" step="0.01"
                               value="<?php echo esc_attr(pc_setting('monthly_infra_cost', '0')); ?>"
                               min="0" class="small-text"> USD/month</td>
                </tr>
            </table>

            <!-- FluentCRM Sync -->
            <h2>FluentCRM Sync</h2>
            <table class="form-table" role="presentation">
                <?php if (!$has_fluentcrm): ?>
                <tr><td colspan="2"><p style="color:#666">FluentCRM is not installed or active. Sync is unavailable.</p></td></tr>
                <?php else: ?>
                <tr>
                    <th>Enable sync</th>
                    <td>
                        <label><input type="checkbox" name="pc_fluentcrm_sync" value="1" <?php checked(pc_setting('fluentcrm_sync', '0'), '1'); ?>>
                            Mirror user events to FluentCRM</label>
                        <p class="description">When enabled, user events are mirrored to FluentCRM for marketing automation.
                        The PMC plugin does not depend on FluentCRM and will work correctly if this is disabled.</p>
                    </td>
                </tr>
                <?php endif; ?>
            </table>

            <?php submit_button('Save Settings'); ?>
        </form>

        <!-- Endpoints reference -->
        <h2>REST Endpoints</h2>
        <table class="widefat" style="max-width:800px">
            <thead><tr><th>Method</th><th>URL</th><th>Auth</th><th>Description</th></tr></thead>
            <tbody>
            <?php
            $endpoints = [
                ['POST', $site . '/wp-json/projectcare/v1/trial',        'X-Projectcare-Secret', 'Issue trial key'],
                ['POST', $site . '/wp-json/projectcare/v1/validate',     'X-Projectcare-Secret', 'Validate API key'],
                ['POST', $site . '/wp-json/projectcare/v1/deduct',       'X-Projectcare-Secret', 'Deduct credits'],
                ['POST', $site . '/wp-json/projectcare/v1/quota',        'X-Projectcare-Secret', 'Get quota'],
                ['POST', $site . '/wp-json/projectcare/v1/stripe',       'Stripe sig',   'Stripe webhook'],
                ['POST', $site . '/wp-json/projectcare/v1/session/save', 'X-Projectcare-Secret', 'Save session'],
                ['POST', $site . '/wp-json/projectcare/v1/session/load', 'X-Projectcare-Secret', 'Load sessions'],
            ];
            foreach ($endpoints as [$m,$u,$a,$d]): ?>
                <tr>
                    <td><code><?php echo esc_html($m); ?></code></td>
                    <td><code style="font-size:11px;word-break:break-all"><?php echo esc_html($u); ?></code></td>
                    <td><?php echo esc_html($a); ?></td>
                    <td><?php echo esc_html($d); ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>

        <!-- Status check -->
        <h2>Status Check</h2>
        <table class="widefat" style="max-width:500px">
            <?php
            $checks = [
                ['GAS Secret set?',      $has_secret],
                ['Stripe Hook set?',     $has_stripe],
                ['Stripe Link set?',     $has_link],
                ['Admin Email set?',     $has_email],
                ['FluentCRM available?', $has_fluentcrm],
            ];
            foreach ($checks as [$label, $ok]): ?>
            <tr>
                <th><?php echo esc_html($label); ?></th>
                <td style="color:<?php echo $ok ? '#0a6b0a' : '#b32d2e'; ?>;font-weight:bold"><?php echo $ok ? 'Yes' : 'No'; ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>
    <?php
}
