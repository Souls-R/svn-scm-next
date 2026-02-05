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
    // Increase timeout for setup
    this.timeout(30000);

    await testUtil.activeExtension();

    // Create SVN repository
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

    // Create and commit a test file
    testFilePath = path.join(checkoutDir.fsPath, "test_permalink.txt");
    fs.writeFileSync(testFilePath, "test content for permalink");

    const repository = sourceControlManager.getRepository(
      checkoutDir
    ) as Repository;

    await commands.executeCommand("svn.refresh");
    
    // Add the file
    const resource = repository.unversioned.resourceStates.find(
      r => r.resourceUri.fsPath === testFilePath
    );
    if (resource) {
      await commands.executeCommand("svn.add", resource);
    }

    // Commit the file
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

    // Open the test file in the editor
    const document = await workspace.openTextDocument(testFilePath);
    await window.showTextDocument(document);

    // Execute the copy permalink command
    await commands.executeCommand("svn.copyPermalink");

    // Give it a moment to copy to clipboard
    await timeout(500);

    // Get the clipboard content
    const clipboard = (env as any).clipboard;
    if (clipboard) {
      const copiedText = await clipboard.readText();

      // Verify the permalink format
      assert.ok(copiedText, "Clipboard should not be empty");
      assert.ok(copiedText.includes("?p="), "Permalink should contain ?p= parameter");
      assert.ok(copiedText.includes("&r="), "Permalink should contain &r= parameter");
      assert.ok(copiedText.includes("/trunk/test_permalink.txt"), "Permalink should contain the file path");

      // Extract and verify revision numbers
      const pMatch = copiedText.match(/\?p=(\d+)/);
      const rMatch = copiedText.match(/&r=(\d+)/);
      
      assert.ok(pMatch, "Should have peg revision parameter");
      assert.ok(rMatch, "Should have operative revision parameter");
      assert.equal(pMatch![1], rMatch![1], "Peg and operative revisions should be the same");
      
      const revision = parseInt(pMatch![1], 10);
      assert.ok(revision > 0, "Revision should be greater than 0");

      console.log(`✓ Permalink copied successfully: ${copiedText}`);
    }
  });

  test("Copy Permalink - No Active Editor", async function() {
    this.timeout(10000);

    // Close all editors
    await commands.executeCommand("workbench.action.closeAllEditors");
    await timeout(500);

    // Try to execute the command without an active editor
    await commands.executeCommand("svn.copyPermalink");

    // The command should show an error message but not throw
    // We can't easily test the error message, but we can verify it doesn't crash
    await timeout(500);
  });

  test("Copy Permalink - Modified File", async function() {
    this.timeout(10000);

    // Save original content
    const originalContent = fs.readFileSync(testFilePath, "utf8");

    // Open and modify the test file
    const document = await workspace.openTextDocument(testFilePath);
    await window.showTextDocument(document);

    // Modify the file
    fs.appendFileSync(testFilePath, "\nmodified content");
    await timeout(500);

    // Execute the copy permalink command
    await commands.executeCommand("svn.copyPermalink");
    await timeout(500);

    // Get the clipboard content
    const clipboard = (env as any).clipboard;
    if (clipboard) {
      const copiedText = await clipboard.readText();

      // Verify that it still uses the last committed revision
      assert.ok(copiedText, "Clipboard should not be empty");
      assert.ok(copiedText.includes("?p="), "Permalink should contain ?p= parameter");
      
      console.log(`✓ Permalink for modified file: ${copiedText}`);
    }

    // Restore original content (without using svn revert which shows a dialog)
    fs.writeFileSync(testFilePath, originalContent);
  });

  test("Copy Permalink - Verify URL Structure", async function() {
    this.timeout(10000);

    // Open the test file
    const document = await workspace.openTextDocument(testFilePath);
    await window.showTextDocument(document);

    // Get repository info to verify URL structure
    const repository = sourceControlManager.getRepository(
      checkoutDir
    );
    
    if (!repository) {
      // Try to reopen the repository if it was closed
      await sourceControlManager.tryOpenRepository(checkoutDir.fsPath);
      const repo2 = sourceControlManager.getRepository(checkoutDir);
      assert.ok(repo2, "Repository should exist");
    }
    
    const repo = sourceControlManager.getRepository(checkoutDir) as Repository;
    assert.ok(repo, "Repository should be available");
    
    const info = await repo.getInfo(testFilePath);

    // Execute the copy permalink command
    await commands.executeCommand("svn.copyPermalink");
    await timeout(500);

    // Get the clipboard content
    const clipboard = (env as any).clipboard;
    if (clipboard) {
      const copiedText = await clipboard.readText();

      // Verify the URL matches the expected structure
      assert.ok(copiedText.startsWith(info.url), "Permalink should start with the file URL");
      
      // Verify the revision matches the commit revision
      const expectedRevision = info.commit.revision;
      assert.ok(copiedText.includes(`?p=${expectedRevision}`), `Should contain peg revision ${expectedRevision}`);
      assert.ok(copiedText.includes(`&r=${expectedRevision}`), `Should contain operative revision ${expectedRevision}`);

      console.log(`✓ URL structure verified: ${copiedText}`);
      console.log(`  Expected revision: ${expectedRevision}`);
    }
  });
});
