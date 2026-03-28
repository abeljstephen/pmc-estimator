<?php
/**
 * WordPress / FluentSMTP SMTP credentials
 * DO NOT commit this file to version control.
 * Add wordpress-plugin/wp-config.php to .gitignore
 */

// FluentSMTP — Gmail "Other SMTP"
define('FLUENTMAIL_SMTP_USERNAME', 'abeljstephen@gmail.com');
define('FLUENTMAIL_SMTP_PASSWORD', 'N@z@reth1231999');

/**
 * Hook to inject credentials into FluentSMTP at runtime.
 * Place this in your theme's functions.php or a mu-plugin
 * if FluentSMTP does not natively read these constants.
 */
add_filter('fluentmail_connection_settings', function ($settings) {
    if (!empty($settings['username'])) {
        $settings['username'] = FLUENTMAIL_SMTP_USERNAME;
        $settings['password'] = FLUENTMAIL_SMTP_PASSWORD;
    }
    return $settings;
});
