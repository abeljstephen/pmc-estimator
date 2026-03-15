<?php
/**
 * Plugin Name:  PMC Estimator CRM
 * Plugin URI:   https://icarenow.io
 * Description:  Key validation, quota tracking, credit deduction, contact records,
 *               payment history and email automation for the PMC Estimator GPT.
 *               Configure everything under Settings → PMC CRM.
 * Version:      1.0.0
 * Author:       iCareNOW
 * Author URI:   https://icarenow.io
 * License:      Proprietary
 */

defined('ABSPATH') || exit;

// ── SETTINGS HELPERS ──────────────────────────────────────────────────────────
// All secrets stored in wp_options — configured via Settings → PMC CRM.
// No wp-config.php edits needed.

function pmc_setting(string $key, string $default = ''): string {
    return get_option('pmc_' . $key, $default);
}

function pmc_secret(): string      { return pmc_setting('api_secret'); }
function pmc_stripe_hook(): string { return pmc_setting('stripe_hook_secret'); }
function pmc_stripe_link(): string { return pmc_setting('stripe_link', 'https://buy.stripe.com/YOUR_LINK'); }
function pmc_admin_email(): string { return pmc_setting('admin_email', get_option('admin_email')); }

// ── ADMIN SETTINGS PAGE ───────────────────────────────────────────────────────
add_action('admin_menu', function () {
    add_options_page(
        'PMC Estimator CRM',
        'PMC CRM',
        'manage_options',
        'pmc-crm',
        'pmc_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('pmc_crm_settings', 'pmc_api_secret');
    register_setting('pmc_crm_settings', 'pmc_stripe_hook_secret');
    register_setting('pmc_crm_settings', 'pmc_stripe_link');
    register_setting('pmc_crm_settings', 'pmc_admin_email');
});

function pmc_settings_page(): void {
    $saved = isset($_GET['settings-updated']);
    $site  = get_site_url();
    ?>
    <div class="wrap">
        <h1>PMC Estimator CRM</h1>
        <p style="color:#6b7280">by iCareNOW &mdash; Configure all secrets here. No cPanel or file editing required.</p>

        <?php if ($saved): ?>
            <div class="notice notice-success is-dismissible"><p>Settings saved.</p></div>
        <?php endif; ?>

        <form method="post" action="options.php">
            <?php settings_fields('pmc_crm_settings'); ?>

            <table class="form-table" role="presentation">

                <tr>
                    <th scope="row"><label for="pmc_api_secret">GAS API Secret</label></th>
                    <td>
                        <input type="password" id="pmc_api_secret" name="pmc_api_secret"
                               value="<?php echo esc_attr(get_option('pmc_api_secret')); ?>"
                               class="regular-text" autocomplete="off">
                        <p class="description">
                            Random secret shared between GAS and this plugin.<br>
                            Generate one at <a href="https://generate-secret.vercel.app/64" target="_blank">generate-secret.vercel.app/64</a>
                            and paste the same value into GAS Script Properties as <code>WP_API_SECRET</code>.
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row"><label for="pmc_stripe_hook_secret">Stripe Webhook Secret</label></th>
                    <td>
                        <input type="password" id="pmc_stripe_hook_secret" name="pmc_stripe_hook_secret"
                               value="<?php echo esc_attr(get_option('pmc_stripe_hook_secret')); ?>"
                               class="regular-text" autocomplete="off">
                        <p class="description">
                            Found in Stripe Dashboard &rarr; Developers &rarr; Webhooks &rarr; your endpoint &rarr; Signing secret.<br>
                            Set your Stripe webhook URL to:
                            <code><?php echo esc_html($site); ?>/wp-json/pmc/v1/stripe</code>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row"><label for="pmc_stripe_link">Stripe Payment Link</label></th>
                    <td>
                        <input type="url" id="pmc_stripe_link" name="pmc_stripe_link"
                               value="<?php echo esc_attr(get_option('pmc_stripe_link')); ?>"
                               class="regular-text" placeholder="https://buy.stripe.com/...">
                        <p class="description">Your Stripe payment link. Shown to users when quota is exhausted or key expires.</p>
                    </td>
                </tr>

                <tr>
                    <th scope="row"><label for="pmc_admin_email">Owner Notification Email</label></th>
                    <td>
                        <input type="email" id="pmc_admin_email" name="pmc_admin_email"
                               value="<?php echo esc_attr(get_option('pmc_admin_email', get_option('admin_email'))); ?>"
                               class="regular-text">
                        <p class="description">Where trial and subscription notification emails are sent (your iCareNOW address).</p>
                    </td>
                </tr>

            </table>

            <?php submit_button('Save Settings'); ?>
        </form>

        <hr>
        <h2>Your REST Endpoints</h2>
        <p>Share these with GAS Script Properties and Stripe:</p>
        <table class="widefat striped" style="max-width:700px">
            <thead><tr><th>Purpose</th><th>URL</th></tr></thead>
            <tbody>
                <tr><td>Trial request (GPT)</td>    <td><code><?php echo esc_html($site); ?>/wp-json/pmc/v1/trial</code></td></tr>
                <tr><td>Validate key (GAS)</td>     <td><code><?php echo esc_html($site); ?>/wp-json/pmc/v1/validate</code></td></tr>
                <tr><td>Deduct credits (GAS)</td>   <td><code><?php echo esc_html($site); ?>/wp-json/pmc/v1/deduct</code></td></tr>
                <tr><td>Check quota (GPT)</td>      <td><code><?php echo esc_html($site); ?>/wp-json/pmc/v1/quota</code></td></tr>
                <tr><td>Stripe webhook</td>         <td><code><?php echo esc_html($site); ?>/wp-json/pmc/v1/stripe</code></td></tr>
            </tbody>
        </table>

        <hr>
        <h2>Status Check</h2>
        <?php
        $secret = pmc_secret();
        $hook   = pmc_stripe_hook();
        $link   = pmc_stripe_link();
        $email  = pmc_admin_email();

        function pmc_status_row(string $label, bool $ok, string $note = ''): void {
            $icon  = $ok ? '&#10003;' : '&#10007;';
            $color = $ok ? 'green'    : 'red';
            echo "<tr><td>{$label}</td>"
               . "<td style='color:{$color};font-weight:bold'>{$icon}</td>"
               . "<td style='color:#6b7280'>" . esc_html($note) . "</td></tr>";
        }
        ?>
        <table class="widefat striped" style="max-width:700px">
            <thead><tr><th>Setting</th><th>Set?</th><th>Note</th></tr></thead>
            <tbody>
                <?php
                pmc_status_row('GAS API Secret',        !empty($secret), empty($secret) ? 'Required before GAS can call this plugin' : 'Ready');
                pmc_status_row('Stripe Webhook Secret', !empty($hook),   empty($hook)   ? 'Required to process payments' : 'Ready');
                pmc_status_row('Stripe Payment Link',   !empty($link) && strpos($link, 'YOUR_LINK') === false, 'Shown to users on upgrade prompts');
                pmc_status_row('Notification Email',    !empty($email),  $email ?: 'Using WordPress admin email');
                pmc_status_row('FluentCRM installed',   pmc_fluentcrm_available(), pmc_fluentcrm_available() ? 'Contact records active' : 'Install FluentCRM for full CRM features');
                ?>
            </tbody>
        </table>
    </div>
    <?php
}

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

// ── REST API ROUTES ───────────────────────────────────────────────────────────
add_action('rest_api_init', function () {
    $auth = ['permission_callback' => 'pmc_check_secret'];
    register_rest_route('pmc/v1', '/trial',    ['methods' => 'POST', 'callback' => 'pmc_request_trial'  ] + $auth);
    register_rest_route('pmc/v1', '/validate', ['methods' => 'POST', 'callback' => 'pmc_validate_key'   ] + $auth);
    register_rest_route('pmc/v1', '/deduct',   ['methods' => 'POST', 'callback' => 'pmc_deduct_credits' ] + $auth);
    register_rest_route('pmc/v1', '/quota',    ['methods' => 'POST', 'callback' => 'pmc_get_quota'      ] + $auth);
    register_rest_route('pmc/v1', '/stripe',   ['methods' => 'POST', 'callback' => 'pmc_stripe_webhook',
        'permission_callback' => '__return_true']);
});

function pmc_check_secret(): bool {
    $header = $_SERVER['HTTP_X_PMC_SECRET'] ?? '';
    $secret = pmc_secret();
    return $secret !== '' && hash_equals($secret, $header);
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
    $contact = FluentCrmApi('contacts')->createOrUpdate(['email' => $email, 'status' => 'subscribed']);
    foreach ($meta as $k => $v) $contact->updateMeta($k, $v);
    $contact->attachTags($tags);
    return $contact;
}

function pmc_log($contact, string $message): void {
    if ($contact && method_exists($contact, 'logActivity')) $contact->logActivity($message);
}

// ── QUOTA BAR ─────────────────────────────────────────────────────────────────
function pmc_bar(int $used, int $total): string {
    if ($total <= 0) return '░░░░░░░░░░░░░░░░░░░░  0% remaining';
    $pct    = min(100, (int) round(($used / $total) * 100));
    $filled = (int) round($pct / 5);
    return str_repeat('█', $filled) . str_repeat('░', 20 - $filled)
        . '  ' . (100 - $pct) . '% remaining  (' . ($total - $used) . ' / ' . $total . ' credits)';
}

function pmc_update_quota_tags($contact, int $remaining, int $total): void {
    $contact->detachTags(['quota-ok', 'quota-warning', 'quota-critical', 'quota-exhausted']);
    $pct = $total > 0 ? ($remaining / $total) * 100 : 0;
    if      ($remaining <= 0) $contact->attachTags(['quota-exhausted']);
    elseif  ($pct <= 10)      $contact->attachTags(['quota-critical']);
    elseif  ($pct <= 25)      $contact->attachTags(['quota-warning']);
    else                      $contact->attachTags(['quota-ok']);
}

function pmc_maybe_warn(string $email, string $plan, int $remaining, int $total): void {
    $pct      = $total > 0 ? ($remaining / $total) * 100 : 0;
    $cache_key = 'pmc_warned_' . md5($email);
    $sent_at   = (int) get_transient($cache_key);
    if ($pct <= 10 && $sent_at > 10) {
        wp_mail($email, 'PMC Estimator — Only ' . $remaining . ' credits left',
            "You have {$remaining} of {$total} credits on your {$plan} plan.\n\nUpgrade: " . pmc_stripe_link());
        set_transient($cache_key, 10, 30 * DAY_IN_SECONDS);
    } elseif ($pct <= 25 && $sent_at > 25) {
        wp_mail($email, 'PMC Estimator — 25% of credits remaining',
            "You have {$remaining} of {$total} credits on your {$plan} plan.\n\nUpgrade: " . pmc_stripe_link());
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
        return rest_ensure_response(['error' => 'A trial was already issued for this email. Check your inbox or subscribe for full access: ' . pmc_stripe_link()]);

    $config = pmc_plans()['trial'];
    $key    = bin2hex(random_bytes(32));
    $expiry = date('Y-m-d', strtotime('+' . $config['days'] . ' days'));

    pmc_upsert_contact($email, [
        'pmc_api_key'       => $key,
        'pmc_plan'          => 'trial',
        'pmc_credits_total' => $config['credits'],
        'pmc_credits_used'  => 0,
        'pmc_key_expires'   => $expiry,
        'pmc_key_status'    => 'active',
        'pmc_quota_bar'     => pmc_bar(0, $config['credits']),
    ], ['trial', 'active', 'quota-ok']);

    $contact = pmc_get_contact($email);
    pmc_log($contact, 'Trial started — ' . $config['credits'] . ' credits, expires ' . $expiry);

    wp_mail(pmc_admin_email(), 'PMC Trial Request',
        "New trial\n\nEmail:   {$email}\nExpires: {$expiry}\nCredits: {$config['credits']}");

    wp_mail($email, 'Your PMC Estimator Trial Key',
        "Welcome to PMC Estimator by iCareNOW.\n\n"
        . "Your 10-day trial key:\n\n{$key}\n\n"
        . "Expires:          {$expiry}\n"
        . "Credits included: {$config['credits']}\n\n"
        . "Paste this key when the PMC Estimator GPT asks for it.\n\n"
        . "— iCareNOW  |  icarenow.io");

    return rest_ensure_response([
        'success' => true,
        'key'     => $key,
        'expiry'  => $expiry,
        'credits' => $config['credits'],
        'plan'    => 'trial',
        'message' => 'Trial key issued and emailed to ' . $email,
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
        return rest_ensure_response(['valid' => false,
            'error' => 'Key is ' . $status . '. Subscribe: ' . pmc_stripe_link()]);

    if (strtotime($expiry) < time()) {
        $contact->updateMeta('pmc_key_status', 'expired');
        $contact->detachTags(['active']); $contact->attachTags(['expired']);
        pmc_log($contact, 'Key expired on ' . $expiry);
        return rest_ensure_response(['valid' => false,
            'error'       => 'Key expired on ' . date('d M Y', strtotime($expiry)),
            'upgrade_url' => pmc_stripe_link()]);
    }

    if ($remaining <= 0) {
        pmc_update_quota_tags($contact, 0, $total);
        return rest_ensure_response(['valid' => false,
            'error'       => 'Quota exhausted — all ' . $total . ' credits used.',
            'upgrade_url' => pmc_stripe_link()]);
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
    $cost      = (int)             ($req->get_param('cost')       ?? 2);
    $operation = sanitize_text_field($req->get_param('operation') ?? 'estimation');
    $contact   = pmc_find_by_key($key);

    if (!$contact) return rest_ensure_response(['error' => 'Key not found']);

    $total     = (int) $contact->getMeta('pmc_credits_total');
    $used      = (int) $contact->getMeta('pmc_credits_used');
    $new_used  = $used + $cost;
    $remaining = max(0, $total - $new_used);

    $contact->updateMeta('pmc_credits_used',    $new_used);
    $contact->updateMeta('pmc_last_estimation', current_time('mysql'));
    $contact->updateMeta('pmc_quota_bar',       pmc_bar($new_used, $total));

    pmc_update_quota_tags($contact, $remaining, $total);
    pmc_log($contact, ucfirst($operation) . ' — ' . $cost . ' credit(s) used. Remaining: ' . $remaining . ' / ' . $total);
    pmc_maybe_warn($contact->email, $contact->getMeta('pmc_plan'), $remaining, $total);

    return rest_ensure_response([
        'success'   => true,
        'used'      => $new_used,
        'remaining' => $remaining,
        'total'     => $total,
        'bar'       => pmc_bar($new_used, $total),
    ]);
}

// ── GET QUOTA ─────────────────────────────────────────────────────────────────
function pmc_get_quota(WP_REST_Request $req): WP_REST_Response {
    $key     = sanitize_text_field($req->get_param('key') ?? '');
    $contact = pmc_find_by_key($key);

    if (!$contact) return rest_ensure_response(['error' => 'Invalid key']);

    $total     = (int) $contact->getMeta('pmc_credits_total');
    $used      = (int) $contact->getMeta('pmc_credits_used');
    $remaining = max(0, $total - $used);

    return rest_ensure_response([
        'plan'      => $contact->getMeta('pmc_plan'),
        'total'     => $total,
        'used'      => $used,
        'remaining' => $remaining,
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

    if (!pmc_verify_stripe($payload, $sig, pmc_stripe_hook()))
        return new WP_REST_Response(['error' => 'Invalid Stripe signature'], 400);

    $event = json_decode($payload, true);
    $type  = $event['type'] ?? '';

    // ── New subscription ──────────────────────────────────────────────────────
    if ($type === 'checkout.session.completed') {
        $session   = $event['data']['object'];
        $email     = strtolower($session['customer_details']['email'] ?? '');
        $amount    = ($session['amount_total'] ?? 0) / 100;
        $stripe_id = $session['customer']       ?? '';
        $intent    = $session['payment_intent'] ?? 'n/a';

        $plan   = pmc_amount_to_plan($amount);
        $config = pmc_plans()[$plan];
        $key    = bin2hex(random_bytes(32));
        $expiry = date('Y-m-d', strtotime('+' . $config['days'] . ' days'));

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
            'Subscribed — ' . $plan . ' — $' . $amount . ' — ' . $config['credits']
            . ' credits — expires ' . $expiry . ' (Stripe: ' . $intent . ')');

        wp_mail(pmc_admin_email(), 'PMC Subscription Request — ' . ucfirst($plan),
            "New subscription\n\nEmail:   {$email}\nPlan:    {$plan}\n"
            . "Amount:  \${$amount}\nCredits: {$config['credits']}\nExpires: {$expiry}\nStripe:  {$intent}");

        wp_mail($email, 'Your PMC Estimator Subscription Key',
            "Thank you for subscribing to PMC Estimator.\n\n"
            . "Plan:             " . ucfirst($plan) . "\n"
            . "Your key:\n\n{$key}\n\n"
            . "Credits included: {$config['credits']}\n"
            . "Expires:          {$expiry}\n\n"
            . "Paste this key when the PMC Estimator GPT asks for it.\n"
            . "Manage your subscription: " . pmc_stripe_link() . "\n\n"
            . "— iCareNOW  |  icarenow.io");
    }

    // ── Subscription renewal ──────────────────────────────────────────────────
    if ($type === 'invoice.payment_succeeded') {
        $invoice = $event['data']['object'];
        if (($invoice['billing_reason'] ?? '') !== 'subscription_cycle')
            return rest_ensure_response(['received' => true]);

        $email   = strtolower($invoice['customer_email'] ?? '');
        $amount  = ($invoice['amount_paid'] ?? 0) / 100;
        $plan    = pmc_amount_to_plan($amount);
        $config  = pmc_plans()[$plan];
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
            pmc_log($contact, 'Renewed — $' . $amount . ' — credits reset to ' . $config['credits'] . ' — expires ' . $expiry);
            delete_transient('pmc_warned_' . md5($email));

            wp_mail($email, 'PMC Estimator — Subscription Renewed',
                "Your " . ucfirst($plan) . " plan has been renewed.\n\n"
                . "Credits reset to: {$config['credits']}\nNew expiry: {$expiry}\n\n"
                . "— iCareNOW  |  icarenow.io");
        }
    }

    // ── Cancellation ─────────────────────────────────────────────────────────
    if ($type === 'customer.subscription.deleted') {
        $email   = strtolower($event['data']['object']['customer_email'] ?? '');
        $contact = pmc_get_contact($email);
        if ($contact) {
            $contact->updateMeta('pmc_key_status', 'cancelled');
            $contact->detachTags(['active']); $contact->attachTags(['cancelled']);
            pmc_log($contact, 'Subscription cancelled via Stripe');
        }
    }

    return rest_ensure_response(['received' => true]);
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function pmc_amount_to_plan(float $amount): string {
    $plans = pmc_plans();
    unset($plans['trial']);
    uasort($plans, fn($a, $b) => $b['price_min'] - $a['price_min']); // highest first
    foreach ($plans as $name => $config) {
        if ($amount >= $config['price_min']) return $name;
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
    $expected = hash_hmac('sha256', $parts['t'] . '.' . $payload, $secret);
    return hash_equals($expected, $parts['v1']);
}
