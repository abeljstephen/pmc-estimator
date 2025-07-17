// Part 1: Configuration and Personas

/**
 * SECTION 0: CONFIG
 * Configuration object for the add-on and web app.
 */
const CONFIG = {
    PAGE_TITLE: 'Interactive Probability Simulator',
    SHOW_EXECUTING_USER: false,
    GOOGLE_CHARTS_URL: 'https://www.gstatic.com/charts/loader.js',
    MATHJAX_URL: 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js',
    GOOGLE_FONTS_URL: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;600&display=swap',
    LOADING_MESSAGE: 'Loading Interactive Probability Simulator...',
    INITIAL_SETUP_TITLE: 'Initial Setup / User Choices',
    INITIAL_SETUP_DESCRIPTION: 'Choose a task and define your target value or confidence level to begin.',
    EXPLORATION_RESULTS_HEADER: 'Exploration Results',
    EXPLORATION_RESULTS_DEFAULT_TEXT: 'Select a mode to view results.',
    TASK_SELECT_LABEL: 'Select Task:',
    TASK_LOADING_MESSAGE: 'Loading tasks...',
    MODE_SELECT_LABEL: 'Target Mode:',
    TARGET_MODE_LABEL: 'Target',
    CONFIDENCE_MODE_LABEL: 'Confidence',
    TARGET_VALUE_LABEL: 'Value',
    CONFIDENCE_LEVEL_LABEL: 'Value',
    DEFAULT_CONFIDENCE_LEVEL: '90',
    OPTIMIZE_LABEL: 'Optimize:',
    OPTIMIZE_NO_LABEL: 'No',
    OPTIMIZE_YES_LABEL: 'Yes',
    EXPLORE_MODE_DEFAULT_TITLE_PREFIX: 'Adjust Sliders to Explore',
    EXPLORE_MODE_DEFAULT_TITLE_SUFFIX: 'Target Value Probability',
    BUDGET_FLEXIBILITY_LABEL: 'Budget Flexibility (%)',
    SCHEDULE_FLEXIBILITY_LABEL: 'Schedule Flexibility (%)',
    SCOPE_CERTAINTY_LABEL: 'Scope Certainty (%)',
    QUALITY_TOLERANCE_LABEL: 'Tolerance for Poor Quality (%)',
    BUDGET_FLEXIBILITY_HELP_TEXT: 'Higher flexibility allows for a larger budget buffer.',
    SCHEDULE_FLEXIBILITY_HELP_TEXT: 'Higher flexibility extends the timeline.',
    SCOPE_CERTAINTY_HELP_TEXT: 'Higher certainty reduces outcome range.',
    QUALITY_TOLERANCE_HELP_TEXT: 'Higher tolerance accepts more defects or lower quality.',
    USE_CASE_LABEL: 'Use Case',
    USE_CASE_WHEN_LABEL: 'When to Use',
    USE_CASE_HOW_LABEL: 'How to Use',
    USE_CASE_BENEFIT_LABEL: 'How It Helps',
    PDF_USE_CASE_WHEN: 'Visualize the likelihood of different outcomes and how adjustments affect the distribution.',
    PDF_USE_CASE_HOW: 'Adjust sliders to see distribution changes.',
    PDF_USE_CASE_BENEFIT: 'Understand the impact of decisions on outcome distribution.',
    CDF_USE_CASE_WHEN: 'Explore cumulative probabilities and how adjustments improve target achievement.',
    CDF_USE_CASE_HOW: 'View baseline and adjusted CDFs to compare outcomes.',
    CDF_USE_CASE_BENEFIT: 'Guides strategic adjustments for better outcomes.',
    SLIDER_COMBINATION_LABEL: 'Slider Combination',
    FILTER_LABEL: 'Filter:',
    FILTER_CURRENT_LABEL: 'Current Selection',
    FILTER_ALL_LABEL: 'All',
    FILTER_ABOVE_50_LABEL: 'Above 50%',
    FILTER_ABOVE_75_LABEL: 'Above 75%',
    FILTER_BELOW_50_LABEL: 'Below 50%',
    FILTER_OPTIMIZED_LABEL: 'Optimized',
    FILTER_HELP_TEXT: 'This table shows combinations of slider settings and their probability of achieving the target value. Filter options: \'Current Selection\' shows current settings, \'All\' shows all combinations, \'Above 50%\'/\'Above 75%\' show combinations with probability above 50%/75%, \'Below 50%\' shows below 50%, and \'Optimized\' shows the optimal settings. Use the filter to narrow down results, navigate pages, and adjust sliders to test scenarios.',
    COMBINATION_TABLE_DEFAULT_TEXT: 'No combinations available',
    PREV_PAGE_LABEL: 'Previous',
    PAGE_INFO_DEFAULT_TEXT: 'Page 1 of 1',
    NEXT_PAGE_LABEL: 'Next',
    INSIGHTS_RECOMMENDATIONS_LABEL: 'Insights and Recommendations',
    RECOMMENDATIONS_HEADER: 'Recommendations',
    STATISTICAL_METRICS_TITLE: 'Statistical Metrics',
    METRIC_HEADER: 'Metric',
    PURPOSE_HEADER: 'Purpose',
    GENERAL_FORMULA_HEADER: 'General Formula',
    DYNAMIC_FORMULA_HEADER: 'Formula with Dynamic Variables',
    RESULT_HEADER: 'Result (Dynamic)',
    PERT_MEAN_LABEL: 'PERT Mean',
    PERT_MEAN_PURPOSE: 'Weighted average emphasizing mode',
    PERT_MEAN_FORMULA: 'E[X] = (a + 4m + b) / 6',
    PERT_MEAN_DYNAMIC_FORMULA: 'E[X] = (<span class="dynamic" id="pert-a"></span> + 4×<span class="dynamic" id="pert-m"></span> + <span class="dynamic" id="pert-b"></span>) / 6',
    TRIANGLE_MEAN_LABEL: 'Triangle Mean',
    TRIANGLE_MEAN_PURPOSE: 'Simple average of estimates',
    TRIANGLE_MEAN_FORMULA: 'E[X] = (a + m + b) / 3',
    TRIANGLE_MEAN_DYNAMIC_FORMULA: 'E[X] = (<span class="dynamic" id="tri-a"></span> + <span class="dynamic" id="tri-m"></span> + <span class="dynamic" id="tri-b"></span>) / 3',
    BETA_MEAN_LABEL: 'Beta Mean',
    BETA_MEAN_PURPOSE: 'Scaled mean of beta distribution',
    BETA_MEAN_FORMULA: 'E[X] = a + (b - a) × α / (α + β)',
    BETA_MEAN_DYNAMIC_FORMULA: 'E[X] = <span class="dynamic" id="beta-a"></span> + (<span class="dynamic" id="beta-b"></span> - <span class="dynamic" id="beta-a"></span>) × 2 / (2 + 5)',
    MC_UNSMOOTHED_MEAN_LABEL: 'MC Unsmoothed Mean',
    MC_UNSMOOTHED_MEAN_PURPOSE: 'Average of sampled MC values',
    MC_UNSMOOTHED_MEAN_FORMULA: 'E[X] = Σ(xᵢ·yᵢ) / Σ(yᵢ)',
    MC_UNSMOOTHED_MEAN_DYNAMIC_FORMULA: 'Sum(xᵢ·yᵢ)/Sum(yᵢ), from raw MC samples',
    MC_SMOOTHED_MEAN_LABEL: 'MC Smoothed Mean',
    MC_SMOOTHED_MEAN_PURPOSE: 'KDE-weighted mean',
    MC_SMOOTHED_MEAN_FORMULA: 'E[X] = Σ(xᵢ·yᵢ·Δx) / Σ(yᵢ·Δx)',
    MC_SMOOTHED_MEAN_DYNAMIC_FORMULA: 'μ = <span class="dynamic" id="mc-smoothed-mean-value"></span> from smoothed KDE distribution',
    MC_SMOOTHED_MEDIAN_LABEL: 'MC Smoothed Median',
    MC_SMOOTHED_MEDIAN_PURPOSE: '50th percentile of smoothed curve',
    MC_SMOOTHED_MEDIAN_FORMULA: 'Median where CDF = 0.5',
    MC_SMOOTHED_MEDIAN_DYNAMIC_FORMULA: 'x such that Σ(yᵢ·Δx) = 0.5 (smoothed CDF midpoint)',
    STD_DEV_LABEL: 'Std Dev (MC Smoothed)',
    STD_DEV_PURPOSE: 'Spread of values around mean',
    STD_DEV_FORMULA: 'σ = √(Σ((xᵢ - μ)²·yᵢ·Δx)/Σ(yᵢ·Δx))',
    STD_DEV_DYNAMIC_FORMULA: 'σ = √(Σ((xᵢ - <span class="dynamic" id="std-mu"></span>)²·yᵢ·Δx)/Σ(yᵢ·Δx))',
    VARIANCE_LABEL: 'Variance (MC Smoothed)',
    VARIANCE_PURPOSE: 'Dispersion measure',
    VARIANCE_FORMULA: 'Var = Σ((xᵢ - μ)²·yᵢ·Δx)/Σ(yᵢ·Δx)',
    VARIANCE_DYNAMIC_FORMULA: 'Var = Σ((xᵢ - <span class="dynamic" id="var-mu"></span>)²·yᵢ·Δx)/Σ(yᵢ·Δx)',
    SKEWNESS_LABEL: 'Skewness (MC Smoothed)',
    SKEWNESS_PURPOSE: 'Asymmetry of distribution',
    SKEWNESS_FORMULA: 'Skew = (Σ((xᵢ - μ)³·yᵢ·Δx)/Σ(yᵢ·Δx)) / σ³',
    SKEWNESS_DYNAMIC_FORMULA: 'Skew = (Σ((xᵢ - <span class="dynamic" id="skew-mu"></span>)³·yᵢ·Δx)/Σ(yᵢ·Δx)) / (<span class="dynamic" id="skew-sigma"></span>)³',
    CV_LABEL: 'Coefficient of Variation',
    CV_PURPOSE: 'Relative standard deviation',
    CV_FORMULA: 'CV = σ / μ',
    CV_DYNAMIC_FORMULA: 'CV = <span class="dynamic" id="cv-sigma"></span> / <span class="dynamic" id="cv-mu"></span>',
    CI_LABEL: '95% Confidence Interval',
    CI_PURPOSE: 'Range with 95% certainty around mean',
    CI_FORMULA: 'CI = μ ± 1.96 × (σ / √n)',
    CI_DYNAMIC_FORMULA: 'CI = <span class="dynamic" id="ci-mu"></span> ± 1.96 × (<span class="dynamic" id="ci-sigma"></span> / √1000)',
    VAR_LABEL: 'Value at Risk (VaR @ 95%)',
    VAR_PURPOSE: 'Risk threshold at 95%',
    VAR_FORMULA: 'VaR = x where P(X > x) = 5%',
    VAR_DYNAMIC_FORMULA: 'VaR = <span class="dynamic" id="var-value"></span> (smoothed CDF where tail = 5%)',
    CVAR_LABEL: 'Conditional VaR (CVaR @ 95%)',
    CVAR_PURPOSE: 'Expected tail loss beyond VaR',
    CVAR_FORMULA: 'CVaR = E[X | X > VaR]',
    CVAR_DYNAMIC_FORMULA: 'Mean of xᵢ > <span class="dynamic" id="cvar-var"></span> from smoothed distribution',
    BACK_TO_TOP_LABEL: 'Back to Top',
    ERROR_NO_SIMULATOR_CONTAINER: 'Probability simulator container not found',
    ERROR_PAGE_LOAD_FAILED: 'Error: Page failed to load. Please refresh or contact support.',
    ERROR_NO_VALID_TASKS: 'No valid tasks available',
    ERROR_NO_VALID_TASKS_MESSAGE: 'Error: No valid tasks found (best case < most likely < worst case not satisfied). Using default values. Please contact support.',
    ERROR_NO_TASK_SELECT: 'task-select element not found',
    ERROR_INVALID_TASK_DATA: 'Invalid task data.',
    ERROR_NO_EXPLORE_MODE_TITLE: 'Explore mode title element not found',
    EXPLORE_MODE_OPTIMIZED_TITLE: 'View Optimized Settings for Maximum Outcome',
    ERROR_TASK_TIMEOUT: 'fetchTasks timed out',
    ERROR_TASK_TIMEOUT_MESSAGE: 'Error: Task loading timed out. Try refreshing the page, using incognito mode, or a different browser (e.g., Firefox). Please contact support if the issue persists.',
    ERROR_NO_SHEET_ID: 'sheetId is not defined',
    ERROR_NO_SHEET_ID_MESSAGE: 'Error: Spreadsheet ID not provided. Please contact support.',
    ERROR_NO_TASKS_AVAILABLE: 'Error: No tasks available',
    ERROR_CONTACT_SUPPORT: 'Please contact support.',
    ERROR_FETCH_TASKS: 'Error fetching tasks:',
    ERROR_FETCH_TASKS_MESSAGE: 'Error loading tasks:',
    ERROR_INVALID_TASK: 'Error: Please select a valid task.',
    ERROR_DATA_TIMEOUT: 'fetchTargetProbabilityData timed out',
    ERROR_DATA_TIMEOUT_MESSAGE: 'Error: Data loading timed out. Try refreshing the page, using incognito mode, or a different browser (e.g., Firefox). Please contact support if the issue persists.',
    ERROR_API_FAILURE: 'Error: Unable to load results due to API failure.',
    ERROR_INVALID_API_RESPONSE: 'Invalid API response:',
    DEFAULT_TARGET_VALUE: 2400.00,
    DEFAULT_CONFIDENCE_LEVEL: 0.9,
    DEFAULT_ORIGINAL_PROBABILITY: 54.0,
    DEFAULT_ADJUSTED_PROBABILITY: 97.6,
    DEFAULT_VALUE_AT_CONFIDENCE: 2325.50,
    DEFAULT_ORIGINAL_VALUE_AT_CONFIDENCE: 2504.91,
    DEFAULT_OPTIMAL_PROBABILITY: 100.0,
    DEFAULT_VARIANCE_SCALE: 0.8,
    ERROR_RENDERING_PDF: 'Error rendering PDF.',
    PDF_CHART_TITLE: 'Interactive Probability Simulator - PDF',
    PDF_X_AXIS_LABEL: 'Value',
    PDF_Y_AXIS_LABEL: 'Probability Density',
    PDF_ORIGINAL_LABEL: 'Original PDF',
    PDF_ADJUSTED_LABEL: 'Slider Adjusted PDF',
    PDF_ORIGINAL_TARGET_LABEL: 'Original Target',
    PDF_ADJUSTED_TARGET_LABEL: 'Adjusted Target',
    PDF_OPTIMIZED_ADJUSTED_LABEL: 'Optimized Adjusted',
    PDF_ORIGINAL_ANNOTATION: 'Original - value:',
    PDF_ADJUSTED_ANNOTATION: 'Adjusted - value:',
    PDF_OPTIMIZED_ANNOTATION: 'Optimized Adjusted - value:',
    PDF_ORIGINAL_TOOLTIP: 'Original - value:',
    PDF_ADJUSTED_TOOLTIP: 'Adjusted - value:',
    PDF_OPTIMIZED_TOOLTIP: 'Optimized Adjusted - value:',
    WARNING_OPTIMAL_VALUE_ADJUSTED: 'Optimal value',
    ERROR_RENDERING_CDF: 'Error rendering CDF.',
    CDF_CHART_TITLE: 'Interactive Probability Simulator - CDF',
    CDF_X_AXIS_LABEL: 'Value',
    CDF_Y_AXIS_LABEL: 'Cumulative Probability',
    CDF_ORIGINAL_LABEL: 'Original CDF',
    CDF_ADJUSTED_LABEL: 'Slider Adjusted CDF',
    CDF_ORIGINAL_TARGET_LABEL: 'Original Target',
    CDF_ADJUSTED_TARGET_LABEL: 'Adjusted Target',
    CDF_OPTIMIZED_ADJUSTED_LABEL: 'Optimized Adjusted',
    CDF_ORIGINAL_ANNOTATION: 'Original CDF - value:',
    CDF_ADJUSTED_ANNOTATION: 'Slider Adjusted CDF - value:',
    CDF_OPTIMIZED_ANNOTATION: 'Optimized Adjusted CDF - value:',
    CDF_ORIGINAL_TOOLTIP: 'Original - value:',
    CDF_ADJUSTED_TOOLTIP: 'Adjusted - value:',
    CDF_OPTIMIZED_TOOLTIP: 'Optimized Adjusted - value:',
    ERROR_NO_EXPLORE_RESULTS: 'Explore results element not found',
    ERROR_INVALID_TASK_RESULTS_MESSAGE: 'Error: Invalid task data (best case < most likely < worst case not satisfied) or no task selected. Using default values (target: 2400.00). Please select a valid task or contact support.',
    WARNING_NO_METRICS_UPDATE: 'Skipping metrics table update due to invalid task or missing data',
    WARNING_ELEMENT_NOT_FOUND: 'Element with ID not found in DOM:',
    ERROR_NO_COMBINATION_TABLE: 'Combination table body not found',
    ERROR_NO_COMBINATION_DATA: 'Error: Unable to load combination data due to API failure.',
    WARNING_NO_COMBINATIONS: 'No combinations available in targetProbabilityData',
    WARNING_COMBINATION_LIMIT: 'Limiting combinations from',
    ERROR_NO_COMBINATIONS_MATCH: 'No combinations match the "{filterValue}" filter. Try adjusting sliders or selecting a different filter.',
    ERROR_INVALID_TASK_RECOMMENDATIONS: 'Error: Please select a valid task or check API connectivity.',
    RECOMMENDATIONS_OVERVIEW_HEADER: 'Overview',
    RECOMMENDATIONS_OVERVIEW_TEXT: 'Starting with your initial estimates (Optimistic: {bestCase}, Most Likely: {mostLikely}, Pessimistic: {worstCase}), we’ve converted them into a probability model to calculate your <strong>risk profile</strong>, which reflects the likelihood of meeting your target of {targetValue} units or achieving a value at your confidence level of {confidenceLevel}%:',
    RECOMMENDATIONS_BASELINE_TEXT: 'Baseline Risk Profile',
    RECOMMENDATIONS_CURRENT_TEXT: 'Current Risk Profile',
    RECOMMENDATIONS_OPTIMIZED_TEXT: 'Optimized Risk Profile',
    RECOMMENDATIONS_SLIDERS_INTRO: 'The sliders enable you to manage these risks. The list below details each slider’s individual impact, with their combined effect driving {adjProb}% or {valueAtConfidence}, as shown in the <strong>Slider Combination Table</strong>.',
    RECOMMENDATIONS_SLIDERS_HEADER: 'Why Sliders Are Powerful for Risk Management',
    RECOMMENDATIONS_SLIDERS_TEXT: 'Your project estimates are <strong>unitless</strong>—they could represent cost, duration, risk, quality, or another metric. The sliders start at <strong>0%</strong>, assuming no tolerance for overruns, delays, scope changes, or quality issues beyond your initial estimates. By <strong>increasing</strong> or <strong>decreasing</strong> the sliders, you can:',
    RECOMMENDATIONS_CONTROLLED_OVERRUNS_TEXT: 'Tolerate Controlled Overruns',
    RECOMMENDATIONS_SCOPE_QUALITY_TEXT: 'Manage Scope and Quality',
    RECOMMENDATIONS_RISK_SCENARIOS_TEXT: 'Test Risk Scenarios',
    RECOMMENDATIONS_SLIDER_TABLE_TEXT: 'Leverage the Slider Combination Table',
    RECOMMENDATIONS_OPTIMIZE_TEXT: 'Optimize Decisions',
    RECOMMENDATIONS_SLIDERS_IMPACT_TEXT: 'Sliders empower you to refine uncertain estimates, improving your <strong>risk profile</strong> from {baselineRiskLevel} to {currentRiskLevel} and potentially {optimalRiskLevel}.',
    RECOMMENDATIONS_MITIGATION_HEADER: 'How Sliders Mitigate Project Risks',
    WHAT_IT_DOES_LABEL: 'What It Does',
    POTENTIAL_IMPACT_LABEL: 'Potential Impact',
    DISTRIBUTION_IMPACT_LABEL: 'Impact on Distribution and Probability',
    MATHEMATICAL_FORMULA_LABEL: 'Mathematical Formula',
    WHY_IT_HELPS_LABEL: 'Why It Helps',
    NEXT_STEP_LABEL: 'Next Step',
    BUDGET_FLEXIBILITY_DOES_TEXT: 'Tolerates <strong>cost overruns</strong> (e.g., budget, personnel). At 100%, you can overrun the project cost by double the Pessimistic estimate (from {worstCase} to {worstCaseDouble} units).',
    BUDGET_FLEXIBILITY_IMPACT_TEXT: 'Increasing from 0% to {budgetFlexibility}% shifts outcomes toward lower values (e.g., from {originalMean} to {adjustedMean} units), reducing <strong>cost overruns</strong>.',
    BUDGET_FLEXIBILITY_DISTRIBUTION_TEXT: '<strong>Increasing from 0% to {budgetFlexibility}% shifts the distribution left</strong>, lowering the mean, individually increasing the <strong>target probability</strong> for {targetValue} (e.g., contributes to {adjProb}%) or lowering the value at {confidenceLevel}% (e.g., to {valueAtConfidence}).',
    BUDGET_FLEXIBILITY_FORMULA: 'Adjusts mean: \\(\\mu\' = \\mu - f \\cdot (P - M) \\cdot (BF/100)\\), where \\(\\mu\\) = {originalMean}, \\(P\\) = {worstCase}, \\(M\\) = {mostLikely}, \\(BF\\) = {budgetFlexibility}%, \\(f\\) = 0.5.',
    BUDGET_FLEXIBILITY_HELPS_TEXT: 'Mitigates <strong>cost overruns</strong>, helping achieve {targetValue} if units are cost-related, improving the {currentRiskLevel} risk profile.',
    BUDGET_FLEXIBILITY_NEXT_STEP: 'Increase to 50–60% ({worstCase1_5}–{worstCase1_6} units) and check the <strong>PDF chart</strong> for a left-shifted curve (e.g., mean at {adjustedMean}).',
    SCHEDULE_FLEXIBILITY_DOES_TEXT: 'Tolerates <strong>schedule delays</strong>. At 100%, you can delay the project by double the Pessimistic estimate (from {worstCase} to {worstCaseDouble} units).',
    SCHEDULE_FLEXIBILITY_IMPACT_TEXT: 'Increasing from 0% to {scheduleFlexibility}% shifts outcomes left (e.g., from {originalMean} to {adjustedMean} units), minimizing <strong>schedule variance</strong>.',
    SCHEDULE_FLEXIBILITY_DISTRIBUTION_TEXT: '<strong>Increasing from 0% to {scheduleFlexibility}% shifts the distribution left</strong>, reducing the mean, individually increasing the <strong>target probability</strong> for {targetValue} (e.g., contributes to {adjProb}%) or reducing the value at {confidenceLevel}%.',
    SCHEDULE_FLEXIBILITY_FORMULA: 'Adjusts mean: \\(\\mu\' = \\mu - f \\cdot (P - M) \\cdot (SF/100)\\), where \\(\\mu\\) = {originalMean}, \\(P\\) = {worstCase}, \\(M\\) = {mostLikely}, \\(SF\\) = {scheduleFlexibility}%, \\(f\\) = 0.5.',
    SCHEDULE_FLEXIBILITY_HELPS_TEXT: 'Reduces <strong>schedule delays</strong>, aiding {targetValue} for time-based estimates, improving the {currentRiskLevel} risk profile.',
    SCHEDULE_FLEXIBILITY_NEXT_STEP: 'Increase to 50–60% ({worstCase1_5}–{worstCase1_6} units) and check the <strong>CDF chart</strong> for higher confidence at {targetValue}.',
    SCOPE_CERTAINTY_DOES_TEXT: 'Reduces <strong>probability of scope creep</strong> by defining deliverables. At 100%, no <strong>scope creep</strong> anticipated; at {scopeCertainty}%, {scopeCreep}% chance of scope increase.',
    SCOPE_CERTAINTY_IMPACT_TEXT: 'Increasing from 0% to {scopeCertainty}% narrows outcome range (e.g., variance drops by ~{varianceReduction}%), focusing on {targetValue}.',
    SCOPE_CERTAINTY_DISTRIBUTION_TEXT: '<strong>Increasing from 0% to {scopeCertainty}% narrows the distribution</strong>, reducing variance, individually increasing the <strong>target probability</strong> for {targetValue} (e.g., contributes to {adjProb}%) by concentrating outcomes.',
    SCOPE_CERTAINTY_FORMULA: 'Scales variance: \\(\\sigma\'^2 = \\sigma^2 \\cdot (1 - SC/100)\\), where \\(\\sigma^2\\) = {originalVariance}, \\(SC\\) = {scopeCertainty}%. Probability of scope creep = {scopeCreep}%.',
    SCOPE_CERTAINTY_HELPS_TEXT: 'Prevents <strong>scope creep</strong>, ensuring predictability for {targetValue}, improving the {currentRiskLevel} risk profile.',
    SCOPE_CERTAINTY_NEXT_STEP: 'Increase to 75% for {scopeCreep}% scope creep risk and check the <strong>PDF chart</strong> for a narrower distribution.',
    QUALITY_TOLERANCE_DOES_TEXT: 'Manages <strong>defects</strong> or <strong>quality trade-offs</strong>. At 100%, allows maximum <strong>defects</strong> or <strong>quality trade-offs</strong>; at 0%, prioritizes <strong>quality assurance</strong>.',
    QUALITY_TOLERANCE_IMPACT_TEXT: 'Increasing from 0% to {qualityTolerance}% shifts outcomes right (more chance of exceeding {targetValue}); decreasing below {qualityTolerance}% reduces extreme outcomes.',
    QUALITY_TOLERANCE_DISTRIBUTION_TEXT: '<strong>Increasing from 0% to {qualityTolerance}% shifts the distribution right</strong>, increasing skewness or upper bound, individually decreasing the <strong>target probability</strong> for {targetValue} (e.g., reduces from {higherProb}% to {adjProb}%). <strong>Decreasing</strong> reduces the right tail, increasing <strong>target probability</strong>.',
    QUALITY_TOLERANCE_FORMULA: 'Adjusts upper bound or skewness: \\(b\' = b + (P - M) \\cdot (QT/100)\\), where \\(b\\) = {worstCase}, \\(QT\\) = {qualityTolerance}%, \\(P\\) = {worstCase}, \\(M\\) = {mostLikely}.',
    QUALITY_TOLERANCE_HELPS_TEXT: 'Minimizes <strong>defects</strong> and overruns, ensuring reliable {targetValue}, improving the {currentRiskLevel} risk profile.',
    QUALITY_TOLERANCE_NEXT_STEP: 'Decrease to 40–50% for <strong>quality assurance</strong> and check the <strong>CDF chart</strong> for reduced right tail (less chance of exceeding {worstCase}).',
    COMBINED_EFFECT_LABEL: 'Combined Effect',
    COMBINED_EFFECT_DOES_TEXT: 'Collectively adjusts the distribution based on all slider settings to achieve {adjProb}% for {targetValue} or {valueAtConfidence} at {confidenceLevel}%.',
    COMBINED_EFFECT_IMPACT_TEXT: 'Combines individual shifts and narrowing to achieve {adjProb}%, reducing <strong>cost overruns</strong>, <strong>schedule delays</strong>, <strong>scope creep</strong>, and <strong>defects</strong>.',
    COMBINED_EFFECT_DISTRIBUTION_TEXT: 'Combines all sliders’ effects, adjusting the mean, variance, and shape to achieve {adjProb}% for {targetValue} or {valueAtConfidence} at {confidenceLevel}%, as detailed in the <strong>Slider Combination Table</strong>.',
    COMBINED_EFFECT_FORMULA: 'Final mean and variance: \\(\\mu_{\\text{final}} = \\mu - f \\cdot (P - M) \\cdot (BF/100 + SF/100)\\), \\(\\sigma_{\\text{final}}^2 = \\sigma^2 \\cdot (1 - SC/100)\\), adjusted by \\(QT\\)-scaled upper bound, where \\(\\mu\\) = {originalMean}, \\(\\sigma^2\\) = {originalVariance}, \\(BF\\) = {budgetFlexibility}%, \\(SF\\) = {scheduleFlexibility}%, \\(SC\\) = {scopeCertainty}%, \\(QT\\) = {qualityTolerance}%.',
    COMBINED_EFFECT_HELPS_TEXT: 'Delivers {adjProb}% for {targetValue}, improving the {currentRiskLevel} risk profile to {optimalRiskLevel}.',
    COMBINED_EFFECT_NEXT_STEP: 'Adjust all sliders as recommended and check the <strong>Slider Combination Table</strong> (filter “Above 75%” or “Optimized”) for the final {adjProb}% or {valueAtConfidence}.',
    RECOMMENDATIONS_EXAMPLE_HEADER: 'Practical Example',
    RECOMMENDATIONS_EXAMPLE_TEXT: 'For your project with estimates (Optimistic: {bestCase}, Most Likely: {mostLikely}, Pessimistic: {worstCase}) and a target of {targetValue} at {confidenceLevel}% confidence:',
    RECOMMENDATIONS_EXAMPLE_BASELINE: 'Baseline Risk Profile',
    RECOMMENDATIONS_EXAMPLE_CURRENT: 'Current Risk Profile',
    RECOMMENDATIONS_EXAMPLE_IMPROVE: 'To improve',
    RECOMMENDATIONS_EXAMPLE_CHECK: 'Check',
    ERROR_NO_TARGET_VALUE: 'Please enter a target value.',
    ERROR_INVALID_TARGET_VALUE: 'Value must be between',
    ERROR_NO_CONFIDENCE_LEVEL: 'Please enter a confidence level.',
    ERROR_INVALID_CONFIDENCE_LEVEL: 'Must be an integer between 1 and 100.',
    DEFAULT_BEST_CASE: 1800.00,
    DEFAULT_MOST_LIKELY: 2400.00,
    DEFAULT_WORST_CASE: 3000.00,
    DEFAULT_ORIGINAL_MEAN: 2400.00,
    DEFAULT_ADJUSTED_MEAN: 2420.50,
    DEFAULT_STD_DEV: 180.50,
    DEFAULT_VARIANCE: 32580.25,
    DEFAULT_SKEWNESS: 0.05,
    DEFAULT_CV: 0.075,
    DEFAULT_CI: '[2079.19, 2761.81]',
    DEFAULT_VAR: 2520.00,
    DEFAULT_CVAR: 2520.00,
    COMBINATION_TABLE_COL_COMBINATION: 'Combo',
    COMBINATION_TABLE_COL_BUDGET: 'Budget Flex (%)',
    COMBINATION_TABLE_COL_SCHEDULE: 'Schedule Flex (%)',
    COMBINATION_TABLE_COL_SCOPE: 'Scope Cert (%)',
    COMBINATION_TABLE_COL_QUALITY: 'Tol Poor Qual (%)',
    COMBINATION_TABLE_COL_PROBABILITY: 'Probability (%)',
    COMBINATION_TABLE_COL_BALANCE: 'Balance',
    COMBINATION_TABLE_COL_SUCCESS: 'Success Chance',
    COMBINATION_TABLE_SUCCESS_TEXT: 'success',
    COMBINATION_TABLE_FAILURE_TEXT: 'failure',
    COMBINATION_TABLE_BALANCED: 'Balanced',
    COMBINATION_TABLE_UNBALANCED: 'Unbalanced',
    RISK_LEVEL_VERY_LOW: 'very low risk',
    RISK_LEVEL_LOW: 'low risk',
    RISK_LEVEL_MODERATE: 'moderate risk',
    RISK_LEVEL_HIGH: 'high risk',
    WARNING_OPTIMAL_SLIDER_SETTINGS_MISSING: 'Optimal slider settings missing in API response',
    ADDON_CALCULATIONS_SHEET_NAME: 'Estimate Calculations Addon', // Distinct sheet name for add-on
    SESSION_ID_PREFIX: 'Session_' // Prefix for unique session IDs
};
const DEPLOYMENT_ID = 'AKfycbxPMikpb1W7qHCYwuIfx1696rU-rsnZka_SRhdSL6x8r8EnhRVbwQ1Kofdjm8jIFcaL';
const ESTIMATION_DATA_SHEET_NAME = 'Estimation Data';
const DEFAULT_PROJECT_NAME = 'Untitled Project';
const DEFAULT_ROW_INDEX = 2;
const MIN_RANGE_MULTIPLIER = 0.1;
const DOGET_TIMEOUT_MS = 15000;

