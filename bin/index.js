#!/usr/bin/env node
import inquirer from "inquirer";
import inquirerAutocompletePrompt from "inquirer-autocomplete-prompt";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import os from "os";
import { GoogleGenerativeAI } from "@google/generative-ai";

inquirer.registerPrompt("autocomplete", inquirerAutocompletePrompt);

const configDir = path.join(os.homedir(), ".config", "manjil-cli");
const configPath = path.join(configDir, "config.json");

/**
 * Prompts the user for their API key and saves it to a configuration file.
 * @returns {Promise<void>}
 */
async function promptForApiKeyAndSave() {
  console.log(chalk.yellow("\nGemini API key not found."));
  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Please enter your Gemini API Key:",
      mask: "*",
    },
  ]);

  if (apiKey) {
    try {
      await fs.promises.mkdir(configDir, { recursive: true });
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({ geminiApiKey: apiKey })
      );
      console.log(chalk.green("API Key saved successfully!"));
      process.env.GEMINI_API_KEY = apiKey;
    } catch (error) {
      console.error(chalk.red("Error saving API key:"), error.message);
      process.exit(1);
    }
  } else {
    console.error(chalk.red("API Key is required. Exiting."));
    process.exit(1);
  }
}

/**
 * Loads the API key from a configuration file.
 * @returns {Promise<string|null>} The API key, or null if not found.
 */
async function loadApiKeyFromConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(
        await fs.promises.readFile(configPath, "utf-8")
      );
      return config.geminiApiKey;
    }
  } catch (error) {
    console.error(
      chalk.red("Error loading API key from config:"),
      error.message
    );
  }
  return null;
}

async function initialize() {
  const keyFromConfig = await loadApiKeyFromConfig();
  if (keyFromConfig) {
    process.env.GEMINI_API_KEY = keyFromConfig;
  }

  if (!process.env.GEMINI_API_KEY) {
    await promptForApiKeyAndSave();
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error(chalk.red("\nAPI Key not found. Please try again."));
    process.exit(1);
  }
}

// Initialize the Google Generative AI client.
let genAI;
let model;
let chatHistory = [];

/**
 * Formats the Gemini model's response for better readability in the terminal.
 * Converts markdown-like syntax to colored and styled text.
 * @param {string} text The raw text response from the Gemini model.
 * @returns {string} The formatted text.
 */
function formatResponseForTerminal(text) {
  let formattedText = text.replace(/\*\*(.*?)\*\*/g, chalk.bold("$1"));
  formattedText = formattedText.replace(/^#\s(.*?)$/gm, chalk.bold.cyan("$1"));
  formattedText = formattedText.replace(
    /^\* (.*?)$/gm,
    `  ${chalk.green("•")} $1`
  );
  formattedText = formattedText.replace(
    /^(\d+\.)\s(.*?)$/gm,
    `  ${chalk.green("$1")} $2`
  );
  formattedText = formattedText.replace(/`(.*?)`/g, chalk.bgGray("$1"));
  return formattedText;
}

/**
 * Sends a question to the Gemini model and prints the formatted response.
 * @param {string} question The user's query.
 */
async function askQuestion(question) {
  try {
    const result = await model.generateContent(question);
    const formattedResponse = formatResponseForTerminal(result.response.text());
    console.log(chalk.yellow("\nGemini: ") + chalk.white(formattedResponse));
    chatHistory.unshift(question);
  } catch (err) {
    console.error(chalk.red("Error: "), err.message);
  }
}

/**
 * Reads the content of a file and sends it to the Gemini model for analysis.
 * The file path is resolved relative to the current working directory.
 * @param {string} filePath The path to the file to be analyzed.
 */
async function checkFile(filePath) {
  const absPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) {
    console.log(chalk.red(`File not found: ${absPath}`));
    return;
  }

  const content = fs.readFileSync(absPath, "utf-8");
  console.log(chalk.cyan(`Reading file: ${absPath}`));

  try {
    const result = await model.generateContent(
      `Analyze this file and provide feedback:\n\n${content}`
    );
    const formattedResponse = formatResponseForTerminal(result.response.text());
    console.log(
      chalk.green("\nGemini’s Analysis:\n") + chalk.white(formattedResponse)
    );
  } catch (err) {
    console.error(chalk.red("Error analyzing file: "), err.message);
  }
}

/**
 * The main interactive chat loop for the CLI.
 */
async function chatMode() {
  console.log(chalk.green("Welcome to Manjil Cli (powered by Gemini)"));

  while (true) {
    const { question } = await inquirer.prompt([
      {
        type: "autocomplete",
        name: "question",
        message: "Ask Gemini (or type 'exit' to quit):",
        source: async (answersSoFar, input) => {
          input = input || "";

          const historySuggestions = chatHistory
            .filter(item => item.toLowerCase().includes(input.toLowerCase()))
            .reverse();

          const fileSuggestions = [];

          if (input.includes("/") || input.includes("\\")) {
            try {
              const absDir = path.resolve(process.cwd(), path.dirname(input));
              const files = await fs.promises.readdir(absDir);
              const matchingFiles = files
                .filter(file =>
                  file
                    .toLowerCase()
                    .includes(path.basename(input).toLowerCase())
                )
                // Convert the absolute path back to a relative path from the current working directory.
                .map(file =>
                  path.relative(process.cwd(), path.join(absDir, file))
                );
              fileSuggestions.push(...matchingFiles);
            } catch (error) {
              // Ignore errors if the path is invalid or does not exist.
            }
          }

          const allSuggestions = [
            ...new Set([...fileSuggestions, ...historySuggestions]),
          ];

          if (fileSuggestions.length > 0 && historySuggestions.length > 0) {
            return [
              ...fileSuggestions,
              new inquirer.Separator("— History —"),
              ...historySuggestions,
            ];
          }

          return allSuggestions;
        },
        pageSize: 10,
        suggestOnly: true,
      },
    ]);

    if (question.toLowerCase() === "exit") {
      console.log(chalk.blue("Goodbye!"));
      break;
    }

    if (question.toLowerCase().startsWith("checkfile ")) {
      const filePath = question.slice("checkfile ".length).trim();
      await checkFile(filePath);
    } else {
      await askQuestion(question);
    }
  }
}

/**
 * The entry point for the CLI application.
 * Handles command-line arguments to run in file analysis or chat mode.
 */
async function main() {
  await initialize();
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const args = process.argv.slice(2);

  if (args[0] === "checkfile" && args[1]) {
    await checkFile(args[1]);
  } else if (args.length > 0) {
    const question = args.join(" ");
    await askQuestion(question);
  } else {
    await chatMode();
  }
}

main();
