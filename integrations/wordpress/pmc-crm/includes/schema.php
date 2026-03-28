<?php
defined('ABSPATH') || exit;

function pmc_create_tables(): void {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    $p = $wpdb->prefix . 'pmc_';

    $sql = [];

    // Users
    $sql[] = "CREATE TABLE {$p}users (
        id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        email           VARCHAR(191) NOT NULL,
        api_key         VARCHAR(191) NOT NULL DEFAULT '',
        plan            VARCHAR(64)  NOT NULL DEFAULT 'trial',
        credits_total   INT          NOT NULL DEFAULT 0,
        credits_used    INT          NOT NULL DEFAULT 0,
        key_status      VARCHAR(32)  NOT NULL DEFAULT 'active',
        key_expires     DATE             NULL DEFAULT NULL,
        stripe_customer_id      VARCHAR(128) NOT NULL DEFAULT '',
        stripe_subscription_id  VARCHAR(128) NOT NULL DEFAULT '',
        last_estimation DATETIME         NULL DEFAULT NULL,
        ip_address      VARCHAR(64)  NOT NULL DEFAULT '',
        source          VARCHAR(32)  NOT NULL DEFAULT 'trial',
        notes           TEXT             NULL,
        auto_rotate_key       TINYINT(1)   NOT NULL DEFAULT 0,
        rate_limit_multiplier FLOAT        NOT NULL DEFAULT 1,
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_email   (email),
        UNIQUE KEY uq_api_key (api_key),
        KEY idx_key_status  (key_status),
        KEY idx_key_expires (key_expires),
        KEY idx_plan        (plan)
    ) $charset;";

    // Activity
    $sql[] = "CREATE TABLE {$p}activity (
        id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id         BIGINT UNSIGNED     NULL DEFAULT NULL,
        email           VARCHAR(191) NOT NULL DEFAULT '',
        action          VARCHAR(64)  NOT NULL DEFAULT '',
        operation_type  VARCHAR(64)  NOT NULL DEFAULT '',
        credits_cost    INT          NOT NULL DEFAULT 0,
        credits_before  INT          NOT NULL DEFAULT 0,
        credits_after   INT          NOT NULL DEFAULT 0,
        duration_ms     INT          NOT NULL DEFAULT 0,
        gas_exec_count  INT          NOT NULL DEFAULT 0,
        task_count      INT          NOT NULL DEFAULT 0,
        has_sliders     TINYINT(1)   NOT NULL DEFAULT 0,
        feasibility_avg FLOAT        NOT NULL DEFAULT 0,
        geo_country     VARCHAR(8)   NOT NULL DEFAULT '',
        geo_region      VARCHAR(64)  NOT NULL DEFAULT '',
        ip_address      VARCHAR(64)  NOT NULL DEFAULT '',
        result          VARCHAR(32)  NOT NULL DEFAULT 'success',
        notes           TEXT             NULL,
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_created_at  (created_at),
        KEY idx_email       (email),
        KEY idx_action      (action),
        KEY idx_result      (result),
        KEY idx_geo_country (geo_country)
    ) $charset;";

    // Plans
    $sql[] = "CREATE TABLE {$p}plans (
        id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
        slug            VARCHAR(64)  NOT NULL,
        label           VARCHAR(128) NOT NULL DEFAULT '',
        credits         INT          NOT NULL DEFAULT 0,
        days            INT          NOT NULL DEFAULT 35,
        price_min_cents INT          NOT NULL DEFAULT 0,
        is_active       TINYINT(1)   NOT NULL DEFAULT 1,
        display_order   INT          NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY uq_slug (slug)
    ) $charset;";

    // Promo codes
    $sql[] = "CREATE TABLE {$p}promo_codes (
        id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code            VARCHAR(64)  NOT NULL,
        credits_grant   INT          NOT NULL DEFAULT 0,
        plan_override   VARCHAR(64)  NOT NULL DEFAULT '',
        days_override   INT          NOT NULL DEFAULT 0,
        max_uses        INT              NULL DEFAULT NULL,
        uses_count      INT          NOT NULL DEFAULT 0,
        expires_at      DATE             NULL DEFAULT NULL,
        is_active       TINYINT(1)   NOT NULL DEFAULT 1,
        notes           TEXT             NULL,
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_code (code)
    ) $charset;";

    // Email templates
    $sql[] = "CREATE TABLE {$p}email_templates (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
        slug        VARCHAR(64)  NOT NULL,
        label       VARCHAR(128) NOT NULL DEFAULT '',
        subject     VARCHAR(255) NOT NULL DEFAULT '',
        body_html   LONGTEXT         NULL,
        is_active   TINYINT(1)   NOT NULL DEFAULT 1,
        updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_slug (slug)
    ) $charset;";

    // Webhook log
    $sql[] = "CREATE TABLE {$p}webhook_log (
        id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        source          VARCHAR(32)  NOT NULL DEFAULT 'stripe',
        event_type      VARCHAR(64)  NOT NULL DEFAULT '',
        event_id        VARCHAR(128) NOT NULL DEFAULT '',
        email           VARCHAR(191) NOT NULL DEFAULT '',
        amount_cents    INT          NOT NULL DEFAULT 0,
        result          VARCHAR(32)  NOT NULL DEFAULT 'processed',
        error_message   TEXT             NULL,
        payload_excerpt TEXT             NULL,
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_created_at (created_at)
    ) $charset;";

    // API key history — one row per key issued per user
    $sql[] = "CREATE TABLE {$p}api_keys (
        id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id         BIGINT UNSIGNED NOT NULL,
        email           VARCHAR(191) NOT NULL DEFAULT '',
        api_key         VARCHAR(191) NOT NULL DEFAULT '',
        status          VARCHAR(32)  NOT NULL DEFAULT 'active',
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at      DATETIME         NULL DEFAULT NULL,
        notes           VARCHAR(255)     NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_api_key   (api_key),
        KEY idx_user_id         (user_id),
        KEY idx_status          (status),
        KEY idx_created_at      (created_at)
    ) $charset;";

    // Payments — full Stripe financial audit trail
    $sql[] = "CREATE TABLE {$p}payments (
        id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id                 BIGINT UNSIGNED     NULL DEFAULT NULL,
        email                   VARCHAR(191) NOT NULL DEFAULT '',
        stripe_payment_intent   VARCHAR(128) NOT NULL DEFAULT '',
        stripe_invoice_id       VARCHAR(128) NOT NULL DEFAULT '',
        stripe_subscription_id  VARCHAR(128) NOT NULL DEFAULT '',
        stripe_customer_id      VARCHAR(128) NOT NULL DEFAULT '',
        stripe_price_id         VARCHAR(128) NOT NULL DEFAULT '',
        stripe_product_id       VARCHAR(128) NOT NULL DEFAULT '',
        stripe_charge_id        VARCHAR(128) NOT NULL DEFAULT '',
        amount_cents            INT          NOT NULL DEFAULT 0,
        currency                VARCHAR(8)   NOT NULL DEFAULT 'usd',
        plan                    VARCHAR(64)  NOT NULL DEFAULT '',
        type                    VARCHAR(32)  NOT NULL DEFAULT '',
        billing_reason          VARCHAR(64)  NOT NULL DEFAULT '',
        period_start            DATETIME         NULL DEFAULT NULL,
        period_end              DATETIME         NULL DEFAULT NULL,
        status                  VARCHAR(32)  NOT NULL DEFAULT 'succeeded',
        coupon_code             VARCHAR(128) NOT NULL DEFAULT '',
        created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_email      (email),
        KEY idx_user_id    (user_id),
        KEY idx_created_at (created_at),
        KEY idx_type       (type)
    ) $charset;";

    // Plot data — live visualization session storage (upsert by token)
    $sql[] = "CREATE TABLE {$p}plot_data (
        id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        token      VARCHAR(64)  NOT NULL,
        data       MEDIUMTEXT   NOT NULL,
        saved_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_token (token),
        KEY idx_saved_at (saved_at)
    ) $charset;";

    // Settings audit log
    $sql[] = "CREATE TABLE {$p}settings_log (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_login  VARCHAR(60)  NOT NULL DEFAULT '',
        field       VARCHAR(64)  NOT NULL DEFAULT '',
        old_value   TEXT             NULL,
        new_value   TEXT             NULL,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_created_at (created_at),
        KEY idx_field (field)
    ) $charset;";

    foreach ($sql as $query) {
        dbDelta($query);
    }
}
