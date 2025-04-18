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
   * Injects CSS and JS content into HTML using a simple regex approach
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
      // Use regex to find and replace the content between the style and script tags
      const styleRegex = new RegExp(`(<style\\s+id=["']${styleId}["'][^>]*>)(.*?)(<\\/style>)`, 'is');
      const scriptRegex = new RegExp(`(<script\\s+id=["']${scriptId}["'][^>]*>)(.*?)(<\\/script>)`, 'is');

      // Replace the content between the tags
      let processedHtml = html
        .replace(styleRegex, `$1${cssContent}$3`)
        .replace(scriptRegex, `$1${jsContent}$3`);

      // Verify that the replacements were successful
      if (!processedHtml.includes(cssContent) || !processedHtml.includes(jsContent)) {
        throw new Error('Content injection failed: Could not find or replace style or script tags');
      }

      return processedHtml;
    } catch (error) {
      console.error('Error injecting content:', error);

      // Fallback to a simpler approach if the regex fails
      const styleTagStart = `<style id="${styleId}">`;
      const styleTagEnd = `</style>`;
      const scriptTagStart = `<script id="${scriptId}">`;
      const scriptTagEnd = `</script>`;

      // Check if the tags exist in the HTML
      if (!html.includes(styleTagStart) || !html.includes(scriptTagStart)) {
        throw new Error(`Failed to inject content: Could not find style or script tags with IDs ${styleId} and ${scriptId}`);
      }

      // Find positions to do targeted replacements
      const styleStartPos = html.indexOf(styleTagStart) + styleTagStart.length;
      const styleEndPos = html.indexOf(styleTagEnd, styleStartPos);
      const scriptStartPos = html.indexOf(scriptTagStart) + scriptTagStart.length;
      const scriptEndPos = html.indexOf(scriptTagEnd, scriptStartPos);

      if (styleStartPos === -1 || styleEndPos === -1 || scriptStartPos === -1 || scriptEndPos === -1) {
        throw new Error('Failed to find tag positions for content injection');
      }

      // Replace the content between the tags
      let result = html.substring(0, styleStartPos) +
        cssContent +
        html.substring(styleEndPos, scriptStartPos) +
        jsContent +
        html.substring(scriptEndPos);

      return result;
    }
  }
}
