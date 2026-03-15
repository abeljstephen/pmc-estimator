<?php
/**
 * Plugin Name:  PMC Estimator CRM
 * Plugin URI:   https://icarenow.io
 * Description:  Key validation, quota tracking, credit deduction, contact records,
 *               payment history and email automation for the PMC Estimator GPT.
 * Version:      1.0.0
 * Author:       iCareNOW
 * Author URI:   https://icarenow.io
 * License:      Proprietary
 */

defined('ABSPATH') || exit;

// ── CONSTANTS ────────────────────────────────────────────────────────────────
// Set these three values in wp-config.php:
//   define('PMC_API_SECRET',       'your-long-random-secret');
//   define('PMC_STRIPE_HOOK_SEC',  'whsec_from_stripe_dashboard');
//   define('PMC_STRIPE_LINK',      'https://buy.stripe.com/your_link');

defined('PMC_API_SECRET')      || define('PMC_API_SECRET',      '');
defined('PMC_STRIPE_HOOK_SEC') || define('PMC_STRIPE_HOOK_SEC', '');
defined('PMC_STRIPE_LINK')     || define('PMC_STRIPE_LINK',     'https://buy.stripe.com/YOUR_LINK');

// ── PLAN DEFINITIONS ─────────────────────────────────────────────────────────
function pmc_plans(): array {
    return [
        'trial'        => ['credits' => 20,     'days' => 10,  'price_min' => 0],
        'starter'      => ['credits' => 300,    'days' => 365, 'price_min' => 40],
        'professional' => ['credits' => 600,    'days' => 365, 'price_min' => 85],
        'team'         => ['credits' => 1500,   'days' => 365, 'price_min' => 220],
        'enterprise'   => ['credits' => 999999, 'days' => 365, 'price_min' => 450],
    ];
}

// ── CREDIT COSTS PER OPERATION ────────────────────────────────────────────────
function pmc_credit_costs(): array {
    return [
        'baseline_only' => 1,
        'full_saco'     => 2,
        'saco_explain'  => 4,
    ];
}

// ── REST API ROUTES ───────────────────────────────────────────────────────────
add_action('rest_api_init', function () {
    $auth = ['permission_callback' => 'pmc_check_secret'];

    register_rest_route('pmc/v1', '/trial',    ['methods' => 'POST', 'callback' => 'pmc_request_trial'  ] + $auth);
    register_rest_route('pmc/v1', '/validate', ['methods' => 'POST', 'callback' => 'pmc_validate_key'   ] + $auth);
    register_rest_route('pmc/v1', '/deduct',   ['methods' => 'POST', 'callback' => 'pmc_deduct_credits' ] + $auth);
    register_rest_route('pmc/v1', '/quota',    ['methods' => 'POST', 'callback' => 'pmc_get_quota'      ] + $auth);
    register_rest_route('pmc/v1', '/stripe',   ['methods' => 'POST', 'callback' => 'pmc_stripe_webhook',
        'permission_callback' => '__return_true']); // Stripe signs its own payload
});

function pmc_check_secret(): bool {
    $header = $_SERVER['HTTP_X_PMC_SECRET'] ?? '';
    return PMC_API_SECRET !== '' && hash_equals(PMC_API_SECRET, $header);
}

// ── FLUENTCRM HELPERS ─────────────────────────────────────────────────────────
function pmc_fluentcrm_available(): bool {
    return function_exists('FluentCrmApi');
}

function pmc_get_contact(string $email) {
    if (!pmc_fluentcrm_available()) return null;
    return FluentCrmApi('contacts')->getContact($email);
}

function pmc_find_by_key(string $key) {
    if (!pmc_fluentcrm_available() || empty($key)) return null;
    return \FluentCrm\App\Models\Subscriber::whereHas('meta', function ($q) use ($key) {
        $q->where('key', 'pmc_api_key')->where('value', $key);
    })->first();
}

function pmc_upsert_contact(string $email, array $meta, array $tags) {
    if (!pmc_fluentcrm_available()) return null;
    $contact = FluentCrmApi('contacts')->createOrUpdate([
        'email'  => $email,
        'status' => 'subscribed',
    ]);
    foreach ($meta as $k => $v) {
        $contact->updateMeta($k, $v);
    }
    $contact->attachTags($tags);
    return $contact;
}

