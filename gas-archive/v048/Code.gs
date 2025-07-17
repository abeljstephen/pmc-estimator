/**
 * SECTION 1: Configuration and Constants
 * Defines the global CONFIG object with UI labels, error messages, and settings, along with constants for sheet names, API URLs, and timeouts.
 */
const CONFIG = {
    PAGE_TITLE: 'Interactive Probability Simulator',
    SUBMIT_PAGE_TITLE: 'Submit Your Estimates',
    VERSION_TEXT: 'Version 1.0',
    MAX_TASKS: 100,
    SHOW_EXECUTING_USER: false,
    GOOGLE_CHARTS_URL: 'https://www.gstatic.com/charts/loader.js',
    MATHJAX_URL: 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js',
    GOOGLE_FONTS_URL: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;600&display=swap',
    LEARN_MORE_URL: 'https://example.com/learn-more',
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
    ERROR_NO_SHEET_ID: 'sheetId is not defined',
    ERROR_NO_SHEET_ID_MESSAGE: 'Error: Spreadsheet ID not provided. Please contact support.',
    ERROR_NO_TASKS_AVAILABLE: 'Error: No tasks available',
    ERROR_CONTACT_SUPPORT: 'Please contact support.',
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
    DEFAULT_ORIGINAL_PROBABILITY: 54.0,
    DEFAULT_ADJUSTED_PROBABILITY: 97.6,
    DEFAULT_VALUE_AT_CONFIDENCE: 2325.50,
    DEFAULT_ORIGINAL_VALUE_AT_CONFIDENCE: 2504.91,
    DEFAULT_OPTIMAL_PROBABILITY: 100.0,
    DEFAULT_VARIANCE_SCALE: 0.8,
    DEFAULT_ORIGINAL_MEAN: 2400.00,
    DEFAULT_ADJUSTED_MEAN: 2420.50,
    DEFAULT_VARIANCE: 32580.25
};

const ESTIMATION_DATA_SHEET_NAME = 'Estimation Data';
const ESTIMATE_CALCULATIONS_SHEET_NAME = 'Estimate Calculations';
const ADDON_CALCULATIONS_SHEET_NAME = 'Estimate Calculations Addon';
const DEFAULT_PROJECT_NAME = 'Untitled Project';
const DEFAULT_ROW_INDEX = 2;
const MIN_RANGE_MULTIPLIER = 0.1;
const DOGET_TIMEOUT_MS = 15000;
const SERVICE_ACCOUNT_KEY_NAME = 'SERVICE_ACCOUNT_KEY';
const API_URL = 'https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI';
const TOKEN_ENDPOINT_URL = 'https://oauth2.googleapis.com/token';
const API_TIMEOUT_MS = 30000;
const SESSION_ID_PREFIX = 'Session_';
const DEPLOYMENT_ID_PROPERTY = 'DEPLOYMENT_ID';

/**
 * SECTION 2: Deployment ID Management
 * Handles dynamic retrieval of the deployment ID for web app URLs, supporting development, web app, and add-on modes.
 */
function getDeploymentId() {
    const scriptProperties = PropertiesService.getScriptProperties();
    let deploymentId = scriptProperties.getProperty(DEPLOYMENT_ID_PROPERTY);
    
    if (!deploymentId) {
        try {
            const url = ScriptApp.getService().getUrl();
            Logger.log('Retrieved web app URL: ' + url);
            if (url.includes('/dev')) {
                Logger.log('Running in development mode (/dev URL). Deployment ID not available.');
                return null; // Return null in dev mode without error
            }
            const match = url.match(/\/s\/([^/]+)\/exec/);
            if (match && match[1]) {
                deploymentId = match[1];
                scriptProperties.setProperty(DEPLOYMENT_ID_PROPERTY, deploymentId);
                Logger.log('Stored deployment ID: ' + deploymentId);
            } else {
                Logger.log('Error: Could not parse deployment ID from URL: ' + url);
                return null; // Return null instead of throwing error
            }
        } catch (error) {
            Logger.log('Error retrieving deployment ID: ' + error.message);
            return null; // Return null instead of throwing error
        }
    }
    return deploymentId;
}



/**
 * SECTION 3: Context and Persona Configuration
 * Determines the execution context (dev, add-on, or web) and generates configuration for subsequent functions.
 */
