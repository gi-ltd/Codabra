(function () {
    const vscode = acquireVsCodeApi();

    // Configure marked with highlight.js for code highlighting
    marked.setOptions({
        highlight: function (code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) { }
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true
    });

    // DOM Elements
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const loadingElement = document.getElementById('loading');

    // We'll modify the send button to become a cancel button when needed
    // Store the original send button content
    const sendButtonOriginalHTML = sendButton.innerHTML;
    const sendButtonOriginalTitle = sendButton.title;

    // Define cancel button content
    const cancelButtonHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    `;
    const chatView = document.getElementById('chat-view');
    const pastChatsView = document.getElementById('history-view');
    const pastChatsList = document.getElementById('history-list');
    const settingsView = document.getElementById('settings-view');
    const apiKeyInput = document.getElementById('api-key');
    const extendedThinkingToggle = document.getElementById('extended-thinking');
    const systemPromptInput = document.getElementById('system-prompt');
    const saveSettingsButton = document.getElementById('save-settings-button');
    const contextUsageText = document.getElementById('context-usage-text');
    const contextUsageBar = document.getElementById('context-usage-bar');

    // State
    let currentChat = null;

    // Initialize
    messageInput.focus();

    // No need for auto-resize with single-line input

    // Send message when Enter is pressed (without Shift)
    messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send message when Send button is clicked
    sendButton.addEventListener('click', sendMessage);

    // Save settings
    saveSettingsButton.addEventListener('click', () => {
        vscode.postMessage({
            command: 'saveSettings',
            settings: {
                apiKey: apiKeyInput.value,
                extendedThinking: extendedThinkingToggle.checked,
                systemPrompt: systemPromptInput.value
            }
        });

        chatView.style.display = 'flex';
        settingsView.style.display = 'none';

        // Set the active panel context
        vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'chat-view' });
    });

    // Send message function
    function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            vscode.postMessage({ command: 'sendMessage', text: text });
            messageInput.value = '';
        }
    }

    // Add message to chat
    function addMessage(content, role) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}-message`;

        const contentElement = document.createElement('div');

        // For assistant messages, normalize line breaks and render markdown. Replace multiple consecutive line breaks with a maximum of two
        if (role === 'assistant') {
            const normalizedContent = content.replace(/\n{3,}/g, '\n\n');

            contentElement.className = 'message-content markdown-content';
            contentElement.innerHTML = marked.parse(normalizedContent);

            contentElement.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block)); // Apply syntax highlighting to code blocks
        } else { // For user messages, just use text
            contentElement.className = 'message-content';
            contentElement.textContent = content;
        }

        messageElement.appendChild(contentElement);
        chatContainer.appendChild(messageElement);

        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Function to update streaming content with markdown rendering
    function updateStreamingContent(content) {
        const streamingContent = document.getElementById('streaming-content');
        if (streamingContent) {
            // Normalize line breaks and render markdown
            const normalizedContent = content.replace(/\n{3,}/g, '\n\n');
            streamingContent.innerHTML = marked.parse(normalizedContent);

            // Apply syntax highlighting to code blocks
            streamingContent.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });

            // Scroll to bottom
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
        switch (event.data.command) {
            case 'loadChat':
                currentChat = event.data.chat;
                chatContainer.innerHTML = '';

                // Show the chat view
                pastChatsView.style.display = 'none';
                settingsView.style.display = 'none';
                chatView.style.display = 'flex';

                // Set the active panel context
                vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'chat-view' });

                // Change justification to flex-start when loading a chat with messages
                if (currentChat.messages.length > 0) {
                    chatContainer.style.justifyContent = 'flex-start';
                    currentChat.messages.forEach(msg => addMessage(msg.content, msg.role));
                } else {
                    chatContainer.style.justifyContent = 'center'; // Reset justification to center for empty chats
                    showStartupMessageIfEmpty(); // Show startup message for empty chats
                }
                break;

            case 'addUserMessage':
                addMessage(event.data.message, 'user');
                break;

            case 'addAssistantMessage':
                addMessage(event.data.message, 'assistant');
                break;

            case 'startStreaming':
                // Create a streaming assistant message container
                const streamingMessageElement = document.createElement('div');
                streamingMessageElement.id = 'streaming-message';
                streamingMessageElement.className = 'message assistant-message';

                const streamingContentElement = document.createElement('div');
                streamingContentElement.className = 'message-content markdown-content';
                streamingContentElement.id = 'streaming-content';

                streamingMessageElement.appendChild(streamingContentElement);
                chatContainer.appendChild(streamingMessageElement);

                // Scroll to bottom
                chatContainer.scrollTop = chatContainer.scrollHeight;

                // Disable input and transform send button into cancel button
                messageInput.disabled = true;
                messageInput.style.opacity = '0.6';

                // Transform send button into cancel button
                sendButton.innerHTML = cancelButtonHTML;
                sendButton.title = 'Cancel response';
                sendButton.classList.add('cancel-mode');

                // Change the event listener for the button
                sendButton.onclick = function () {
                    // Send cancellation request to the backend
                    vscode.postMessage({ command: 'cancelStreaming' });

                    // Disable the button to prevent multiple cancellations
                    sendButton.disabled = true;
                    sendButton.style.opacity = '0.5';
                };
                break;

            case 'updateStreamingContent':
                // Update the streaming content with the latest content
                updateStreamingContent(event.data.content);
                break;

            case 'endStreaming':
                // Re-enable input and restore send button
                messageInput.disabled = false;
                messageInput.style.opacity = '1';

                // Restore send button
                sendButton.innerHTML = sendButtonOriginalHTML;
                sendButton.title = sendButtonOriginalTitle;
                sendButton.classList.remove('cancel-mode');
                sendButton.disabled = false;
                sendButton.style.opacity = '1';

                // Restore the original click event
                sendButton.onclick = sendMessage;

                // Remove streaming message element (it will be replaced by the final message)
                const streamingElement = document.getElementById('streaming-message');
                if (streamingElement) {
                    // If the message was cancelled, we'll keep the partial content
                    // and add a cancellation note in the UI
                    if (event.data.cancelled) {
                        // The cancelled message will be loaded via loadChat
                        streamingElement.remove();
                    } else {
                        streamingElement.remove();
                    }
                }
                break;

            case 'loadSettings': // Show the settings view

                chatView.style.display = 'none';
                pastChatsView.style.display = 'none';
                settingsView.style.display = 'block';

                // Set the active panel context
                vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'settings-view' });

                // Load the settings values
                apiKeyInput.value = event.data.settings.apiKey;
                extendedThinkingToggle.checked = event.data.settings.extendedThinking;
                systemPromptInput.value = event.data.settings.systemPrompt || '';
                break;

            case 'showCurrentChat': // Show the chat view

                pastChatsView.style.display = 'none';
                settingsView.style.display = 'none';
                chatView.style.display = 'flex';

                // Set the active panel context
                vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'chat-view' });
                break;

            case 'updateContextUsage': // Update the context usage bar
                updateContextUsage(event.data.used, event.data.total);
                break;

            case 'loadPastChats': // Show the past chats view

                chatView.style.display = 'none';
                settingsView.style.display = 'none';
                pastChatsView.style.display = 'block';

                // Set the active panel context
                vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'history-view' });

                // Load the past chats
                if (event.data.chats && event.data.chats.length > 0) {

                    pastChatsList.innerHTML = '';
                    event.data.chats.forEach(chat => {

                        const chatElement = document.createElement('div');
                        chatElement.className = 'past-chat-item';
                        chatElement.innerHTML = `
                            <div class="chat-title">${chat.title}</div>
                            <div class="chat-date">${new Date(chat.updatedAt).toLocaleString()}</div>
                            <div class="delete-icon" title="Delete chat">
                                <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/>
                                </svg>
                            </div>
                        `;

                        // Add click event for the chat item (excluding the delete icon)
                        chatElement.addEventListener('click', function (e) {
                            // Check if the click was on the delete icon
                            if (e.target.closest('.delete-icon')) {
                                e.stopPropagation(); // Prevent the chat from opening
                                return;
                            }
                            vscode.postMessage({ command: 'openChat', chatId: chat.id });

                            // Show the chat view
                            pastChatsView.style.display = 'none';
                            chatView.style.display = 'flex';

                            // Set the active panel context
                            vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'chat-view' });
                        });

                        // Add click event for the delete icon - directly delete without confirmation since confirm() is not allowed in the sandboxed environment
                        chatElement.querySelector('.delete-icon').addEventListener('click', function (e) {
                            e.stopPropagation(); // Prevent the chat from opening
                            vscode.postMessage({ command: 'deleteChat', chatId: chat.id });
                        });

                        // Also add event listeners to the SVG and path elements to ensure clicks are captured
                        const svg = chatElement.querySelector('.delete-icon').querySelector('svg');

                        if (svg) {
                            svg.addEventListener('click', function (e) {
                                e.stopPropagation(); // Prevent the chat from opening
                                vscode.postMessage({ command: 'deleteChat', chatId: chat.id });
                            });

                            const path = svg.querySelector('path');
                            if (path) {
                                path.addEventListener('click', function (e) {
                                    e.stopPropagation(); // Prevent the chat from opening
                                    vscode.postMessage({ command: 'deleteChat', chatId: chat.id });
                                });
                            }
                        }

                        pastChatsList.appendChild(chatElement);
                    });
                } else
                    pastChatsList.innerHTML = '<div class="loading-message">No past chats found.</div>';
                break;
        }

        // Send a response back to confirm message was received
        try {
            vscode.postMessage({ command: 'messageReceived', originalCommand: event.data.command });
        } catch (e) {
            console.error('Error sending response:', e);
        }
    });

    // Function to show startup message if chat is empty
    function showStartupMessageIfEmpty() {
        if (chatContainer.querySelectorAll('.message').length === 0) {
            const startupMessage = document.createElement('div');
            startupMessage.id = 'startup-message';
            startupMessage.className = 'startup-message';

            startupMessage.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Type your message to start a conversation.</span>
            `;

            chatContainer.innerHTML = '';
            chatContainer.appendChild(startupMessage);
        }
    }

    // Modify addMessage to remove startup message before adding new messages
    const originalAddMessage = addMessage;
    addMessage = function (content, role) {
        if (document.getElementById('startup-message')) { // Remove startup message if it exists
            chatContainer.innerHTML = '';
            chatContainer.style.justifyContent = 'flex-start'; // Change justification to flex-start when messages are added
        }

        // Call the original addMessage function
        originalAddMessage(content, role);
    };

    // Function to update the context usage bar
    function updateContextUsage(used, total) {
        // Format the numbers
        const usedFormatted = used >= 1000 ? (used / 1000).toFixed(0) + 'K' : used;
        const totalFormatted = total >= 1000 ? (total / 1000).toFixed(0) + 'K' : total;

        // Calculate percentage
        const percentage = Math.min(100, Math.round((used / total) * 100));

        // Update the text
        contextUsageText.textContent = `${usedFormatted} / ${totalFormatted} tokens (${percentage}%)`;

        // Update the progress bar
        contextUsageBar.style.width = `${percentage}%`;

        // Change color based on usage
        if (percentage < 70)
            contextUsageBar.style.backgroundColor = 'var(--vscode-progressBar-background)';
        else if (percentage < 90)
            contextUsageBar.style.backgroundColor = 'var(--vscode-editorWarning-foreground)';
        else
            contextUsageBar.style.backgroundColor = 'var(--vscode-editorError-foreground)';
    }

    // Show startup message initially
    showStartupMessageIfEmpty();

    // Initialize context usage
    updateContextUsage(0, 200000);
}());
