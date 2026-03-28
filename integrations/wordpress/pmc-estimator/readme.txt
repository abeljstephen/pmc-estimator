===  PMC Estimator ===
Contributors:      icarenow
Tags:              project management, probability, estimation, PERT, monte carlo, schedule, cost
Requires at least: 6.0
Tested up to:      6.7
Requires PHP:      7.4
Stable tag:        1.0.0
License:           GPLv2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Probability-based project cost & schedule estimator. Enter Optimistic / Most Likely / Pessimistic estimates and see full probability curves instantly.

== Description ==

PMC Estimator uses three-point estimation (PERT / Beta distribution) combined with SACO (Shape-Adaptive Copula Optimization) to turn your O/M/P estimates into actionable probability curves.

**Features:**
* Instant PDF and CDF probability curves from three-point estimates
* Multiple optimization strategies (Conservative, General, Unconstrained)
* Monte Carlo simulation
* Group mode — combine multiple tasks into an aggregate distribution
* Import tasks from CSV or Excel
* Works entirely in the browser — no data sent to any server
* Runs offline once loaded

**Usage:**
Add `[pmc_estimator]` to any page or post.

== Installation ==

1. Upload the `pmc-estimator` folder to `/wp-content/plugins/`
2. Activate the plugin in WordPress admin → Plugins
3. Create or edit a page, add `[pmc_estimator]` to the content
4. Publish the page

== Changelog ==

= 1.0.0 =
* Initial release
