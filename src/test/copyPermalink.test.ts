import * as assert from "assert";
import * as fs from "original-fs";
import * as path from "path";
import { commands, env, Uri, window, workspace } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { Repository } from "../repository";
import * as testUtil from "./testUtil";
import { timeout } from "../util";

suite("Copy Permalink Tests", () => {
  let repoUri: Uri;
  let checkoutDir: Uri;
  let sourceControlManager: SourceControlManager;
  let testFilePath: string;

  suiteSetup(async function() {
    this.timeout(30000);

    await testUtil.activeExtension();

    repoUri = await testUtil.createRepoServer();
    await testUtil.createStandardLayout(testUtil.getSvnUrl(repoUri));
    checkoutDir = await testUtil.createRepoCheckout(
      testUtil.getSvnUrl(repoUri) + "/trunk"
    );

    sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      checkoutDir
    )) as SourceControlManager;

    await sourceControlManager.tryOpenRepository(checkoutDir.fsPath);

    testFilePath = path.join(checkoutDir.fsPath, "test_permalink.txt");
    fs.writeFileSync(testFilePath, "test content for permalink");

    const repository = sourceControlManager.getRepository(
      checkoutDir
    ) as Repository;

    await commands.executeCommand("svn.refresh");
    
    const resource = repository.unversioned.resourceStates.find(
      r => r.resourceUri.fsPath === testFilePath
    );
    if (resource) {
      await commands.executeCommand("svn.add", resource);
    }

    repository.inputBox.value = "Add test file for permalink";
    await commands.executeCommand("svn.commitWithMessage");
    await timeout(1000);
  });

  suiteTeardown(() => {
    sourceControlManager.openRepositories.forEach(repository =>
      repository.dispose()
    );
    testUtil.destroyAllTempPaths();
  });

  test("Copy Permalink - Success", async function() {
    this.timeout(10000);

    const document = await workspace.openTextDocument(testFilePath);
    await window.showTextDocument(document);

    await commands.executeCommand("svn.copyPermalink");

    await timeout(500);

    const clipboard = (env as any).clipboard;
    if (clipboard) {
      const copiedText = await clipboard.readText();

      assert.ok(copiedText, "Clipboard should not be empty");
      
      const expectedPattern = /^file:\/\/\/tmp\/svn_server_-[^/]+\/trunk\/test_permalink\.txt\?p=2&r=2$/;
      assert.ok(expectedPattern.test(copiedText), `Permalink should match expected format: ${copiedText}`);
      
      console.log(`✓ Permalink copied successfully: ${copiedText}`);
    }
  });

  test("Copy Permalink - No Active Editor", async function() {
    this.timeout(10000);

    await commands.executeCommand("workbench.action.closeAllEditors");
    await timeout(500);

    await commands.executeCommand("svn.copyPermalink");

    // The command should show an error message but not throw
    // We can't easily test the error message, but we can verify it doesn't crash
    await timeout(500);
  });

  test("Copy Permalink - Modified File", async function() {
    this.timeout(10000);

    const originalContent = fs.readFileSync(testFilePath, "utf8");

    const document = await workspace.openTextDocument(testFilePath);
    await window.showTextDocument(document);

    fs.appendFileSync(testFilePath, "\nmodified content");
    await timeout(500);

    await commands.executeCommand("svn.copyPermalink");
    await timeout(500);

    const clipboard = (env as any).clipboard;
    if (clipboard) {
      const copiedText = await clipboard.readText();

      assert.ok(copiedText, "Clipboard should not be empty");
      assert.ok(copiedText.includes("?p="), "Permalink should contain ?p= parameter");
      
      console.log(`✓ Permalink for modified file: ${copiedText}`);
    }

    fs.writeFileSync(testFilePath, originalContent);
  });
});