function pmc_log($contact, string $message): void {
    if ($contact && method_exists($contact, 'logActivity')) {
        $contact->logActivity($message);
    }
}

// ── QUOTA BAR ─────────────────────────────────────────────────────────────────
function pmc_bar(int $used, int $total): string {
    if ($total <= 0) return '░░░░░░░░░░░░░░░░░░░░  0% remaining';
    $pct    = min(100, (int) round(($used / $total) * 100));
    $filled = (int) round($pct / 5);
    $bar    = str_repeat('█', $filled) . str_repeat('░', 20 - $filled);
    return $bar . '  ' . (100 - $pct) . '% remaining  (' . ($total - $used) . ' / ' . $total . ' credits)';
}

function pmc_update_quota_tags($contact, int $remaining, int $total): void {
    $contact->detachTags(['quota-ok', 'quota-warning', 'quota-critical', 'quota-exhausted']);
    $pct = $total > 0 ? ($remaining / $total) * 100 : 0;
    if      ($remaining <= 0) $contact->attachTags(['quota-exhausted']);
    elseif  ($pct <= 10)      $contact->attachTags(['quota-critical']);
    elseif  ($pct <= 25)      $contact->attachTags(['quota-warning']);
    else                      $contact->attachTags(['quota-ok']);
}

// ── QUOTA WARNING EMAILS ──────────────────────────────────────────────────────
function pmc_maybe_warn(string $email, string $plan, int $remaining, int $total): void {
    $pct      = $total > 0 ? ($remaining / $total) * 100 : 0;
    $cache_key = 'pmc_warned_' . md5($email);
    $sent_at   = (int) get_transient($cache_key);   // stores pct threshold already sent

    if ($pct <= 10 && $sent_at > 10) {
        wp_mail($email,
            'PMC Estimator — Only ' . $remaining . ' credits left',
            "You have {$remaining} of {$total} credits remaining on your {$plan} plan.\n\n"
            . "Top up or upgrade here:\n" . PMC_STRIPE_LINK);
        set_transient($cache_key, 10, 30 * DAY_IN_SECONDS);

    } elseif ($pct <= 25 && $sent_at > 25) {
        wp_mail($email,
            'PMC Estimator — 25% of credits remaining',
            "Heads up — you have {$remaining} of {$total} credits left on your {$plan} plan.\n\n"
            . "Upgrade anytime:\n" . PMC_STRIPE_LINK);
        set_transient($cache_key, 25, 30 * DAY_IN_SECONDS);
    }
}

// ── TRIAL REQUEST ─────────────────────────────────────────────────────────────
function pmc_request_trial(WP_REST_Request $req): WP_REST_Response {
    $email = strtolower(sanitize_email($req->get_param('email') ?? ''));

    if (!is_email($email))
        return rest_ensure_response(['error' => 'A valid email address is required']);

    $existing = pmc_get_contact($email);
    if ($existing && $existing->getMeta('pmc_api_key'))
        return rest_ensure_response(['error' => 'A trial has already been issued for this email. Check your inbox or subscribe for full access.']);

    $plans  = pmc_plans();
    $config = $plans['trial'];
    $key    = bin2hex(random_bytes(32));
    $expiry = date('Y-m-d', strtotime('+' . $config['days'] . ' days'));

    $contact = pmc_upsert_contact($email, [
        'pmc_api_key'        => $key,
        'pmc_plan'           => 'trial',
        'pmc_credits_total'  => $config['credits'],
        'pmc_credits_used'   => 0,
        'pmc_key_expires'    => $expiry,
        'pmc_key_status'     => 'active',
        'pmc_quota_bar'      => pmc_bar(0, $config['credits']),
    ], ['trial', 'active', 'quota-ok']);

    pmc_log($contact, 'Trial started — ' . $config['credits'] . ' credits issued, expires ' . $expiry);

    // Notify owner
    wp_mail(
        get_option('admin_email'),
        'PMC Trial Request',
        "New trial request\n\nEmail:   {$email}\nExpires: {$expiry}\nCredits: {$config['credits']}"
    );

    // Welcome email to user — FluentCRM automation fires via tag 'trial'
    // (or fallback wp_mail if FluentCRM not configured yet)
    wp_mail(
        $email,
        'Your PMC Estimator Trial Key',
        "Welcome to PMC Estimator by iCareNOW.\n\n"
        . "Your 10-day trial key:\n\n{$key}\n\n"
        . "Expires:          {$expiry}\n"
        . "Credits included: {$config['credits']}\n\n"
        . "Paste this key when the PMC Estimator GPT asks for it.\n\n"
        . "— iCareNOW  |  icarenow.io"
    );

    return rest_ensure_response([
        'success'  => true,
        'key'      => $key,
        'expiry'   => $expiry,
        'credits'  => $config['credits'],
        'plan'     => 'trial',
        'message'  => 'Trial key issued. Check your email — it has also been sent to ' . $email,
    ]);
}

