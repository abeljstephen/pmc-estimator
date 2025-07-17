// Part 1: Configuration and Personas

/**
 * SECTION 0: CONFIG
 * Configuration object for the add-on and web app.
 */
const CONFIG = {
    // General Settings
    PAGE_TITLE: 'Interactive Probability Simulator',
    SUBMIT_PAGE_TITLE: 'Submit Your Estimates',
    VERSION_TEXT: 'Version 1.0',
    MAX_TASKS: 100,
    SHOW_EXECUTING_USER: false,

    // External Resources
    GOOGLE_CHARTS_URL: 'https://www.gstatic.com/charts/loader.js',
    MATHJAX_URL: 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js',
    GOOGLE_FONTS_URL: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;600&display=swap',
    LEARN_MORE_URL: 'https://example.com/learn-more',

    // UI Labels and Messages
    LOADING_MESSAGE: 'Loading Interactive Probability Simulator...',
    LOADING_MESSAGE_SUBMIT: 'Submitting tasks...',
    TASK_LOADING_MESSAGE: 'Loading tasks...',
    INITIAL_SETUP_TITLE: 'Initial Setup / User Choices',
    INITIAL_SETUP_DESCRIPTION: 'Choose a task and define your target value or confidence level to begin.',
    SUBMIT_INSTRUCTIONS: 'Enter tasks with their best case, most likely, and worst case estimates. Select one task for plotting.',
    NO_TASKS_MESSAGE: 'No tasks provided. Add a task to begin.',
    EXPLORATION_RESULTS_HEADER: 'Exploration Results',
    EXPLORATION_RESULTS_DEFAULT_TEXT: 'Select a mode to view results.',
    INSIGHTS_RECOMMENDATIONS_LABEL: 'Insights and Recommendations',
    RECOMMENDATIONS_HEADER: 'Recommendations',
    STATISTICAL_METRICS_TITLE: 'Statistical Metrics',
    BACK_TO_TOP_LABEL: 'Back to Top',
    LEARN_MORE_LABEL: 'Learn More',
    SUCCESS_MESSAGE: 'Tasks submitted successfully. Use the buttons below to view the spreadsheet or dashboard.',
    SUCCESS_MESSAGE_WITH_INVALID_ROWS: 'Tasks submitted, but some rows had errors. Use the buttons below to view the spreadsheet or dashboard.',

    // Form Labels and Tooltips
    PROJECT_NAME_LABEL: 'Project Name',
    TASK_NAME_LABEL: 'Task Name',
    TASK_NAME_TOOLTIP: 'Enter a unique name for the task (alphanumeric characters and underscores only).',
    TASK_SELECT_LABEL: 'Select Task:',
    BEST_CASE_LABEL: 'Best Case',
    BEST_CASE_TOOLTIP: 'Enter the optimistic estimate for the task.',
    MOST_LIKELY_LABEL: 'Most Likely',
    MOST_LIKELY_TOOLTIP: 'Enter the most likely estimate for the task.',
    WORST_CASE_LABEL: 'Worst Case',
    WORST_CASE_TOOLTIP: 'Enter the pessimistic estimate for the task.',
    SELECT_FOR_PLOT_LABEL: 'Select for Plot',
    SELECT_FOR_PLOT_TOOLTIP: 'Select one task to be used for plotting in the dashboard.',
    MODE_SELECT_LABEL: 'Target Mode:',
    TARGET_MODE_LABEL: 'Target',
    CONFIDENCE_MODE_LABEL: 'Confidence',
    TARGET_VALUE_LABEL: 'Value',
    CONFIDENCE_LEVEL_LABEL: 'Value',
    DEFAULT_CONFIDENCE_LEVEL: '90',
    OPTIMIZE_LABEL: 'Optimize:',
    OPTIMIZE_NO_LABEL: 'No',
    OPTIMIZE_YES_LABEL: 'Yes',
    ADD_TASK_BUTTON: 'Add Task',
    SUBMIT_BUTTON: 'Submit',
    CLEAR_FORM_BUTTON: 'Clear Form',
    OPEN_SPREADSHEET_BUTTON: 'Open Spreadsheet',
    OPEN_DASHBOARD_BUTTON: 'Open Dashboard',

    // Slider Settings
    BUDGET_FLEXIBILITY_LABEL: 'Budget Flexibility (%)',
    SCHEDULE_FLEXIBILITY_LABEL: 'Schedule Flexibility (%)',
    SCOPE_CERTAINTY_LABEL: 'Scope Certainty (%)',
    QUALITY_TOLERANCE_LABEL: 'Tolerance for Poor Quality (%)',
    BUDGET_FLEXIBILITY_HELP_TEXT: 'Higher flexibility allows for a larger budget buffer.',
    SCHEDULE_FLEXIBILITY_HELP_TEXT: 'Higher flexibility extends the timeline.',
    SCOPE_CERTAINTY_HELP_TEXT: 'Higher certainty reduces outcome range.',
    QUALITY_TOLERANCE_HELP_TEXT: 'Higher tolerance accepts more defects or lower quality.',

    // Use Case Descriptions
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

    // Chart Settings
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

    // Combination Table
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

    // Statistical Metrics
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

    // Recommendations
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
    EXPLORE_MODE_DEFAULT_TITLE_PREFIX: 'Adjust Sliders to Explore',
    EXPLORE_MODE_DEFAULT_TITLE_SUFFIX: 'Target Value Probability',
    EXPLORE_MODE_OPTIMIZED_TITLE: 'View Optimized Settings for Maximum Outcome',

    // Risk Levels
    RISK_LEVEL_VERY_LOW: 'very low risk',
    RISK_LEVEL_LOW: 'low risk',
    RISK_LEVEL_MODERATE: 'moderate risk',
    RISK_LEVEL_HIGH: 'high risk',

    // Default Values
    DEFAULT_PROJECT_NAME: 'Untitled Project',
    DEFAULT_BEST_CASE: 1800.00,
    DEFAULT_MOST_LIKELY: 2400.00,
    DEFAULT_WORST_CASE: 3000.00,
    DEFAULT_TARGET_VALUE: 2400.00,
    DEFAULT_CONFIDENCE_LEVEL: 0.9,
    DEFAULT_ORIGINAL_PROBABILITY: 54.0,
    DEFAULT_ADJUSTED_PROBABILITY: 97.6,
    DEFAULT_VALUE_AT_CONFIDENCE: 2325.50,
    DEFAULT_ORIGINAL_VALUE_AT_CONFIDENCE: 2504.91,
    DEFAULT_OPTIMAL_PROBABILITY: 100.0,
    DEFAULT_VARIANCE_SCALE: 0.8,
    DEFAULT_ORIGINAL_MEAN: 2400.00,
    DEFAULT_ADJUSTED_MEAN: 2420.50,
    DEFAULT_STD_DEV: 180.50,
    DEFAULT_VARIANCE: 32580.25,
    DEFAULT_SKEWNESS: 0.05,
    DEFAULT_CV: 0.075,
    DEFAULT_CI: '[2079.19, 2761.81]',
    DEFAULT_VAR: 2520.00,
    DEFAULT_CVAR: 2520.00,

    // Error Messages
    ERROR_NO_SIMULATOR_CONTAINER: 'Probability simulator container not found',
    ERROR_PAGE_LOAD_FAILED: 'Error: Page failed to load. Please refresh or contact support.',
    ERROR_NO_VALID_TASKS: 'No valid tasks available',
    ERROR_NO_VALID_TASKS_MESSAGE: 'Error: No valid tasks found (best case < most likely < worst case not satisfied). Using default values. Please contact support.',
    ERROR_NO_TASK_SELECT: 'task-select element not found',
    ERROR_INVALID_TASK_DATA: 'Invalid task data.',
    ERROR_NO_EXPLORE_MODE_TITLE: 'Explore mode title element not found',
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
    ERROR_RENDERING_PDF: 'Error rendering PDF.',
    ERROR_RENDERING_CDF: 'Error rendering CDF.',
    ERROR_NO_EXPLORE_RESULTS: 'Explore results element not found',
    ERROR_INVALID_TASK_RESULTS_MESSAGE: 'Error: Invalid task data (best case < most likely < worst case not satisfied) or no task selected. Using default values (target: 2400.00). Please select a valid task or contact support.',
    WARNING_NO_METRICS_UPDATE: 'Skipping metrics table update due to invalid task or missing data',
    WARNING_ELEMENT_NOT_FOUND: 'Element with ID not found in DOM:',
    ERROR_NO_COMBINATION_TABLE: 'Combination table body not found',
    ERROR_NO_COMBINATION_DATA: 'Error: Unable to load combination data due to API failure.',
    WARNING_NO_COMBINATIONS: 'No combinations available in targetProbabilityData',
    WARNING_COMBINATION_LIMIT: 'Limiting combinations from',
    ERROR_NO_COMBINATION_MATCH: 'No combinations match the "{filterValue}" filter. Try adjusting sliders or selecting a different filter.',
    ERROR_INVALID_TASK_RECOMMENDATIONS: 'Error: Please select a valid task or check API connectivity.',
    WARNING_OPTIMAL_VALUE_ADJUSTED: 'Optimal value',
    WARNING_OPTIMAL_SLIDER_SETTINGS_MISSING: 'Optimal slider settings missing in API response',
    ERROR_NO_PLOT_URL: 'No valid dashboard URL available. Please try submitting again.',
    ERROR_NO_SHEET_URL: 'No valid spreadsheet URL available. Please try submitting again.',
    ERROR_INVALID_TASKS_ARRAY: 'Invalid tasks array provided.',
    ERROR_TOO_MANY_TASKS: 'Too many tasks provided. Maximum allowed is 100.',
    ERROR_INVALID_TASK_OBJECT: 'Invalid task object',
    ERROR_INVALID_ESTIMATE_ORDER: 'Best Case must be less than Most Likely, and Most Likely must be less than Worst Case',
    ERROR_ESTIMATES_NOT_DISTINCT: 'Estimates must be distinct values',
    ERROR_RANGE_TOO_SMALL: 'Estimate range too small',
    ERROR_MULTIPLE_SELECTED_TASKS: 'Only one task can be selected for plotting',
    ERROR_NO_SELECTED_TASK: 'Please select one task for plotting',
    ERROR_INVALID_TASK_NAME: 'Invalid task name',
    ERROR_INVALID_TASK_NAME_ADJUSTED: 'Task name adjusted to alphanumeric characters and underscores',
    ERROR_LOADING_TASKS: 'Error loading tasks:',
    CONFIRM_CLEAR_FORM: 'Are you sure you want to clear the form?',
    CONFIRM_SUBMIT: 'Are you sure you want to submit the tasks?',
    CONFIRM_INVALID_ROWS: 'Continue with invalid rows marked as N/A?',
    ERROR_OPERATION_CANCELLED: 'Operation cancelled by user',
    ERROR_SUBMIT_FAILED: 'Failed to submit tasks:',
    ERROR_INVALID_BEST_CASE: 'Invalid Best Case estimate',
    ERROR_INVALID_MOST_LIKELY: 'Invalid Most Likely estimate',
    ERROR_INVALID_WORST_CASE: 'Invalid Worst Case estimate',
    ERROR_NO_TARGET_VALUE: 'Please enter a target value.',
    ERROR_INVALID_TARGET_VALUE: 'Value must be between',
    ERROR_NO_CONFIDENCE_LEVEL: 'Please enter a confidence level.',
    ERROR_INVALID_CONFIDENCE_LEVEL: 'Must be an integer between 1 and 100.'
};

