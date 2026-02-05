import { commands, env, window } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { Command } from "./command";

export class CopyPermalink extends Command {
  constructor() {
    super("svn.copyPermalink");
  }

  public async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showErrorMessage("No active editor");
      return;
    }

    const fileUri = editor.document.uri;
    if (fileUri.scheme !== "file") {
      window.showErrorMessage("File is not a local file");
      return;
    }

    const filePath = fileUri.fsPath;

    // Get the source control manager
    const sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    // Get the repository for this file
    const repository = await sourceControlManager.getRepositoryFromUri(fileUri);
    if (!repository) {
      window.showErrorMessage("File is not in an SVN repository");
      return;
    }

    try {
      // Get SVN info for the file
      const info = await repository.getInfo(filePath);
      
      if (!info || !info.url || !info.commit || !info.commit.revision) {
        window.showErrorMessage("Could not retrieve SVN information for this file");
        return;
      }

      // Construct the permalink using the last committed revision
      const revision = info.commit.revision;
      const permalink = `${info.url}?p=${revision}&r=${revision}`;

      // Copy to clipboard
      const clipboard = (env as any).clipboard;
      if (clipboard === undefined) {
        window.showErrorMessage("Clipboard is supported in VS Code 1.30 and newer");
        return;
      }

      await clipboard.writeText(permalink);
      window.showInformationMessage(`Permalink copied to clipboard (revision ${revision})`);
    } catch (error) {
      window.showErrorMessage(`Failed to copy permalink: ${error}`);
    }
  }
}
