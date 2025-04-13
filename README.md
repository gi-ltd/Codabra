# Codabra (Preview)

**Codabra** is a simple, clean AI coding assistant for Visual Studio Code that integrates with Anthropic's Claude model to provide intelligent coding assistance directly in your editor. This extension is currently in preview.

## Features

- **AI-Powered Coding Assistant**: Leverage Claude's advanced capabilities to help with coding tasks, debugging, and best practices
- **Clean Chat Interface**: Interact with Claude through a simple, intuitive chat panel in the VSCode sidebar
- **Markdown Support**: View responses with proper formatting, syntax highlighting, and code blocks
- **Chat History**: Access and manage your past conversations
- **Context-Aware**: Automatically includes relevant editor context with your queries
- **Extended Thinking Mode**: Enable Claude's extended thinking capabilities for more complex problems
- **Customizable System Prompt**: Configure the AI's behavior to suit your specific needs

## Installation

1. Install the extension from the Visual Studio Code Marketplace
2. Get an API key from [Anthropic](https://www.anthropic.com/)
3. Configure the extension with your API key

## Requirements

- Visual Studio Code version 1.99.0 or higher
- An Anthropic API key with access to Claude models

## Usage

### Starting a New Chat

1. Click the Codabra icon in the activity bar to open the sidebar
2. Click the "+" icon to start a new chat, or use the keyboard shortcut `Ctrl+Shift+A` (`Cmd+Shift+A` on Mac)
3. Type your question or request in the input field and press Enter

### Viewing Chat History

1. Click the history icon in the sidebar to view your past conversations
2. Click on any past chat to open it
3. Use the delete icon to remove unwanted conversations

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

## Privacy & Security

- Your API key is stored locally in your VSCode settings
- Chat history is stored locally in your VSCode global state
- Code context is only shared with Anthropic's API when you send a message

## License

This project is licensed under the terms specified in the repository.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on the [GitHub repository](https://github.com/gi-ltd/Codabra).