/**
 * SECTION 1: PERSONAS
 * Determines the execution context (add-on or web app) and returns configuration.
 * @param {Object} e - HTTP event object (for web app).
 * @param {string} context - Execution context ('doGet', 'showPlotWeb', 'addPertColumns').
 * @returns {Object} Configuration object with mode, sheetId, sheetName, defaultTask, and other settings.
 */
function personas(e, context) {
    Logger.log('personas called with event: ' + JSON.stringify(e) + ', context: ' + context);
    const config = {
        mode: 'standalone',
        sheetId: null,
        sheetName: null,
        defaultTask: null,
        rowIndex: DEFAULT_ROW_INDEX,
        isWebAppContext: false,
        errorHandler: 'alert',
        userEmail: Session.getEffectiveUser().getEmail() || 'anonymous_' + new Date().getTime(),
        sessionId: null
    };
    try {
        // Web app mode: HTTP event with parameters
        if (e && e.parameter && e.parameter.sheetId) {
            config.mode = 'web';
            config.isWebAppContext = true;
            config.errorHandler = 'confirm';
            config.sheetId = e.parameter.sheetId;
            config.sessionId = e.parameter.sessionId || CONFIG.SESSION_ID_PREFIX + Utilities.getUuid();
            Logger.log('Web app mode - sheetId: ' + config.sheetId + ', sessionId: ' + config.sessionId);
            try {
                const ss = SpreadsheetApp.openById(config.sheetId);
                const properties = ss.getProperties();
                const createdBy = properties.getProperty('createdBy');
                if (createdBy && createdBy !== config.userEmail) {
                    Logger.log('Warning: Spreadsheet created by ' + createdBy + ', current user: ' + config.userEmail);
                }
            } catch (error) {
                Logger.log('Error: Invalid sheetId provided in web mode: ' + config.sheetId);
                throw new Error('Invalid spreadsheet ID provided in web mode.');
            }
            config.sheetName = ESTIMATION_DATA_SHEET_NAME;
        } else {
            Logger.log('No sheetId provided, assuming standalone mode');
            // Standalone mode: Use active spreadsheet
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            if (!ss && context !== 'doGet') {
                Logger.log('Error: No active spreadsheet found in standalone mode');
                throw new Error('No active spreadsheet found. Please run the script from within a Google Sheet.');
            }
            if (ss) {
                config.sheetId = ss.getId();
                const sheets = ss.getSheets();
                let targetSheet = sheets.find(sheet => sheet.getName().toLowerCase() === ESTIMATION_DATA_SHEET_NAME.toLowerCase());
                config.sheetName = targetSheet ? targetSheet.getName() : (SpreadsheetApp.getActiveSheet()?.getName() || ESTIMATION_DATA_SHEET_NAME);
                if (context === 'showPlotWeb') {
                    const activeRange = SpreadsheetApp.getActiveSheet()?.getActiveRange();
                    config.rowIndex = activeRange ? activeRange.getRow() : DEFAULT_ROW_INDEX;
                    if (config.rowIndex < DEFAULT_ROW_INDEX) config.rowIndex = DEFAULT_ROW_INDEX;
                    const tasks = getAllTasks(config.sheetId).tasks;
                    if (tasks && tasks.length > 0) {
                        const sheet = ss.getSheetByName(config.sheetName);
                        const activeRowData = sheet.getRange(config.rowIndex, 1, 1, 4).getValues()[0];
                        const taskName = activeRowData[0]?.toString().trim();
                        const bestCase = parseFloat(activeRowData[1]);
                        const mostLikely = parseFloat(activeRowData[2]);
                        const worstCase = parseFloat(activeRowData[3]);
                        if (taskName && Number.isFinite(bestCase) && Number.isFinite(mostLikely) && Number.isFinite(worstCase) &&
                            bestCase < mostLikely && mostLikely < worstCase) {
                            config.defaultTask = taskName;
                        } else {
                            const firstValidTask = tasks.find(task => 
                                task.task && Number.isFinite(task.optimistic) && 
                                Number.isFinite(task.mostLikely) && 
                                Number.isFinite(task.pessimistic) && 
                                task.optimistic < task.mostLikely && 
                                task.mostLikely < task.pessimistic);
                            config.defaultTask = firstValidTask ? firstValidTask.task : tasks[0]?.task;
                        }
                    }
                }
            }
        }
        Logger.log('Config returned: ' + JSON.stringify(config));
        return config;
    } catch (error) {
        Logger.log('Error in personas: ' + error.message);
        throw error;
    }
}

