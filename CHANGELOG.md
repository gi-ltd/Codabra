# Change Log

All notable changes to the "Codabra" extension will be documented in this file.

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
