# Codabra (Preview)

**Codabra** is a simple, clean AI coding assistant for Visual Studio Code that integrates with Anthropic's Claude model to provide intelligent coding assistance directly in your editor. This extension is currently in preview.

## Features

- **AI-Powered Coding Assistant**: Leverage Claude's advanced capabilities to help with coding tasks, debugging, and best practices
- **Clean Chat Interface**: Interact with Claude through a simple, intuitive chat panel in the VSCode sidebar
- **Script Attachments**: Attach code from your active editor to your messages for more targeted assistance
- **Markdown Support**: View responses with proper formatting, syntax highlighting, and code blocks
- **Context-Aware**: Automatically includes relevant editor context with your queries
- **Extended Thinking Mode**: Enable Claude's extended thinking capabilities for more complex problems
- **Customizable System Prompt**: Configure the AI's behavior to suit your specific needs
- **Context Usage Tracking**: Monitor your token usage with a visual progress bar

## Installation

1. Install the extension from the Visual Studio Code Marketplace
2. Get an API key from [Anthropic](https://www.anthropic.com/)
3. Configure the extension with your API key

## Requirements

- Visual Studio Code version 1.63.0 or higher
- An Anthropic API key with access to Claude models

## Usage

### Starting a New Chat

2. Click the "+" icon to start a new chat, or use the keyboard shortcut `Ctrl+Shift+Z` (`Cmd+Shift+Z` on Mac)
3. Type your question or request in the input field and press Enter

### Attaching Scripts

1. Open a file in the editor that contains code you want to discuss
2. Click the paperclip icon next to the message input field
3. The content of the active editor will be attached to your message
4. To attach additional files, click the "Add Another Script" button that appears
   - This will open a file picker dialog allowing you to select any file from your system
5. Type your question about the code and send the message
6. All attached scripts will be displayed with your message and included in Claude's context

If no active editor is found, Codabra will:
1. Try to use content from any visible editor
2. If no editor is available, prompt you to open a file
3. Provide a manual input option where you can paste or type code directly

The file picker dialog allows you to select files from anywhere on your system, not just open editors, making it easy to discuss multiple related files even if they're not currently open.

This feature is particularly useful when you need to discuss multiple related files, such as:
- A component and its stylesheet
- A class and its test file
- A frontend component and its backend API
- Multiple files that work together in a complex feature

### Configuring Settings

1. Click the gear icon in the sidebar to open settings
2. Enter your Anthropic API key
3. Toggle Extended Thinking mode on/off
4. Customize the system prompt to change Claude's behavior
5. Click "Save" to apply your changes

## Configuration Options

### API Key

Your Anthropic API key is required to use the extension. This key is stored securely in your VSCode settings.

### Extended Thinking

When enabled, this option allows Claude to use its extended thinking capabilities, which can be helpful for more complex problems. This uses Claude 3.7 Sonnet's thinking feature.

### System Prompt

The system prompt defines how Claude behaves when responding to your queries. You can customize this to make Claude more focused on specific programming languages, frameworks, or coding styles.

### Context Usage Tracking

The context usage bar displays how much of Claude's context window is being used by your conversation. This helps you monitor your token usage and avoid hitting the context limit (200K tokens). The progress bar changes color based on usage:
- Green: Normal usage (below 70%)
- Yellow: Moderate usage (70-90%)
- Red: High usage (above 90%)

When you approach the context limit, consider starting a new chat to reset the context window.

## Privacy & Security

- Your API key is stored locally in your VSCode settings
- Code context is only shared with Anthropic's API when you send a message

## License

This project is licensed under the terms specified in the repository.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Architecture

Codabra follows a modular architecture with clear separation of concerns:

- **ApiService**: Manages communication with the Anthropic API
- **ChatManager**: Manages chat operations (creating, loading, sending messages)
- **ChatPanel**: Coordinates between specialized components and handles UI rendering
- **ContextUsageTracker**: Tracks and updates token usage
- **SettingsManager**: Handles settings operations and configuration
- **WebviewManager**: Handles webview initialization and communication
- **Extension**: Main entry point that registers commands and activates components
- **Utils**:
  - **ErrorHandler**: Centralizes error handling and reporting
  - **EventManager**: Manages custom events and subscriptions
  - **LockManager**: Handles concurrency and prevents race conditions
  - **ResourceManager**: Manages loading and disposal of resources

This architecture makes the codebase more maintainable and easier to extend with new features.

## Support

If you encounter any issues or have questions, please open an issue on the [GitHub repository](https://github.com/gi-ltd/Codabra).
