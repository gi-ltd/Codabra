import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { EventManager } from './utils/eventManager';
import { handleError } from './utils/errorHandler';

export class WebviewManager {
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public get view(): vscode.WebviewView | undefined {
    return this._view;
  }

  public async initialize(webviewView: vscode.WebviewView): Promise<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src/resources')]
    };

    await this.updateWebviewContent(webviewView.webview);
  }

  public postMessage(message: any): Thenable<boolean> {
    if (!this._view) {
      return Promise.resolve(false);
    }

    // Use the simplified EventManager to handle debouncing
    EventManager.postMessageToWebview(this._view.webview, message);

    // Return a resolved promise since the actual message might be sent after debounce
    return Promise.resolve(true);
  }

  /**
   * Updates the webview content by safely injecting CSS and JS into the HTML template
   * @param webview The webview to update
   */
  private async updateWebviewContent(webview: vscode.Webview): Promise<void> {
    try {
      // Read the HTML, CSS, and JS files
      const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'src/resources', 'chat-panel.html').fsPath;
      const cssPath = vscode.Uri.joinPath(this._extensionUri, 'src/resources', 'chat-panel.css').fsPath;
      const jsPath = vscode.Uri.joinPath(this._extensionUri, 'src/resources', 'chat-panel.js').fsPath;

      const [htmlContent, cssContent, jsContent] = await Promise.all([
        fs.readFile(htmlPath, 'utf8'),
        fs.readFile(cssPath, 'utf8'),
        fs.readFile(jsPath, 'utf8')
      ]);

      // Create a simple template replacement
      const processedHtml = htmlContent
        .replace('/* STYLE_PLACEHOLDER */', cssContent)
        .replace('// SCRIPT_PLACEHOLDER', jsContent);

      webview.html = processedHtml;
    } catch (error) {
      handleError(error, 'updating webview content');
      throw error;
    }
  }

}
