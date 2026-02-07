"use strict";

const cp = require("node:child_process");
const path = require("node:path");
const vscode = require("vscode");

const REFRESH_COMMAND = "openplanetAngelscript.refreshGrammarSymbols";
const CONFIG_SECTION = "openplanetAngelscript";

let statusBarItem = null;
let sessionRefreshStarted = false;

function getConfig() {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

function getGeneratorArgs(extensionPath) {
  const config = getConfig();
  const args = [path.join(extensionPath, "scripts", "generate-openplanet-grammar.mjs")];
  const sourceDirs = config.get("sourceDirs", []);
  const includeHeaderFallback = config.get("includeHeaderFallback", false);

  if (Array.isArray(sourceDirs) && sourceDirs.length > 0) {
    args.push("--openplanet-dirs", sourceDirs.join(";"));
  }
  if (includeHeaderFallback) {
    args.push("--include-headers", "true");
  }
  return args;
}

function maybeShowReloadPrompt() {
  vscode.window
    .showInformationMessage(
      "Openplanet AngelScript symbols refreshed. Reload window to ensure updated highlighting is applied.",
      "Reload Window",
    )
    .then((selection) => {
      if (selection === "Reload Window") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
}

function runGenerator(extensionPath, opts = {}) {
  const { reason = "manual", quiet = false, promptReload = false } = opts;

  return new Promise((resolve) => {
    const args = getGeneratorArgs(extensionPath);
    const child = cp.spawn(process.execPath, args, { cwd: extensionPath });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      const message = `Openplanet symbol refresh failed (${reason}): ${err.message}`;
      vscode.window.showErrorMessage(message);
      resolve(false);
    });
    child.on("close", (code) => {
      if (code === 0) {
        if (!quiet) {
          vscode.window.showInformationMessage(`Openplanet symbols refreshed (${reason}).`);
        }
        if (promptReload) maybeShowReloadPrompt();
        resolve(true);
        return;
      }

      const detail = (stderr || stdout || "").trim();
      const message = detail
        ? `Openplanet symbol refresh failed (${reason}): ${detail}`
        : `Openplanet symbol refresh failed (${reason}).`;
      vscode.window.showErrorMessage(message);
      resolve(false);
    });
  });
}

function ensureStatusBar(context) {
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = null;
  }

  const showButton = getConfig().get("showRefreshButton", true);
  if (!showButton) return;

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  statusBarItem.text = "$(refresh) OP Symbols";
  statusBarItem.tooltip = "Refresh Openplanet syntax symbols";
  statusBarItem.command = REFRESH_COMMAND;
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(REFRESH_COMMAND, async () => {
      await runGenerator(context.extensionPath, {
        reason: "manual",
        quiet: false,
        promptReload: true,
      });
    }),
  );

  ensureStatusBar(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        ensureStatusBar(context);
      }
    }),
  );

  if (!sessionRefreshStarted && getConfig().get("refreshSymbolsOnSessionStart", true)) {
    sessionRefreshStarted = true;
    runGenerator(context.extensionPath, {
      reason: "session start",
      quiet: true,
      promptReload: false,
    });
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
