#!/usr/bin/env node
import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import os from "os";
import { GoogleGenerativeAI } from "@google/generative-ai";

const configDir = path.join(os.homedir(), ".config", "manjil-cli");
const configPath = path.join(configDir, "config.json");

let lastAnalyzedFile = null;

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

let genAI;
let model;
let chat;

function formatResponseForTerminal(text) {
  return text
    .replace(/#{1,6}\s?(.*)/g, chalk.bold.cyan("$1"))
    .replace(/\*\*(.*?)\*\*/g, chalk.bold("$1"))
    .replace(/\*(.*?)\*/g, chalk.italic("$1"))
    .replace(/`([^`]+)`/g, chalk.bgGray.white(" $1 "))
    .replace(/^\* (.*?)$/gm, `  ${chalk.green("•")} $1`)
    .replace(/^(\d+\.)\s(.*?)$/gm, `  ${chalk.green("$1")} $2`);
}

function extractCodeFromResponse(text) {
  const codeBlockRegex =
    /```(?:javascript|js|node|jsx?|typescript|ts|python|py)?\n?([\s\S]*?)\n?```/;
  const match = text.match(codeBlockRegex);

  if (match) {
    return match[1].trim();
  }

  return text.trim();
}

async function askQuestion(question) {
  try {
    const result = await chat.sendMessage(question);
    const formattedResponse = formatResponseForTerminal(result.response.text());
    console.log(chalk.yellow("\nGemini: ") + chalk.white(formattedResponse));
  } catch (err) {
    console.error(chalk.red("Error: "), err.message);
  }
}

async function checkFile(filePath, continueChat = false) {
  const absPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) {
    console.log(chalk.red(`File not found: ${absPath}`));
    return;
  }

  const content = fs.readFileSync(absPath, "utf-8");
  console.log(chalk.cyan(`Analyzing file: ${absPath}`));

  lastAnalyzedFile = absPath;

  try {
    const result = await chat.sendMessage(
      `Analyze this file and provide comprehensive feedback in a detailed paragraph format. Cover code quality, potential improvements, best practices, and optimization suggestions:\n\nFile: ${filePath}\n\nContent:\n${content}`
    );
    const formattedResponse = formatResponseForTerminal(result.response.text());
    console.log(
      chalk.green("\nFile Analysis:\n") + chalk.white(formattedResponse)
    );

    if (continueChat) {
      console.log(
        chalk.gray(
          "\nFile context loaded. Continue asking questions or use 'overwrite' to improve this file.\n"
        )
      );
      await chatMode();
    }
  } catch (err) {
    console.error(chalk.red("Error analyzing file: "), err.message);
  }
}

async function debugFile(filePath, continueChat = false) {
  const absPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) {
    console.log(chalk.red(`File not found: ${absPath}`));
    return;
  }

  const content = fs.readFileSync(absPath, "utf-8");
  console.log(chalk.cyan(`Debugging file: ${absPath}`));

  lastAnalyzedFile = absPath;

  try {
    const result = await chat.sendMessage(
      `Debug this file and provide a comprehensive paragraph explaining what issues, bugs, inefficiencies, or improvements you found. Be specific about problems and suggest concrete solutions:\n\nFile: ${filePath}\n\nContent:\n${content}`
    );
    const formattedResponse = formatResponseForTerminal(result.response.text());
    console.log(
      chalk.red("\nDebug Analysis:\n") + chalk.white(formattedResponse)
    );

    const { shouldOverwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "shouldOverwrite",
        message: "Would you like to overwrite this file with improved code?",
        default: false,
      },
    ]);

    if (shouldOverwrite) {
      await handleOverwrite();
    }

    if (continueChat) {
      console.log(
        chalk.gray(
          "\nFile context loaded. Continue asking questions or use 'overwrite' anytime.\n"
        )
      );
      await chatMode();
    }
  } catch (err) {
    console.error(chalk.red("Error debugging file: "), err.message);
  }
}

async function handleOverwrite() {
  if (!lastAnalyzedFile) {
    console.log(
      chalk.red(
        "No file has been analyzed yet. Use 'checkfile' or 'debug' first."
      )
    );
    return;
  }

  if (!fs.existsSync(lastAnalyzedFile)) {
    console.log(
      chalk.red(`Previously analyzed file not found: ${lastAnalyzedFile}`)
    );
    return;
  }

  const content = fs.readFileSync(lastAnalyzedFile, "utf-8");
  const fileName = path.basename(lastAnalyzedFile);

  console.log(chalk.cyan(`Generating improved code for: ${fileName}`));

  try {
    const result = await chat.sendMessage(
      `Rewrite this entire file with all improvements, fixes, and optimizations. Return only the complete, clean code without any comments, explanations, or markdown formatting. Make the code production-ready and maintain all original functionality while implementing the improvements we discussed:\n\nFile: ${fileName}\n\nCurrent Content:\n${content}`
    );

    const rewrittenCode = extractCodeFromResponse(result.response.text());

    console.log(chalk.green("\nImproved Code Preview:"));
    console.log(chalk.white("─".repeat(60)));
    console.log(rewrittenCode);
    console.log(chalk.white("─".repeat(60)));

    const { shouldSave } = await inquirer.prompt([
      {
        type: "confirm",
        name: "shouldSave",
        message: `Save this improved code to ${fileName}?`,
        default: false,
      },
    ]);

    if (shouldSave) {
      const backupPath = lastAnalyzedFile + ".backup";
      fs.writeFileSync(backupPath, content);
      console.log(chalk.yellow(`Backup created: ${backupPath}`));

      fs.writeFileSync(lastAnalyzedFile, rewrittenCode);
      console.log(
        chalk.green(`✅ File successfully improved and saved: ${fileName}`)
      );
    } else {
      console.log(chalk.gray("Changes not saved. Original file unchanged."));
    }
  } catch (err) {
    console.error(chalk.red("Error generating improved code: "), err.message);
  }
}

async function chatMode() {
  console.log(chalk.green("💬 Manjil CLI - Powered by Gemini AI"));
  console.log(
    chalk.gray(
      "Commands: 'exit', 'checkfile <path>', 'file <path>', 'overwrite'"
    )
  );
  console.log(
    chalk.gray("Session memory active - context persists during chat.\n")
  );

  while (true) {
    const { question } = await inquirer.prompt([
      {
        type: "input",
        name: "question",
        message: chalk.cyan("Ask Gemini:"),
      },
    ]);

    if (question.toLowerCase() === "exit") {
      console.log(chalk.blue("\nSession ended. Goodbye!"));
      break;
    }

    if (question.toLowerCase() === "overwrite") {
      await handleOverwrite();
      continue;
    }

    if (question.toLowerCase().startsWith("checkfile ")) {
      const filePath = question.slice("checkfile ".length).trim();
      await checkFile(filePath);
      continue;
    }

    if (question.toLowerCase().startsWith("file ")) {
      const filePath = question.slice("file ".length).trim();
      const absPath = path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(absPath)) {
        console.log(chalk.red(`File not found: ${absPath}`));
        continue;
      }

      const content = fs.readFileSync(absPath, "utf-8");
      console.log(chalk.cyan(`Adding file context: ${absPath}`));

      lastAnalyzedFile = absPath;

      try {
        await chat.sendMessage(
          `Here is a code file for context (${filePath}):\n${content}`
        );
        console.log(chalk.green("File context added to conversation."));
      } catch (err) {
        console.error(chalk.red("Error adding file context: "), err.message);
      }
    } else {
      await askQuestion(question);
    }
  }
}

process.on("SIGINT", () => {
  console.log(chalk.blue("\n\nSession ended. Goodbye!"));
  process.exit(0);
});

async function main() {
  await initialize();

  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  chat = model.startChat({ history: [] });

  const args = process.argv.slice(2);

  if (args[0] === "checkfile" && args[1]) {
    await checkFile(args[1], true);
  } else if (args[0] === "debug" && args[1]) {
    await debugFile(args[1], true);
  } else if (args.length > 0) {
    const question = args.join(" ");
    await askQuestion(question);
    console.log(chalk.gray("\nContinuing with interactive chat...\n"));
    await chatMode();
  } else {
    await chatMode();
  }
}

main();
