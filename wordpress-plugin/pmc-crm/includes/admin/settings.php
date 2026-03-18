<?php
defined('ABSPATH') || exit;

function pmc_page_settings(): void {
    if (!current_user_can('manage_options')) return;

    $notice = '';

    if (isset($_POST['pmc_save_settings_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pmc_save_settings_nonce'])), 'pmc_save_settings')) {
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
                'gas_account_type'       => 'sanitize_text_field',
                'gas_safe_daily_limit'   => 'absint',
                'gas_endpoint'           => 'esc_url_raw',
                // FluentCRM
                'fluentcrm_sync'         => 'absint',
            ];

            foreach ($fields as $key => $sanitizer) {
                $raw = $_POST['pmc_' . $key] ?? '';
                if ($sanitizer === 'absint') {
                    $val = isset($_POST['pmc_' . $key]) ? 1 : 0;
                    // For numeric fields, use the actual value
                    if (in_array($key, ['rl_trial_max','rl_trial_window','rl_validate_max','rl_validate_window',
                        'rl_deduct_max','rl_deduct_window','rl_session_max','rl_session_window',
                        'global_rate_limit','gas_safe_daily_limit'], true)) {
                        $val = absint($raw);
                    }
                } else {
                    $val = call_user_func($sanitizer, wp_unslash($raw));
                }
                update_option('pmc_' . $key, $val);
            }
            $notice = 'Settings saved.';
        }
    }

    $site = get_site_url();
    $has_secret    = pmc_secret()      !== '';
    $has_stripe    = pmc_stripe_hook() !== '';
    $has_link      = pmc_stripe_link() !== 'https://buy.stripe.com/YOUR_LINK';
    $has_email     = pmc_admin_email() !== '';
    $has_fluentcrm = pmc_fluentcrm_available();
    ?>
    <div class="wrap">
        <h1>PMC CRM Settings</h1>
        <?php if ($notice): ?>
            <div class="notice notice-success is-dismissible"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('pmc_save_settings', 'pmc_save_settings_nonce'); ?>

            <!-- API Secrets -->
            <h2>API Secrets</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th><label>GAS API Secret <?php echo pmc_tip('Secret sent in X-PMC-Secret header from GAS to WordPress'); ?></label></th>
                    <td><input type="password" name="pmc_api_secret" value="<?php echo esc_attr(pmc_secret()); ?>" class="regular-text" autocomplete="off"></td>
                </tr>
                <tr>
                    <th><label>Stripe Webhook Secret <?php echo pmc_tip('whsec_... value from Stripe Dashboard webhook settings'); ?></label></th>
                    <td><input type="password" name="pmc_stripe_hook_secret" value="<?php echo esc_attr(pmc_stripe_hook()); ?>" class="regular-text" autocomplete="off"></td>
                </tr>
                <tr>
                    <th><label>Stripe Payment Link</label></th>
                    <td><input type="url" name="pmc_stripe_link" value="<?php echo esc_attr(pmc_stripe_link()); ?>" class="regular-text"></td>
                </tr>
                <tr>
                    <th><label>GAS Endpoint URL <?php echo pmc_tip('The GAS web app deploy URL used for pings'); ?></label></th>
                    <td><input type="url" name="pmc_gas_endpoint" value="<?php echo esc_attr(pmc_setting('gas_endpoint')); ?>" class="regular-text"></td>
                </tr>
            </table>

            <!-- Notifications -->
            <h2>Notifications</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th><label>Admin Email</label></th>
                    <td><input type="email" name="pmc_admin_email" value="<?php echo esc_attr(pmc_admin_email()); ?>" class="regular-text"></td>
                </tr>
                <tr>
                    <th>New trial notification</th>
                    <td><label><input type="checkbox" name="pmc_notify_new_trial" value="1" <?php checked(pmc_setting('notify_new_trial', '1'), '1'); ?>> Send admin email on new trial</label></td>
                </tr>
                <tr>
                    <th>New subscription notification</th>
                    <td><label><input type="checkbox" name="pmc_notify_new_sub" value="1" <?php checked(pmc_setting('notify_new_sub', '1'), '1'); ?>> Send admin email on new subscription</label></td>
                </tr>
                <tr>
                    <th>Webhook error alerts</th>
                    <td><label><input type="checkbox" name="pmc_notify_webhook_errors" value="1" <?php checked(pmc_setting('notify_webhook_errors', '1'), '1'); ?>> Send admin email on webhook errors</label></td>
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
                        Max: <input type="number" name="pmc_rl_<?php echo esc_attr($key); ?>_max" value="<?php echo esc_attr(pmc_setting('rl_' . $key . '_max', (string)$def_max)); ?>" min="1" style="width:60px">
                        requests per
                        <input type="number" name="pmc_rl_<?php echo esc_attr($key); ?>_window" value="<?php echo esc_attr(pmc_setting('rl_' . $key . '_window', (string)$def_win)); ?>" min="1" style="width:60px"> seconds
                    </td>
                </tr>
                <?php endforeach; ?>
                <tr>
                    <th>Global calls/min (0 = disabled)</th>
                    <td><input type="number" name="pmc_global_rate_limit" value="<?php echo esc_attr(pmc_setting('global_rate_limit', '0')); ?>" min="0" class="small-text">
                    <?php echo pmc_tip('Across all IPs. 0 disables the global limit.'); ?></td>
                </tr>
            </table>

            <!-- Feature Flags -->
            <h2>Feature Flags</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th>Trial issuance</th>
                    <td><label><input type="checkbox" name="pmc_trial_paused" value="1" <?php checked(pmc_setting('trial_paused'), '1'); ?>>
                        Pause trial issuance (maintenance mode)</label></td>
                </tr>
                <tr>
                    <th>Promo codes</th>
                    <td><label><input type="checkbox" name="pmc_promos_enabled" value="1" <?php checked(pmc_setting('promos_enabled', '1'), '1'); ?>>
                        Enable promo code redemption</label></td>
                </tr>
                <tr>
                    <th>Session save/load</th>
                    <td><label><input type="checkbox" name="pmc_sessions_enabled" value="1" <?php checked(pmc_setting('sessions_enabled', '1'), '1'); ?>>
                        Enable session save/load endpoints</label></td>
                </tr>
            </table>

            <!-- GAS Configuration -->
            <h2>GAS Configuration</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th>Account type</th>
                    <td>
                        <label><input type="radio" name="pmc_gas_account_type" value="consumer"  <?php checked(pmc_gas_account_type(), 'consumer'); ?>> Consumer (personal Gmail)</label>&nbsp;&nbsp;
                        <label><input type="radio" name="pmc_gas_account_type" value="workspace" <?php checked(pmc_gas_account_type(), 'workspace'); ?>> Workspace (Google Workspace)</label>
                    </td>
                </tr>
                <tr>
                    <th>Safe daily call ceiling</th>
                    <td><input type="number" name="pmc_gas_safe_daily_limit" value="<?php echo esc_attr(pmc_gas_safe_daily_limit()); ?>" min="1" class="small-text">
                    <?php echo pmc_tip('Calls above this threshold trigger headroom warnings on the GAS Status page'); ?></td>
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
                        <label><input type="checkbox" name="pmc_fluentcrm_sync" value="1" <?php checked(pmc_setting('fluentcrm_sync', '0'), '1'); ?>>
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
                ['POST', $site . '/wp-json/pmc/v1/trial',        'X-PMC-Secret', 'Issue trial key'],
                ['POST', $site . '/wp-json/pmc/v1/validate',     'X-PMC-Secret', 'Validate API key'],
                ['POST', $site . '/wp-json/pmc/v1/deduct',       'X-PMC-Secret', 'Deduct credits'],
                ['POST', $site . '/wp-json/pmc/v1/quota',        'X-PMC-Secret', 'Get quota'],
                ['POST', $site . '/wp-json/pmc/v1/stripe',       'Stripe sig',   'Stripe webhook'],
                ['POST', $site . '/wp-json/pmc/v1/session/save', 'X-PMC-Secret', 'Save session'],
                ['POST', $site . '/wp-json/pmc/v1/session/load', 'X-PMC-Secret', 'Load sessions'],
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
