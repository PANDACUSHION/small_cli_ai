#!/bin/bash

# Check if askcli exists
askcli_path=$(which askcli 2>/dev/null)

if [ -z "$askcli_path" ]; then
    echo "askcli not found in PATH"
else
    echo "Found askcli at: $askcli_path"
    echo "Removing askcli..."
    sudo rm -rf "$askcli_path"
fi

# Check if Node.js is installed
if command -v node >/dev/null 2>&1; then
    echo "Node.js is installed: $(node -v)"
else
    echo "Error: Node.js is not installed. Please install it first."
    exit 1
fi

# Check if npm is installed
if command -v npm >/dev/null 2>&1; then
    echo "npm is installed: $(npm -v)"
else
    echo "Error: npm is not installed. Please install it first."
    exit 1
fi

# Install npm packages in current directory
current_path=$(pwd)
echo "Installing npm packages locally in: $current_path"
npm install

# Install globally
echo "Installing npm package globally..."
sudo npm install -g .
