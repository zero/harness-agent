import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type WorkspacePicker = () => Promise<string | undefined>;

interface CommandError extends Error {
  code?: number | string;
  stderr?: string;
}

async function runPickerCommand(command: string, args: string[]): Promise<string | undefined> {
  const { stdout } = await execFileAsync(command, args, {
    windowsHide: true
  });
  const selectedPath = stdout.trim();
  return selectedPath || undefined;
}

async function pickWorkspaceWithMacOsDialog(): Promise<string | undefined> {
  try {
    return await runPickerCommand("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "Select project workspace")'
    ]);
  } catch (error) {
    const commandError = error as CommandError;
    if (commandError.stderr?.includes("(-128)")) {
      return undefined;
    }
    throw error;
  }
}

async function pickWorkspaceWithWindowsDialog(): Promise<string | undefined> {
  return runPickerCommand("powershell.exe", [
    "-NoProfile",
    "-STA",
    "-Command",
    [
      "Add-Type -AssemblyName System.Windows.Forms;",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;",
      "$dialog.Description = 'Select project workspace';",
      "$dialog.ShowNewFolderButton = $true;",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
      "  [Console]::Write($dialog.SelectedPath)",
      "}"
    ].join(" ")
  ]);
}

async function pickWorkspaceWithLinuxDialog(): Promise<string | undefined> {
  try {
    return await runPickerCommand("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select project workspace"
    ]);
  } catch (error) {
    const commandError = error as CommandError;
    if (commandError.code === 1) {
      return undefined;
    }
    return runPickerCommand("kdialog", ["--getexistingdirectory", ".", "Select project workspace"]);
  }
}

export async function pickWorkspaceWithSystemDialog(): Promise<string | undefined> {
  if (process.platform === "darwin") {
    return pickWorkspaceWithMacOsDialog();
  }
  if (process.platform === "win32") {
    return pickWorkspaceWithWindowsDialog();
  }
  if (process.platform === "linux") {
    return pickWorkspaceWithLinuxDialog();
  }

  throw new Error(`Unsupported platform for workspace picker: ${process.platform}`);
}
