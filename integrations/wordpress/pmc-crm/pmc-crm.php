<?php
/**
 * Plugin Name:  PMC Estimator CRM
 * Plugin URI:   https://icarenow.io
 * Description:  Complete API key management, quota tracking, credit system, email automation,
 *               analytics, and GAS monitoring for the PMC Estimator GPT. No external CRM required.
 * Version:      2.3.0
 * Author:       iCareNOW
 * Author URI:   https://icarenow.io
 * License:      Proprietary
 */

defined('ABSPATH') || exit;

define('PMC_CRM_VERSION', '2.3.0');
define('PMC_CRM_DIR',     plugin_dir_path(__FILE__));
define('PMC_CRM_URL',     plugin_dir_url(__FILE__));

// Core includes
require_once PMC_CRM_DIR . 'includes/schema.php';
require_once PMC_CRM_DIR . 'includes/helpers.php';
require_once PMC_CRM_DIR . 'includes/plans.php';
require_once PMC_CRM_DIR . 'includes/users.php';
require_once PMC_CRM_DIR . 'includes/activity.php';
require_once PMC_CRM_DIR . 'includes/rate-limiter.php';
require_once PMC_CRM_DIR . 'includes/emails.php';
require_once PMC_CRM_DIR . 'includes/promo.php';
require_once PMC_CRM_DIR . 'includes/stripe.php';
require_once PMC_CRM_DIR . 'includes/rest-api.php';
require_once PMC_CRM_DIR . 'includes/gas.php';
require_once PMC_CRM_DIR . 'includes/fluentcrm.php';

// Admin includes
if (is_admin()) {
    require_once PMC_CRM_DIR . 'includes/admin/menu.php';
    require_once PMC_CRM_DIR . 'includes/admin/dashboard.php';
    require_once PMC_CRM_DIR . 'includes/admin/users-list.php';
    require_once PMC_CRM_DIR . 'includes/admin/user-detail.php';
    require_once PMC_CRM_DIR . 'includes/admin/activity-log.php';
    require_once PMC_CRM_DIR . 'includes/admin/plans-editor.php';
    require_once PMC_CRM_DIR . 'includes/admin/promo-codes.php';
    require_once PMC_CRM_DIR . 'includes/admin/email-templates.php';
    require_once PMC_CRM_DIR . 'includes/admin/stripe-log.php';
    require_once PMC_CRM_DIR . 'includes/admin/gas-status.php';
    require_once PMC_CRM_DIR . 'includes/admin/settings.php';
    require_once PMC_CRM_DIR . 'includes/admin/tools.php';
    require_once PMC_CRM_DIR . 'includes/admin/bulk-email.php';
    require_once PMC_CRM_DIR . 'includes/admin/help.php';
}

register_activation_hook(__FILE__, 'pmc_activate');
function pmc_activate(): void {
    pmc_create_tables();
    pmc_seed_plans();
    pmc_seed_email_templates();
    update_option('pmc_crm_db_version', PMC_CRM_VERSION);
    pmc_schedule_crons();
}

register_deactivation_hook(__FILE__, 'pmc_deactivate');
function pmc_deactivate(): void {
    wp_clear_scheduled_hook('pmc_expire_keys_cron');
    wp_clear_scheduled_hook('pmc_daily_digest_cron');
    wp_clear_scheduled_hook('pmc_auto_rotate_cron');
    wp_clear_scheduled_hook('pmc_plot_cleanup_cron');
}

// ── UPGRADE PATH ──────────────────────────────────────────────────────────────
// Runs on every page load — cheap version_compare guard ensures it only does
// real work when the stored DB version is behind the plugin version.
// Handles FTP/SFTP uploads that bypass the activation hook.
add_action('plugins_loaded', 'pmc_maybe_upgrade');
function pmc_maybe_upgrade(): void {
    $stored = get_option('pmc_crm_db_version', '0.0.0');
    if (version_compare($stored, PMC_CRM_VERSION, '<')) {
        pmc_create_tables();
        pmc_seed_plans();
        pmc_seed_email_templates();
        update_option('pmc_crm_db_version', PMC_CRM_VERSION);
        pmc_schedule_crons();
    }
}

// ── CRON REGISTRATION ─────────────────────────────────────────────────────────
function pmc_schedule_crons(): void {
    if (!wp_next_scheduled('pmc_expire_keys_cron')) {
        wp_schedule_event(time(), 'hourly', 'pmc_expire_keys_cron');
    }
    if (!wp_next_scheduled('pmc_daily_digest_cron')) {
        wp_schedule_event(strtotime('tomorrow midnight'), 'daily', 'pmc_daily_digest_cron');
    }
    if (!wp_next_scheduled('pmc_auto_rotate_cron')) {
        wp_schedule_event(time(), 'hourly', 'pmc_auto_rotate_cron');
    }
    if (!wp_next_scheduled('pmc_plot_cleanup_cron')) {
        wp_schedule_event(strtotime('tomorrow midnight'), 'daily', 'pmc_plot_cleanup_cron');
    }
}

