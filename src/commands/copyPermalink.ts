import { commands, env, Uri, window } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { Command } from "./command";

export class CopyPermalink extends Command {
  constructor() {
    super("svn.copyPermalink");
  }

  public async execute(resourceUri?: Uri): Promise<void> {
    // If a URI is passed directly (e.g., from editor context menu), use it
    let fileUri: Uri | undefined = resourceUri;

    // Otherwise, try to get file URI from active text editor
    if (!fileUri) {
      fileUri = window.activeTextEditor?.document.uri;
    }

    // If still no URI, try to get from active tab
    // This handles binary files or files with unsupported encoding
    if (!fileUri) {
      const activeTab = window.tabGroups.activeTabGroup?.activeTab;
      if (activeTab?.input) {
        const input = activeTab.input as any;
        if (input.uri) {
          fileUri = input.uri;
        }
      }
    }

    if (!fileUri) {
      window.showErrorMessage("No active file");
      return;
    }

    if (fileUri.scheme !== "file") {
      window.showErrorMessage("File is not a local file");
      return;
    }

    const filePath = fileUri.fsPath;

    const sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    const repository = await sourceControlManager.getRepositoryFromUri(fileUri);
    if (!repository) {
      window.showErrorMessage("File is not in an SVN repository");
      return;
    }

    try {
      const info = await repository.getInfo(filePath);

      if (!info || !info.url || !info.commit || !info.commit.revision) {
        window.showErrorMessage(
          "Could not retrieve SVN information for this file"
        );
        return;
      }

      const revision = info.commit.revision;
      const permalink = `${info.url}?p=${revision}&r=${revision}`;

      const clipboard = (env as any).clipboard;
      if (clipboard === undefined) {
        window.showErrorMessage(
          "Clipboard is supported in VS Code 1.30 and newer"
        );
        return;
      }

      await clipboard.writeText(permalink);
      window.showInformationMessage(
        `Permalink copied to clipboard (revision ${revision})`
      );
    } catch (error) {
      window.showErrorMessage(`Failed to copy permalink: ${error}`);
    }
  }
}