// Constants
const DEPLOYMENT_ID = 'UPDATE_WITH_NEW_DEPLOYMENT_ID'; // Placeholder for new deployment ID
const ESTIMATION_DATA_SHEET_NAME = 'Estimation Data';
const ESTIMATE_CALCULATIONS_SHEET_NAME = 'Estimate Calculations';
const ADDON_CALCULATIONS_SHEET_NAME = 'Estimate Calculations Addon';
const DEFAULT_PROJECT_NAME = 'Untitled Project';
const DEFAULT_ROW_INDEX = 2;
const MIN_RANGE_MULTIPLIER = 0.1;
const DOGET_TIMEOUT_MS = 15000;
const SERVICE_ACCOUNT_KEY_NAME = 'serviceAccountKey';
const API_URL = 'https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI';
const TOKEN_ENDPOINT_URL = 'https://oauth2.googleapis.com/token';
const API_TIMEOUT_MS = 30000; // 30 seconds
const SESSION_ID_PREFIX = 'Session_';

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
        sessionId: CONFIG.SESSION_ID_PREFIX + Utilities.getUuid() // Set sessionId for both modes
    };
    try {
        // Web app mode: HTTP event with parameters
        if (e && e.parameter && e.parameter.sheetId) {
            config.mode = 'web';
            config.isWebAppContext = true;
            config.errorHandler = 'confirm';
            config.sheetId = e.parameter.sheetId;
            config.sessionId = e.parameter.sessionId || config.sessionId;
            Logger.log('Web app mode - sheetId: ' + config.sheetId + ', sessionId: ' + config.sessionId);
            try {
                const ss = SpreadsheetApp.openById(config.sheetId);
                const scriptProperties = PropertiesService.getScriptProperties();
                const createdBy = scriptProperties.getProperty('createdBy');
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
            } else if (context === 'doGet') {
                config.sheetId = null; // Explicitly set to null for submit.html
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
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hasEstimationSheet = ss && ss.getSheets().some(s => s.getName().toLowerCase() === ESTIMATION_DATA_SHEET_NAME.toLowerCase());
    const menu = ui.createAddonMenu();
    if (hasEstimationSheet) {
        menu.addItem('PERT', 'addPertColumnsWrapper')
            .addItem('PLOT', 'showPlot');
    } else {
        menu.addItem('PERT', 'showNoSheetError')
            .addItem('PLOT', 'showNoSheetError');
    }
    menu.addToUi();
}

function showNoSheetError() {
    SpreadsheetApp.getUi().alert('Error', `No "${ESTIMATION_DATA_SHEET_NAME}" sheet found. Please create a sheet named "${ESTIMATION_DATA_SHEET_NAME}" with columns: Task Name, Best Case, Most Likely, Worst Case, Selected for Plot.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * SECTION 3: PERT CALCULATIONS
 * Handles PERT calculations and sheet updates for the add-on persona.
 */

/**
 * Wrapper function to call addPertColumns from the add-on UI.
 */
function addPertColumnsWrapper() {
    const config = personas(null, 'addPertColumnsWrapper');
    Logger.log('addPertColumnsWrapper called with config: ' + JSON.stringify(config));
    if (!config.sheetId) {
        Logger.log('Error: No active spreadsheet found in addPertColumnsWrapper');
        SpreadsheetApp.getUi().alert('Error', 'No active spreadsheet found. Please open a spreadsheet with task data.', SpreadsheetApp.getUi().ButtonSet.OK);
        return;
    }
    const result = addPertColumns(config);
    if (result.status === 'error') {
        Logger.log('addPertColumnsWrapper errors: ' + result.errors.join('; '));
        SpreadsheetApp.getUi().alert('Errors in Processing', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
        Logger.log('addPertColumnsWrapper completed successfully');
        SpreadsheetApp.getUi().alert('Success', 'PERT calculations completed successfully.', SpreadsheetApp.getUi().ButtonSet.OK);
    }
}

/**
 * Processes PERT calculations and updates the spreadsheet.
 * @param {Object} config - Configuration object with sheetId, isWebAppContext, errorHandler, userEmail, sessionId.
 * @returns {Object} Status and errors.
 */
function addPertColumns(config) {
    Logger.log('addPertColumns called with config: ' + JSON.stringify(config || 'undefined'));
    const errors = [];
    let output = { status: 'success', errors: [], message: '' };
    try {
        if (!config || typeof config !== 'object') {
            errors.push('Invalid or missing config object');
            Logger.log('Error: Invalid or missing config object');
            output.status = 'error';
            output.errors = errors;
            output.message = 'Failed to process: Invalid or missing config object';
            if (config?.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        if (!config.sheetId) {
            errors.push('No spreadsheet ID provided');
            Logger.log('Error: No spreadsheet ID provided');
            output.status = 'error';
            output.errors = errors;
            output.message = 'Failed to process: No spreadsheet ID provided';
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        const ss = SpreadsheetApp.openById(config.sheetId);
        let sheet = ss.getSheets().find(s => s.getName().toLowerCase() === ESTIMATION_DATA_SHEET_NAME.toLowerCase());
        if (!sheet) {
            errors.push(`Sheet "${ESTIMATION_DATA_SHEET_NAME}" not found`);
            Logger.log(`Error: Sheet "${ESTIMATION_DATA_SHEET_NAME}" not found`);
            output.status = 'error';
            output.errors = errors;
            output.message = `Failed to process: Sheet "${ESTIMATION_DATA_SHEET_NAME}" not found`;
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        const data = sheet.getDataRange().getValues();
        if (data.length < 2) {
            errors.push('No task data found in sheet');
            Logger.log('Error: No task data found in sheet');
            output.status = 'error';
            output.errors = errors;
            output.message = 'Failed to process: No task data found in sheet';
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        if (sheet.getLastColumn() < 4) {
            errors.push('Sheet must have at least 4 columns: Task Name, Best Case, Most Likely, Worst Case');
            Logger.log('Error: Sheet has fewer than 4 columns');
            output.status = 'error';
            output.errors = errors;
            output.message = 'Failed to process: Sheet must have at least 4 columns';
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        const tasks = [];
        let selectedForPlotCount = 0;
        let selectedTaskIndex = -1;
        for (let i = 1; i < data.length; i++) {
            const [name, bestCase, mostLikely, worstCase, selectedForPlot] = data[i];
            if (!name && (!bestCase || !mostLikely || !worstCase)) {
                Logger.log(`Skipping empty row ${i + 1}`);
                continue;
            }
            if (typeof bestCase !== 'number' || !isFinite(bestCase) || 
                typeof mostLikely !== 'number' || !isFinite(mostLikely) || 
                typeof worstCase !== 'number' || !isFinite(worstCase)) {
                errors.push(`Invalid numeric inputs at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                Logger.log(`Error: Invalid numeric inputs at row ${i + 1}`);
                continue;
            }
            if (bestCase > mostLikely || mostLikely > worstCase) {
                errors.push(`Invalid estimate order at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                Logger.log(`Error: Invalid estimate order at row ${i + 1}`);
                continue;
            }
            if (bestCase === mostLikely || mostLikely === worstCase) {
                errors.push(`Estimates too close at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                Logger.log(`Error: Estimates too close at row ${i + 1}`);
                continue;
            }
            const range = worstCase - bestCase;
            const minRange = mostLikely * MIN_RANGE_MULTIPLIER;
            if (range < minRange) {
                errors.push(`Estimate range too small at row ${i + 1}: range=${range}, minRange=${minRange}`);
                Logger.log(`Error: Estimate range too small at row ${i + 1}`);
                continue;
            }
            tasks.push({
                task: name || `Task_${i}`,
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
            });
            if (selectedForPlot === true || selectedForPlot === 'TRUE') {
                selectedForPlotCount++;
                selectedTaskIndex = i;
            }
        }
        if (selectedForPlotCount > 1) {
            errors.push('Only one task can be selected for plotting');
            Logger.log('Error: Multiple tasks selected for plotting');
            output.status = 'error';
            output.errors = errors;
            output.message = 'Failed to process: Only one task can be selected for plotting';
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        if (tasks.length === 0) {
            errors.push('No valid tasks found after validation');
            Logger.log('Error: No valid tasks found');
            output.status = 'error';
            output.errors = errors;
            output.message = 'Failed to process: No valid tasks found';
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        const apiResponse = callEstimatorAPI(tasks);
        if (!apiResponse || !apiResponse.results || !Array.isArray(apiResponse.results)) {
            errors.push('API response missing or invalid "results" array');
            Logger.log('Error: API response missing or invalid "results" array');
            output.status = 'error';
            output.errors = errors;
            output.message = 'Failed to process: Invalid API response';
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        // Validate API response fields
        const requiredFields = [
            'task', 'triangleMean', 'triangleVariance', 'triangleStdDev', 'triangleSkewness', 'triangleKurtosis',
            'trianglePoints', 'pertMean', 'pertStdDev', 'pertVariance', 'pertSkewness', 'pertKurtosis', 'pertPoints',
            'betaMean', 'betaVariance', 'betaSkewness', 'betaKurtosis', 'alpha', 'beta', 'betaMode', 'betaPoints',
            'mcMean', 'mcVariance', 'mcSkewness', 'mcKurtosis', 'mcVaR', 'mcCVaR', 'mcMAD', 'mcPoints',
            'mcSmoothedMean', 'mcSmoothedVariance', 'mcSmoothedSkewness', 'mcSmoothedKurtosis', 'mcSmoothedVaR',
            'mcSmoothedCVaR', 'mcSmoothedMAD', 'mcSmoothedConfidenceInterval', 'mcSmoothedPoints',
            'weightedConservative', 'weightedNeutral', 'weightedOptimistic', 'probExceedPertMeanBeta',
            'probExceedPertMeanMCUnsmoothed', 'probExceedPertMeanMCSmoothed', 'cdfPoints'
        ];
        apiResponse.results.forEach((result, i) => {
            requiredFields.forEach(field => {
                if (!result[field] || result[field].value === undefined) {
                    errors.push(`Missing or invalid field "${field}" in API response for task ${i + 1}`);
                    Logger.log(`Error: Missing or invalid field "${field}" in API response for task ${i + 1}`);
                }
            });
        });
        Logger.log('API results received: ' + JSON.stringify(apiResponse.results));
        let calcSheet = ss.getSheets().find(s => s.getName().toLowerCase() === ESTIMATE_CALCULATIONS_SHEET_NAME.toLowerCase());
        if (!calcSheet) {
            calcSheet = ss.insertSheet(ESTIMATE_CALCULATIONS_SHEET_NAME);
        } else {
            calcSheet.clear();
        }
        // Create error log sheet
        let errorSheet = ss.getSheets().find(s => s.getName().toLowerCase() === 'Error Log');
        if (!errorSheet) {
            errorSheet = ss.insertSheet('Error Log');
            errorSheet.getRange(1, 1, 1, 2).setValues([['Row', 'Error Message']]).setFontWeight('bold');
        } else {
            errorSheet.getRange(2, 1, errorSheet.getLastRow(), 2).clear();
        }
        const headers = [
            'Name', 'Best Case', 'Most Likely', 'Worst Case', 'Triangle Mean', 'Triangle Variance', 'Triangle StdDev',
            'Triangle Skewness', 'Triangle Kurtosis', 'Triangle Points', 'PERT Mean', 'PERT StdDev', 'PERT Variance',
            'PERT Skewness', 'PERT Kurtosis', 'PERT Points', 'Beta Mean', 'Beta Variance', 'Beta Skewness',
            'Beta Kurtosis', 'Alpha', 'Beta', 'Beta Mode', 'Beta Points', 'MC On Beta Unsmoothed Mean',
            'MC On Beta Unsmoothed Variance', 'MC On Beta Unsmoothed Skewness', 'MC On Beta Unsmoothed Kurtosis',
            'MC On Beta Unsmoothed VaR 90%', 'MC On Beta Unsmoothed CVaR 90%', 'MC On Beta Unsmoothed MAD',
            'MC On Beta Unsmoothed Points', 'MC On Beta Smoothed Mean', 'MC On Beta Smoothed Variance',
            'MC On Beta Smoothed Skewness', 'MC On Beta Smoothed Kurtosis', 'MC On Beta Smoothed VaR 90%',
            'MC On Beta Smoothed CVaR 90%', 'MC On Beta Smoothed MAD', 'MC On Beta Smoothed 90th Percentile Confidence',
            'MC On Beta Smoothed Points', 'Weighted Estimate (Conservative)', 'Weighted Estimate (Neutral)',
            'Weighted Estimate (Optimistic)', 'Probability Exceeding PERT Mean (Beta)',
            'Probability Exceeding PERT Mean (MC Unsmoothed)', 'Probability Exceeding PERT Mean (MC Smoothed)', 'CDF Points'
        ];
        const headerDescriptions = [
            'Task name or identifier.', 'Optimistic estimate (best-case).', 'Most likely estimate.', 'Pessimistic estimate (worst-case).',
            'Triangle distribution average.', 'Triangle distribution spread.', 'Triangle standard deviation.', 'Triangle asymmetry.',
            'Triangle peakedness.', 'Triangle cumulative points.', 'Weighted average (PERT).', 'PERT standard deviation.',
            'PERT spread.', 'PERT asymmetry.', 'PERT peakedness.', 'PERT cumulative points.', 'Beta distribution mean.',
            'Beta spread.', 'Beta asymmetry.', 'Beta peakedness.', 'Beta shape (alpha).', 'Beta shape (beta).', 'Beta mode.',
            'Beta cumulative points.', 'Unsmoothed Monte Carlo mean.', 'Unsmoothed Monte Carlo spread.',
            'Unsmoothed Monte Carlo asymmetry.', 'Unsmoothed Monte Carlo peakedness.', 'Unsmoothed Monte Carlo VaR 90%.',
            'Unsmoothed Monte Carlo CVaR 90%.', 'Unsmoothed Monte Carlo MAD.', 'Unsmoothed Monte Carlo points.',
            'Smoothed Monte Carlo mean.', 'Smoothed Monte Carlo spread.', 'Smoothed Monte Carlo asymmetry.',
            'Smoothed Monte Carlo peakedness.', 'Smoothed Monte Carlo VaR 90%.', 'Smoothed Monte Carlo CVaR 90%.',
            'Smoothed Monte Carlo MAD.', 'Smoothed Monte Carlo 90th Percentile.', 'Smoothed Monte Carlo points.',
            'Conservative weighted estimate.', 'Neutral weighted estimate (PERT Mean).', 'Optimistic weighted estimate.',
            'Probability exceeding PERT Mean (Beta).', 'Probability exceeding PERT Mean (MC Unsmoothed).',
            'Probability exceeding PERT Mean (MC Smoothed).', 'Cumulative distribution points.'
        ];
        calcSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        calcSheet.getRange(2, 1, 1, headers.length).setValues([headerDescriptions]);
        const dataRows = [];
        const errorRows = [];
        for (let i = 0; i < data.length - 1; i++) {
            const originalRowIndex = i + 2;
            const [name, bestCase, mostLikely, worstCase, selectedForPlot] = data[i + 1];
            if (!name && (!bestCase || !mostLikely || !worstCase)) {
                dataRows.push(new Array(headers.length).fill('N/A'));
                Logger.log(`Row ${originalRowIndex} is empty, filling with N/A`);
                continue;
            }
            if (typeof bestCase !== 'number' || !isFinite(bestCase) || 
                typeof mostLikely !== 'number' || !isFinite(mostLikely) || 
                typeof worstCase !== 'number' || !isFinite(worstCase)) {
                dataRows.push(new Array(headers.length).fill('N/A'));
                errors.push(`Invalid numeric inputs at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([originalRowIndex, `Invalid numeric inputs: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                Logger.log(`Error: Invalid numeric inputs at row ${originalRowIndex}`);
                continue;
            }
            if (bestCase > mostLikely || mostLikely > worstCase) {
                dataRows.push(new Array(headers.length).fill('N/A'));
                errors.push(`Invalid estimate order at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([originalRowIndex, `Invalid estimate order: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                Logger.log(`Error: Invalid estimate order at row ${originalRowIndex}`);
                continue;
            }
            if (bestCase === mostLikely || mostLikely === worstCase) {
                dataRows.push(new Array(headers.length).fill('N/A'));
                errors.push(`Estimates too close at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([originalRowIndex, `Estimates too close: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                Logger.log(`Error: Estimates too close at row ${originalRowIndex}`);
                continue;
            }
            const range = worstCase - bestCase;
            const minRange = mostLikely * MIN_RANGE_MULTIPLIER;
            if (range < minRange) {
                dataRows.push(new Array(headers.length).fill('N/A'));
                errors.push(`Estimate range too small at row ${originalRowIndex}: range=${range}, minRange=${minRange}`);
                errorRows.push([originalRowIndex, `Estimate range too small: range=${range}, minRange=${minRange}`]);
                Logger.log(`Error: Estimate range too small at row ${originalRowIndex}`);
                continue;
            }
            const resultIndex = tasks.findIndex(task => task.task === (name || `Task_${i + 1}`));
            if (resultIndex === -1 || !apiResponse.results[resultIndex]) {
                dataRows.push(new Array(headers.length).fill('N/A'));
                errors.push(`No API results for task at row ${originalRowIndex}: ${name || `Task_${i + 1}`}`);
                errorRows.push([originalRowIndex, `No API results for task: ${name || `Task_${i + 1}`}`]);
                Logger.log(`Error: No API results for task at row ${originalRowIndex}`);
                continue;
            }
            const result = apiResponse.results[resultIndex];
            const rowData = [
                result.task?.value || name || `Task_${i + 1}`,
                bestCase,
                mostLikely,
                worstCase,
                result.triangleMean?.value || 'N/A',
                result.triangleVariance?.value || 'N/A',
                result.triangleStdDev?.value || 'N/A',
                result.triangleSkewness?.value || 'N/A',
                result.triangleKurtosis?.value || 'N/A',
                JSON.stringify(result.trianglePoints?.value || []),
                result.pertMean?.value || 'N/A',
                result.pertStdDev?.value || 'N/A',
                result.pertVariance?.value || 'N/A',
                result.pertSkewness?.value || 'N/A',
                result.pertKurtosis?.value || 'N/A',
                JSON.stringify(result.pertPoints?.value || []),
                result.betaMean?.value || 'N/A',
                result.betaVariance?.value || 'N/A',
                result.betaSkewness?.value || 'N/A',
                result.betaKurtosis?.value || 'N/A',
                result.alpha?.value || 'N/A',
                result.beta?.value || 'N/A',
                result.betaMode?.value || 'N/A',
                JSON.stringify(result.betaPoints?.value || []),
                result.mcMean?.value || 'N/A',
                result.mcVariance?.value || 'N/A',
                result.mcSkewness?.value || 'N/A',
                result.mcKurtosis?.value || 'N/A',
                result.mcVaR?.value || 'N/A',
                result.mcCVaR?.value || 'N/A',
                result.mcMAD?.value || 'N/A',
                JSON.stringify(result.mcPoints?.value || []),
                result.mcSmoothedMean?.value || 'N/A',
                result.mcSmoothedVariance?.value || 'N/A',
                result.mcSmoothedSkewness?.value || 'N/A',
                result.mcSmoothedKurtosis?.value || 'N/A',
                result.mcSmoothedVaR?.value || 'N/A',
                result.mcSmoothedCVaR?.value || 'N/A',
                result.mcSmoothedMAD?.value || 'N/A',
                result.mcSmoothedConfidenceInterval?.value ? `[${result.mcSmoothedConfidenceInterval.value.lower.toFixed(2)}, ${result.mcSmoothedConfidenceInterval.value.upper.toFixed(2)}]` : 'N/A',
                JSON.stringify(result.mcSmoothedPoints?.value || []),
                result.weightedConservative?.value || 'N/A',
                result.weightedNeutral?.value || 'N/A',
                result.weightedOptimistic?.value || 'N/A',
                result.probExceedPertMeanBeta?.value || 'N/A',
                result.probExceedPertMeanMCUnsmoothed?.value || 'N/A',
                result.probExceedPertMeanMCSmoothed?.value || 'N/A',
                JSON.stringify(result.cdfPoints?.value || [])
            ];
            dataRows.push(rowData);
            Logger.log(`Processed row ${originalRowIndex} with data: ${JSON.stringify(rowData)}`);
        }
        if (dataRows.length > 0) {
            calcSheet.getRange(3, 1, dataRows.length, headers.length).setValues(dataRows);
        }
        if (errorRows.length > 0) {
            errorSheet.getRange(2, 1, errorRows.length, 2).setValues(errorRows);
        }
        calcSheet.getRange(1, 1, calcSheet.getLastRow(), calcSheet.getLastColumn()).setWrap(true);
        errorSheet.getRange(1, 1, errorSheet.getLastRow(), errorSheet.getLastColumn()).setWrap(true);
        output.message = 'Successfully processed PERT calculations';
        if (errors.length > 0) {
            output.status = 'error';
            output.errors = errors;
            output.message = 'Processed with errors: ' + errors.join('; ');
        }
        if (config.isWebAppContext && errors.length > 0) {
            Logger.log('Web app context with errors: ' + errors.join('; '));
            output.message += '\nSome rows were invalid and marked as N/A. Check the "Error Log" sheet.';
        }
        if (config.errorHandler === 'confirm' && errors.length > 0 && SpreadsheetApp.getUi()) {
            SpreadsheetApp.getUi().alert('Errors in Processing', output.message + '\nCheck the "Error Log" sheet for details.', SpreadsheetApp.getUi().ButtonSet.OK);
        }
        Logger.log('addPertColumns completed: ' + output.message);
        return output;
    } catch (error) {
        Logger.log('Error in addPertColumns: ' + error.message + '\nStack: ' + error.stack);
        output.status = 'error';
        output.errors.push(error.message);
        output.message = 'Failed to process PERT calculations: ' + error.message;
        errorRows.push([0, `General error: ${error.message}`]);
        if (errorRows.length > 0) {
            errorSheet.getRange(2, 1, errorRows.length, 2).setValues(errorRows);
        }
        if (config?.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
            SpreadsheetApp.getUi().alert('Error', output.message + '\nCheck the "Error Log" sheet for details.', SpreadsheetApp.getUi().ButtonSet.OK);
        }
        return output;
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
                (task.targetValue !== undefined && (typeof task.targetValue !== 'number' || !isFinite(task.targetValue)))) {
                Logger.log(`Invalid task data at index ${i}: ${JSON.stringify(task)}`);
                throw new Error(`Invalid task data at index ${i}: All task estimates and targetValue (if provided) must be finite numbers`);
            }
        });
        const keyJsonString = PropertiesService.getScriptProperties().getProperty(SERVICE_ACCOUNT_KEY_NAME);
        if (!keyJsonString) {
            Logger.log('Error: Script property "' + SERVICE_ACCOUNT_KEY_NAME + '" not found. Please set it in Project Settings > Script Properties with your service account key JSON.');
            throw new Error('Script property "' + SERVICE_ACCOUNT_KEY_NAME + '" not found. Please set it in Project Settings > Script Properties with your service account key JSON.');
        }
        let keyJson;
        try {
            keyJson = JSON.parse(keyJsonString);
        } catch (e) {
            Logger.log('Error parsing ' + SERVICE_ACCOUNT_KEY_NAME + ': ' + e.message);
            throw new Error('Failed to parse ' + SERVICE_ACCOUNT_KEY_NAME + ': ' + e.message);
        }
        if (!keyJson.client_email || !keyJson.private_key) {
            Logger.log('Error: Invalid ' + SERVICE_ACCOUNT_KEY_NAME + ' JSON; missing client_email or private_key');
            throw new Error('Invalid ' + SERVICE_ACCOUNT_KEY_NAME + ' JSON; missing client_email or private_key');
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
                Logger.log('Token request failed: ' + response.getContentText());
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
        Logger.log('Full API response: ' + JSON.stringify(response.getContentText()));
        if (response.getResponseCode() !== 200) {
            Logger.log('API request failed: ' + response.getContentText());
            throw new Error('API request failed: ' + response.getContentText());
        }
        const responseData = JSON.parse(response.getContentText());
        Logger.log('API response data received with ' + (responseData.results ? responseData.results.length : 0) + ' results');
        // Validate response fields
        if (responseData.results) {
            const requiredFields = [
                'task', 'triangleMean', 'triangleVariance', 'triangleStdDev', 'triangleSkewness', 'triangleKurtosis',
                'trianglePoints', 'pertMean', 'pertStdDev', 'pertVariance', 'pertSkewness', 'pertKurtosis', 'pertPoints',
                'betaMean', 'betaVariance', 'betaSkewness', 'betaKurtosis', 'alpha', 'beta', 'betaMode', 'betaPoints',
                'mcMean', 'mcVariance', 'mcSkewness', 'mcKurtosis', 'mcVaR', 'mcCVaR', 'mcMAD', 'mcPoints',
                'mcSmoothedMean', 'mcSmoothedVariance', 'mcSmoothedSkewness', 'mcSmoothedKurtosis', 'mcSmoothedVaR',
                'mcSmoothedCVaR', 'mcSmoothedMAD', 'mcSmoothedConfidenceInterval', 'mcSmoothedPoints',
                'weightedConservative', 'weightedNeutral', 'weightedOptimistic', 'probExceedPertMeanBeta',
                'probExceedPertMeanMCUnsmoothed', 'probExceedPertMeanMCSmoothed', 'cdfPoints'
            ];
            responseData.results.forEach((result, i) => {
                requiredFields.forEach(field => {
                    if (!result[field] || result[field].value === undefined) {
                        Logger.log(`Warning: Missing or invalid field "${field}" in API response for task ${i + 1}`);
                    }
                });
            });
        }
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
            Logger.log('Warning: No data found in sheet: ' + sheet.getName());
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
            } else {
                Logger.log(`Warning: Invalid task at row ${index + 2}: task=${task}, optimistic=${optimistic}, mostLikely=${mostLikely}, pessimistic=${pessimistic}`);
            }
        });
        Logger.log('Fetched ' + tasks.length + ' valid tasks, defaultTaskIndex: ' + defaultTaskIndex);
        return { tasks, defaultTaskIndex };
    } catch (error) {
        Logger.log('Error in getAllTasks: ' + error.message + '\nStack: ' + error.stack);
        throw error;
    }
}




// Part 3: Plot Data Fetching and Web App Integration

/**
 * SECTION 5: PLOT DATA FETCHING
 * Fetches data for Plot.html visualizations.
 */

/**
 * Displays the Plot.html interface as a web URL for the add-on persona.
 */
function showPlot() {
    try {
        if (!DEPLOYMENT_ID || DEPLOYMENT_ID === 'UPDATE_WITH_NEW_DEPLOYMENT_ID') {
            throw new Error('Invalid DEPLOYMENT_ID. Please update with the correct deployment ID.');
        }
        const config = personas(null, 'showPlot');
        Logger.log('showPlot called with config: ' + JSON.stringify(config));
        if (!config.sheetId) {
            throw new Error('No active spreadsheet found. Please open a spreadsheet with task data.');
        }
        const sessionId = CONFIG.SESSION_ID_PREFIX + Utilities.getUuid();
        const plotUrl = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec?sheetId=${config.sheetId}&sessionId=${sessionId}`;
        Logger.log('Opening plot URL: ' + plotUrl);
        const ui = SpreadsheetApp.getUi();
        const response = ui.alert(
            'Open Dashboard',
            `The Interactive Probability Simulator dashboard will open in a new browser tab. URL: ${plotUrl}`,
            ui.ButtonSet.OK
        );
        const html = HtmlService.createHtmlOutput(
            `<script>window.open('${plotUrl}', '_blank'); window.close();</script>`
        ).setTitle('Redirecting to Dashboard');
        ui.showModalDialog(html, 'Redirecting to Dashboard');
    } catch (error) {
        Logger.log('Error in showPlot: ' + error.message + '\nStack: ' + error.stack);
        SpreadsheetApp.getUi().alert('Error', 'Failed to open dashboard: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
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
        const timestamp = new Date().toISOString().split('T')[0];
        const sliderKey = `${params.sliderValues.budgetFlexibility}_${params.sliderValues.scheduleFlexibility}_${params.sliderValues.scopeCertainty}_${params.sliderValues.qualityTolerance}`;
        const cacheKey = `cdf_${params.sheetId}_${params.task}_${timestamp}_${params.sessionId || 'nosession'}_${sliderKey}`;
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
            Logger.log('Error: doGet timed out during initial processing, elapsed: ' + (Date.now() - startTime) + 'ms');
            throw new Error('Operation timed out during initial processing');
        }
        if (config.sheetId) {
            Logger.log('Serving Plot.html with sheetId: ' + config.sheetId);
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
                Logger.log('Error: doGet timed out while rendering submit.html, elapsed: ' + (Date.now() - startTime) + 'ms');
                throw new Error('Operation timed out while rendering submit.html');
            }
            Logger.log('Rendering submit.html');
            return template.evaluate().setTitle(CONFIG.SUBMIT_PAGE_TITLE);
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
        if (tasks.length > CONFIG.MAX_TASKS) {
            Logger.log(`Error: Too many tasks provided: ${tasks.length}, max allowed: ${CONFIG.MAX_TASKS}`);
            throw new Error(`Too many tasks provided: ${tasks.length}, max allowed: ${CONFIG.MAX_TASKS}`);
        }
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
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '');
        const ss = SpreadsheetApp.create(`PERT Estimates ${timestamp}_${userEmail.split('@')[0]}_${sessionId}`);
        const scriptProperties = PropertiesService.getScriptProperties();
        scriptProperties.setProperty('createdBy', userEmail);
        scriptProperties.setProperty('sessionId', sessionId);
        const sheet = ss.getSheets()[0];
        sheet.setName(ESTIMATION_DATA_SHEET_NAME);
        const data = tasks.map(task => [
            task.taskName,
            task.bestCase,
            task.mostLikely,
            task.worstCase,
            task.selectedForPlot ? 'TRUE' : 'FALSE'
        ]);
        sheet.getRange(2, 1, data.length, 5).setValues(data);
        sheet.getRange(1, 1, 1, 5).setValues([['Task Name', 'Best Case', 'Most Likely', 'Worst Case', 'Selected for Plot']]).setFontWeight('bold');
        const config = {
            sheetId: ss.getId(),
            isWebAppContext: true,
            errorHandler: 'confirm',
            userEmail: userEmail,
            sessionId: sessionId
        };
        const result = addPertColumns(config);
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