// ── KEY EXPIRY CRON ───────────────────────────────────────────────────────────
// Runs hourly — marks any key past its expiry date as 'expired'.
// Lazy expiry also happens on validate, but this keeps the DB clean proactively.
add_action('pmc_expire_keys_cron', 'pmc_run_expire_keys');
function pmc_run_expire_keys(): void {
    global $wpdb;
    $table   = $wpdb->prefix . 'pmc_users';
    $updated = $wpdb->query($wpdb->prepare(
        "UPDATE `{$table}` SET key_status = 'expired', updated_at = NOW()
         WHERE key_status = 'active'
           AND key_expires IS NOT NULL
           AND key_expires < %s",
        current_time('Y-m-d')
    ));
    if ($updated > 0) {
        error_log('[PMC CRM] Expired ' . $updated . ' key(s) via hourly cron');
    }
}

// ── AUTO-ROTATE KEYS CRON ─────────────────────────────────────────────────────
// Runs hourly — for users with auto_rotate_key=1 expiring today,
// generates a new key, emails it, and resets expiry for 35 more days.
add_action('pmc_auto_rotate_cron', 'pmc_run_auto_rotate_keys');
function pmc_run_auto_rotate_keys(): void {
    global $wpdb;
    $table = $wpdb->prefix . 'pmc_users';
    $today = current_time('Y-m-d');

    $candidates = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM `{$table}` WHERE auto_rotate_key=1 AND key_status='active'
         AND key_expires IS NOT NULL AND key_expires <= %s",
        $today
    )) ?: [];

    foreach ($candidates as $user) {
        $new_key  = bin2hex(random_bytes(32));
        $new_exp  = date('Y-m-d', strtotime('+35 days'));
        pmc_revoke_user_keys((int) $user->id, 'superseded', 'auto-rotate on expiry');
        pmc_update_user((int) $user->id, [
            'api_key'    => $new_key,
            'key_expires'=> $new_exp,
            'key_status' => 'active',
            'credits_used' => 0,
        ]);
        pmc_create_api_key((int) $user->id, $user->email, $new_key, 'auto-rotate on expiry');
        pmc_send_email($user->email, 'key_regen', [
            'email'  => $user->email,
            'key'    => $new_key,
            'plan'   => $user->plan,
            'expiry' => $new_exp,
        ]);
        pmc_log_activity(['user_id' => (int) $user->id, 'email' => $user->email,
            'action' => 'key_regen', 'result' => 'success',
            'notes'  => 'Auto-rotated key on expiry. New expiry: ' . $new_exp]);
        error_log('[PMC CRM] Auto-rotated key for ' . $user->email);
    }
}

// ── PLOT DATA CLEANUP CRON ────────────────────────────────────────────────────
// Runs daily — deletes plot_data rows older than 7 days (tokens are conversation-scoped).
add_action('pmc_plot_cleanup_cron', 'pmc_run_plot_cleanup');
function pmc_run_plot_cleanup(): void {
    global $wpdb;
    $table   = $wpdb->prefix . 'pmc_plot_data';
    $deleted = $wpdb->query(
        "DELETE FROM `{$table}` WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    if ($deleted > 0) {
        error_log('[PMC CRM] Cleaned up ' . $deleted . ' expired plot_data row(s)');
    }
}

// ── DAILY DIGEST CRON ─────────────────────────────────────────────────────────
// Fires at midnight — sends admin summary of yesterday's activity if enabled.
add_action('pmc_daily_digest_cron', 'pmc_run_daily_digest');
function pmc_run_daily_digest(): void {
    if (pmc_setting('daily_digest', '0') !== '1') return;

    $yesterday = date('Y-m-d', strtotime('yesterday'));
    $data      = pmc_get_calls_in_window($yesterday, $yesterday);
    $active    = pmc_get_user_count('active');
    $total     = pmc_get_user_count();

    $subject = 'PMC CRM Daily Digest — ' . date('M j, Y', strtotime('yesterday'));
    $message = "PMC Estimator — Daily Summary for " . date('M j, Y', strtotime('yesterday')) . "\n\n"
        . "API Calls:       " . ($data['total_calls']     ?? 0) . "\n"
        . "Credits Used:    " . ($data['credits_consumed'] ?? 0) . "\n"
        . "Unique Users:    " . ($data['unique_users']    ?? 0) . "\n"
        . "Avg Duration:    " . round(($data['avg_duration_ms'] ?? 0) / 1000, 2) . "s\n"
        . "Failed Calls:    " . ($data['failed_calls']    ?? 0) . "\n\n"
        . "Total Users:     " . $total . "\n"
        . "Active Keys:     " . $active . "\n\n"
        . "— PMC CRM v" . PMC_CRM_VERSION;

    pmc_send_admin_email($subject, $message);
}
