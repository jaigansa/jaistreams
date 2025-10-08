#!/bin/bash
# Change to the parent directory (as you intended)
cd "$(dirname "$0")/.."
echo "🚀 Starting server.js from $(pwd)..."
# Provide the path to server.js relative to the 'apps' folder
node server.js
