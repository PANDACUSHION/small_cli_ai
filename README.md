AI CLI (Powered by Gemini)

A terminal-based CLI powered by Google Gemini AI for chat and file analysis.
Features

    Chat with Gemini AI directly in your terminal.

    Autocomplete suggestions from chat history and file paths.

    Analyze and provide feedback on local files.

    Color-coded, easy-to-read responses in the terminal.

Requirements

    Node.js (v18+ recommended)

    npm

    Google Gemini API key

Setup

    Clone the repository:

    git clone <repository-url>
    cd <repository-folder>

    Install dependencies:

    npm install

    Install the CLI globally (optional):

    sudo npm install -g .

Usage
Run in interactive chat mode:

askcli

    When you run the CLI for the first time, it will prompt you to enter your Gemini API key. This key will be saved securely for future use.

    Type your questions directly in the terminal.

    Use exit to quit.

    Type checkfile <path/to/file> to analyze a file.

Run a single question:

askcli "Your question here"

Analyze a specific file:

askcli checkfile path/to/file.js

Notes

    Autocomplete supports both previous questions and local file paths.

    Responses are formatted with colors and symbols for readability.

    The API key is now stored in a global configuration file after the initial setup.

License

MIT License
