import {
  TabInputCustom,
  TabInputNotebook,
  TabInputText,
  TabInputTextDiff,
  Uri,
  window
} from "vscode";
import { Command } from "./command";

export class Lock extends Command {
  constructor() {
    super("svn.lock");
  }

  public async execute(resourceUri?: Uri) {
    let uri: Uri | undefined = resourceUri;

    if (!uri) {
      uri = this.getUriFromActiveTab();
    }

    if (!uri) {
      uri = window.activeTextEditor?.document.uri;
    }

    if (!uri) {
      window.showErrorMessage("No file is currently open");
      return;
    }

    if (uri.scheme !== "file") {
      window.showErrorMessage("Can only lock files from the file system");
      return;
    }

    await this.runByRepository(uri, async (repository, resource) => {
      if (!repository) {
        return;
      }

      const path = resource.fsPath;

      try {
        await repository.lock([path]);
        window.showInformationMessage(`Successfully locked ${path}`);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to lock file");
      }
    });
  }

  private getUriFromActiveTab(): Uri | undefined {
    const activeTab = window.tabGroups.activeTabGroup?.activeTab;
    const input = activeTab?.input;

    if (!input) {
      return;
    }

    if (input instanceof TabInputText) {
      return input.uri;
    }

    if (input instanceof TabInputCustom) {
      return input.uri;
    }

    if (input instanceof TabInputNotebook) {
      return input.uri;
    }

    if (input instanceof TabInputTextDiff) {
      if (input.modified.scheme === "file") {
        return input.modified;
      }

      if (input.original.scheme === "file") {
        return input.original;
      }

      return;
    }

    const inputWithUri = input as { uri?: Uri };
    return inputWithUri.uri;
  }
}
