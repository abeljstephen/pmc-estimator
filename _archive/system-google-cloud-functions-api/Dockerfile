# WHAT: Defines a custom runtime for Google Cloud Functions to support both Node.js and Python.
# WHY: The pmcEstimatorAPI Cloud Function requires Node.js for core.js/index.js and Python for Py-BOBYQA,
#      used by BOBYQAOptimalSliderSettings via python-shell.
# WHERE: Placed in /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api, copied to the
#        cloud during deployment.
# HOW: - Uses node:20 as the base image for Node.js 20.
#      - Installs Python 3 and pip, then Py-BOBYQA and dependencies.
#      - Copies source files and installs Node.js dependencies.
#      - Sets the USE_CORE=1 environment variable to enable core.js logic.
#      - Runs npm start to execute the Cloud Function via functions-framework.

# Start with Node.js 20 base image
FROM node:20

# Install Python 3 and pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Install Python dependencies (matching local versions)
RUN pip3 install pybobyqa==1.5.0 numpy==2.3.1 pandas==2.3.1 scipy==1.16.0 python-dateutil==2.9.0.post0 pytz==2025.2 tzdata==2025.2 six==1.17.0

# Set working directory
WORKDIR /usr/src/app

# Copy source files (index.js, core.js, bobyqa_optimizer.py, package.json)
COPY . .

# Install Node.js dependencies
RUN npm install

# Set environment variable to enable core.js logic
ENV USE_CORE=1

# Run the Cloud Function
CMD ["npm", "start"]
