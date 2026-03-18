<?php
defined('ABSPATH') || exit;

/**
 * Returns true if FluentCRM sync is enabled and FluentCRM is present.
 */
function pmc_fluentcrm_sync_enabled(): bool {
    return pmc_setting('fluentcrm_sync', '0') === '1' && function_exists('FluentCrmApi');
}

/**
 * Returns true if FluentCRM is installed and active.
 */
function pmc_fluentcrm_available(): bool {
    return function_exists('FluentCrmApi');
}

/**
 * Upsert a FluentCRM contact from a PMC user object.
 * Mirrors all pmc_* meta fields. Tags applied if provided.
 * Fully wrapped in try/catch — FluentCRM errors never break the plugin.
 */
function pmc_fluentcrm_sync_user(object $user, array $tags = []): void {
    if (!pmc_fluentcrm_sync_enabled()) return;

    try {
        $result  = FluentCrmApi('contacts')->createOrUpdate([
            'email'  => $user->email,
            'status' => 'subscribed',
        ]);
        $contact = is_array($result) ? ($result['subscriber'] ?? null) : $result;
        if (!$contact || !$contact->id) return;

        $meta_fields = [
            'pmc_api_key'         => $user->api_key,
            'pmc_plan'            => $user->plan,
            'pmc_credits_total'   => (string) $user->credits_total,
            'pmc_credits_used'    => (string) $user->credits_used,
            'pmc_key_expires'     => (string) ($user->key_expires ?? ''),
            'pmc_key_status'      => $user->key_status,
            'pmc_quota_bar'       => pmc_bar((int) $user->credits_used, (int) $user->credits_total),
            'pmc_last_estimation' => (string) ($user->last_estimation ?? ''),
            'pmc_stripe_customer' => (string) ($user->stripe_customer_id ?? ''),
            'pmc_source'          => (string) ($user->source ?? ''),
        ];

        global $wpdb;
        $table = $wpdb->prefix . 'fc_subscriber_meta';
        foreach ($meta_fields as $key => $value) {
            $sql = $wpdb->prepare(
                "INSERT INTO `{$table}` (subscriber_id, object_type, `key`, value, created_at, updated_at)
                 VALUES (%d, 'subscriber', %s, %s, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()",
                $contact->id, $key, $value
            );
            $wpdb->query($sql);
        }

        // Quota tags
        $remaining = pmc_credits_remaining($user);
        $total     = (int) $user->credits_total;
        $contact->detachTags(['quota-ok', 'quota-warning', 'quota-critical', 'quota-exhausted']);
        $pct = $total > 0 ? ($remaining / $total) * 100 : 0;
        if ($remaining <= 0)   $contact->attachTags(['quota-exhausted']);
        elseif ($pct <= 10)    $contact->attachTags(['quota-critical']);
        elseif ($pct <= 25)    $contact->attachTags(['quota-warning']);
        else                   $contact->attachTags(['quota-ok']);

        // Status tags
        $contact->detachTags(['active', 'expired', 'cancelled', 'suspended', 'trial',
            'starter', 'professional', 'team', 'enterprise']);
        $attach = [$user->key_status, $user->plan];
        foreach ($tags as $t) $attach[] = $t;
        $contact->attachTags(array_unique(array_filter($attach)));

    } catch (\Throwable $e) {
        error_log('[PMC CRM] FluentCRM sync error: ' . $e->getMessage());
    }
}