// ── VALIDATE KEY ──────────────────────────────────────────────────────────────
function pmc_validate_key(WP_REST_Request $req): WP_REST_Response {
    $key     = sanitize_text_field($req->get_param('key') ?? '');
    $contact = pmc_find_by_key($key);

    if (!$contact)
        return rest_ensure_response(['valid' => false, 'error' => 'Invalid key']);

    $status    = $contact->getMeta('pmc_key_status');
    $expiry    = $contact->getMeta('pmc_key_expires');
    $total     = (int) $contact->getMeta('pmc_credits_total');
    $used      = (int) $contact->getMeta('pmc_credits_used');
    $remaining = $total - $used;

    if ($status !== 'active')
        return rest_ensure_response(['valid' => false, 'error' => 'This key is ' . $status . '. Subscribe for a new key: ' . PMC_STRIPE_LINK]);

    if (strtotime($expiry) < time()) {
        $contact->updateMeta('pmc_key_status', 'expired');
        $contact->detachTags(['active']);
        $contact->attachTags(['expired']);
        pmc_log($contact, 'Key expired on ' . $expiry);
        return rest_ensure_response(['valid' => false,
            'error'       => 'Your key expired on ' . date('d M Y', strtotime($expiry)) . '.',
            'upgrade_url' => PMC_STRIPE_LINK]);
    }

    if ($remaining <= 0) {
        pmc_update_quota_tags($contact, 0, $total);
        return rest_ensure_response(['valid' => false,
            'error'       => 'Quota exhausted — all ' . $total . ' credits have been used.',
            'upgrade_url' => PMC_STRIPE_LINK]);
    }

    return rest_ensure_response([
        'valid'     => true,
        'email'     => $contact->email,
        'plan'      => $contact->getMeta('pmc_plan'),
        'total'     => $total,
        'used'      => $used,
        'remaining' => $remaining,
        'expires'   => $expiry,
        'bar'       => pmc_bar($used, $total),
    ]);
}

// ── DEDUCT CREDITS ────────────────────────────────────────────────────────────
function pmc_deduct_credits(WP_REST_Request $req): WP_REST_Response {
    $key       = sanitize_text_field($req->get_param('key')       ?? '');
    $cost      = (int)            ($req->get_param('cost')        ?? 2);
    $operation = sanitize_text_field($req->get_param('operation') ?? 'estimation');
    $contact   = pmc_find_by_key($key);

    if (!$contact)
        return rest_ensure_response(['error' => 'Key not found']);

    $total     = (int) $contact->getMeta('pmc_credits_total');
    $used      = (int) $contact->getMeta('pmc_credits_used');
    $new_used  = $used + $cost;
    $remaining = $total - $new_used;

    $contact->updateMeta('pmc_credits_used',    $new_used);
    $contact->updateMeta('pmc_last_estimation', current_time('mysql'));
    $contact->updateMeta('pmc_quota_bar',       pmc_bar($new_used, $total));

    pmc_update_quota_tags($contact, max(0, $remaining), $total);
    pmc_log($contact,
        ucfirst($operation) . ' — ' . $cost . ' credit(s) used. '
        . 'Remaining: ' . max(0, $remaining) . ' / ' . $total);

    pmc_maybe_warn($contact->email, $contact->getMeta('pmc_plan'), max(0, $remaining), $total);

    return rest_ensure_response([
        'success'   => true,
        'used'      => $new_used,
        'remaining' => max(0, $remaining),
        'total'     => $total,
        'bar'       => pmc_bar($new_used, $total),
    ]);
}

