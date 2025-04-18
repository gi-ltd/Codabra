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
    const settingsView = document.getElementById('settings-view');
    const apiKeyInput = document.getElementById('api-key');
    const extendedThinkingToggle = document.getElementById('extended-thinking');
    const systemPromptInput = document.getElementById('system-prompt');
    const saveSettingsButton = document.getElementById('save-settings-button');
    const contextUsageText = document.getElementById('context-usage-text');
    const contextUsageBar = document.getElementById('context-usage-bar');

    // State
    let currentChat = null;
    let attachedScripts = [];
    const scriptsContainer = document.getElementById('scripts-container');
    const attachScriptButton = document.getElementById('attach-script-button');

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

    // Attach script button click handler
    attachScriptButton.addEventListener('click', function () {
        // Request the active editor content from the extension
        // The extension will handle all fallback mechanisms
        vscode.postMessage({ command: 'getActiveEditorContent' });
    });

    // Function to create a script attachment element
    function createScriptElement(script, language, index) {
        const scriptContainer = document.createElement('div');
        scriptContainer.className = 'script-attachment-container';
        scriptContainer.dataset.index = index;

        const scriptHeader = document.createElement('div');
        scriptHeader.className = 'script-attachment-header';

        const scriptTitle = document.createElement('span');
        scriptTitle.textContent = `Script ${index + 1}: ${language}`;

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-script-button';
        removeButton.title = 'Remove script';
        removeButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;

        // Add click event to remove this specific script
        removeButton.addEventListener('click', function () {
            removeScriptAttachment(index);
        });

        scriptHeader.appendChild(scriptTitle);
        scriptHeader.appendChild(removeButton);

        const scriptContent = document.createElement('pre');
        scriptContent.className = 'script-content';
        scriptContent.textContent = script;

        // Add syntax highlighting if language is available
        if (language && hljs.getLanguage(language)) {
            const codeElement = document.createElement('code');
            codeElement.className = `language-${language}`;
            codeElement.textContent = script;

            // Apply syntax highlighting
            hljs.highlightElement(codeElement);

            // Clear and append the highlighted code
            scriptContent.innerHTML = '';
            scriptContent.appendChild(codeElement);
        }

        scriptContainer.appendChild(scriptHeader);
        scriptContainer.appendChild(scriptContent);

        return scriptContainer;
    }

    // Function to add a script attachment
    function addScriptAttachment(script, language) {
        // Validate inputs
        if (!script) {
            console.warn('Attempted to add empty script');
            return;
        }

        // Normalize language
        const normalizedLanguage = language || 'text';

        // Limit script size to prevent performance issues (100KB limit)
        const MAX_SCRIPT_SIZE = 100 * 1024;
        let scriptContent = script;
        if (script.length > MAX_SCRIPT_SIZE) {
            scriptContent = script.substring(0, MAX_SCRIPT_SIZE) +
                '\n\n// Note: Script was truncated due to size limitations';
            console.warn(`Script truncated from ${script.length} to ${MAX_SCRIPT_SIZE} characters`);
        }

        // Add to the scripts array with a unique ID
        const scriptId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        attachedScripts.push({
            id: scriptId,
            content: scriptContent,
            language: normalizedLanguage
        });

        // Limit the number of scripts to prevent performance issues
        const MAX_SCRIPTS = 5;
        if (attachedScripts.length > MAX_SCRIPTS) {
            attachedScripts.shift(); // Remove the oldest script
            console.warn(`Maximum script limit (${MAX_SCRIPTS}) reached, removed oldest script`);
        }

        // Create the script element
        const scriptElement = createScriptElement(scriptContent, normalizedLanguage, attachedScripts.length - 1);

        // Add to the container
        scriptsContainer.appendChild(scriptElement);

        // Add "Add Another Script" button if it doesn't exist and this is the first script
        if (attachedScripts.length === 1) {
            addAnotherScriptButton();
        }

        // Return the script ID for reference
        return scriptId;
    }

    // Function to add the "Add Another Script" button
    function addAnotherScriptButton() {
        // Check if button already exists
        if (document.getElementById('add-another-script-button')) {
            return;
        }

        // Check if we've reached the maximum number of scripts
        const MAX_SCRIPTS = 5;
        if (attachedScripts.length >= MAX_SCRIPTS) {
            return; // Don't add the button if we've reached the limit
        }

        const addButton = document.createElement('button');
        addButton.id = 'add-another-script-button';
        addButton.className = 'add-another-script-button';
        addButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Another Script
        `;

        // Add click event to add another script
        addButton.addEventListener('click', function () {
            // Request to select a different file
            vscode.postMessage({ command: 'selectFileForScript' });
        });

        scriptsContainer.appendChild(addButton);
    }

    // Function to remove a script attachment
    function removeScriptAttachment(index) {
        // Validate index
        if (index < 0 || index >= attachedScripts.length) {
            console.warn(`Invalid script index: ${index}`);
            return;
        }

        try {
            // Remove from the array
            attachedScripts.splice(index, 1);

            // Rebuild the UI
            updateScriptAttachmentsUI();
        } catch (error) {
            console.error('Error removing script attachment:', error);

            // Fallback: clear all scripts and rebuild from scratch
            clearAllScriptAttachments();
        }
    }

    // Function to update the script attachments UI
    function updateScriptAttachmentsUI() {
        try {
            // Clear the container
            scriptsContainer.innerHTML = '';

            // Add each script
            attachedScripts.forEach((script, index) => {
                if (!script || !script.content) {
                    console.warn(`Invalid script at index ${index}, skipping`);
                    return;
                }

                const scriptElement = createScriptElement(script.content, script.language || 'text', index);
                scriptsContainer.appendChild(scriptElement);
            });

            // Add the "Add Another Script" button if there are scripts
            if (attachedScripts.length > 0) {
                addAnotherScriptButton();
            }
        } catch (error) {
            console.error('Error updating script attachments UI:', error);

            // Fallback: clear everything
            scriptsContainer.innerHTML = '';
        }
    }

    // Function to clear all script attachments
    function clearAllScriptAttachments() {
        attachedScripts = [];
        scriptsContainer.innerHTML = '';
    }

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
            // Create message object
            const messageData = {
                command: 'sendMessage',
                text: text
            };

            // Add script attachments if present
            if (attachedScripts.length > 0) {
                messageData.scripts = attachedScripts;
            }

            // Send message to extension
            vscode.postMessage(messageData);

            // Clear input and script attachments
            messageInput.value = '';
            clearAllScriptAttachments();
        }
    }

    // Add message to chat
    function addMessage(content, role, scripts) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}-message`;

        const contentElement = document.createElement('div');

        // For assistant messages, normalize line breaks and render markdown. Replace multiple consecutive line breaks with a maximum of two
        if (role === 'assistant') {
            const normalizedContent = content.replace(/\n{3,}/g, '\n\n');

            contentElement.className = 'message-content markdown-content';
            contentElement.innerHTML = marked.parse(normalizedContent);

            contentElement.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block)); // Apply syntax highlighting to code blocks

            messageElement.appendChild(contentElement);
        } else { // For user messages, just use text
            contentElement.className = 'message-content';
            contentElement.textContent = content;
            messageElement.appendChild(contentElement);

            // Handle script attachments
            if (scripts) {
                // If scripts is an array, handle multiple scripts
                if (Array.isArray(scripts)) {
                    scripts.forEach((script, index) => {
                        addScriptToMessage(messageElement, script, index);
                    });
                }
                // If scripts is a single object, handle it as a single script (for backward compatibility)
                else if (typeof scripts === 'object' && scripts.content) {
                    addScriptToMessage(messageElement, scripts, 0);
                }
            }
        }

        chatContainer.appendChild(messageElement);

        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Helper function to add a script to a message
    function addScriptToMessage(messageElement, script, index) {
        try {
            // Validate script object
            if (!script || typeof script !== 'object') {
                console.warn('Invalid script object:', script);
                return;
            }

            // Ensure script has content
            if (!script.content) {
                console.warn('Script missing content:', script);
                return;
            }

            // Normalize language
            const language = script.language || 'text';

            // Create script element
            const scriptElement = document.createElement('div');
            scriptElement.className = 'message-script-attachment';

            // Create header
            const scriptHeader = document.createElement('div');
            scriptHeader.className = 'message-script-header';

            // Determine header text based on context
            let headerText;
            if (Array.isArray(script.scripts) && script.scripts.length > 1) {
                headerText = `Attached Script ${index + 1}: ${language}`;
            } else {
                headerText = `Attached Script (${language}):`;
            }

            scriptHeader.textContent = headerText;

            // Create content container
            const scriptContent = document.createElement('pre');
            scriptContent.className = 'message-script-content';

            // Create code element with syntax highlighting
            const codeElement = document.createElement('code');

            // Apply language class if available in highlight.js
            if (language && hljs.getLanguage(language)) {
                codeElement.className = `language-${language}`;
            } else {
                // Fallback to text or auto-detection
                codeElement.className = 'language-text';
            }

            // Limit content size for performance
            const MAX_DISPLAY_SIZE = 50 * 1024; // 50KB
            let displayContent = script.content;

            if (displayContent.length > MAX_DISPLAY_SIZE) {
                displayContent = displayContent.substring(0, MAX_DISPLAY_SIZE) +
                    '\n\n// Note: Script display was truncated due to size limitations';
            }

            // Set content and apply highlighting
            codeElement.textContent = displayContent;

            try {
                hljs.highlightElement(codeElement);
            } catch (highlightError) {
                console.warn('Error highlighting code:', highlightError);
                // Fallback to plain text if highlighting fails
                codeElement.className = '';
            }

            // Assemble the elements
            scriptContent.appendChild(codeElement);
            scriptElement.appendChild(scriptHeader);
            scriptElement.appendChild(scriptContent);

            // Add the script element after the content element
            messageElement.appendChild(scriptElement);
        } catch (error) {
            console.error('Error adding script to message:', error);
            // Don't add anything if there's an error
        }
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
            case 'activeEditorContent':
                // Add the active editor content as a script attachment
                if (event.data.content) {
                    addScriptAttachment(event.data.content, event.data.language);
                }
                break;

            case 'loadChat':
                currentChat = event.data.chat;
                chatContainer.innerHTML = '';

                // Show the chat view
                settingsView.style.display = 'none';
                chatView.style.display = 'flex';

                // Set the active panel context
                vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'chat-view' });

                // Change justification to flex-start when loading a chat with messages
                if (currentChat.messages.length > 0) {
                    chatContainer.style.justifyContent = 'flex-start';
                    currentChat.messages.forEach(msg => addMessage(msg.content, msg.role, msg.script));
                } else {
                    chatContainer.style.justifyContent = 'center'; // Reset justification to center for empty chats
                    showStartupMessageIfEmpty(); // Show startup message for empty chats
                }
                break;

            case 'addUserMessage':
                addMessage(event.data.message, 'user', event.data.script);
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

                // Disable input, attachment button, and transform send button into cancel button
                messageInput.disabled = true;
                messageInput.style.opacity = '0.6';
                attachScriptButton.disabled = true;
                attachScriptButton.style.opacity = '0.6';

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
                // Re-enable input, attachment button, and restore send button
                messageInput.disabled = false;
                messageInput.style.opacity = '1';
                attachScriptButton.disabled = false;
                attachScriptButton.style.opacity = '1';

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
                settingsView.style.display = 'block';

                // Set the active panel context
                vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'settings-view' });

                // Load the settings values
                apiKeyInput.value = event.data.settings.apiKey;
                extendedThinkingToggle.checked = event.data.settings.extendedThinking;
                systemPromptInput.value = event.data.settings.systemPrompt || '';
                break;

            case 'showCurrentChat': // Show the chat view

                settingsView.style.display = 'none';
                chatView.style.display = 'flex';

                // Set the active panel context
                vscode.postMessage({ command: 'setContext', key: 'activeWebviewPanelId', value: 'chat-view' });
                break;

            case 'updateContextUsage': // Update the context usage bar
                updateContextUsage(event.data.used, event.data.total);
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
    addMessage = function (content, role, script) {
        if (document.getElementById('startup-message')) { // Remove startup message if it exists
            chatContainer.innerHTML = '';
            chatContainer.style.justifyContent = 'flex-start'; // Change justification to flex-start when messages are added
        }

        // Call the original addMessage function
        originalAddMessage(content, role, script);
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
