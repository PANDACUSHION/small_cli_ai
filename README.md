# AI CLI (Powered by Gemini)

A terminal-based CLI powered by **Google Gemini AI** for chat and file analysis.

---

## Features

- Chat with Gemini AI directly in your terminal.
- Autocomplete suggestions from chat history and file paths.
- Analyze and provide feedback on local files.
- Color-coded, easy-to-read responses in the terminal.

---

## Requirements

- Node.js (v18+ recommended)
- npm
- Google Gemini API key

---

## Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd <repository-folder>

   ```

2. **Create a `.env` file at the root of the project:**

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Install the CLI globally (optional):**

   ```bash
   sudo npm install -g .
   ```

---

## Usage

### Run in interactive chat mode:

```bash
askcli
```

- Type your questions directly in the terminal.
- Use `exit` to quit.
- Type `checkfile <path/to/file>` to analyze a file.

### Run a single question:

```bash
askcli "Your question here"
```

### Analyze a specific file:

```bash
askcli checkfile path/to/file.js
```

---

## Notes

- Autocomplete supports both previous questions and local file paths.
- Responses are formatted with colors and symbols for readability.
- Ensure your Gemini API key is valid and set in `.env`.

---

## License

MIT License
