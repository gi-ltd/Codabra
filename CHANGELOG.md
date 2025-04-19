# Change Log

All notable changes to the "Codabra" extension will be documented in this file.

## [1.2.0] - 2025-04-19

### Added
- Code blocks now have a copy button that appears on hover, allowing users to easily copy code to clipboard
- Added visual feedback when copying code (success/failure indicators)

### Changed
- Improved code block styling to match VSCode's native appearance
- Enhanced code block readability with better colors and formatting
- Applied consistent styling across all types of code blocks (markdown, script attachments, streaming content)

## [1.1.0] - 2025-04-19

### Changed
- Removed preview status - Codabra is now considered stable
- Fixed dependency issues with @anthropic-ai/sdk and its dependencies that were causing activation failures
- Improved extension packaging to include all dependencies for maximum compatibility

## [1.0.8] - 2025-04-19

### Changed
- Bug fixes and performance improvements

## [1.0.7] - 2025-04-18

### Changed
- The extention now opens as a tab
- Changed hotkey for opening chat from Ctrl+Shift+A to Ctrl+Shift+Z

## [1.0.6] - 2025-04-18

### Removed
- Chat history

## [1.0.5] - 2025-04-18

### Changed
- Bug fixes and performance improvements

## [1.0.4] - 2025-04-18

### Changed
- Reduced minimum VSCode version requirement from 1.99.0 to 1.60.0 for better compatibility with older VSCode installations
- Improved token counting by removing estimation fallback for more accurate context usage tracking

## [1.0.3] - 2025-04-18

### Added
- Script attachment feature that allows users to attach code from the active editor to their messages
- Support for attaching multiple scripts to a single message
- File picker dialog for selecting additional files from anywhere on the system
- UI for displaying attached scripts with syntax highlighting
- "Add Another Script" button for attaching additional files
- Improved message formatting to clearly show attached scripts
- Enhanced editor detection to find content from any visible editor
- Manual code input option when no editor is available
- Automatic file picker prompt when no editor is found

## [1.0.2] - 2025-04-15

### Changed
- Bug fixes and performance improvements

## [1.0.1] - 2025-04-14

### Added
- Context usage tracking with visual progress bar
- Color-coded progress bar to indicate token usage levels
- Real-time updates of context usage during conversations

### Changed
- Refactored codebase into a more modular architecture
- Improved separation of concerns with specialized manager classes
- Enhanced resource management and cleanup
- Better error handling and null safety
- Added comprehensive code comments

## [1.0.0] - 2025-04-13

### Added
- Initial release of Codabra
- Chat interface for interacting with Claude AI
- Support for markdown rendering in responses
- Code syntax highlighting
- Chat history management
- Context-aware queries that include editor information
- Extended thinking mode toggle
- Customizable system prompt
- Settings management
