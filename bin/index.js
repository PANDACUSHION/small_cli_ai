#!/usr/bin/env node
import inquirer from "inquirer";
import inquirerAutocompletePrompt from "inquirer-autocomplete-prompt";
import chalk from "chalk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
inquirer.registerPrompt("autocomplete", inquirerAutocompletePrompt);
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to suppress console logs
function suppressConsoleLogs(callback) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    callback();
  } finally {
    console.log = originalLog;
  }
}

// Wrap the dotenv config call to prevent log messages
suppressConsoleLogs(() => {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
let chatHistory = [];

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

async function checkFile(filePath) {
  const absPath = path.resolve(filePath);
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
              const dir = path.dirname(input);
              const files = await fs.promises.readdir(dir);
              const matchingFiles = files
                .filter(file =>
                  file
                    .toLowerCase()
                    .includes(path.basename(input).toLowerCase())
                )
                .map(file => path.join(dir, file));
              fileSuggestions.push(...matchingFiles);
            } catch (error) {}
          }

          const allSuggestions = [
            ...new Set([...fileSuggestions, ...historySuggestions]),
          ];

          if (fileSuggestions.length > 0 && historySuggestions.length > 0) {
            return [
              ...fileSuggestions,
              new inquirer.Separator(),
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

async function main() {
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
