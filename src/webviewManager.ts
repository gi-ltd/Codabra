import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { EventManager } from './utils/eventManager';
import { handleError } from './utils/errorHandler';

export class WebviewManager {
  private _view?: vscode.WebviewView;
  private _panel?: vscode.WebviewPanel;
  public disposables: vscode.Disposable[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public get view(): vscode.WebviewView | undefined {
    return this._view;
  }

  public get webview(): vscode.Webview | undefined {
    return this._panel?.webview || this._view?.webview;
  }

  public async initialize(webviewView: vscode.WebviewView): Promise<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src/resources')]
    };

    await this.updateWebviewContent(webviewView.webview);
  }

  public async initializePanel(panel: vscode.WebviewPanel): Promise<void> {
    this._panel = panel;

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src/resources')]
    };

    await this.updateWebviewContent(panel.webview);
  }

  public postMessage(message: any): Thenable<boolean> {
    if (this._panel) {
      // Use the simplified EventManager to handle debouncing
      EventManager.postMessageToWebview(this._panel.webview, message);
      return Promise.resolve(true);
    } else if (this._view) {
      // Use the simplified EventManager to handle debouncing
      EventManager.postMessageToWebview(this._view.webview, message);
      return Promise.resolve(true);
    }

    // Return a resolved promise since the actual message might be sent after debounce
    return Promise.resolve(false);
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
