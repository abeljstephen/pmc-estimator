<?php
defined('ABSPATH') || exit;

function pmc_page_emails(): void {
    if (!current_user_can('manage_options')) return;

    global $wpdb;
    $table  = $wpdb->prefix . 'pmc_email_templates';
    $notice = '';

    // Preview
    if (isset($_GET['preview'])) {
        $slug = sanitize_text_field($_GET['preview']);
        $dummy = ['email' => 'user@example.com', 'key' => 'abc123def456', 'plan' => 'Professional',
            'credits' => '55', 'expiry' => date('Y-m-d', strtotime('+35 days')),
            'upgrade_url' => pmc_stripe_link(), 'credits_remaining' => '42', 'credits_total' => '55',
            'site_name' => get_bloginfo('name')];
        [,$body] = pmc_render_template($slug, $dummy);
        echo wp_kses_post($body);
        exit;
    }

    // Save template
    if (isset($_POST['pmc_save_tpl_nonce'])) {
        $slug = sanitize_text_field($_POST['template_slug'] ?? '');
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pmc_save_tpl_nonce'])), 'pmc_save_template_' . $slug)) {
            $db_result = $wpdb->update($table, [
                'subject'   => sanitize_text_field($_POST['tpl_subject']   ?? ''),
                'body_html' => wp_kses_post($_POST['tpl_body_html'] ?? ''),
                'is_active' => isset($_POST['tpl_active']) ? 1 : 0,
            ], ['slug' => $slug]);
            if (false === $db_result) {
                error_log('pmc_save_template: DB update failed for slug=' . $slug);
            }
            $notice = 'Template "' . $slug . '" saved.';
        }
    }

    // Toggle active
    if (isset($_POST['pmc_toggle_tpl_nonce'], $_POST['toggle_slug'])) {
        $slug = sanitize_text_field($_POST['toggle_slug']);
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pmc_toggle_tpl_nonce'])), 'pmc_toggle_template_' . $slug)) {
            $current   = (int) $wpdb->get_var($wpdb->prepare("SELECT is_active FROM `{$table}` WHERE slug=%s", $slug));
            $db_result = $wpdb->update($table, ['is_active' => $current ? 0 : 1], ['slug' => $slug]);
            if (false === $db_result) {
                error_log('pmc_toggle_template: DB update failed for slug=' . $slug);
            }
            $notice = 'Template "' . $slug . '" ' . ($current ? 'deactivated' : 'activated') . '.';
        }
    }

    // Reset to default
    if (isset($_POST['pmc_reset_tpl_nonce'], $_POST['reset_slug'])) {
        $slug = sanitize_text_field($_POST['reset_slug']);
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pmc_reset_tpl_nonce'])), 'pmc_reset_template_' . $slug)) {
            $db_result = $wpdb->delete($table, ['slug' => $slug]);
            if (false === $db_result) {
                error_log('pmc_reset_template: DB delete failed for slug=' . $slug);
            }
            pmc_seed_email_templates(); // re-seeds only missing slugs
            $notice = 'Template "' . $slug . '" reset to default.';
        }
    }

    $templates = $wpdb->get_results("SELECT * FROM `{$table}` ORDER BY slug") ?: [];

    $vars_ref = [
        '{{email}}'             => 'User email address',
        '{{key}}'               => 'API key',
        '{{plan}}'              => 'Plan name (e.g. Professional)',
        '{{credits}}'           => 'Credits (total for new key, or remaining)',
        '{{expiry}}'            => 'Key expiry date (YYYY-MM-DD)',
        '{{upgrade_url}}'       => 'Stripe payment link',
        '{{credits_remaining}}' => 'Remaining credits (total - used)',
        '{{credits_total}}'     => 'Total credits on the plan',
        '{{site_name}}'         => 'WordPress site name',
    ];
    ?>
    <div class="wrap">
        <h1>Email Templates</h1>
        <?php if ($notice): ?>
            <div class="notice notice-success is-dismissible"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <div style="display:grid;grid-template-columns:1fr 260px;gap:20px">
        <div>
        <?php foreach ($templates as $tpl): ?>
            <details style="background:#fff;border:1px solid #ddd;border-radius:6px;margin-bottom:12px">
                <summary style="padding:12px 16px;cursor:pointer;font-weight:bold;display:flex;justify-content:space-between;align-items:center">
                    <span><?php echo esc_html($tpl->label . ' (' . $tpl->slug . ')'); ?></span>
                    <span style="color:<?php echo (int)$tpl->is_active ? '#0a6b0a' : '#b32d2e'; ?>;font-size:12px;font-weight:normal">
                        <?php echo (int)$tpl->is_active ? 'Active' : 'Inactive'; ?>
                    </span>
                </summary>
                <div style="padding:12px 16px">
                    <form method="post">
                        <?php wp_nonce_field('pmc_save_template_' . $tpl->slug, 'pmc_save_tpl_nonce'); ?>
                        <input type="hidden" name="template_slug" value="<?php echo esc_attr($tpl->slug); ?>">
                        <p>
                            <label>
                                <input type="checkbox" name="tpl_active" value="1" <?php checked((int)$tpl->is_active, 1); ?>>
                                Active
                            </label>
                        </p>
                        <p>
                            <label>Subject<br>
                                <input type="text" name="tpl_subject" value="<?php echo esc_attr($tpl->subject); ?>" class="widefat">
                            </label>
                        </p>
                        <p>
                            <label>Body HTML<br>
                                <textarea name="tpl_body_html" rows="20" class="widefat" style="font-family:monospace;font-size:12px"><?php echo esc_textarea($tpl->body_html ?? ''); ?></textarea>
                            </label>
                        </p>
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <?php submit_button('Save Template', 'primary', '', false); ?>
                            <a href="<?php echo esc_url(add_query_arg(['preview' => $tpl->slug], admin_url('admin.php?page=pmc-crm-emails'))); ?>"
                               target="_blank" class="button">Preview</a>
                        </div>
                    </form>
                    <form method="post" style="display:inline;margin-top:8px">
                        <?php wp_nonce_field('pmc_toggle_template_' . $tpl->slug, 'pmc_toggle_tpl_nonce'); ?>
                        <input type="hidden" name="toggle_slug" value="<?php echo esc_attr($tpl->slug); ?>">
                        <button type="submit" class="button button-small"><?php echo (int)$tpl->is_active ? 'Deactivate' : 'Activate'; ?></button>
                    </form>
                    <form method="post" style="display:inline;margin-left:8px">
                        <?php wp_nonce_field('pmc_reset_template_' . $tpl->slug, 'pmc_reset_tpl_nonce'); ?>
                        <input type="hidden" name="reset_slug" value="<?php echo esc_attr($tpl->slug); ?>">
                        <button type="submit" class="button button-small" onclick="return confirm('Reset to default? Current edits will be lost.')">Reset to Default</button>
                    </form>
                </div>
            </details>
        <?php endforeach; ?>
        </div>

        <!-- Variables reference sidebar -->
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;height:fit-content;position:sticky;top:32px">
            <h3 style="margin-top:0">Variable Reference</h3>
            <dl style="font-size:12px">
                <?php foreach ($vars_ref as $var => $desc): ?>
                    <dt style="font-family:monospace;color:#2271b1;margin-top:8px"><?php echo esc_html($var); ?></dt>
                    <dd style="margin-left:8px;color:#444"><?php echo esc_html($desc); ?></dd>
                <?php endforeach; ?>
            </dl>
        </div>
        </div>
    </div>
    <?php
}
