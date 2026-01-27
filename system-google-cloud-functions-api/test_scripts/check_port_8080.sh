#!/bin/bash

PORT=8080

# Check for process on port
PID=$(lsof -t -i:$PORT)

if [ -z "$PID" ]; then
  echo "Port $PORT is free."
else
  echo "Process $PID is running on port $PORT."
  echo "Options:"
  echo "1) Kill the process and use port $PORT"
  echo "2) Use next available port (starting from 8081)"
  read -p "Enter choice (1 or 2): " choice

  if [ "$choice" = "1" ]; then
    echo "Killing process $PID..."
    kill -9 $PID
    if [ $? -eq 0 ]; then
      echo "Process killed successfully."
    else
      echo "Failed to kill process. Exiting."
      exit 1
    fi
  elif [ "$choice" = "2" ]; then
    NEW_PORT=$((PORT + 1))
    while true; do
      NEW_PID=$(lsof -t -i:$NEW_PORT)
      if [ -z "$NEW_PID" ]; then
        echo "Port $NEW_PORT is free."
        PORT=$NEW_PORT
        break
      fi
      NEW_PORT=$((NEW_PORT + 1))
    done
  else
    echo "Invalid choice. Exiting."
    exit 1
  fi

  echo "Using port $PORT."
fi