// ── GET QUOTA ─────────────────────────────────────────────────────────────────
function pmc_get_quota(WP_REST_Request $req): WP_REST_Response {
    $key     = sanitize_text_field($req->get_param('key') ?? '');
    $contact = pmc_find_by_key($key);

    if (!$contact)
        return rest_ensure_response(['error' => 'Invalid key']);

    $total     = (int) $contact->getMeta('pmc_credits_total');
    $used      = (int) $contact->getMeta('pmc_credits_used');
    $remaining = $total - $used;

    return rest_ensure_response([
        'plan'      => $contact->getMeta('pmc_plan'),
        'total'     => $total,
        'used'      => $used,
        'remaining' => max(0, $remaining),
        'expires'   => $contact->getMeta('pmc_key_expires'),
        'status'    => $contact->getMeta('pmc_key_status'),
        'bar'       => pmc_bar($used, $total),
        'last_used' => $contact->getMeta('pmc_last_estimation') ?? 'Never',
    ]);
}

// ── STRIPE WEBHOOK ────────────────────────────────────────────────────────────
function pmc_stripe_webhook(WP_REST_Request $req): WP_REST_Response {
    $payload = $req->get_body();
    $sig     = $req->get_header('stripe-signature') ?? '';

    if (!pmc_verify_stripe($payload, $sig, PMC_STRIPE_HOOK_SEC))
        return new WP_REST_Response(['error' => 'Invalid Stripe signature'], 400);

    $event = json_decode($payload, true);
    $type  = $event['type'] ?? '';

    // ── New subscription ──────────────────────────────────────────────────────
    if ($type === 'checkout.session.completed') {
        $session   = $event['data']['object'];
        $email     = strtolower($session['customer_details']['email'] ?? '');
        $amount    = ($session['amount_total'] ?? 0) / 100;
        $stripe_id = $session['customer']        ?? '';
        $intent    = $session['payment_intent']  ?? 'n/a';

        $plan   = pmc_amount_to_plan($amount);
        $plans  = pmc_plans();
        $config = $plans[$plan];
        $key    = bin2hex(random_bytes(32));
        $expiry = date('Y-m-d', strtotime('+' . $config['days'] . ' days'));

        // Supersede any prior active key for this email
        $existing = pmc_get_contact($email);
        if ($existing && $existing->getMeta('pmc_api_key')) {
            $existing->updateMeta('pmc_key_status', 'superseded');
            $existing->detachTags(['active', 'trial', 'starter', 'professional', 'team', 'enterprise']);
            pmc_log($existing, 'Prior key superseded by new ' . $plan . ' subscription');
        }

        $contact = pmc_upsert_contact($email, [
            'pmc_api_key'         => $key,
            'pmc_plan'            => $plan,
            'pmc_credits_total'   => $config['credits'],
            'pmc_credits_used'    => 0,
            'pmc_key_expires'     => $expiry,
            'pmc_key_status'      => 'active',
            'pmc_stripe_customer' => $stripe_id,
            'pmc_quota_bar'       => pmc_bar(0, $config['credits']),
        ], [$plan, 'active', 'quota-ok']);

        pmc_log($contact,
            'Subscribed to ' . $plan . ' — $' . $amount
            . ' — ' . $config['credits'] . ' credits'
            . ' — expires ' . $expiry
            . ' (Stripe: ' . $intent . ')');

        // Notify owner
        wp_mail(
            get_option('admin_email'),
            'PMC Subscription Request — ' . ucfirst($plan),
            "New subscription\n\nEmail:   {$email}\nPlan:    {$plan}\n"
            . "Amount:  \${$amount}\nCredits: {$config['credits']}\nExpires: {$expiry}\n"
            . "Stripe:  {$intent}"
        );

        // Key email to subscriber — FluentCRM automation also fires via plan tag
        wp_mail(
            $email,
            'Your PMC Estimator Subscription Key',
            "Thank you for subscribing to PMC Estimator.\n\n"
            . "Plan:             " . ucfirst($plan) . "\n"
            . "Your key:\n\n{$key}\n\n"
            . "Credits included: {$config['credits']}\n"
            . "Expires:          {$expiry}\n\n"
            . "Paste this key when the PMC Estimator GPT asks for it.\n"
            . "To manage your subscription:\n" . PMC_STRIPE_LINK . "\n\n"
            . "— iCareNOW  |  icarenow.io"
        );
    }

    // ── Subscription renewal ──────────────────────────────────────────────────
    if ($type === 'invoice.payment_succeeded') {
        $invoice = $event['data']['object'];
        $reason  = $invoice['billing_reason'] ?? '';

        // Only process automatic renewals, not the initial charge
        if ($reason !== 'subscription_cycle')
            return rest_ensure_response(['received' => true]);

        $email   = strtolower($invoice['customer_email'] ?? '');
        $amount  = ($invoice['amount_paid'] ?? 0) / 100;
        $plan    = pmc_amount_to_plan($amount);
        $plans   = pmc_plans();
        $config  = $plans[$plan];
        $expiry  = date('Y-m-d', strtotime('+365 days'));

        $contact = pmc_get_contact($email);
        if ($contact) {
            $contact->updateMeta('pmc_credits_total', $config['credits']);
            $contact->updateMeta('pmc_credits_used',  0);
            $contact->updateMeta('pmc_key_expires',   $expiry);
            $contact->updateMeta('pmc_key_status',    'active');
            $contact->updateMeta('pmc_quota_bar',     pmc_bar(0, $config['credits']));
            $contact->detachTags(['expired', 'quota-exhausted', 'quota-critical', 'quota-warning']);
            $contact->attachTags(['active', 'quota-ok']);
            pmc_log($contact,
                'Subscription renewed — $' . $amount
                . ' — credits reset to ' . $config['credits']
                . ' — expires ' . $expiry);

            // Reset low-quota warning transient so emails fire again next cycle
            delete_transient('pmc_warned_' . md5($email));

            wp_mail(
                $email,
                'PMC Estimator — Subscription Renewed',
                "Your " . ucfirst($plan) . " plan has been renewed.\n\n"
                . "Credits reset to: {$config['credits']}\n"
                . "New expiry:       {$expiry}\n\n"
                . "— iCareNOW  |  icarenow.io"
            );
        }
    }

    // ── Subscription cancelled ────────────────────────────────────────────────
    if ($type === 'customer.subscription.deleted') {
        $sub   = $event['data']['object'];
        $email = strtolower($sub['customer_email'] ?? '');

        $contact = pmc_get_contact($email);
        if ($contact) {
            $contact->updateMeta('pmc_key_status', 'cancelled');
            $contact->detachTags(['active']);
            $contact->attachTags(['cancelled']);
            pmc_log($contact, 'Subscription cancelled via Stripe');
        }
    }

    return rest_ensure_response(['received' => true]);
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function pmc_amount_to_plan(float $amount): string {
    $plans = pmc_plans();
    arsort($plans); // highest price first
    foreach ($plans as $name => $config) {
        if ($amount >= $config['price_min'] && $name !== 'trial') return $name;
    }
    return 'starter';
}

function pmc_verify_stripe(string $payload, string $sig_header, string $secret): bool {
    if (empty($secret) || empty($sig_header)) return false;
    $parts = [];
    foreach (explode(',', $sig_header) as $part) {
        $kv = explode('=', $part, 2);
        if (count($kv) === 2) $parts[$kv[0]] = $kv[1];
    }
    if (empty($parts['t']) || empty($parts['v1'])) return false;
    $signed   = $parts['t'] . '.' . $payload;
    $expected = hash_hmac('sha256', $signed, $secret);
    return hash_equals($expected, $parts['v1']);
}