function personas(e, context) {
    Logger.log('personas called with event: ' + JSON.stringify(e || 'null') + ', context: ' + context);
    const config = {
        mode: 'addon', // Default to add-on mode
        sheetId: null,
        sheetName: null,
        defaultTask: null,
        rowIndex: DEFAULT_ROW_INDEX,
        isWebAppContext: false,
        errorHandler: 'alert',
        userEmail: Session.getEffectiveUser().getEmail() || 'anonymous_' + new Date().getTime(),
        sessionId: SESSION_ID_PREFIX + Utilities.getUuid()
    };
    try {
        const serviceUrl = ScriptApp.getService().getUrl();
        const isDevMode = serviceUrl.includes('/dev');

        if (e && e.parameter && e.parameter.sheetId) {
            config.mode = 'web';
            config.isWebAppContext = true;
            config.errorHandler = 'confirm';
            config.sheetId = e.parameter.sheetId;
            config.sessionId = e.parameter.sessionId || config.sessionId;
            Logger.log('Web app mode - sheetId: ' + config.sheetId + ', sessionId: ' + config.sessionId);
            const ss = SpreadsheetApp.openById(config.sheetId);
            const scriptProperties = PropertiesService.getScriptProperties();
            const createdBy = scriptProperties.getProperty('createdBy');
            if (createdBy && createdBy !== config.userEmail) {
                Logger.log('Warning: Spreadsheet created by ' + createdBy + ', current user: ' + config.userEmail);
            }
            config.sheetName = ESTIMATION_DATA_SHEET_NAME;
        } else if (isDevMode || context === 'dev') {
            config.mode = 'dev';
            Logger.log('Development mode - running from Apps Script editor or dev URL');
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            if (!ss) {
                Logger.log('Error: No active spreadsheet found in dev mode');
                throw new Error('No active spreadsheet found. Please run the script from within a Google Sheet.');
            }
            config.sheetId = ss.getId();
            Logger.log('Spreadsheet ID: ' + config.sheetId);
            const activeSheet = SpreadsheetApp.getActiveSheet();
            if (!activeSheet) {
                Logger.log('Error: No active sheet found');
                throw new Error('No active sheet found. Please select a sheet with task data.');
            }
            config.sheetName = activeSheet.getName();
            Logger.log('Active Sheet: ' + config.sheetName);
        } else {
            config.mode = 'addon';
            Logger.log('Add-on mode - running from Google Sheets add-on');
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            if (!ss) {
                Logger.log('Error: No active spreadsheet found in add-on mode');
                throw new Error('No active spreadsheet found. Please run the script from within a Google Sheet.');
            }
            config.sheetId = ss.getId();
            Logger.log('Spreadsheet ID: ' + config.sheetId);
            const activeSheet = SpreadsheetApp.getActiveSheet();
            if (!activeSheet) {
                Logger.log('Error: No active sheet found');
                throw new Error('No active sheet found. Please select a sheet with task data.');
            }
            config.sheetName = activeSheet.getName();
            Logger.log('Active Sheet: ' + config.sheetName);
        }

        // Handle defaultTask for showPlot in all modes
        if (context === 'showPlot' || context === 'showPlotWeb' || context === 'dev') {
            const ss = SpreadsheetApp.openById(config.sheetId);
            let activeSheet = SpreadsheetApp.getActiveSheet();
            let activeRowIndex = DEFAULT_ROW_INDEX;
            let taskName = null;
            let bestCase, mostLikely, worstCase;

            // Check if the active sheet is "Estimation Data" or "Estimate Calculations"
            if (activeSheet && (activeSheet.getName() === ESTIMATION_DATA_SHEET_NAME || activeSheet.getName() === ESTIMATE_CALCULATIONS_SHEET_NAME)) {
                const activeRange = activeSheet.getActiveRange();
                activeRowIndex = activeRange ? activeRange.getRow() : DEFAULT_ROW_INDEX;
                if (activeRowIndex < DEFAULT_ROW_INDEX) activeRowIndex = DEFAULT_ROW_INDEX;
                const activeRowData = activeSheet.getRange(activeRowIndex, 1, 1, 4).getValues()[0];
                taskName = activeRowData[0]?.toString().trim();
                bestCase = parseFloat(activeRowData[1]);
                mostLikely = parseFloat(activeRowData[2]);
                worstCase = parseFloat(activeRowData[3]);
                if (taskName && Number.isFinite(bestCase) && Number.isFinite(mostLikely) && Number.isFinite(worstCase) &&
                    bestCase < mostLikely && mostLikely < worstCase) {
                    config.defaultTask = taskName;
                    config.rowIndex = activeRowIndex;
                    Logger.log(`Selected valid task from active row ${activeRowIndex}: ${taskName}`);
                }
            }

            // If no valid active row, default to first viable row in "Estimation Data"
            if (!config.defaultTask) {
                const estimationSheet = ss.getSheetByName(ESTIMATION_DATA_SHEET_NAME) || ss.getSheets()[0];
                const data = estimationSheet.getDataRange().getValues();
                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    taskName = row[0]?.toString().trim();
                    bestCase = parseFloat(row[1]);
                    mostLikely = parseFloat(row[2]);
                    worstCase = parseFloat(row[3]);
                    if (taskName && Number.isFinite(bestCase) && Number.isFinite(mostLikely) && Number.isFinite(worstCase) &&
                        bestCase < mostLikely && mostLikely < worstCase) {
                        config.defaultTask = taskName;
                        config.rowIndex = i + 1; // 1-based row index
                        Logger.log(`Defaulted to first viable task at row ${i + 1}: ${taskName}`);
                        break;
                    }
                }
                if (!config.defaultTask) {
                    Logger.log('Warning: No viable tasks found in Estimation Data sheet');
                    config.defaultTask = null;
                    config.rowIndex = DEFAULT_ROW_INDEX;
                }
            }
            config.sheetName = ESTIMATION_DATA_SHEET_NAME; // Ensure Plot.html uses Estimation Data
        }
        Logger.log('Config returned: ' + JSON.stringify(config));
        return config;
    } catch (error) {
        Logger.log('Error in personas: ' + error.message + '\nStack: ' + error.stack);
        throw new Error('Failed to initialize configuration: ' + error.message);
    }
}


 // SECTION 4: Menu Setup
 // Creates the custom menu in Google Sheets for add-on functionality and validates sheet columns.
 
function onOpen(e) {
    try {
        const ui = SpreadsheetApp.getUi();
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const activeSheet = SpreadsheetApp.getActiveSheet();
        const hasRequiredColumns = activeSheet && checkSheetColumns(activeSheet);
        const menu = ui.createAddonMenu();
        if (hasRequiredColumns) {
            menu.addItem('PERT', 'addPertColumnsWrapper')
                .addItem('PLOT', 'showPlotWrapper'); // Use showPlotWrapper
        } else {
            menu.addItem('PERT', 'showNoSheetError')
                .addItem('PLOT', 'showNoSheetError');
        }
        menu.addToUi();
        Logger.log('onOpen completed: Menu created with ' + (hasRequiredColumns ? 'PERT and PLOT options' : 'error options'));
    } catch (error) {
        Logger.log('Error in onOpen: ' + error.message + '\nStack: ' + error.stack);
    }
}

function checkSheetColumns(sheet) {
    try {
        const columnHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim().toLowerCase());
        Logger.log(`checkSheetColumns: Sheet "${sheet.getName()}" headers: ${JSON.stringify(columnHeaders)}`);
        const requiredColumns = ['name', 'best case', 'best_case', 'most likely', 'most_likely', 'worst case', 'worst_case'];
        const foundColumns = requiredColumns.filter(col => columnHeaders.includes(col));
        const missingColumns = requiredColumns.filter(col => !columnHeaders.includes(col));
        const hasRequiredColumns = columnHeaders.includes('name') &&
                                  (columnHeaders.includes('best case') || columnHeaders.includes('best_case')) &&
                                  (columnHeaders.includes('most likely') || columnHeaders.includes('most_likely')) &&
                                  (columnHeaders.includes('worst case') || columnHeaders.includes('worst_case'));
        Logger.log(`checkSheetColumns: Found columns: ${JSON.stringify(foundColumns)}, Missing columns: ${JSON.stringify(missingColumns)}, Has required columns: ${hasRequiredColumns}`);
        if (!hasRequiredColumns) {
            Logger.log(`Error: Missing required columns. Expected: ${JSON.stringify(requiredColumns)}, Found: ${JSON.stringify(columnHeaders)}`);
        }
        return hasRequiredColumns;
    } catch (error) {
        Logger.log('Error in checkSheetColumns: ' + error.message + '\nStack: ' + error.stack);
        return false;
    }
}