// Part 2: API Interaction, Task Retrieval, and PERT Calculations

/**
 * SECTION 1: MENU SETUP
 * Defines the custom menu in Google Sheets to provide user access to key functionalities.
 */

/**
 * Adds an Add-On menu to the Google Sheets UI for user interaction.
 */
function onOpen(e) {
    var ui = SpreadsheetApp.getUi();
    ui.createAddonMenu()
        .addItem('PERT', 'addPertColumnsWrapper')
        .addItem('PLOT', 'showPlot')
        .addToUi();
}

/**
 * Wrapper for addPertColumns to ensure proper configuration.
 */
function addPertColumnsWrapper() {
    try {
        const config = personas(null, 'addPertColumns');
        const ss = SpreadsheetApp.openById(config.sheetId);
        const properties = ss.getProperties();
        const createdBy = properties.getProperty('createdBy');
        if (createdBy && createdBy !== config.userEmail) {
            const ui = SpreadsheetApp.getUi();
            const response = ui.alert(
                'Warning',
                `This spreadsheet was created by ${createdBy} (likely via web app). Modifying it may cause conflicts. Proceed?`,
                ui.ButtonSet.YES_NO
            );
            if (response !== ui.Button.YES) {
                throw new Error('Operation cancelled to avoid conflicts.');
            }
        }
        addPertColumns(config);
    } catch (error) {
        SpreadsheetApp.getUi().alert('Error', 'Failed to run PERT calculations: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
}

/**
 * SECTION 2: API INTERACTION
 * Handles secure API calls to pmcEstimatorAPI with JWT authentication.
 */

/**
 * Calls the web API to perform estimation calculations using secure JWT authentication.
 * @param {Array} tasks - Array of task objects with flattened structure.
 * @returns {Object} API response with computed metrics.
 */
function callEstimatorAPI(tasks) {
    const startTime = Date.now();
    const lock = LockService.getScriptLock();
    try {
        if (!lock.tryLock(10000)) {
            Logger.log('Error: API is busy, please try again later.');
            throw new Error('API is busy, please try again later.');
        }
        if (!Array.isArray(tasks) || tasks.length === 0) {
            Logger.log('Error: tasks must be a non-empty array');
            throw new Error('Tasks must be a non-empty array');
        }
        tasks.forEach((task, i) => {
            if (!task.task || 
                typeof task.optimistic !== 'number' || !isFinite(task.optimistic) ||
                typeof task.mostLikely !== 'number' || !isFinite(task.mostLikely) ||
                typeof task.pessimistic !== 'number' || !isFinite(task.pessimistic) ||
                typeof task.targetValue !== 'number' || !isFinite(task.targetValue)) {
                Logger.log(`Invalid task data at index ${i}: ${JSON.stringify(task)}`);
                throw new Error(`Invalid task data at index ${i}: All task estimates and targetValue must be finite numbers`);
            }
        });
        const keyJsonString = PropertiesService.getScriptProperties().getProperty(SERVICE_ACCOUNT_KEY_NAME);
        if (!keyJsonString) {
            Logger.log('Error: ' + SERVICE_ACCOUNT_KEY_NAME + ' not found in Script Properties');
            throw new Error(SERVICE_ACCOUNT_KEY_NAME + ' not found in Script Properties');
        }
        let keyJson;
        try {
            keyJson = JSON.parse(keyJsonString);
        } catch (e) {
            Logger.log('Error parsing ' + SERVICE_ACCOUNT_KEY_NAME + ': ' + e.message);
            throw new Error('Failed to parse ' + SERVICE_ACCOUNT_KEY_NAME + ': ' + e.message);
        }
        const now = Math.floor(Date.now() / 1000);
        const claimSet = {
            iss: keyJson.client_email,
            aud: TOKEN_ENDPOINT_URL,
            exp: now + 3600,
            iat: now,
            target_audience: API_URL
        };
        const header = { alg: 'RS256', typ: 'JWT' };
        const toSign = Utilities.base64EncodeWebSafe(JSON.stringify(header)) + '.' +
                       Utilities.base64EncodeWebSafe(JSON.stringify(claimSet));
        let token;
        try {
            const signature = Utilities.computeRsaSha256Signature(toSign, keyJson.private_key);
            const jwt = toSign + '.' + Utilities.base64EncodeWebSafe(signature);
            Logger.log('Generated JWT: [Redacted]');
            const response = UrlFetchApp.fetch(TOKEN_ENDPOINT_URL, {
                method: 'POST',
                contentType: 'application/x-www-form-urlencoded',
                payload: {
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt
                },
                muteHttpExceptions: true,
                timeout: API_TIMEOUT_MS
            });
            if (Date.now() - startTime > API_TIMEOUT_MS) {
                Logger.log('Error: Token request timed out');
                throw new Error('Token request timed out');
            }
            Logger.log('Token endpoint response code: ' + response.getResponseCode());
            Logger.log('Token endpoint response: [Redacted]');
            if (response.getResponseCode() !== 200) {
                throw new Error('Failed to obtain token: ' + response.getContentText());
            }
            const tokenData = JSON.parse(response.getContentText());
            token = tokenData.id_token;
            Logger.log('Generated Token: [Redacted]');
        } catch (e) {
            Logger.log('Token generation failed: ' + e.message);
            throw new Error('Failed to obtain token: ' + e.message);
        }
        const options = {
            method: 'POST',
            contentType: 'application/json',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            payload: JSON.stringify(tasks),
            muteHttpExceptions: true,
            timeout: API_TIMEOUT_MS
        };
        Logger.log('Calling API with ' + tasks.length + ' tasks');
        Logger.log('Payload: ' + JSON.stringify(tasks));
        const response = UrlFetchApp.fetch(API_URL, options);
        if (Date.now() - startTime > API_TIMEOUT_MS) {
            Logger.log('Error: API request timed out');
            throw new Error('API request timed out');
        }
        Logger.log('API response code: ' + response.getResponseCode());
        Logger.log('API response content: ' + response.getContentText());
        if (response.getResponseCode() !== 200) {
            Logger.log('API request failed: ' + response.getContentText());
            throw new Error('API request failed: ' + response.getContentText());
        }
        const responseData = JSON.parse(response.getContentText());
        Logger.log('API response data received with ' + (responseData.results ? responseData.results.length : 0) + ' results');
        return responseData;
    } catch (error) {
        Logger.log('Error in callEstimatorAPI: ' + error.message + '\nStack: ' + error.stack);
        throw error;
    } finally {
        if (lock.hasLock()) {
            lock.releaseLock();
        }
    }
}

/**
 * SECTION 3: TASK RETRIEVAL
 * Fetches tasks from the specified spreadsheet for use in Plot.html’s dropdown.
 */

/**
 * Fetches all tasks from the specified sheet for Plot.html’s dropdown.
 * Validates that the sheet has at least 4 columns (Name, Best Case, Most Likely, Worst Case) and data starting from row 2.
 * Ensures estimates are numeric, finite, and in valid order (bestCase ≤ mostLikely ≤ worstCase).
 * Returns an array of task objects and the default task index.
 * @param {string} sheetId - Spreadsheet ID.
 * @returns {Object} { tasks: Array, defaultTaskIndex: number }.
 */
function getAllTasks(sheetId) {
    Logger.log('getAllTasks called with sheetId: ' + sheetId);
    try {
        const ss = SpreadsheetApp.openById(sheetId);
        const sheets = ss.getSheets();
        const sheet = sheets.find(s => s.getName().toLowerCase() === ESTIMATION_DATA_SHEET_NAME.toLowerCase()) || sheets[0];
        if (!sheet) {
            Logger.log('Error: No sheets found in spreadsheet: ' + sheetId);
            throw new Error('No sheets found in spreadsheet');
        }
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) {
            Logger.log('No data found in sheet: ' + sheet.getName());
            return { tasks: [], defaultTaskIndex: 0 };
        }
        const tasks = [];
        let defaultTaskIndex = 0;
        data.slice(1).forEach((row, index) => {
            const [task, optimistic, mostLikely, pessimistic, selectedForPlot] = row;
            if (task && Number.isFinite(optimistic) && Number.isFinite(mostLikely) && Number.isFinite(pessimistic) &&
                optimistic < mostLikely && mostLikely < pessimistic) {
                tasks.push({
                    task: task.toString(),
                    optimistic: optimistic,
                    mostLikely: mostLikely,
                    pessimistic: pessimistic,
                    selectedForPlot: selectedForPlot === true || selectedForPlot === 'TRUE'
                });
                if (selectedForPlot === true || selectedForPlot === 'TRUE') {
                    defaultTaskIndex = tasks.length - 1;
                }
            }
        });
        Logger.log('Fetched ' + tasks.length + ' valid tasks, defaultTaskIndex: ' + defaultTaskIndex);
        return { tasks, defaultTaskIndex };
    } catch (error) {
        Logger.log('Error in getAllTasks: ' + error.message + '\nStack: ' + error.stack);
        throw error;
    }
}

/**
 * SECTION 4: PERT CALCULATIONS
 * Processes spreadsheet data and adds PERT metrics to the Estimate Calculations sheet.
 */

/**
 * Adds PERT columns to the "Estimate Calculations" sheet using API-provided metrics.
 * Always writes headers and descriptions, even on failure.
 * @param {Object} config - Persona configuration with sheetId, isWebAppContext, errorHandler.
 * @returns {Object} Result object with status, message, and errors array.
 */
function addPertColumns(config) {
    Logger.log('addPertColumns called with config: ' + JSON.stringify(config));
    const ss = SpreadsheetApp.openById(config.sheetId);
    const sheetName = config.isWebAppContext ? 'Estimate Calculations' : CONFIG.ADDON_CALCULATIONS_SHEET_NAME;
    let sheet = ss.getSheetByName(sheetName);
    let result = { status: 'success', message: '', errors: [] };

    try {
        if (sheet && !config.isWebAppContext) {
            const ui = SpreadsheetApp.getUi();
            const response = ui.alert(
                'Sheet exists',
                'The sheet "' + sheetName + '" already exists. Do you want to overwrite its content?',
                ui.ButtonSet.YES_NO
            );
            if (response === ui.Button.YES) {
                sheet.clear();
            } else {
                throw new Error('Operation cancelled by user.');
            }
        } else if (sheet) {
            sheet.clear();
        } else {
            sheet = ss.insertSheet(sheetName);
        }

        const headers = [
            'Name', 'Best Case', 'Most Likely', 'Worst Case',
            'Triangle Mean', 'Triangle Variance', 'Triangle StdDev', 'Triangle Skewness', 'Triangle Kurtosis', 'Triangle Points',
            'PERT Mean', 'PERT StdDev', 'PERT Variance', 'PERT Skewness', 'PERT Kurtosis', 'PERT Points',
            'Beta Mean', 'Beta Variance', 'Beta Skewness', 'Beta Kurtosis', 'Alpha', 'Beta', 'Beta Mode', 'Beta Points',
            'MC On Beta Unsmoothed Mean', 'MC On Beta Unsmoothed Variance', 'MC On Beta Unsmoothed Skewness', 'MC On Beta Unsmoothed Kurtosis', 
            'MC On Beta Unsmoothed VaR 90%', 'MC On Beta Unsmoothed CVaR 90%', 'MC On Beta Unsmoothed MAD', 'MC On Beta Unsmoothed Points',
            'MC On Beta Smoothed Mean', 'MC On Beta Smoothed Variance', 'MC On Beta Smoothed Skewness', 'MC On Beta Smoothed Kurtosis', 
            'MC On Beta Smoothed VaR 90%', 'MC On Beta Smoothed CVaR 90%', 'MC On Beta Smoothed MAD', 'MC On Beta Smoothed 90th Percentile Confidence', 
            'MC On Beta Smoothed Points',
            'Weighted Estimate (Conservative)', 'Weighted Estimate (Neutral)', 'Weighted Estimate (Optimistic)',
            'Probability Exceeding PERT Mean (Beta)', 'Probability Exceeding PERT Mean (MC Unsmoothed)', 
            'Probability Exceeding PERT Mean (MC Smoothed)', 'CDF Points'
        ];

        const descriptions = [
            'Task name or identifier.', 
            'Optimistic estimate (best-case).', 
            'Most likely estimate.', 
            'Pessimistic estimate (worst-case).',
            'Triangle distribution average.', 
            'Triangle distribution spread.', 
            'Triangle standard deviation.', 
            'Triangle asymmetry.', 
            'Triangle peakedness.', 
            'Triangle cumulative points.',
            'Weighted average (PERT).', 
            'PERT standard deviation.', 
            'PERT spread.', 
            'PERT asymmetry.', 
            'PERT peakedness.', 
            'PERT cumulative points.',
            'Beta distribution mean.', 
            'Beta spread.', 
            'Beta asymmetry.', 
            'Beta peakedness.', 
            'Beta shape (alpha).', 
            'Beta shape (beta).', 
            'Beta mode.', 
            'Beta cumulative points.',
            'Unsmoothed Monte Carlo mean.', 
            'Unsmoothed Monte Carlo spread.', 
            'Unsmoothed Monte Carlo asymmetry.', 
            'Unsmoothed Monte Carlo peakedness.', 
            'Unsmoothed Monte Carlo VaR 90%.', 
            'Unsmoothed Monte Carlo CVaR 90%.', 
            'Unsmoothed Monte Carlo MAD.', 
            'Unsmoothed Monte Carlo points.',
            'Smoothed Monte Carlo mean.', 
            'Smoothed Monte Carlo spread.', 
            'Smoothed Monte Carlo asymmetry.', 
            'Smoothed Monte Carlo peakedness.', 
            'Smoothed Monte Carlo VaR 90%.', 
            'Smoothed Monte Carlo CVaR 90%.', 
            'Smoothed Monte Carlo MAD.', 
            'Smoothed Monte Carlo 90th Percentile.', 
            'Smoothed Monte Carlo points.',
            'Conservative weighted estimate.', 
            'Neutral weighted estimate (PERT Mean).', 
            'Optimistic weighted estimate.', 
            'Probability exceeding PERT Mean (Beta).', 
            'Probability exceeding PERT Mean (MC Unsmoothed).', 
            'Probability exceeding PERT Mean (MC Smoothed).', 
            'Cumulative distribution points.'
        ];

        // Always write headers and descriptions
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.getRange(2, 1, 1, headers.length).setValues([descriptions]).setFontStyle('italic');

        const firstSheet = ss.getSheets().find(s => s.getName().toLowerCase() === ESTIMATION_DATA_SHEET_NAME.toLowerCase()) || ss.getSheets()[0];
        if (firstSheet.getLastColumn() < 4) {
            const error = 'First sheet must have at least 4 columns (Name, Best Case, Most Likely, Worst Case).';
            Logger.log('Error: ' + error);
            sheet.getRange(3, 1).setValue('Error: ' + error);
            result.errors.push(error);
            result.status = 'error';
            result.message = error;
            return result;
        }
        const lastRow = firstSheet.getLastRow();
        if (lastRow < 2) {
            const error = 'No data found in the first sheet.';
            Logger.log('Error: ' + error);
            sheet.getRange(3, 1).setValue('Error: ' + error);
            result.errors.push(error);
            result.status = 'error';
            result.message = error;
            return result;
        }

        const dataRange = firstSheet.getRange(2, 1, lastRow - 1, Math.max(4, firstSheet.getLastColumn()));
        const data = dataRange.getValues();
        const errorMessages = [];

        const tasks = data.map((row, index) => {
            const [name, bestCase, mostLikely, worstCase] = row;
            if (typeof bestCase !== 'number' || !isFinite(bestCase) || 
                typeof mostLikely !== 'number' || !isFinite(mostLikely) || 
                typeof worstCase !== 'number' || !isFinite(worstCase)) {
                const error = `Row ${index + 2} has non-numeric or non-finite estimates: ${JSON.stringify(row)}`;
                Logger.log(error);
                errorMessages.push(error);
                result.errors.push(error);
                return { name: name || 'Unnamed Task', error: error };
            }
            if (bestCase > mostLikely || mostLikely > worstCase) {
                const error = `Row ${index + 2} has invalid estimate order: ${JSON.stringify(row)}`;
                Logger.log(error);
                errorMessages.push(error);
                result.errors.push(error);
                return { name: name || 'Unnamed Task', error: error };
            }
            if (bestCase === mostLikely || mostLikely === worstCase) {
                const error = `Row ${index + 2} has estimates too close: ${JSON.stringify(row)}`;
                Logger.log(error);
                errorMessages.push(error);
                result.errors.push(error);
                return { name: name || 'Unnamed Task', error: error };
            }
            const range = worstCase - bestCase;
            const minRange = mostLikely * MIN_RANGE_MULTIPLIER;
            if (range < minRange) {
                const error = `Row ${index + 2} has estimate range too small (${range} < ${minRange}): ${JSON.stringify(row)}`;
                Logger.log(error);
                errorMessages.push(error);
                result.errors.push(error);
                return { name: name || 'Unnamed Task', error: error };
            }
            if (bestCase === mostLikely && mostLikely === worstCase) {
                const error = `Row ${index + 2} has zero variance: ${JSON.stringify(row)}`;
                Logger.log(error);
                errorMessages.push(error);
                result.errors.push(error);
                return { name: name || 'Unnamed Task', error: error };
            }
            return {
                task: name || 'Unnamed Task',
                optimistic: bestCase * 1.0,
                mostLikely: mostLikely * 1.0,
                pessimistic: worstCase * 1.0,
                budgetFlexibility: 0.0,
                scheduleFlexibility: 0.0,
                scopeCertainty: 0.0,
                qualityTolerance: 0.0,
                targetValue: bestCase * 1.0,
                confidenceLevel: 0.9,
                targetProbabilityOnly: false,
                optimizeFor: 'target'
            };
        });

        if (errorMessages.length > 0 && !config.isWebAppContext) {
            const ui = SpreadsheetApp.getUi();
            const errorSummary = errorMessages.join('\n');
            const response = ui.alert(
                'Errors Encountered',
                `${errorSummary}\n\nPress "Continue" to proceed with "N/A" for invalid rows, or "Cancel" to stop.`,
                ui.ButtonSet.OK_CANCEL
            );
            if (response === ui.Button.CANCEL) {
                throw new Error('Operation cancelled by user due to invalid input data.');
            }
        }

        const validTasks = tasks.filter(task => !task.error);
        if (validTasks.length === 0 && tasks.length > 0) {
            Logger.log('No valid tasks to send to API, but processing all rows for output.');
            sheet.getRange(3, 1).setValue('Error: No valid tasks found. Check input data.');
            result.status = 'error';
            result.message = 'No valid tasks found.';
            return result;
        }

        let apiResponse = { results: [] };
        if (validTasks.length > 0) {
            try {
                apiResponse = callEstimatorAPI(validTasks);
            } catch (error) {
                Logger.log('API call failed: ' + error.message);
                errorMessages.push(`API call failed: ${error.message}`);
                result.errors.push(`API call failed: ${error.message}`);
                sheet.getRange(3, 1).setValue('Error: Failed to fetch data from API. Please check ' + SERVICE_ACCOUNT_KEY_NAME + ' and network connectivity.');
            }
        }

        const results = apiResponse.results || [];
        let resultIndex = 0;
        const allRowData = tasks.map((task, index) => {
            if (task.error) {
                const row = new Array(headers.length).fill('N/A');
                row[0] = task.name;
                Logger.log(`Row ${index + 2} data length: ${row.length}`);
                return row;
            }
            const result = results[resultIndex] || {};
            resultIndex++;
            if (result.error) {
                const error = `Row ${index + 2} API error: ${result.error}`;
                Logger.log(error);
                errorMessages.push(error);
                result.errors.push(error);
                const row = new Array(headers.length).fill('N/A');
                row[0] = task.task || 'Unnamed Task';
                Logger.log(`Row ${index + 2} data length: ${row.length}`);
                return row;
            }
            const row = [
                result.task?.value || 'N/A',
                result.bestCase?.value || 'N/A',
                result.mostLikely?.value || 'N/A',
                result.worstCase?.value || 'N/A',
                result.triangleMean?.value || 'N/A',
                result.triangleVariance?.value || 'N/A',
                result.triangleStdDev?.value || 'N/A',
                result.triangleSkewness?.value || 'N/A',
                result.triangleKurtosis?.value || 'N/A',
                result.trianglePoints?.value ? JSON.stringify(result.trianglePoints.value) : 'N/A',
                result.pertMean?.value || 'N/A',
                result.pertStdDev?.value || 'N/A',
                result.pertVariance?.value || 'N/A',
                result.pertSkewness?.value || 'N/A',
                result.pertKurtosis?.value || 'N/A',
                result.pertPoints?.value ? JSON.stringify(result.pertPoints.value) : 'N/A',
                result.betaMean?.value || 'N/A',
                result.betaVariance?.value || 'N/A',
                result.betaSkewness?.value || 'N/A',
                result.betaKurtosis?.value || 'N/A',
                result.alpha?.value || 'N/A',
                result.beta?.value || 'N/A',
                result.betaMode?.value || 'N/A',
                result.betaPoints?.value ? JSON.stringify(result.betaPoints.value) : 'N/A',
                result.mcMean?.value || 'N/A',
                result.mcVariance?.value || 'N/A',
                result.mcSkewness?.value || 'N/A',
                result.mcKurtosis?.value || 'N/A',
                result.mcVaR?.value || 'N/A',
                result.mcCVaR?.value || 'N/A',
                result.mcMAD?.value || 'N/A',
                result.mcPoints?.value ? JSON.stringify(result.mcPoints.value) : 'N/A',
                result.mcSmoothedMean?.value || 'N/A',
                result.mcSmoothedVariance?.value || 'N/A',
                result.mcSmoothedSkewness?.value || 'N/A',
                result.mcSmoothedKurtosis?.value || 'N/A',
                result.mcSmoothedVaR?.value || 'N/A',
                result.mcSmoothedCVaR?.value || 'N/A',
                result.mcSmoothedMAD?.value || 'N/A',
                result.mcSmoothedConfidenceValues?.value?.valueAt90Percent || 'N/A',
                result.mcSmoothedPoints?.value ? JSON.stringify(result.mcSmoothedPoints.value) : 'N/A',
                result.weightedConservative?.value || 'N/A',
                result.weightedNeutral?.value || 'N/A',
                result.weightedOptimistic?.value || 'N/A',
                result.probExceedPertMeanBeta?.value || 'N/A',
                result.probExceedPertMeanMCUnsmoothed?.value || 'N/A',
                result.probExceedPertMeanMCSmoothed?.value || 'N/A',
                result.cdfPoints?.value ? JSON.stringify(result.cdfPoints.value) : 'N/A'
            ];
            Logger.log(`Row ${index + 2} data length: ${row.length}`);
            return row;
        });

        if (allRowData.length > 0) {
            Logger.log(`Writing ${allRowData.length} rows with ${allRowData[0].length} columns to sheet`);
            sheet.getRange(3, 1, allRowData.length, headers.length).setValues(allRowData);
            const numRows = allRowData.length;
            const columnsToHighlight = [11, 40];
            columnsToHighlight.forEach(col => {
                sheet.getRange(1, col).setFontWeight('bold').setBackground('#d1e7dd');
                sheet.getRange(3, col, numRows, 1).setBackground('#d1e7dd');
            });
        } else {
            Logger.log('No data to write to sheet; all tasks invalid or API failed');
            sheet.getRange(3, 1).setValue('Error: No valid task data or API response available. Please check input data and ' + SERVICE_ACCOUNT_KEY_NAME + '.');
        }

        if (errorMessages.length > 0) {
            result.message = errorMessages.join('; ');
            result.status = 'error';
            if (!config.isWebAppContext) {
                const ui = SpreadsheetApp.getUi();
                ui.alert('Errors Encountered', `${result.message}\n\nThe script completed with "N/A" for affected rows.`, ui.ButtonSet.OK);
            }
        } else {
            result.message = 'PERT calculations completed successfully.';
            if (!config.isWebAppContext) {
                const ui = SpreadsheetApp.getUi();
                ui.alert('Success', 'PERT calculations completed successfully.', ui.ButtonSet.OK);
            }
        }

        return result;
    } catch (error) {
        Logger.log('Error in addPertColumns: ' + error.message);
        sheet.getRange(3, 1).setValue('Error: Failed to process PERT calculations: ' + error.message);
        result.status = 'error';
        result.message = 'Failed to process PERT calculations: ' + error.message;
        result.errors.push(result.message);
        return result;
    }
}

// Part 3: Plot Data Fetching and Web App Integration

/**
 * SECTION 5: PLOT DATA FETCHING
 * Fetches data for Plot.html visualizations.
 */

/**
 * Displays the Plot.html interface as a sidebar in Google Sheets for the add-on persona.
 */
function showPlot() {
    try {
        const config = personas(null, 'showPlot');
        Logger.log('showPlot called with config: ' + JSON.stringify(config));
        
        const template = HtmlService.createTemplateFromFile('Plot');
        template.sheetId = config.sheetId;
        template.sheetName = config.sheetName;
        template.defaultTask = config.defaultTask;
        template.executingUser = CONFIG.SHOW_EXECUTING_USER ? config.userEmail : '';
        template.CONFIG = CONFIG;
        
        const html = template.evaluate()
            .setTitle(CONFIG.PAGE_TITLE)
            .setWidth(1200)
            .setHeight(800);
        
        SpreadsheetApp.getUi().showSidebar(html);
    } catch (error) {
        Logger.log('Error in showPlot: ' + error.message + '\nStack: ' + error.stack);
        SpreadsheetApp.getUi().alert('Error', 'Failed to display plot: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
}

/**
 * Fetches properties for plotting in Plot.html.
 * @param {string} sheetId - Spreadsheet ID.
 * @param {string} sheetName - Name of the sheet.
 * @param {number} rowIndex - Row index to fetch input data from.
 * @returns {Object} Properties object with metrics, points, and task name.
 */
function getProperties(sheetId, sheetName, rowIndex) {
    try {
        Logger.log(`getProperties called with sheetId: ${sheetId}, sheetName: ${sheetName}, rowIndex: ${rowIndex}`);

        if (typeof sheetId !== 'string' || !sheetId) {
            Logger.log('Error: sheetId must be a non-empty string');
            throw new Error('sheetId must be a non-empty string');
        }
        if (typeof sheetName !== 'string' || !sheetName) {
            Logger.log('Error: sheetName must be a non-empty string');
            throw new Error('sheetName must be a non-empty string');
        }
        if (typeof rowIndex !== 'number' || rowIndex < DEFAULT_ROW_INDEX || !Number.isInteger(rowIndex)) {
            Logger.log('Error: rowIndex must be an integer >= ' + DEFAULT_ROW_INDEX);
            throw new Error('rowIndex must be an integer >= ' + DEFAULT_ROW_INDEX);
        }

        const spreadsheet = SpreadsheetApp.openById(sheetId);
        if (!spreadsheet) {
            Logger.log('Error: Spreadsheet not found');
            throw new Error('Spreadsheet not found');
        }
        const sheet = spreadsheet.getSheets().find(s => s.getName().toLowerCase() === sheetName.toLowerCase());
        if (!sheet) {
            Logger.log(`Error: Sheet "${sheetName}" not found`);
            throw new Error(`Sheet "${sheetName}" not found`);
        }

        const lastRow = sheet.getLastRow();
        if (rowIndex > lastRow) {
            Logger.log(`Error: rowIndex ${rowIndex} exceeds sheet's last row: ${lastRow}`);
            throw new Error(`rowIndex ${rowIndex} exceeds sheet's last row: ${lastRow}`);
        }

        if (sheet.getLastColumn() < 4) {
            Logger.log('Error: Sheet "' + sheetName + '" has fewer than 4 columns');
            throw new Error('Sheet "' + sheetName + '" must have at least 4 columns');
        }

        const data = sheet.getRange(rowIndex, 1, 1, 4).getValues()[0];
        if (!data || data.length < 4) {
            Logger.log(`Error: Insufficient data at row ${rowIndex}`);
            throw new Error(`Insufficient data at row ${rowIndex}`);
        }
        Logger.log('Input data from sheet: ' + JSON.stringify(data));

        const [name, bestCase, mostLikely, worstCase] = data;
        if (typeof bestCase !== 'number' || !isFinite(bestCase) || 
            typeof mostLikely !== 'number' || !isFinite(mostLikely) || 
            typeof worstCase !== 'number' || !isFinite(worstCase)) {
            Logger.log(`Error: Invalid numeric inputs at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
            throw new Error(`Invalid numeric inputs at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
        }
        if (bestCase > mostLikely || mostLikely > worstCase) {
            Logger.log(`Error: Invalid estimate order at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
            throw new Error(`Invalid estimate order at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
        }
        if (bestCase === mostLikely || mostLikely === worstCase) {
            Logger.log(`Error: Estimates too close at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
            throw new Error(`Estimates too close at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
        }
        const range = worstCase - bestCase;
        const minRange = mostLikely * MIN_RANGE_MULTIPLIER;
        if (range < minRange) {
            Logger.log(`Error: Estimate range too small at row ${rowIndex}: range=${range}, minRange=${minRange}`);
            throw new Error(`Estimate range too small at row ${rowIndex}: range=${range}, minRange=${minRange}`);
        }
        if (bestCase === mostLikely && mostLikely === worstCase) {
            Logger.log(`Error: Zero variance at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
            throw new Error(`Zero variance at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
        }

        const task = {
            task: name || 'Unnamed Task',
            optimistic: bestCase * 1.0,
            mostLikely: mostLikely * 1.0,
            pessimistic: worstCase * 1.0,
            budgetFlexibility: 0.0,
            scheduleFlexibility: 0.0,
            scopeCertainty: 0.0,
            qualityTolerance: 0.0,
            targetValue: bestCase * 1.0,
            confidenceLevel: 0.9,
            targetProbabilityOnly: false,
            optimizeFor: 'target'
        };
        Logger.log('Task object prepared for API: ' + JSON.stringify(task));

        const apiResponse = callEstimatorAPI([task]);
        if (!apiResponse || !apiResponse.results || !Array.isArray(apiResponse.results) || apiResponse.results.length === 0) {
            Logger.log('Error: API response missing or invalid "results" array');
            throw new Error('API response missing or invalid "results" array');
        }

        const result = apiResponse.results[0];
        Logger.log('API result for task: ' + result.task?.value);

        function getValue(field, fieldName) {
            const value = result[field]?.value;
            if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) {
                Logger.log(`Warning: ${fieldName} is invalid or missing (value: ${value}), defaulting to 0`);
                return 0;
            }
            return value;
        }

        function getPoints(field, fieldName) {
            const points = result[field]?.value;
            if (!Array.isArray(points) || points.length === 0) {
                Logger.log(`Warning: ${fieldName} is invalid or empty, defaulting to []`);
                return [];
            }
            if (!points.every(p => typeof p.x === 'number' && typeof p.y === 'number')) {
                Logger.log(`Warning: ${fieldName} contains invalid point format, defaulting to []`);
                return [];
            }
            return points;
        }

        const properties = {
            TASK_NAME: result.task?.value || 'Unnamed Task',
            MIN: getValue('bestCase', 'MIN'),
            MOST_LIKELY: getValue('mostLikely', 'MOST_LIKELY'),
            MAX: getValue('worstCase', 'MAX'),
            TRIANGLE_MEAN: getValue('triangleMean', 'TRIANGLE_MEAN'),
            TRIANGLE_VARIANCE: getValue('triangleVariance', 'TRIANGLE_VARIANCE'),
            TRIANGLE_STD: getValue('triangleStdDev', 'TRIANGLE_STD'),
            TRIANGLE_SKEWNESS: getValue('triangleSkewness', 'TRIANGLE_SKEWNESS'),
            TRIANGLE_KURTOSIS: getValue('triangleKurtosis', 'TRIANGLE_KURTOSIS'),
            TRIANGLE_POINTS: getPoints('trianglePoints', 'TRIANGLE_POINTS'),
            PERT_MEAN: getValue('pertMean', 'PERT_MEAN'),
            PERT_STD: getValue('pertStdDev', 'PERT_STD'),
            PERT_VARIANCE: getValue('pertVariance', 'PERT_VARIANCE'),
            PERT_SKEWNESS: getValue('pertSkewness', 'PERT_SKEWNESS'),
            PERT_KURTOSIS: getValue('pertKurtosis', 'PERT_KURTOSIS'),
            PERT_POINTS: getPoints('pertPoints', 'PERT_POINTS'),
            BETA_MEAN: getValue('betaMean', 'BETA_MEAN'),
            BETA_VARIANCE: getValue('betaVariance', 'BETA_VARIANCE'),
            BETA_SKEWNESS: getValue('betaSkewness', 'BETA_SKEWNESS'),
            BETA_KURTOSIS: getValue('betaKurtosis', 'BETA_KURTOSIS'),
            ALPHA: getValue('alpha', 'ALPHA'),
            BETA: getValue('beta', 'BETA'),
            BETA_MODE: getValue('betaMode', 'BETA_MODE'),
            BETA_POINTS: getPoints('betaPoints', 'BETA_POINTS'),
            MC_UNSMOOTHED_MEAN: getValue('mcMean', 'MC_UNSMOOTHED_MEAN'),
            MC_UNSMOOTHED_VARIANCE: getValue('mcVariance', 'MC_UNSMOOTHED_VARIANCE'),
            MC_UNSMOOTHED_SKEWNESS: getValue('mcSkewness', 'MC_UNSMOOTHED_SKEWNESS'),
            MC_UNSMOOTHED_KURTOSIS: getValue('mcKurtosis', 'MC_UNSMOOTHED_KURTOSIS'),
            MC_UNSMOOTHED_VaR_90: getValue('mcVaR', 'MC_UNSMOOTHED_VaR_90'),
            MC_UNSMOOTHED_CVaR_90: getValue('mcCVaR', 'MC_UNSMOOTHED_CVaR_90'),
            MC_UNSMOOTHED_MAD: getValue('mcMAD', 'MC_UNSMOOTHED_MAD'),
            MC_UNSMOOTHED_POINTS: getPoints('mcPoints', 'MC_UNSMOOTHED_POINTS'),
            MC_SMOOTHED_MEAN: getValue('mcSmoothedMean', 'MC_SMOOTHED_MEAN'),
            MC_SMOOTHED_VARIANCE: getValue('mcSmoothedVariance', 'MC_SMOOTHED_VARIANCE'),
            MC_SMOOTHED_SKEWNESS: getValue('mcSmoothedSkewness', 'MC_SMOOTHED_SKEWNESS'),
            MC_SMOOTHED_KURTOSIS: getValue('mcSmoothedKurtosis', 'MC_SMOOTHED_KURTOSIS'),
            MC_SMOOTHED_VaR_90: getValue('mcSmoothedVaR', 'MC_SMOOTHED_VaR_90'),
            MC_SMOOTHED_CVaR_90: getValue('mcSmoothedCVaR', 'MC_SMOOTHED_CVaR_90'),
            MC_SMOOTHED_MAD: getValue('mcSmoothedMAD', 'MC_SMOOTHED_MAD'),
            MC_SMOOTHED_POINTS: getPoints('mcSmoothedPoints', 'MC_SMOOTHED_POINTS'),
            WEIGHTED_CONSERVATIVE: getValue('weightedConservative', 'WEIGHTED_CONSERVATIVE'),
            WEIGHTED_NEUTRAL: getValue('weightedNeutral', 'WEIGHTED_NEUTRAL'),
            WEIGHTED_OPTIMISTIC: getValue('weightedOptimistic', 'WEIGHTED_OPTIMISTIC'),
            PROB_EXCEED_PERT_MEAN_BETA: getValue('probExceedPertMeanBeta', 'PROB_EXCEED_PERT_MEAN_BETA'),
            PROB_EXCEED_PERT_MEAN_MC_UNSMOOTHED: getValue('probExceedPertMeanMCUnsmoothed', 'PROB_EXCEED_PERT_MEAN_MC_UNSMOOTHED'),
            PROB_EXCEED_PERT_MEAN_MC_SMOOTHED: getValue('probExceedPertMeanMCSmoothed', 'PROB_EXCEED_PERT_MEAN_MC_SMOOTHED'),
            CDF_POINTS: getPoints('cdfPoints', 'CDF_POINTS'),
            TARGET_PROBABILITY_POINTS: getPoints('targetProbabilityPoints', 'TARGET_PROBABILITY_POINTS')
        };

        const requiredPointFields = [
            'TRIANGLE_POINTS', 'PERT_POINTS', 'BETA_POINTS',
            'MC_UNSMOOTHED_POINTS', 'MC_SMOOTHED_POINTS', 'CDF_POINTS',
            'TARGET_PROBABILITY_POINTS'
        ];
        requiredPointFields.forEach(field => {
            if (!properties[field] || properties[field].length === 0) {
                Logger.log(`Warning: ${field} is empty; plot may not render correctly`);
            }
        });

        Logger.log('Returning properties for task: ' + properties.TASK_NAME);
        return properties;
    } catch (error) {
        Logger.log('Error in getProperties: ' + error.message);
        throw error;
    }
}

/**
 * Fetches target probability data for Plot.html based on user inputs from sliders and mode.
 * @param {Object} params - Parameters including task, estimates, slider values, target value, confidence level, and mode.
 * @returns {Object} API response with probability data or error details.
 */
function getTargetProbabilityData(params) {
    const lock = LockService.getScriptLock();
    try {
        if (!lock.tryLock(10000)) {
            Logger.log('Error: API is busy, please try again later.');
            throw new Error('API is busy, please try again later.');
        }
        Logger.log('getTargetProbabilityData called with params: ' + JSON.stringify(params));

        if (!params.task || typeof params.task !== 'string') {
            Logger.log('Error: task must be a non-empty string');
            throw new Error('Task must be a non-empty string');
        }
        if (typeof params.optimistic !== 'number' || !isFinite(params.optimistic) ||
            typeof params.mostLikely !== 'number' || !isFinite(params.mostLikely) ||
            typeof params.pessimistic !== 'number' || !isFinite(params.pessimistic)) {
            Logger.log(`Error: Invalid numeric inputs: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
            throw new Error(`Invalid numeric inputs: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
        }
        if (params.optimistic > params.mostLikely || params.mostLikely > params.pessimistic) {
            Logger.log(`Error: Invalid estimate order: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
            throw new Error(`Invalid estimate order: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
        }
        if (params.optimistic === params.mostLikely || params.mostLikely === params.pessimistic) {
            Logger.log(`Error: Estimates too close: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
            throw new Error(`Estimates too close: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
        }
        const range = params.pessimistic - params.optimistic;
        const minRange = params.mostLikely * MIN_RANGE_MULTIPLIER;
        if (range < minRange) {
            Logger.log(`Error: Estimate range too small: range=${range}, minRange=${minRange}`);
            throw new Error(`Estimate range too small: range=${range}, minRange=${minRange}`);
        }
        if (params.optimistic === params.mostLikely && params.mostLikely === params.pessimistic) {
            Logger.log(`Error: Zero variance: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
            throw new Error(`Zero variance: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
        }
        if (!params.sliderValues || 
            typeof params.sliderValues.budgetFlexibility !== 'number' || !isFinite(params.sliderValues.budgetFlexibility) ||
            typeof params.sliderValues.scheduleFlexibility !== 'number' || !isFinite(params.sliderValues.scheduleFlexibility) ||
            typeof params.sliderValues.scopeCertainty !== 'number' || !isFinite(params.sliderValues.scopeCertainty) ||
            typeof params.sliderValues.qualityTolerance !== 'number' || !isFinite(params.sliderValues.qualityTolerance)) {
            Logger.log('Error: Invalid slider values: ' + JSON.stringify(params.sliderValues));
            throw new Error('All slider values must be finite numbers');
        }
        if (params.sliderValues.budgetFlexibility < 0 || params.sliderValues.budgetFlexibility > 100 ||
            params.sliderValues.scheduleFlexibility < 0 || params.sliderValues.scheduleFlexibility > 100 ||
            params.sliderValues.scopeCertainty < 0 || params.sliderValues.scopeCertainty > 100 ||
            params.sliderValues.qualityTolerance < 0 || params.sliderValues.qualityTolerance > 100) {
            Logger.log('Error: Slider values must be between 0 and 100: ' + JSON.stringify(params.sliderValues));
            throw new Error('Slider values must be between 0 and 100');
        }
        if (typeof params.targetValue !== 'number' || !isFinite(params.targetValue)) {
            Logger.log('Error: Invalid targetValue: ' + params.targetValue);
            throw new Error('Target value must be a finite number');
        }
        if (params.targetValue < params.optimistic || params.targetValue > params.pessimistic) {
            Logger.log(`Error: Target value ${params.targetValue} out of range: [${params.optimistic}, ${params.pessimistic}]`);
            throw new Error(`Target value ${params.targetValue} must be between optimistic (${params.optimistic}) and pessimistic (${params.pessimistic})`);
        }
        if (typeof params.confidenceLevel !== 'number' || !isFinite(params.confidenceLevel) || params.confidenceLevel < 0 || params.confidenceLevel > 1) {
            Logger.log('Error: Invalid confidenceLevel: ' + params.confidenceLevel);
            throw new Error('Confidence level must be a number between 0 and 1');
        }
        if (typeof params.isOptimizeMode !== 'boolean') {
            Logger.log('Error: isOptimizeMode must be a boolean: ' + params.isOptimizeMode);
            throw new Error('isOptimizeMode must be a boolean');
        }
        if (!['target', 'confidence'].includes(params.mode)) {
            Logger.log('Error: Invalid mode: ' + params.mode);
            throw new Error('Mode must be "target" or "confidence"');
        }

        const cache = CacheService.getScriptCache();
        // Enhanced cacheKey with timestamp and sessionId to avoid collisions
        const timestamp = new Date().toISOString().split('T')[0];
        const cacheKey = `cdf_${params.sheetId}_${params.task}_${timestamp}_${params.sessionId || 'nosession'}`;
        let cachedCdf = cache.get(cacheKey);
        let targetProbabilityOriginalCdf = null;
        if (cachedCdf) {
            try {
                targetProbabilityOriginalCdf = JSON.parse(cachedCdf);
                Logger.log('Retrieved cached targetProbabilityOriginalCdf for task: ' + params.task);
            } catch (e) {
                Logger.log('Error parsing cached CDF: ' + e.message);
                cachedCdf = null;
            }
        }

        const task = {
            task: params.task,
            optimistic: params.optimistic * 1.0,
            mostLikely: params.mostLikely * 1.0,
            pessimistic: params.pessimistic * 1.0,
            budgetFlexibility: params.isOptimizeMode && params.previousOptimalSliderSettings ?
                params.previousOptimalSliderSettings.budgetFlexibility * 1.0 :
                params.sliderValues.budgetFlexibility * 1.0,
            scheduleFlexibility: params.isOptimizeMode && params.previousOptimalSliderSettings ?
                params.previousOptimalSliderSettings.scheduleFlexibility * 1.0 :
                params.sliderValues.scheduleFlexibility * 1.0,
            scopeCertainty: params.isOptimizeMode && params.previousOptimalSliderSettings ?
                params.previousOptimalSliderSettings.scopeCertainty * 1.0 :
                params.sliderValues.scopeCertainty * 1.0,
            qualityTolerance: params.isOptimizeMode && params.previousOptimalSliderSettings ?
                params.previousOptimalSliderSettings.qualityTolerance * 1.0 :
                params.sliderValues.qualityTolerance * 1.0,
            targetValue: params.targetValue * 1.0,
            confidenceLevel: params.confidenceLevel,
            targetProbabilityOnly: false,
            optimizeFor: params.mode
        };
        Logger.log('Task object prepared for API: ' + JSON.stringify(task));

        const apiResponse = callEstimatorAPI([task]);
        if (!apiResponse || !apiResponse.results || !Array.isArray(apiResponse.results) || apiResponse.results.length === 0) {
            Logger.log('Error: API response missing or invalid "results" array');
            throw new Error('API response missing or invalid "results" array');
        }

        const result = apiResponse.results[0];
        Logger.log('API result for task: ' + result.task?.value);

        if (!cachedCdf && result.targetProbabilityOriginalCdf?.value) {
            try {
                cache.put(cacheKey, JSON.stringify(result.targetProbabilityOriginalCdf.value), 3600);
                Logger.log('Cached targetProbabilityOriginalCdf for task: ' + params.task);
            } catch (e) {
                Logger.log('Error caching targetProbabilityOriginalCdf: ' + e.message);
            }
        }

        return {
            ...result,
            targetProbabilityOriginalCdf: { value: cachedCdf ? targetProbabilityOriginalCdf : result.targetProbabilityOriginalCdf?.value || [] }
        };
    } catch (error) {
        Logger.log('Error in getTargetProbabilityData: ' + error.message);
        throw new Error('Failed to fetch target probability data: ' + error.message);
    } finally {
        if (lock.hasLock()) {
            lock.releaseLock();
        }
    }
}

/**
 * SECTION 6: WEB APP INTEGRATION
 * Handles web app requests for creating and submitting estimate sheets.
 */

/**
 * Shows the HTML form or Plot.html for the web app.
 * @param {Object} e - HTTP event with parameters.
 * @returns {HtmlOutput|TextOutput} HTML form or JSON response.
 */
function doGet(e) {
    Logger.log('doGet called with parameters: ' + JSON.stringify(e?.parameter || {}));
    const startTime = Date.now();
    try {
        const config = personas(e, 'doGet');
        Logger.log('Config: ' + JSON.stringify(config));
        if (Date.now() - startTime > DOGET_TIMEOUT_MS) {
            Logger.log('Error: doGet timed out during initial processing');
            throw new Error('Operation timed out during initial processing');
        }
        if (config.sheetId) {
            Logger.log('Serving Plot.html with sheetId: ' + config.sheetId + ', sessionId: ' + config.sessionId);
            const template = HtmlService.createTemplateFromFile('Plot');
            template.sheetId = config.sheetId;
            template.sheetName = config.sheetName;
            template.defaultTask = config.defaultTask;
            template.executingUser = CONFIG.SHOW_EXECUTING_USER ? config.userEmail : '';
            template.CONFIG = CONFIG;
            const html = template.evaluate()
                .setTitle(CONFIG.PAGE_TITLE)
                .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
            Logger.log('Rendering Plot.html');
            return html;
        } else {
            Logger.log('No sheetId provided, serving submit.html');
            const template = HtmlService.createTemplateFromFile('submit');
            try {
                template.tasks = e?.parameter?.tasks ? JSON.parse(decodeURIComponent(e.parameter.tasks)) : [];
                template.projectName = e?.parameter?.projectName ? decodeURIComponent(e.parameter.projectName) : DEFAULT_PROJECT_NAME;
                Logger.log('Parsed tasks for submit.html: ' + JSON.stringify(template.tasks));
                Logger.log('Project name for submit.html: ' + template.projectName);
            } catch (decodeError) {
                Logger.log('Error decoding or parsing tasks parameter: ' + decodeError.message);
                template.tasks = [];
                template.projectName = e?.parameter?.projectName ? decodeURIComponent(e.parameter.projectName) : DEFAULT_PROJECT_NAME;
                return ContentService.createTextOutput(
                    JSON.stringify({ error: 'Invalid tasks parameter: ' + decodeError.message })
                ).setMimeType(ContentService.MimeType.JSON);
            }
            if (Date.now() - startTime > DOGET_TIMEOUT_MS) {
                Logger.log('Error: doGet timed out while rendering submit.html');
                throw new Error('Operation timed out while rendering submit.html');
            }
            Logger.log('Rendering submit.html');
            return template.evaluate().setTitle('Submit Your Estimates');
        }
    } catch (error) {
        Logger.log('Error in doGet: ' + error.message + '\nStack: ' + error.stack);
        return ContentService.createTextOutput(
            JSON.stringify({ error: 'Server error: ' + error.message })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * Creates a spreadsheet and returns URLs for the web app.
 * @param {Array} tasks - Array of task objects.
 * @returns {Object} Object containing sheetUrl, plotUrl, message, errors, and selectedTask.
 */
function createEstimateSheet(tasks) {
    Logger.log('createEstimateSheet called with tasks: ' + JSON.stringify(tasks));
    try {
        // Validate tasks
        let selectedTask = null;
        const userEmail = Session.getEffectiveUser().getEmail() || 'anonymous_' + new Date().getTime();
        const sessionId = CONFIG.SESSION_ID_PREFIX + Utilities.getUuid();
        tasks.forEach((task, i) => {
            task.taskName = (task.taskName || '').replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50) || `Task_${i + 1}`;
            if (!task.taskName || 
                typeof task.bestCase !== 'number' || !isFinite(task.bestCase) ||
                typeof task.mostLikely !== 'number' || !isFinite(task.mostLikely) ||
                typeof task.worstCase !== 'number' || !isFinite(task.worstCase)) {
                Logger.log('Invalid task data at index ' + i + ': ' + JSON.stringify(task));
                throw new Error('Invalid task data at index ' + i + ': ' + JSON.stringify(task));
            }
            if (task.bestCase > task.mostLikely || task.mostLikely > task.worstCase) {
                Logger.log('Invalid estimate order at index ' + i + ': ' + JSON.stringify(task));
                throw new Error('Invalid estimate order at index ' + i);
            }
            if (task.bestCase === task.mostLikely || task.mostLikely === task.worstCase) {
                Logger.log('Estimates too close at index ' + i + ': ' + JSON.stringify(task));
                throw new Error('Estimates must be distinct at index ' + i);
            }
            const range = task.worstCase - task.bestCase;
            const minRange = task.mostLikely * MIN_RANGE_MULTIPLIER;
            if (range < minRange) {
                Logger.log('Estimate range too small at index ' + i + ': range=' + range + ', minRange=' + minRange);
                throw new Error('Estimate range too small at index ' + i);
            }
            if (task.selectedForPlot) {
                if (selectedTask) {
                    Logger.log('Multiple tasks selected for plotting at index ' + i);
                    throw new Error('Only one task can be selected for plotting');
                }
                selectedTask = task.taskName;
            }
        });

        // Create a new spreadsheet with unique name
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '');
        const ss = SpreadsheetApp.create(`PERT Estimates ${timestamp}_${userEmail.split('@')[0]}_${sessionId}`);
        const properties = ss.getProperties();
        properties.setProperty('createdBy', userEmail);
        properties.setProperty('sessionId', sessionId);
        const sheet = ss.getSheets()[0];
        sheet.setName(ESTIMATION_DATA_SHEET_NAME);

        // Write tasks to the sheet
        const data = tasks.map(task => [
            task.taskName,
            task.bestCase,
            task.mostLikely,
            task.worstCase,
            task.selectedForPlot ? 'TRUE' : 'FALSE'
        ]);
        sheet.getRange(2, 1, data.length, 5).setValues(data);

        // Set headers
        sheet.getRange(1, 1, 1, 5).setValues([['Task Name', 'Best Case', 'Most Likely', 'Worst Case', 'Selected for Plot']]).setFontWeight('bold');

        // Call addPertColumns to process the data
        const config = {
            sheetId: ss.getId(),
            isWebAppContext: true,
            errorHandler: 'confirm',
            userEmail: userEmail,
            sessionId: sessionId
        };
        const result = addPertColumns(config);

        // Prepare response with sessionId in plotUrl
        const sheetUrl = ss.getUrl();
        const plotUrl = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec?sheetId=${ss.getId()}&sessionId=${sessionId}`;
        Logger.log('Generated plotUrl: ' + plotUrl);
        return {
            status: result.status,
            sheetUrl: sheetUrl,
            plotUrl: plotUrl,
            message: result.message,
            errors: result.errors,
            selectedTask: selectedTask
        };
    } catch (error) {
        Logger.log('Error in createEstimateSheet: ' + error.message);
        throw new Error('Failed to create estimate sheet: ' + error.message);
    }
}

/**
 * Handles POST requests to auto-create a sheet for the web app.
 * @param {Object} e - HTTP event with parameters.
 * @returns {TextOutput} JSON containing sheetUrl, plotUrl, message, errors, and selectedTask.
 */
function doPost(e) {
    Logger.log('doPost called with parameters: ' + JSON.stringify(e?.parameter));
    try {
        if (!e || !e.parameter || !e.parameter.data) {
            throw new Error('Missing data parameter.');
        }

        const tasks = JSON.parse(e.parameter.data);
        if (!Array.isArray(tasks) || tasks.length === 0) {
            throw new Error('Invalid or empty tasks array.');
        }

        return ContentService.createTextOutput(
            JSON.stringify(createEstimateSheet(tasks))
        ).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        Logger.log('Error in doPost: ' + error.message);
        return ContentService.createTextOutput(
            JSON.stringify({ error: error.message })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}








