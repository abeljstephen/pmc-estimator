<?php
defined('ABSPATH') || exit;

/**
 * Return all plans from the database, ordered by display_order.
 * Falls back to hardcoded defaults if the table is empty.
 *
 * Each row: id, slug, label, credits, days, price_min_cents, is_active, display_order
 */
function pc_get_plans(): array {
    global $wpdb;
    $table = $wpdb->prefix . 'pc_plans';
    $rows  = $wpdb->get_results("SELECT * FROM `{$table}` ORDER BY display_order ASC, id ASC", ARRAY_A);
    if (!empty($rows)) return $rows;

    // Fallback hardcoded defaults
    return [
        ['id' => 0, 'slug' => 'trial',        'label' => 'Trial',        'credits' => 20,     'days' => 10, 'price_min_cents' => 0,    'is_active' => 1, 'display_order' => 0, 'gas_tier' => 'slim'],
        ['id' => 0, 'slug' => 'starter',       'label' => 'Starter',      'credits' => 25,     'days' => 35, 'price_min_cents' => 500,  'is_active' => 1, 'display_order' => 1, 'gas_tier' => 'slim'],
        ['id' => 0, 'slug' => 'professional',  'label' => 'Professional', 'credits' => 55,     'days' => 35, 'price_min_cents' => 1000, 'is_active' => 1, 'display_order' => 2, 'gas_tier' => 'full'],
        ['id' => 0, 'slug' => 'team',          'label' => 'Team',         'credits' => 130,    'days' => 35, 'price_min_cents' => 2000, 'is_active' => 1, 'display_order' => 3, 'gas_tier' => 'full'],
        ['id' => 0, 'slug' => 'enterprise',    'label' => 'Enterprise',   'credits' => 999999, 'days' => 35, 'price_min_cents' => 4000, 'is_active' => 1, 'display_order' => 4, 'gas_tier' => 'full'],
    ];
}

/**
 * Return a single plan by slug, or null if not found.
 */
function pc_get_plan(string $slug): ?array {
    foreach (pc_get_plans() as $plan) {
        if ($plan['slug'] === $slug) return $plan;
    }
    return null;
}

/**
 * Seed default plans if the table is empty.
 */
function pc_seed_plans(): void {
    global $wpdb;
    $table = $wpdb->prefix . 'pc_plans';
    $count = (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$table}`");
    if ($count > 0) return;

    $defaults = [
        ['slug' => 'trial',       'label' => 'Trial',        'credits' => 20,     'days' => 10, 'price_min_cents' => 0,    'is_active' => 1, 'display_order' => 0, 'gas_tier' => 'slim'],
        ['slug' => 'starter',     'label' => 'Starter',      'credits' => 25,     'days' => 35, 'price_min_cents' => 500,  'is_active' => 1, 'display_order' => 1, 'gas_tier' => 'slim'],
        ['slug' => 'professional','label' => 'Professional', 'credits' => 55,     'days' => 35, 'price_min_cents' => 1000, 'is_active' => 1, 'display_order' => 2, 'gas_tier' => 'full'],
        ['slug' => 'team',        'label' => 'Team',         'credits' => 130,    'days' => 35, 'price_min_cents' => 2000, 'is_active' => 1, 'display_order' => 3, 'gas_tier' => 'full'],
        ['slug' => 'enterprise',  'label' => 'Enterprise',   'credits' => 999999, 'days' => 35, 'price_min_cents' => 4000, 'is_active' => 1, 'display_order' => 4, 'gas_tier' => 'full'],
    ];

    foreach ($defaults as $plan) {
        $inserted = $wpdb->insert($table, $plan);
        if (false === $inserted) {
            error_log('pc_seed_plans: insert failed for slug=' . $plan['slug']);
        }
    }
}

/**
 * Return top-up credit pack definitions.
 * One-off purchases detected when Stripe session mode === 'payment'.
 */
function pc_topup_packs(): array {
    return [
        ['credits' => 500, 'price_min' => 25],  // $29.99 → 500 credits
        ['credits' => 150, 'price_min' => 10],  // $11.99 → 150 credits
        ['credits' => 50,  'price_min' => 4],   // $4.99  → 50 credits
    ];
}
