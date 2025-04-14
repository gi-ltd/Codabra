import * as vscode from 'vscode';
import { promises as fs } from 'fs';

/**
 * Manages the webview initialization and communication
 */
export class WebviewManager {
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  /**
   * Gets the current webview
   */
  public get view(): vscode.WebviewView | undefined {
    return this._view;
  }

  /**
   * Initializes the webview
   */
  public async initialize(webviewView: vscode.WebviewView): Promise<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'resources')]
    };

    await this.updateWebviewContent(webviewView.webview);
  }

  /**
   * Sends a message to the webview
   */
  public postMessage(message: any): Thenable<boolean> {
    if (!this._view) {
      return Promise.resolve(false);
    }

    return this._view.webview.postMessage(message);
  }

  /**
   * Updates the webview content by loading HTML, CSS, and JS
   */
  private async updateWebviewContent(webview: vscode.Webview): Promise<void> {
    try {
      // Get the resource path. Read the HTML, CSS, and JS content
      const htmlContent = await fs.readFile(vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.html').fsPath, 'utf8');
      const cssContent = await fs.readFile(vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.css').fsPath, 'utf8');
      const jsContent = await fs.readFile(vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.js').fsPath, 'utf8');

      // Find the style tag where we'll inject the CSS
      const styleTagId = 'vscode-css-styles';
      // Find the script tag where we'll inject the JavaScript
      const scriptTagId = 'vscode-js-script';

      let processedHtml = htmlContent;

      // Inject CSS
      if (processedHtml.includes(`id="${styleTagId}"`))
        processedHtml = processedHtml.replace(new RegExp(`<style id="${styleTagId}">.*?</style>`, 's'), `<style id="${styleTagId}">${cssContent}</style>`);
      else
        throw new Error(`Style tag with id="${styleTagId}" not found in HTML template`);

      // Inject JavaScript
      if (processedHtml.includes(`id="${scriptTagId}"`))
        processedHtml = processedHtml.replace(new RegExp(`<script id="${scriptTagId}">.*?</script>`, 's'), `<script id="${scriptTagId}">${jsContent}</script>`);
      else
        throw new Error(`Script tag with id="${scriptTagId}" not found in HTML template`);

      // Set the HTML content
      webview.html = processedHtml;

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load chat view: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