function showNoSheetError() {
    try {
        SpreadsheetApp.getUi().alert('Error', `The active sheet must have columns: Name, Best Case (or best_case), Most Likely (or most_likely), Worst Case (or worst_case). Please ensure these columns exist with valid data.`, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (error) {
        Logger.log('Error in showNoSheetError: ' + error.message);
    }
}

/**
 * SECTION 5: PERT Calculations
 * Handles PERT calculations and sheet updates for the Add-on and Web Personas.
 */
function addPertColumnsWrapper() {
    Logger.log('addPertColumnsWrapper called');
    try {
        const config = personas(null, 'addPertColumnsWrapper');
        if (!config) {
            Logger.log('Error: personas returned null or undefined config');
            SpreadsheetApp.getUi().alert('Error', 'Failed to initialize configuration. Please ensure you are running the script from a Google Sheet with valid data.', SpreadsheetApp.getUi().ButtonSet.OK);
            return;
        }
        Logger.log('addPertColumnsWrapper config: ' + JSON.stringify(config));
        if (!config.sheetId) {
            Logger.log('Error: No active spreadsheet found in addPertColumnsWrapper');
            SpreadsheetApp.getUi().alert('Error', 'No active spreadsheet found. Please open a spreadsheet with task data.', SpreadsheetApp.getUi().ButtonSet.OK);
            return;
        }
        const result = addPertColumns(config);
        if (result.status === 'error') {
            Logger.log('addPertColumnsWrapper errors: ' + result.errors.join('; '));
            SpreadsheetApp.getUi().alert('Errors in Processing', result.message + '\nCheck the "Error Log" sheet for details.', SpreadsheetApp.getUi().ButtonSet.OK);
        } else {
            Logger.log('addPertColumnsWrapper completed successfully');
            SpreadsheetApp.getUi().alert('Success', 'PERT calculations completed successfully.', SpreadsheetApp.getUi().ButtonSet.OK);
        }
    } catch (error) {
        Logger.log('Error in addPertColumnsWrapper: ' + error.message + '\nStack: ' + error.stack);
        SpreadsheetApp.getUi().alert('Error', 'Failed to process PERT calculations: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
}

function addPertColumns(config) {
    Logger.log('addPertColumns called with config: ' + JSON.stringify(config || 'undefined'));
    if (typeof config === 'undefined') {
        Logger.log('Error: addPertColumns called directly without config. Please use the "PERT" menu item in the Google Sheet.');
        throw new Error('addPertColumns must be called via the "PERT" menu item. Please run the script from a Google Sheet with valid data.');
    }
    const errors = [];
    let output = { status: 'success', errors: [], message: '' };
    let errorRows = [];
    let ss; // Declare ss at function scope
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
        ss = SpreadsheetApp.openById(config.sheetId);
        const sheet = ss.getSheetByName(config.sheetName) || SpreadsheetApp.getActiveSheet();
        if (!sheet) {
            errors.push(`Sheet "${config.sheetName}" not found`);
            Logger.log(`Error: Sheet "${config.sheetName}" not found`);
            output.status = 'error';
            output.errors = errors;
            output.message = `Failed to process: Sheet "${config.sheetName}" not found`;
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        if (!checkSheetColumns(sheet)) {
            errors.push('Sheet must have columns: Name, Best Case (or best_case), Most Likely (or most_likely), Worst Case (or worst_case)');
            Logger.log('Error: Sheet missing required columns');
            output.status = 'error';
            output.errors = errors;
            output.message = 'Failed to process: Sheet must have columns Name, Best Case (or best_case), Most Likely (or most_likely), Worst Case (or worst_case)';
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        const data = sheet.getDataRange().getValues();
        Logger.log(`Sheet data (first two rows): ${JSON.stringify(data.slice(0, 2))}`); // Log first two rows for debugging
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
        const columnHeaders = data[0].map(h => h.toString().trim().toLowerCase());
        Logger.log(`addPertColumns: Column headers: ${JSON.stringify(columnHeaders)}`);
        const nameCol = columnHeaders.indexOf('name');
        const bestCaseCol = columnHeaders.indexOf('best case') !== -1 ? columnHeaders.indexOf('best case') : columnHeaders.indexOf('best_case');
        const mostLikelyCol = columnHeaders.indexOf('most likely') !== -1 ? columnHeaders.indexOf('most likely') : columnHeaders.indexOf('most_likely');
        const worstCaseCol = columnHeaders.indexOf('worst case') !== -1 ? columnHeaders.indexOf('worst case') : columnHeaders.indexOf('worst_case');
        const selectedCol = columnHeaders.indexOf('selected for plot') !== -1 ? columnHeaders.indexOf('selected for plot') : -1;
        if (nameCol === -1 || bestCaseCol === -1 || mostLikelyCol === -1 || worstCaseCol === -1) {
            errors.push(`Required columns missing: Name, Best Case (or best_case), Most Likely (or most_likely), Worst Case (or worst_case). Found: ${JSON.stringify(columnHeaders)}`);
            Logger.log('Error: Required columns missing');
            output.status = 'error';
            output.errors = errors;
            output.message = `Failed to process: Required columns missing: Name, Best Case (or best_case), Most Likely (or most_likely), Worst Case (or worst_case). Found: ${JSON.stringify(columnHeaders)}`;
            if (config.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
                SpreadsheetApp.getUi().alert('Error', output.message, SpreadsheetApp.getUi().ButtonSet.OK);
            }
            return output;
        }
        const tasks = [];
        let selectedForPlotCount = 0;
        let selectedTaskIndex = -1;
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const name = row[nameCol]?.toString().trim();
            const bestCase = parseFloat(row[bestCaseCol]);
            const mostLikely = parseFloat(row[mostLikelyCol]);
            const worstCase = parseFloat(row[worstCaseCol]);
            const selectedForPlot = selectedCol !== -1 ? (row[selectedCol] === true || row[selectedCol] === 'TRUE') : false;
            if (!name && (!Number.isFinite(bestCase) || !Number.isFinite(mostLikely) || !Number.isFinite(worstCase))) {
                Logger.log(`Skipping empty row ${i + 1}`);
                continue;
            }
            if (!Number.isFinite(bestCase) || !Number.isFinite(mostLikely) || !Number.isFinite(worstCase)) {
                errors.push(`Invalid numeric inputs at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                Logger.log(`Error: Invalid numeric inputs at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([i + 1, `Invalid numeric inputs: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                continue;
            }
            if (bestCase >= mostLikely || mostLikely >= worstCase) {
                errors.push(`Invalid estimate order at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                Logger.log(`Error: Invalid estimate order at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([i + 1, `Invalid estimate order: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                continue;
            }
            if (bestCase === mostLikely || mostLikely === worstCase) {
                errors.push(`Estimates too close at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                Logger.log(`Error: Estimates too close at row ${i + 1}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([i + 1, `Estimates too close: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                continue;
            }
            const range = worstCase - bestCase;
            const minRange = mostLikely * MIN_RANGE_MULTIPLIER;
            if (range < minRange) {
                errors.push(`Estimate range too small at row ${i + 1}: range=${range}, minRange=${minRange}`);
                Logger.log(`Error: Estimate range too small at row ${i + 1}: range=${range}, minRange=${minRange}`);
                errorRows.push([i + 1, `Estimate range too small: range=${range}, minRange=${minRange}`]);
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
            if (selectedForPlot) {
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
        // Validate API response fields, use placeholders for missing fields
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
                    Logger.log(`Warning: Missing or invalid field "${field}" in API response for task ${i + 1}`);
                    result[field] = { value: 'N/A' }; // Assign placeholder for missing fields
                }
            });
        });
        Logger.log('API results received: ' + JSON.stringify(apiResponse.results));
        // Delete existing "Estimate Calculations" and "Error Log" sheets to overwrite
        let calcSheet = ss.getSheets().find(s => s.getName().toLowerCase() === ESTIMATE_CALCULATIONS_SHEET_NAME.toLowerCase());
        if (calcSheet) {
            ss.deleteSheet(calcSheet);
            Logger.log('Deleted existing "Estimate Calculations" sheet');
        }
        calcSheet = ss.insertSheet(ESTIMATE_CALCULATIONS_SHEET_NAME);
        Logger.log('Created new "Estimate Calculations" sheet');
        
        let errorSheet = ss.getSheets().find(s => s.getName().toLowerCase() === 'Error Log'.toLowerCase());
        if (errorSheet) {
            ss.deleteSheet(errorSheet);
            Logger.log('Deleted existing "Error Log" sheet');
        }
        errorSheet = ss.insertSheet('Error Log');
        errorSheet.getRange(1, 1, 1, 2).setValues([['Row', 'Error Message']]).setFontWeight('bold');
        Logger.log('Created new "Error Log" sheet');
        
        const calcHeaders = [
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
        calcSheet.getRange(1, 1, 1, calcHeaders.length).setValues([calcHeaders]).setFontWeight('bold');
        calcSheet.getRange(2, 1, 1, calcHeaders.length).setValues([headerDescriptions]);
        const dataRows = [];
        for (let i = 1; i < data.length; i++) {
            const originalRowIndex = i + 1;
            const row = data[i];
            const name = row[nameCol]?.toString().trim();
            const bestCase = parseFloat(row[bestCaseCol]);
            const mostLikely = parseFloat(row[mostLikelyCol]);
            const worstCase = parseFloat(row[worstCaseCol]);
            const selectedForPlot = selectedCol !== -1 ? (row[selectedCol] === true || row[selectedCol] === 'TRUE') : false;
            if (!name && (!Number.isFinite(bestCase) || !Number.isFinite(mostLikely) || !Number.isFinite(worstCase))) {
                dataRows.push(new Array(calcHeaders.length).fill('N/A'));
                Logger.log(`Row ${originalRowIndex} is empty, filling with N/A`);
                continue;
            }
            if (!Number.isFinite(bestCase) || !Number.isFinite(mostLikely) || !Number.isFinite(worstCase)) {
                errors.push(`Invalid numeric inputs at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([originalRowIndex, `Invalid numeric inputs: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                Logger.log(`Error: Invalid numeric inputs at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                continue;
            }
            if (bestCase >= mostLikely || mostLikely >= worstCase) {
                dataRows.push(new Array(calcHeaders.length).fill('N/A'));
                errors.push(`Invalid estimate order at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([originalRowIndex, `Invalid estimate order: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                Logger.log(`Error: Invalid estimate order at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                continue;
            }
            if (bestCase === mostLikely || mostLikely === worstCase) {
                dataRows.push(new Array(calcHeaders.length).fill('N/A'));
                errors.push(`Estimates too close at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                errorRows.push([originalRowIndex, `Estimates too close: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`]);
                Logger.log(`Error: Estimates too close at row ${originalRowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
                continue;
            }
            const range = worstCase - bestCase;
            const minRange = mostLikely * MIN_RANGE_MULTIPLIER;
            if (range < minRange) {
                dataRows.push(new Array(calcHeaders.length).fill('N/A'));
                errors.push(`Estimate range too small at row ${originalRowIndex}: range=${range}, minRange=${minRange}`);
                errorRows.push([originalRowIndex, `Estimate range too small: range=${range}, minRange=${minRange}`]);
                Logger.log(`Error: Estimate range too small at row ${originalRowIndex}: range=${range}, minRange=${minRange}`);
                continue;
            }
            const resultIndex = tasks.findIndex(task => task.task === (name || `Task_${i}`));
            if (resultIndex === -1 || !apiResponse.results[resultIndex]) {
                dataRows.push(new Array(calcHeaders.length).fill('N/A'));
                errors.push(`No API results for task at row ${originalRowIndex}: ${name || `Task_${i}`}`);
                errorRows.push([originalRowIndex, `No API results for task: ${name || `Task_${i}`}`]);
                Logger.log(`Error: No API results for task at row ${originalRowIndex}`);
                continue;
            }
            const result = apiResponse.results[resultIndex];
            const rowData = [
                result.task?.value || name || `Task_${i}`,
                bestCase,
                mostLikely,
                worstCase,
                result.triangleMean?.value || 'N/A',
                result.triangleVariance?.value || 'N/A',
                result.triangleStdDev?.value || 'N/A',
                result.triangleSkewness?.value || 'N/A',
                result.triangleKurtosis?.value || 'N/A',
                // JSON.stringify(result.trianglePoints?.value || []), // Commented out per user request
                'N/A', // Placeholder for TRIANGLE_POINTS
                result.pertMean?.value || 'N/A',
                result.pertStdDev?.value || 'N/A',
                result.pertVariance?.value || 'N/A',
                result.pertSkewness?.value || 'N/A',
                result.pertKurtosis?.value || 'N/A',
                // JSON.stringify(result.pertPoints?.value || []), // Commented out per user request
                'N/A', // Placeholder for PERT_POINTS
                result.betaMean?.value || 'N/A',
                result.betaVariance?.value || 'N/A',
                result.betaSkewness?.value || 'N/A',
                result.betaKurtosis?.value || 'N/A',
                result.alpha?.value || 'N/A',
                result.beta?.value || 'N/A',
                result.betaMode?.value || 'N/A',
                // JSON.stringify(result.betaPoints?.value || []), // Commented out per user request
                'N/A', // Placeholder for BETA_POINTS
                result.mcMean?.value || 'N/A',
                result.mcVariance?.value || 'N/A',
                result.mcSkewness?.value || 'N/A',
                result.mcKurtosis?.value || 'N/A',
                result.mcVaR?.value || 'N/A',
                result.mcCVaR?.value || 'N/A',
                result.mcMAD?.value || 'N/A',
                // JSON.stringify(result.mcPoints?.value || []), // Commented out per user request
                'N/A', // Placeholder for MC_UNSMOOTHED_POINTS
                result.mcSmoothedMean?.value || 'N/A',
                result.mcSmoothedVariance?.value || 'N/A',
                result.mcSmoothedSkewness?.value || 'N/A',
                result.mcSmoothedKurtosis?.value || 'N/A',
                result.mcSmoothedVaR?.value || 'N/A',
                result.mcSmoothedCVaR?.value || 'N/A',
                result.mcSmoothedMAD?.value || 'N/A',
                result.mcSmoothedConfidenceInterval?.value ? `[${result.mcSmoothedConfidenceInterval.value.lower.toFixed(2)}, ${result.mcSmoothedConfidenceInterval.value.upper.toFixed(2)}]` : 'N/A',
                // JSON.stringify(result.mcSmoothedPoints?.value || []), // Commented out per user request
                'N/A', // Placeholder for MC_SMOOTHED_POINTS
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
            calcSheet.getRange(3, 1, dataRows.length, calcHeaders.length).setValues(dataRows);
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
        errorRows = errorRows || [];
        errorRows.push([0, `General error: ${error.message}`]);
        if (ss) { // Check if ss is defined
            let errorSheet = ss.getSheets().find(s => s.getName().toLowerCase() === 'Error Log'.toLowerCase());
            if (errorSheet) {
                ss.deleteSheet(errorSheet);
                Logger.log('Deleted existing "Error Log" sheet due to error');
            }
            errorSheet = ss.insertSheet('Error Log');
            errorSheet.getRange(1, 1, 1, 2).setValues([['Row', 'Error Message']]).setFontWeight('bold');
            if (errorRows.length > 0) {
                errorSheet.getRange(2, 1, errorRows.length, 2).setValues(errorRows);
            }
        } else {
            Logger.log('Error: Spreadsheet object (ss) not defined, cannot create Error Log sheet');
        }
        if (config?.errorHandler === 'confirm' && SpreadsheetApp.getUi()) {
            SpreadsheetApp.getUi().alert('Error', output.message + '\nCheck the "Error Log" sheet for details if available.', SpreadsheetApp.getUi().ButtonSet.OK);
        }
        return output;
    }
}

/**
 * SECTION 6: API Interaction
 * Handles secure API calls to pmcEstimatorAPI with JWT authentication.
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
 * SECTION 7: Task Retrieval
 * Retrieves valid tasks from a specified sheet for processing or plotting.
 */
function getAllTasks(sheetId, sheetName) {
    Logger.log('getAllTasks called with sheetId: ' + sheetId + ', sheetName: ' + sheetName);
    try {
        const ss = SpreadsheetApp.openById(sheetId);
        const sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
        if (!sheet) {
            Logger.log('Error: No sheets found in spreadsheet: ' + sheetId);
            throw new Error('No sheets found in spreadsheet');
        }
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) {
            Logger.log('Warning: No data found in sheet: ' + sheet.getName());
            return { tasks: [], defaultTaskIndex: 0 };
        }
        const columnHeaders = data[0].map(h => h.toString().trim().toLowerCase());
        Logger.log(`getAllTasks: Sheet "${sheet.getName()}" headers: ${JSON.stringify(columnHeaders)}`);
        const nameCol = columnHeaders.indexOf('name');
        const bestCaseCol = columnHeaders.indexOf('best case') !== -1 ? columnHeaders.indexOf('best case') : columnHeaders.indexOf('best_case');
        const mostLikelyCol = columnHeaders.indexOf('most likely') !== -1 ? columnHeaders.indexOf('most likely') : columnHeaders.indexOf('most_likely');
        const worstCaseCol = columnHeaders.indexOf('worst case') !== -1 ? columnHeaders.indexOf('worst case') : columnHeaders.indexOf('worst_case');
        const selectedCol = columnHeaders.indexOf('selected for plot') !== -1 ? columnHeaders.indexOf('selected for plot') : -1;
        if (nameCol === -1 || bestCaseCol === -1 || mostLikelyCol === -1 || worstCaseCol === -1) {
            Logger.log('Error: Required columns missing in sheet: ' + sheet.getName());
            throw new Error('Required columns missing: Name, Best Case (or best_case), Most Likely (or most_likely), Worst Case (or worst_case)');
        }
        const tasks = [];
        let defaultTaskIndex = 0;
        data.slice(1).forEach((row, index) => {
            const task = row[nameCol]?.toString().trim();
            const optimistic = parseFloat(row[bestCaseCol]);
            const mostLikely = parseFloat(row[mostLikelyCol]);
            const pessimistic = parseFloat(row[worstCaseCol]);
            const selectedForPlot = selectedCol !== -1 ? (row[selectedCol] === true || row[selectedCol] === 'TRUE') : false;
            if (task && Number.isFinite(optimistic) && Number.isFinite(mostLikely) && Number.isFinite(pessimistic) &&
                optimistic < mostLikely && mostLikely < pessimistic) {
                tasks.push({
                    task: task,
                    optimistic: optimistic,
                    mostLikely: mostLikely,
                    pessimistic: pessimistic,
                    selectedForPlot: selectedForPlot
                });
                if (selectedForPlot) {
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

/**
 * SECTION 8: Plot Data Fetching
 * Retrieves data for the Plot.html dashboard and opens the dashboard.
 */
function getProperties(sheetId, sheetName, rowIndex) {
    try {
        Logger.log(`getProperties called with sheetId: ${sheetId}, sheetName: ${sheetName}, rowIndex: ${rowIndex}`);
        if (typeof sheetId !== 'string' || !sheetId) {
            throw new Error('sheetId must be a non-empty string');
        }
        if (typeof sheetName !== 'string' || !sheetName) {
            throw new Error('sheetName must be a non-empty string');
        }
        if (typeof rowIndex !== 'number' || rowIndex < DEFAULT_ROW_INDEX || !Number.isInteger(rowIndex)) {
            throw new Error('rowIndex must be an integer >= ' + DEFAULT_ROW_INDEX);
        }
        const spreadsheet = SpreadsheetApp.openById(sheetId);
        const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.getSheets()[0];
        if (!sheet) {
            throw new Error(`Sheet "${sheetName}" not found`);
        }
        const lastRow = sheet.getLastRow();
        if (rowIndex > lastRow) {
            throw new Error(`rowIndex ${rowIndex} exceeds sheet's last row: ${lastRow}`);
        }
        const columnHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim().toLowerCase());
        Logger.log(`getProperties: Sheet "${sheet.getName()}" headers: ${JSON.stringify(columnHeaders)}`);
        const nameCol = columnHeaders.indexOf('name');
        const bestCaseCol = columnHeaders.indexOf('best case') !== -1 ? columnHeaders.indexOf('best case') : columnHeaders.indexOf('best_case');
        const mostLikelyCol = columnHeaders.indexOf('most likely') !== -1 ? columnHeaders.indexOf('most likely') : columnHeaders.indexOf('most_likely');
        const worstCaseCol = columnHeaders.indexOf('worst case') !== -1 ? columnHeaders.indexOf('worst case') : columnHeaders.indexOf('worst_case');
        if (nameCol === -1 || bestCaseCol === -1 || mostLikelyCol === -1 || worstCaseCol === -1) {
            throw new Error('Sheet must have columns: Name, Best Case (or best_case), Most Likely (or most_likely), Worst Case (or worst_case)');
        }
        const data = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
        const name = data[nameCol]?.toString().trim();
        const bestCase = parseFloat(data[bestCaseCol]);
        const mostLikely = parseFloat(data[mostLikelyCol]);
        const worstCase = parseFloat(data[worstCaseCol]);
        if (!Number.isFinite(bestCase) || !Number.isFinite(mostLikely) || !Number.isFinite(worstCase)) {
            throw new Error(`Invalid numeric inputs at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
        }
        if (bestCase >= mostLikely || mostLikely >= worstCase) {
            throw new Error(`Invalid estimate order at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
        }
        if (bestCase === mostLikely || mostLikely === worstCase) {
            throw new Error(`Estimates too close at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
        }
        const range = worstCase - bestCase;
        const minRange = mostLikely * MIN_RANGE_MULTIPLIER;
        if (range < minRange) {
            throw new Error(`Estimate range too small at row ${rowIndex}: range=${range}, minRange=${minRange}`);
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
 * SECTION 8.1: Plot Wrapper
 * Wrapper for showPlot to handle persona-specific logic and UI interactions.
 */
function showPlotWrapper() {
    Logger.log('showPlotWrapper called');
    let plotUrl = '';
    try {
        const config = personas(null, 'dev'); // Default to dev mode for editor runs
        Logger.log('showPlotWrapper config: ' + JSON.stringify(config));
        if (!config.sheetId) {
            Logger.log('Error: No active spreadsheet found in showPlotWrapper');
            SpreadsheetApp.getUi().alert('Error', 'No active spreadsheet found. Please open a spreadsheet with task data.', SpreadsheetApp.getUi().ButtonSet.OK);
            return;
        }
        plotUrl = showPlot(config);
        Logger.log('showPlotWrapper received plotUrl: ' + plotUrl);

        if (config.mode === 'dev' || config.mode === 'addon') {
            // Attempt to open the dashboard in a new tab using a temporary HTML dialog
            try {
                const html = HtmlService.createHtmlOutput(
                    `<p>Opening dashboard...</p>
                     <p>If the dashboard does not open, <a href="${plotUrl}" target="_blank">click here</a>.</p>
                     <script>
                         function openDashboard() {
                             try {
                                 window.open('${plotUrl}', '_blank');
                                 google.script.host.close();
                             } catch (e) {
                                 console.error('Failed to open URL: ' + e.message);
                                 google.script.run.logClientError('Failed to open plotUrl in dialog: ' + e.message);
                                 alert('Failed to open dashboard automatically. Please click the link above or copy this URL: ${plotUrl}');
                             }
                         }
                         setTimeout(openDashboard, 1000); // Increased delay to 1s
                     </script>`
                ).setTitle('Opening Dashboard').setWidth(400).setHeight(150);
                SpreadsheetApp.getUi().showModalDialog(html, 'Opening Dashboard');
                Logger.log(`${config.mode} mode: Attempted to open dashboard via HTML dialog: ${plotUrl}`);
            } catch (dialogError) {
                Logger.log('Error opening HTML dialog: ' + dialogError.message);
                SpreadsheetApp.getUi().alert(
                    'Error',
                    'Failed to open dashboard automatically. Please open this URL manually: ' + plotUrl,
                    SpreadsheetApp.getUi().ButtonSet.OK
                );
            }
        } else if (config.mode === 'web') {
            Logger.log('Web mode: Plot URL generated but not opened directly: ' + plotUrl);
            // Web mode relies on doGet to serve Plot.html
        }
        return plotUrl;
    } catch (error) {
        Logger.log('Error in showPlotWrapper: ' + error.message + '\nStack: ' + error.stack);
        SpreadsheetApp.getUi().alert('Error', 'Failed to open dashboard: ' + error.message + '\nPlease try opening this URL manually: ' + (plotUrl || 'No URL generated'), SpreadsheetApp.getUi().ButtonSet.OK);
        throw error;
    }
}

/**
 * Utility function to log client-side errors from HTML dialogs
 */
function logClientError(errorMessage) {
    Logger.log('Client-side error: ' + errorMessage);
}


/**
 * SECTION 8: Plot Data Fetching
 * Retrieves data for the Plot.html dashboard and returns the URL or renders it based on mode.
 */
function showPlot(config) {
    try {
        Logger.log('showPlot called with config: ' + JSON.stringify(config));
        if (!config || !config.sheetId) {
            throw new Error('No active spreadsheet found. Please open a spreadsheet with task data.');
        }
        const deploymentId = getDeploymentId();
        const sessionId = SESSION_ID_PREFIX + Utilities.getUuid();
        const plotUrl = deploymentId 
            ? `https://script.google.com/macros/s/${deploymentId}/exec?sheetId=${config.sheetId}&sessionId=${sessionId}`
            : null;
        Logger.log('Generated plot URL: ' + (plotUrl || 'Not available in dev mode'));
        
        if (!plotUrl) {
            throw new Error('No deployment ID available. Please deploy the script as a web app to use the dashboard.');
        }
        
        if (config.mode === 'web') {
            Logger.log('Web mode: Dashboard URL: ' + plotUrl);
            // doGet handles rendering Plot.html
        }
        return plotUrl; // Return URL for wrapper to handle
    } catch (error) {
        Logger.log('Error in showPlot: ' + error.message + '\nStack: ' + error.stack);
        throw error;
    }
}



function getTargetProbabilityData(params) {
    Logger.log('getTargetProbabilityData called with params: ' + JSON.stringify(params));
    try {
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid or missing parameters');
        }
        if (!params.task || typeof params.task !== 'string') {
            throw new Error('Task must be a non-empty string');
        }
        if (!Number.isFinite(params.optimistic) || !Number.isFinite(params.mostLikely) || !Number.isFinite(params.pessimistic)) {
            throw new Error('Optimistic, mostLikely, and pessimistic must be finite numbers');
        }
        if (params.optimistic >= params.mostLikely || params.mostLikely >= params.pessimistic) {
            throw new Error('Invalid estimate order: optimistic < mostLikely < pessimistic required');
        }
        if (params.optimistic === params.mostLikely || params.mostLikely === params.pessimistic) {
            throw new Error('Estimates must be distinct');
        }
        const range = params.pessimistic - params.optimistic;
        const minRange = params.mostLikely * MIN_RANGE_MULTIPLIER;
        if (range < minRange) {
            throw new Error(`Estimate range too small: range=${range}, minRange=${minRange}`);
        }
        if (!params.sliderValues || typeof params.sliderValues !== 'object') {
            throw new Error('sliderValues must be an object');
        }
        const { budgetFlexibility, scheduleFlexibility, scopeCertainty, qualityTolerance } = params.sliderValues;
        if (!Number.isFinite(budgetFlexibility) || budgetFlexibility < 0 || budgetFlexibility > 100 ||
            !Number.isFinite(scheduleFlexibility) || scheduleFlexibility < 0 || scheduleFlexibility > 100 ||
            !Number.isFinite(scopeCertainty) || scopeCertainty < 0 || scopeCertainty > 100 ||
            !Number.isFinite(qualityTolerance) || qualityTolerance < 0 || qualityTolerance > 100) {
            throw new Error('Slider values must be numbers between 0 and 100');
        }
        if (params.mode === 'target' && (!Number.isFinite(params.targetValue) || params.targetValue < params.optimistic || params.targetValue > params.pessimistic)) {
            throw new Error(`Target value must be a number between ${params.optimistic} and ${params.pessimistic}`);
        }
        if (params.mode === 'confidence' && (!Number.isFinite(params.confidenceLevel) || params.confidenceLevel <= 0 || params.confidenceLevel >= 1)) {
            throw new Error('Confidence level must be a number between 0 and 1');
        }
        if (params.isOptimizeMode && (!params.previousOptimalSliderSettings || typeof params.previousOptimalSliderSettings !== 'object')) {
            Logger.log('Warning: previousOptimalSliderSettings missing or invalid in optimize mode; proceeding without previous settings');
        }
        const tasks = [{
            task: params.task,
            optimistic: params.optimistic,
            mostLikely: params.mostLikely,
            pessimistic: params.pessimistic,
            budgetFlexibility: budgetFlexibility / 100, // Normalize to 0-1
            scheduleFlexibility: scheduleFlexibility / 100,
            scopeCertainty: scopeCertainty / 100,
            qualityTolerance: qualityTolerance / 100,
            targetValue: params.mode === 'target' ? params.targetValue : params.mostLikely,
            confidenceLevel: params.mode === 'confidence' ? params.confidenceLevel : 0.9,
            targetProbabilityOnly: true, // Focus on target probability for dashboard
            optimizeFor: params.isOptimizeMode ? params.mode : 'none'
        }];
        Logger.log('Calling API with task: ' + JSON.stringify(tasks[0]));
        const apiResponse = callEstimatorAPI(tasks);
        if (!apiResponse || !apiResponse.results || !Array.isArray(apiResponse.results) || apiResponse.results.length === 0) {
            throw new Error('API response missing or invalid "results" array');
        }
        const result = apiResponse.results[0];
        Logger.log('API result for task: ' + result.task?.value);

        // Helper functions to safely extract values
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

        // Format response similar to getProperties()
        const properties = {
            TASK_NAME: result.task?.value || params.task,
            MIN: params.optimistic,
            MOST_LIKELY: params.mostLikely,
            MAX: params.pessimistic,
            BUDGET_FLEXIBILITY: budgetFlexibility,
            SCHEDULE_FLEXIBILITY: scheduleFlexibility,
            SCOPE_CERTAINTY: scopeCertainty,
            QUALITY_TOLERANCE: qualityTolerance,
            MODE: params.mode,
            TARGET_VALUE: params.mode === 'target' ? params.targetValue : null,
            CONFIDENCE_LEVEL: params.mode === 'confidence' ? params.confidenceLevel : null,
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

        // Handle optimization mode
        if (params.isOptimizeMode && params.previousOptimalSliderSettings) {
            properties.PREVIOUS_OPTIMAL_SLIDER_SETTINGS = params.previousOptimalSliderSettings;
        }

        // Validate critical fields for dashboard rendering
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

        Logger.log('Returning target probability data for task: ' + properties.TASK_NAME);
        return properties;
    } catch (error) {
        Logger.log('Error in getTargetProbabilityData: ' + error.message + '\nStack: ' + error.stack);
        throw new Error('Failed to fetch target probability data: ' + error.message);
    }
}

/**
 * SECTION 9: Web App Integration
 * Serves Plot.html or submit.html based on URL parameters and handles task submission for the Web Persona.
 */
function doGet(e) {
    Logger.log('doGet called with parameters: ' + JSON.stringify(e?.parameter || {}));
    const startTime = Date.now();
    try {
        const config = personas(e, 'doGet');
        Logger.log('Config: ' + JSON.stringify(config));
        if (!config.sheetId) {
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
        Logger.log('Serving Plot.html with sheetId: ' + config.sheetId);
        try {
            const ss = SpreadsheetApp.openById(config.sheetId);
            Logger.log('Successfully accessed spreadsheet: ' + config.sheetId);
            const sheet = ss.getSheetByName(config.sheetName) || ss.getSheets()[0];
            Logger.log('Accessed sheet: ' + sheet.getName());
        } catch (sheetError) {
            Logger.log('Error accessing spreadsheet: ' + sheetError.message);
            throw new Error('Failed to access spreadsheet: ' + sheetError.message);
        }
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
    } catch (error) {
        Logger.log('Error in doGet: ' + error.message + '\nStack: ' + error.stack);
        return ContentService.createTextOutput(
            JSON.stringify({ error: 'Server error: ' + error.message })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}

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
        Logger.log('Error in doPost: ' + error.message + '\nStack: ' + error.stack);
        return ContentService.createTextOutput(
            JSON.stringify({ error: error.message })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}

function createEstimateSheet(tasks) {
    Logger.log('createEstimateSheet called with tasks: ' + JSON.stringify(tasks));
    try {
        if (!Array.isArray(tasks) || tasks.length === 0) {
            throw new Error('Invalid or empty tasks array');
        }
        if (tasks.length > CONFIG.MAX_TASKS) {
            throw new Error(`Too many tasks provided: ${tasks.length}, max allowed: ${CONFIG.MAX_TASKS}`);
        }
        let selectedTask = null;
        const userEmail = Session.getEffectiveUser().getEmail() || 'anonymous_' + new Date().getTime();
        const sessionId = SESSION_ID_PREFIX + Utilities.getUuid();
        tasks.forEach((task, i) => {
            task.taskName = (task.taskName || '').replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50) || `Task_${i + 1}`;
            if (!task.taskName || 
                typeof task.bestCase !== 'number' || !isFinite(task.bestCase) || task.bestCase < 0 ||
                typeof task.mostLikely !== 'number' || !isFinite(task.mostLikely) || task.mostLikely < 0 ||
                typeof task.worstCase !== 'number' || !isFinite(task.worstCase) || task.worstCase < 0) {
                throw new Error(`Invalid task data at index ${i}: ${JSON.stringify(task)}`);
            }
            if (task.bestCase >= task.mostLikely || task.mostLikely >= task.worstCase) {
                throw new Error(`Invalid estimate order at index ${i}`);
            }
            if (task.bestCase === task.mostLikely || task.mostLikely === task.worstCase) {
                throw new Error(`Estimates must be distinct at index ${i}`);
            }
            const range = task.worstCase - task.bestCase;
            const minRange = task.mostLikely * MIN_RANGE_MULTIPLIER;
            if (range < minRange) {
                throw new Error(`Estimate range too small at index ${i}`);
            }
            if (task.selectedForPlot) {
                if (selectedTask) {
                    throw new Error('Only one task can be selected for plotting');
                }
                selectedTask = task.taskName;
            }
        });
        if (!selectedTask && tasks.length > 0) {
            tasks[0].selectedForPlot = true;
            selectedTask = tasks[0].taskName;
        }
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
        sheet.getRange(1, 1, 1, 5).setValues([['Name', 'Best Case', 'Most Likely', 'Worst Case', 'Selected for Plot']]).setFontWeight('bold');
        sheet.getRange(2, 1, data.length, 5).setValues(data);
        const config = {
            sheetId: ss.getId(),
            sheetName: ESTIMATION_DATA_SHEET_NAME,
            isWebAppContext: true,
            errorHandler: 'confirm',
            userEmail: userEmail,
            sessionId: sessionId
        };
        const result = addPertColumns(config);
        const sheetUrl = ss.getUrl();
        const deploymentId = getDeploymentId();
        let plotUrl = '';
        if (deploymentId) {
            plotUrl = `https://script.google.com/macros/s/${deploymentId}/exec?sheetId=${ss.getId()}&sessionId=${sessionId}`;
            Logger.log('Generated plotUrl: ' + plotUrl);
        } else {
            Logger.log('Warning: No deployment ID available. Dashboard URL will be empty.');
            plotUrl = '';
        }
        return {
            status: result.status,
            sheetUrl: sheetUrl,
            plotUrl: plotUrl,
            message: deploymentId ? result.message : result.message + ' Note: Dashboard unavailable without a valid deployment ID; please deploy as a web app.',
            errors: result.errors,
            selectedTask: selectedTask
        };
    } catch (error) {
        Logger.log('Error in createEstimateSheet: ' + error.message + '\nStack: ' + error.stack);
        throw new Error('Failed to create estimate sheet: ' + error.message);
    }
}



   