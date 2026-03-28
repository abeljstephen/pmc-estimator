# bobyqa_optimizer.py
#
# WHAT: This script performs BOBYQA optimization using the Py-BOBYQA library to find optimal slider
#       settings (e.g., Budget Flexibility, Schedule Flexibility) for the pmcEstimatorAPI Cloud Function.
#       It is called by the BOBYQAOptimalSliderSettings function in core.js via python-shell.
#
# WHY: The core.js function references a missing bobyqa-js package, so we use Py-BOBYQA (installed locally
#      as Py-BOBYQA-1.5.0) to perform the optimization. This script enables the Interactive Probability
#      Simulator to optimize sliders for maximizing the probability of meeting a target value or minimizing
#      a value at a confidence level, as required for Plot.html visualizations.
#
# WHERE: Located in /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api, this script is
#        copied to Google Cloud Functions during deployment via deploy_pmcEstimatorAPI.sh. It runs in a
#        custom runtime (Node.js + Python) defined by a Dockerfile.
#
# HOW: - Reads input (initial sliders, bounds, precomputed objective values) from /tmp/bobyqa_input.json,
#        written by core.js.
#      - Uses Py-BOBYQA to optimize sliders, referencing precomputed objective values to avoid complex
#        Node.js-Python callbacks.
#      - Writes the optimized sliders to /tmp/bobyqa_output.json, read by core.js.
#      - Uses /tmp for file I/O, as it’s the only writable directory in Google Cloud Functions.
#
# DEPENDENCIES: Requires Py-BOBYQA, numpy, pandas, scipy, etc., installed via:
#               `python3 -m pip install Py-BOBYQA numpy pandas scipy python-dateutil pytz tzdata six`
#
# REFERENCES:
# - Vose, D. (2008). Risk Analysis: A Quantitative Guide. Wiley. (For optimization in risk analysis)
# - Powell, M. J. D. (2009). The BOBYQA algorithm for bound constrained optimization without derivatives.
# - Clemen, R. T., & Reilly, T. (2013). Making Hard Decisions with DecisionTools. (For robust outputs)
# - McConnell, S. (2004). Code Complete. (For error handling and clarity)

import pybobyqa
import json
import numpy as np

# WHAT: Reads input data from a JSON file written by core.js.
# WHY: core.js serializes the initial sliders, bounds, and precomputed objective values to pass to Python,
#      as direct function calls between Node.js and Python are complex in Cloud Functions.
# WHERE: Reads from /tmp/bobyqa_input.json, written by core.js in the BOBYQAOptimalSliderSettings function.
# HOW: Uses Python’s json module to load the JSON file, expecting a structure with initialSliders (array),
#      bounds (array of [lower, upper] pairs), and nodeData (precomputed objective values).
def read_input():
    try:
        # Open and read the input JSON file from /tmp (writable in Cloud Functions)
        with open('/tmp/bobyqa_input.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        # Log error and raise for robustness (Clemen & Reilly, 2013)
        print(f"Error reading input: {str(e)}")
        raise

# WHAT: Writes the optimization result or error to a JSON file for core.js to read.
# WHY: core.js expects the optimized sliders or an error message in a JSON file to continue processing.
#      Using a file avoids complex inter-process communication in Cloud Functions.
# WHERE: Writes to /tmp/bobyqa_output.json, read by core.js in BOBYQAOptimalSliderSettings.
# HOW: Uses Python’s json module to write the result (e.g., {"x": [slider values]}) or error message.
def write_output(result):
    try:
        # Write result to /tmp (writable in Cloud Functions)
        with open('/tmp/bobyqa_output.json', 'w') as f:
            json.dump(result, f)
    except Exception as e:
        # Log error but don’t raise, as this is a cleanup step (McConnell, 2004)
        print(f"Error writing output: {str(e)}")

# WHAT: Defines the objective function for Py-BOBYQA to optimize.
# WHY: Py-BOBYQA requires a function to minimize (negated to maximize probability). Since the actual
#      objective function is in JavaScript (in core.js), we use precomputed values from node_data to
#      approximate it, avoiding real-time Node.js-Python callbacks.
# WHERE: Called iteratively by Py-BOBYQA during optimization to evaluate slider combinations.
# HOW: - Takes sliders (numpy array) and node_data (precomputed objective values from core.js).
#      - Converts sliders to a string key (e.g., "[50,50,50,50,50,50]") to look up the precomputed value.
#      - Returns the negated value (to maximize) or -inf if not found, ensuring robustness (Vose, 2008).
def objective(sliders, node_data):
    # Convert sliders array to string for lookup
    sliders_str = str(sliders.tolist())
    # Return negated objective value or -inf if not found
    return -node_data.get(sliders_str, float('inf'))

# WHAT: Main function to perform BOBYQA optimization.
# WHY: Orchestrates the optimization process by reading input, running Py-BOBYQA, and writing output.
#      Handles errors to ensure robust execution in Cloud Functions.
# WHERE: Called when the script is executed by python-shell from core.js.
# HOW: - Reads input data (initial sliders, bounds, node_data).
#      - Runs Py-BOBYQA with the objective function, initial sliders, and bounds.
#      - Writes the optimized sliders or error to /tmp/bobyqa_output.json.
def main():
    try:
        # Read input data from /tmp/bobyqa_input.json
        data = read_input()
        
        # Extract initial sliders (x0) as a numpy array
        x0 = np.array(data['initialSliders'])
        
        # Extract bounds as numpy arrays (lower and upper bounds for each slider)
        bounds_lower = np.array(data['bounds'][0])
        bounds_upper = np.array(data['bounds'][1])
        
        # Extract precomputed objective values
        node_data = data['nodeData']
        
        # Run Py-BOBYQA optimization
        # - objective: Uses precomputed values from node_data
        # - x0: Initial slider values (e.g., [50, 50, 50, 50, 50, 50])
        # - bounds: [lower, upper] for each slider (e.g., [[0,100], [0,100], ...])
        # - maxfun: Limits evaluations to 1000 for performance
        # - rhobeg: Initial trust region radius (10, per Powell, 2009)
        # - doinit: Ensures initialization for robustness
        soln = pybobyqa.solve(
            lambda x: objective(x, node_data),
            x0=x0,
            bounds=(bounds_lower, bounds_upper),
            maxfun=1000,
            rhobeg=10,
            doinit=True
        )
        
        # Write optimized sliders to output file
        write_output({"x": soln.x.tolist()})
    except Exception as e:
        # Write error to output file for core.js to handle (McConnell, 2004)
        write_output({"error": str(e)})
        print(f"Optimization failed: {str(e)}")

# WHAT: Entry point for the script.
# WHY: Ensures the script runs only when executed directly (e.g., by python-shell), not when imported.
# WHERE: Executed by python-shell when core.js calls PythonShell.run('bobyqa_optimizer.py').
# HOW: Calls the main function to perform optimization.
if __name__ == "__main__":
    main()
