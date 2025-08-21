#!/usr/bin/env node
import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import os from "os";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuration management
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
        JSON.stringify({ geminiApiKey: apiKey }, null, 2)
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

/**
 * Initialize API key from config or prompt user
 */
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
let chat;

/**
 * Formats the Gemini model's response for better readability in the terminal.
 * @param {string} text The raw text response from the Gemini model.
 * @returns {string} The formatted text.
 */
function formatResponseForTerminal(text) {
  return text
    .replace(/#{1,6}\s?(.*)/g, chalk.bold.cyan("$1"))
    .replace(/\*\*(.*?)\*\*/g, chalk.bold("$1"))
    .replace(/\*(.*?)\*/g, chalk.italic("$1"))
    .replace(/`([^`]+)`/g, chalk.bgGray.white(" $1 "))
    .replace(/^\* (.*?)$/gm, `  ${chalk.green("•")} $1`)
    .replace(/^(\d+\.)\s(.*?)$/gm, `  ${chalk.green("$1")} $2`);
}

/**
 * Sends a question to the Gemini model and prints the formatted response.
 * @param {string} question The user's query.
 */
async function askQuestion(question) {
  try {
    const result = await chat.sendMessage(question);
    const formattedResponse = formatResponseForTerminal(result.response.text());
    console.log(chalk.yellow("\nGemini: ") + chalk.white(formattedResponse));
  } catch (err) {
    console.error(chalk.red("Error: "), err.message);
  }
}

/**
 * Reads the content of a file and sends it to the Gemini model for analysis.
 * @param {string} filePath The path to the file to be analyzed.
 * @param {boolean} continueChat Whether to continue with chat mode after analysis
 */
async function checkFile(filePath, continueChat = false) {
  const absPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) {
    console.log(chalk.red(`File not found: ${absPath}`));
    return;
  }

  const content = fs.readFileSync(absPath, "utf-8");
  console.log(chalk.cyan(`Reading file: ${absPath}`));

  try {
    const result = await chat.sendMessage(
      `Analyze this file and provide feedback:\n\nFile: ${filePath}\n\nContent:\n${content}`
    );
    const formattedResponse = formatResponseForTerminal(result.response.text());
    console.log(
      chalk.green("\nGemini's Analysis:\n") + chalk.white(formattedResponse)
    );

    // If we should continue with chat after analysis
    if (continueChat) {
      console.log(
        chalk.gray(
          "\nFile context is now loaded. You can continue asking questions about it.\n"
        )
      );
      await chatMode();
    }
  } catch (err) {
    console.error(chalk.red("Error analyzing file: "), err.message);
  }
}

/**
 * The main interactive chat loop for the CLI.
 */
async function chatMode() {
  console.log(chalk.green("💬 Welcome to Manjil CLI (powered by Gemini)"));
  console.log(
    chalk.gray(
      "Commands: 'exit' to quit, 'checkfile <path>' to analyze files, 'file <path>' to add context"
    )
  );
  console.log(chalk.gray("Memory persists during this session only.\n"));

  while (true) {
    const { question } = await inquirer.prompt([
      {
        type: "input",
        name: "question",
        message: chalk.cyan("Ask Gemini (or type 'exit' to quit):"),
      },
    ]);

    if (question.toLowerCase() === "exit") {
      console.log(chalk.blue("\nGoodbye! (Session memory cleared)"));
      break;
    }

    // Handle checkfile command (with analysis and response)
    if (question.toLowerCase().startsWith("checkfile ")) {
      const filePath = question.slice("checkfile ".length).trim();
      await checkFile(filePath);
      continue; // Continue the chat loop after checkfile
    }
    // Handle file command (context only, no analysis response)
    else if (question.toLowerCase().startsWith("file ")) {
      const filePath = question.slice("file ".length).trim();
      const absPath = path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(absPath)) {
        console.log(chalk.red(`File not found: ${absPath}`));
        continue;
      }

      const content = fs.readFileSync(absPath, "utf-8");
      console.log(chalk.cyan(`Adding file context: ${absPath}`));

      try {
        await chat.sendMessage(
          `Here is a code file for context (${filePath}):\n${content}`
        );
        console.log(chalk.green("File context added to conversation."));
      } catch (err) {
        console.error(chalk.red("Error adding file context: "), err.message);
      }
    }
    // Regular question
    else {
      await askQuestion(question);
    }
  }
}

/**
 * Handle graceful exit on Ctrl+C
 */
process.on("SIGINT", () => {
  console.log(chalk.blue("\n\nGoodbye! (Session memory cleared)"));
  process.exit(0);
});

/**
 * The entry point for the CLI application.
 */
async function main() {
  await initialize();

  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Start chat session with persistent memory
  chat = model.startChat({ history: [] });

  const args = process.argv.slice(2);

  if (args[0] === "checkfile" && args[1]) {
    // After checkfile from command line, continue with chat
    await checkFile(args[1], true);
  } else if (args.length > 0) {
    const question = args.join(" ");
    await askQuestion(question);
    // After answering a direct question, start chat mode
    console.log(chalk.gray("\nContinuing with interactive chat...\n"));
    await chatMode();
  } else {
    await chatMode();
  }
}

main();
