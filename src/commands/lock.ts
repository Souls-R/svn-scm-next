import { window } from "vscode";
import { Command } from "./command";

export class Lock extends Command {
  constructor() {
    super("svn.lock");
  }

  public async execute() {
    const editor = window.activeTextEditor;

    if (!editor) {
      window.showErrorMessage("No file is currently open");
      return;
    }

    const uri = editor.document.uri;

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
        window.showInformationMessage(`Successfully locked ${resource.fsPath}`);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to lock file");
      }
    });
  }
}
