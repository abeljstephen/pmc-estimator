<?php
/**
 * Plugin Name:       PMC Estimator
 * Plugin URI:        https://icarenow.io/estimator
 * Description:       Probability-based project cost & schedule estimator using SACO (Shape-Adaptive Copula Optimization). Add [pmc_estimator] to any page.
 * Version:           2.0.0
 * Author:            iCareNOW
 * Author URI:        https://icarenow.io
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       pmc-estimator
 */

if ( ! defined( 'ABSPATH' ) ) exit; // Prevent direct access

define( 'PMC_ESTIMATOR_VERSION', '2.0.0' );
define( 'PMC_ESTIMATOR_DIR', plugin_dir_path( __FILE__ ) );
define( 'PMC_ESTIMATOR_URL', plugin_dir_url( __FILE__ ) );

/**
 * Register and enqueue assets only on pages that use the shortcode.
 */
function pmc_estimator_enqueue_assets() {
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'pmc_estimator' ) ) return;

    // Chart.js from CDN — no local vendor files needed
    wp_enqueue_script(
        'chartjs',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
        [],
        '4.4.0',
        true
    );

    // Three.js r134 + OrbitControls — for 3D visualizations
    wp_enqueue_script(
        'threejs',
        'https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js',
        [],
        '0.134.0',
        true
    );
    wp_enqueue_script(
        'threejs-orbit-controls',
        'https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/controls/OrbitControls.js',
        ['threejs'],
        '0.134.0',
        true
    );

    // SACO computation engine — ported from GAS, runs entirely in browser, no server calls
    wp_enqueue_script( 'pmc-baseline',  PMC_ESTIMATOR_URL . 'assets/js/engine/baseline.js',  [],               PMC_ESTIMATOR_VERSION, true );
    wp_enqueue_script( 'pmc-copula',    PMC_ESTIMATOR_URL . 'assets/js/engine/copula.js',    ['pmc-baseline'], PMC_ESTIMATOR_VERSION, true );
    wp_enqueue_script( 'pmc-optimizer', PMC_ESTIMATOR_URL . 'assets/js/engine/optimizer.js', ['pmc-copula'],   PMC_ESTIMATOR_VERSION, true );
    wp_enqueue_script( 'pmc-saco',      PMC_ESTIMATOR_URL . 'assets/js/engine/saco.js',      ['pmc-optimizer'],PMC_ESTIMATOR_VERSION, true );

    // 3D visualizations (Three.js-based)
    wp_enqueue_script( 'pmc-viz3d', PMC_ESTIMATOR_URL . 'assets/js/engine/viz3d.js', ['threejs-orbit-controls'], PMC_ESTIMATOR_VERSION, true );

    // Main app UI
    wp_enqueue_script( 'pmc-app', PMC_ESTIMATOR_URL . 'assets/js/app.js', ['pmc-saco', 'chartjs', 'pmc-viz3d'], PMC_ESTIMATOR_VERSION, true );
    wp_enqueue_style(  'pmc-estimator', PMC_ESTIMATOR_URL . 'assets/css/estimator.css', [], PMC_ESTIMATOR_VERSION );
}
add_action( 'wp_enqueue_scripts', 'pmc_estimator_enqueue_assets' );

/**
 * [pmc_estimator] shortcode — outputs the app container.
 */
function pmc_estimator_shortcode( $atts ) {
    ob_start();
    include PMC_ESTIMATOR_DIR . 'templates/estimator.html';
    return ob_get_clean();
}
add_shortcode( 'pmc_estimator', 'pmc_estimator_shortcode' );

/**
 * Add Content-Security-Policy header on pages that use the [pmc_estimator] shortcode.
 * estimator.html is a template fragment (no DOCTYPE) so CSP must be set at the HTTP level.
 */
function pmc_estimator_add_csp_header() {
    if ( ! is_singular() ) return;
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'pmc_estimator' ) ) return;
    header( "Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline' 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'unsafe-inline' 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self'; font-src https://cdn.jsdelivr.net data:;" );
}
add_action( 'send_headers', 'pmc_estimator_add_csp_header' );
