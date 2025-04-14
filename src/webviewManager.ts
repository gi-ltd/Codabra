import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { JSDOM } from 'jsdom';
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
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'resources')]
    };

    await this.updateWebviewContent(webviewView.webview);
  }

  public postMessage(message: any): Thenable<boolean> {
    if (!this._view) {
      return Promise.resolve(false);
    }

    if (message.command && EventManager.DEBOUNCE_COMMANDS.includes(message.command)) {
      // Use EventManager to debounce specific commands
      EventManager.debounce(`webview-message-${message.command}`, () => {
        if (this._view) {
          this._view.webview.postMessage(message);
        }
      }, 100);

      // Return a resolved promise since the actual message will be sent after debounce
      return Promise.resolve(true);
    } else {
      // For other commands, post immediately
      return this._view.webview.postMessage(message);
    }
  }

  /**
   * Updates the webview content by safely injecting CSS and JS into the HTML template
   * @param webview The webview to update
   */
  private async updateWebviewContent(webview: vscode.Webview): Promise<void> {
    try {
      // Read the HTML, CSS, and JS files
      const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.html').fsPath;
      const cssPath = vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.css').fsPath;
      const jsPath = vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.js').fsPath;

      const [htmlContent, cssContent, jsContent] = await Promise.all([
        fs.readFile(htmlPath, 'utf8'),
        fs.readFile(cssPath, 'utf8'),
        fs.readFile(jsPath, 'utf8')
      ]);

      // Define the tag IDs
      const styleTagId = 'vscode-css-styles';
      const scriptTagId = 'vscode-js-script';

      // Process the HTML content
      let processedHtml = this.injectContent(
        htmlContent,
        styleTagId,
        scriptTagId,
        cssContent,
        jsContent
      );

      // Set the processed HTML to the webview
      webview.html = processedHtml;
    } catch (error) {
      // Use standardized error handling
      handleError(error, 'updating webview content');
      throw error;
    }
  }

  /**
   * Safely injects CSS and JS content into HTML using DOM parsing
   * This is more robust than regex-based replacement
   * @param html The HTML template
   * @param styleId The ID of the style tag
   * @param scriptId The ID of the script tag
   * @param cssContent The CSS content to inject
   * @param jsContent The JS content to inject
   * @returns The processed HTML with injected content
   */
  private injectContent(
    html: string,
    styleId: string,
    scriptId: string,
    cssContent: string,
    jsContent: string
  ): string {
    try {
      // Create a DOM parser
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Find the style tag by ID
      const styleTag = document.getElementById(styleId);
      if (!styleTag) {
        throw new Error(`Style tag with id="${styleId}" not found in HTML template`);
      }

      // Find the script tag by ID
      const scriptTag = document.getElementById(scriptId);
      if (!scriptTag) {
        throw new Error(`Script tag with id="${scriptId}" not found in HTML template`);
      }

      // Update the content
      styleTag.textContent = cssContent;
      scriptTag.textContent = jsContent;

      // Serialize the document back to HTML
      return dom.serialize();
    } catch (error) {
      console.error('Error using DOM parser, falling back to regex-based replacement:', error);

      // Fallback to regex-based replacement if DOM parsing fails
      // Find the style tag
      const styleTagRegex = new RegExp(`<style\\s+[^>]*id=["']${styleId}["'][^>]*>([\\s\\S]*?)<\\/style>`, 'i');
      const styleMatch = html.match(styleTagRegex);

      if (!styleMatch) {
        throw new Error(`Style tag with id="${styleId}" not found in HTML template`);
      }

      // Find the script tag
      const scriptTagRegex = new RegExp(`<script\\s+[^>]*id=["']${scriptId}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i');
      const scriptMatch = html.match(scriptTagRegex);

      if (!scriptMatch) {
        throw new Error(`Script tag with id="${scriptId}" not found in HTML template`);
      }

      // Replace the content of the style tag
      return html
        .replace(styleMatch[0], `<style id="${styleId}">${cssContent}</style>`)
        .replace(scriptMatch[0], `<script id="${scriptId}">${jsContent}</script>`);
    }
  }
}
