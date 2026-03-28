<?php
/**
 * Plugin Name:       ProjectCare by iCareNOW
 * Plugin URI:        https://icarenow.io/projectcare
 * Description:       Probability-based project cost & schedule estimator using SACO (Shape-Adaptive Copula Optimization). Add [projectcare] to any page.
 * Version:           1.0.0
 * Author:            iCareNOW
 * Author URI:        https://icarenow.io
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       projectcare
 */

if ( ! defined( 'ABSPATH' ) ) exit; // Prevent direct access

define( 'PROJECTCARE_VERSION', '1.0.0' );
define( 'PROJECTCARE_DIR', plugin_dir_path( __FILE__ ) );
define( 'PROJECTCARE_URL', plugin_dir_url( __FILE__ ) );

/**
 * Register and enqueue assets only on pages that use the shortcode.
 */
function projectcare_enqueue_assets() {
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'projectcare' ) ) return;

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
    wp_enqueue_script( 'projectcare-baseline',  PROJECTCARE_URL . 'assets/js/engine/baseline.js',  [],                      PROJECTCARE_VERSION, true );
    wp_enqueue_script( 'projectcare-copula',    PROJECTCARE_URL . 'assets/js/engine/copula.js',    ['projectcare-baseline'], PROJECTCARE_VERSION, true );
    wp_enqueue_script( 'projectcare-optimizer', PROJECTCARE_URL . 'assets/js/engine/optimizer.js', ['projectcare-copula'],   PROJECTCARE_VERSION, true );
    wp_enqueue_script( 'projectcare-saco',      PROJECTCARE_URL . 'assets/js/engine/saco.js',      ['projectcare-optimizer'],PROJECTCARE_VERSION, true );

    // 3D visualizations (Three.js-based)
    wp_enqueue_script( 'projectcare-viz3d', PROJECTCARE_URL . 'assets/js/engine/viz3d.js', ['threejs-orbit-controls'], PROJECTCARE_VERSION, true );

    // Main app UI
    wp_enqueue_script( 'projectcare-app', PROJECTCARE_URL . 'assets/js/app.js', ['projectcare-saco', 'chartjs', 'projectcare-viz3d'], PROJECTCARE_VERSION, true );
    wp_enqueue_style(  'projectcare',     PROJECTCARE_URL . 'assets/css/estimator.css', [], PROJECTCARE_VERSION );
}
add_action( 'wp_enqueue_scripts', 'projectcare_enqueue_assets' );

/**
 * [projectcare] shortcode — outputs the app container.
 */
function projectcare_shortcode( $atts ) {
    ob_start();
    include PROJECTCARE_DIR . 'templates/estimator.html';
    return ob_get_clean();
}
add_shortcode( 'projectcare', 'projectcare_shortcode' );

/**
 * Add Content-Security-Policy header on pages that use the [projectcare] shortcode.
 * estimator.html is a template fragment (no DOCTYPE) so CSP must be set at the HTTP level.
 */
function projectcare_add_csp_header() {
    if ( ! is_singular() ) return;
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'projectcare' ) ) return;
    header( "Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline' 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'unsafe-inline' 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self'; font-src https://cdn.jsdelivr.net data:;" );
}
add_action( 'send_headers', 'projectcare_add_csp_header' );
