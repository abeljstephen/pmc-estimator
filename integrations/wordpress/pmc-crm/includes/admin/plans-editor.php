<?php
defined('ABSPATH') || exit;

function pmc_page_plans(): void {
    if (!current_user_can('manage_options')) return;

    $notice = '';

    if (isset($_POST['pmc_save_plans_nonce'])) {
        if (wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['pmc_save_plans_nonce'])), 'pmc_save_plans')) {
            global $wpdb;
            $table = $wpdb->prefix . 'pmc_plans';

            $slugs   = array_map('sanitize_text_field', (array) ($_POST['plan_slug']          ?? []));
            $labels  = array_map('sanitize_text_field', (array) ($_POST['plan_label']         ?? []));
            $credits = array_map('intval',               (array) ($_POST['plan_credits']       ?? []));
            $days    = array_map('intval',               (array) ($_POST['plan_days']          ?? []));
            $prices  = array_map('floatval',             (array) ($_POST['plan_price_dollars'] ?? []));
            $orders  = array_map('intval',               (array) ($_POST['plan_order']         ?? []));
            $active  = (array) ($_POST['plan_active'] ?? []);
            $ids     = array_map('intval',               (array) ($_POST['plan_id']            ?? []));

            foreach ($slugs as $i => $slug) {
                if (empty($slug)) continue;
                $data = [
                    'slug'            => $slug,
                    'label'           => $labels[$i]  ?? $slug,
                    'credits'         => $credits[$i] ?? 0,
                    'days'            => $days[$i]    ?? 35,
                    'price_min_cents' => (int) round(($prices[$i] ?? 0) * 100),
                    'is_active'       => in_array($i, array_keys($active)) ? 1 : 0,
                    'display_order'   => $orders[$i]  ?? $i,
                ];
                $plan_id = (int) ($ids[$i] ?? 0);
                if ($plan_id > 0) {
                    $db_result = $wpdb->update($table, $data, ['id' => $plan_id]);
                } else {
                    $db_result = $wpdb->insert($table, $data);
                }
                if (false === $db_result) {
                    error_log('pmc plans-editor: DB error saving plan slug=' . $slug);
                }
            }
            $notice = 'Plans saved.';
        }
    }

    $plans = pmc_get_plans();
    ?>
    <div class="wrap">
        <h1>Plans Editor</h1>
        <?php if ($notice): ?>
            <div class="notice notice-success is-dismissible"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <p style="color:#666">
            <strong>price_min_cents</strong> is the minimum Stripe payment (in dollars) that maps to this plan.
            When a Stripe checkout completes, the payment amount is compared against plans highest-first to determine which plan to assign.
        </p>

        <form method="post">
            <?php wp_nonce_field('pmc_save_plans', 'pmc_save_plans_nonce'); ?>
            <table class="widefat" style="margin-bottom:16px">
                <thead>
                    <tr>
                        <th>Slug</th><th>Label</th><th>Credits</th><th>Days</th>
                        <th>Min Price ($)</th><th>Active</th><th>Display Order</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($plans as $i => $p): ?>
                    <tr>
                        <td>
                            <input type="hidden" name="plan_id[]" value="<?php echo esc_attr($p['id']); ?>">
                            <input type="text" name="plan_slug[]" value="<?php echo esc_attr($p['slug']); ?>" style="width:110px">
                        </td>
                        <td><input type="text" name="plan_label[]"  value="<?php echo esc_attr($p['label']); ?>" style="width:130px"></td>
                        <td><input type="number" name="plan_credits[]" value="<?php echo esc_attr($p['credits']); ?>" min="0" style="width:80px"></td>
                        <td><input type="number" name="plan_days[]"    value="<?php echo esc_attr($p['days']); ?>" min="1" style="width:60px"></td>
                        <td><input type="number" name="plan_price_dollars[]" value="<?php echo esc_attr(number_format($p['price_min_cents'] / 100, 2, '.', '')); ?>" min="0" step="0.01" style="width:80px"></td>
                        <td style="text-align:center"><input type="checkbox" name="plan_active[<?php echo esc_attr($i); ?>]" value="1" <?php checked((int) $p['is_active'], 1); ?>></td>
                        <td><input type="number" name="plan_order[]" value="<?php echo esc_attr($p['display_order']); ?>" min="0" style="width:60px"></td>
                    </tr>
                <?php endforeach; ?>
                <!-- New plan row -->
                <tr style="background:#f9f9f9">
                    <td><input type="hidden" name="plan_id[]" value="0"><input type="text" name="plan_slug[]" placeholder="new-plan" style="width:110px"></td>
                    <td><input type="text" name="plan_label[]" placeholder="New Plan" style="width:130px"></td>
                    <td><input type="number" name="plan_credits[]" value="" min="0" style="width:80px"></td>
                    <td><input type="number" name="plan_days[]" value="35" min="1" style="width:60px"></td>
                    <td><input type="number" name="plan_price_dollars[]" value="" min="0" step="0.01" style="width:80px"></td>
                    <td style="text-align:center"><input type="checkbox" name="plan_active[<?php echo count($plans); ?>]" value="1" checked></td>
                    <td><input type="number" name="plan_order[]" value="<?php echo count($plans); ?>" style="width:60px"></td>
                </tr>
                </tbody>
            </table>
            <?php submit_button('Save All Plans', 'primary'); ?>
        </form>
    </div>
    <?php
}
