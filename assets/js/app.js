// CTFBot - Main JavaScript file
// This implements the Gemini API integration and UI functionality

// Constants and configuration
const DEFAULT_API_KEY = ""; // No default API key - users must provide their own
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1";
const MODEL_NAME = "gemini-pro";
const API_URL = `${API_BASE_URL}/models/${MODEL_NAME}:generateContent`;
const MAX_HISTORY_LENGTH = 20; // Maximum number of messages to keep in history
const DEFAULT_SYSTEM_PROMPT = `You are CTFBot, an expert AI assistant specializing in Capture The Flag (CTF) competitions and cybersecurity challenges. Your purpose is to help users analyze challenges, provide hints without giving away complete solutions unless asked, and explain security concepts.
Focus on these areas:
- Challenge analysis: Determine the likely category and potential techniques to solve
- Cryptography: Cipher identification, encoding/decoding techniques, cryptanalysis
- Web exploitation: XSS, CSRF, SQLi, command injection, etc.
- Binary exploitation: Buffer overflows, format string vulnerabilities, ROP chains
- Reverse engineering: Understanding assembly code, decompiling, deobfuscation
- Forensics: File analysis, steganography, network traffic analysis, memory forensics
- OSINT: Open-source intelligence techniques and resources
- Miscellaneous: Common CTF tricks and tools

Whenever you're presented with challenge text or files, analyze and suggest possible approaches. For code, explain what it does and potential vulnerabilities.`;

// State management
const state = {
    apiKey: localStorage.getItem('ctfbot_api_key') || DEFAULT_API_KEY,
    theme: localStorage.getItem('ctfbot_theme') || 'system',
    saveHistory: localStorage.getItem('ctfbot_save_history') !== 'false',
    isProcessing: false,
    chatHistory: [],
    currentContext: ''
};

// DOM Elements
const elements = {
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    chatMessages: document.getElementById('chat-messages'),
    welcomeScreen: document.getElementById('welcome-screen'),
    typingIndicator: document.getElementById('typing-indicator'),
    apiKeyInput: document.getElementById('api-key'),
    apiKeyNotice: document.getElementById('api-key-notice'),
    settingsModal: document.getElementById('settings-modal'),
    historyToggle: document.getElementById('history-toggle'),
    apiStatusIndicator: document.getElementById('api-status-indicator'),
    apiStatusText: document.getElementById('api-status-text'),
    chatHistorySidebar: document.getElementById('chat-history-sidebar'),
    chatHistoryList: document.getElementById('chat-history-list'),
    sidebarOverlay: document.querySelector('.sidebar-overlay'),
    assistanceType: document.getElementById('assistance-type'),
    themeButtons: document.querySelectorAll('.theme-btn')
};

// Initialize the application
async function init() {
    // Apply theme immediately before any other operations
    applyTheme();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load chat history in the background
    setTimeout(() => {
        loadChatHistory();
    }, 0);
    
    // Check API key status in the background
    if (state.apiKey) {
        elements.apiKeyInput.value = state.apiKey;
        setTimeout(async () => {
            await checkApiKeyStatus();
            if (elements.apiKeyNotice) {
                elements.apiKeyNotice.style.display = 'none';
            }
        }, 0);
    }
    
    adjustTextareaHeight();
}

// Setup event listeners
function setupEventListeners() {
    // Message input
    if (elements.messageInput) {
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
        elements.messageInput.addEventListener('input', adjustTextareaHeight);
    }
    
    // Send button
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', handleSendMessage);
    }
    
    // Chat history sidebar
    const historyMenuBtn = document.getElementById('history-menu-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    if (historyMenuBtn) {
        historyMenuBtn.addEventListener('click', toggleChatHistory);
    }
    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', toggleChatHistory);
    }
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', toggleChatHistory);
    }

    // Settings modal
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings');
    const setupApiKeyBtn = document.getElementById('setup-api-key');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettingsModal);
    }
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    if (setupApiKeyBtn) {
        setupApiKeyBtn.addEventListener('click', openSettingsModal);
    }
    
    // API key instructions
    const apiKeyInstructionsBtn = document.getElementById('get-api-key-instructions');
    if (apiKeyInstructionsBtn) {
        apiKeyInstructionsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('api-key-instructions').style.display = 'block';
        });
    }
    
    // Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    // Theme buttons in settings
    if (elements.themeButtons) {
        elements.themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.getAttribute('data-theme');
                if (theme) {
                    state.theme = theme;
                    localStorage.setItem('ctfbot_theme', theme);
                    applyTheme();
                }
            });
        });
    }
}

// Adjust textarea height
function adjustTextareaHeight() {
    const textarea = elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

// Handle sending messages
async function handleSendMessage() {
    const messageText = elements.messageInput.value.trim();
    if (!messageText || state.isProcessing) return;

    // Blur input on mobile to hide keyboard
    if (window.innerWidth <= 768) {
        elements.messageInput.blur();
    }

    // Check for API key
    if (!state.apiKey) {
        elements.apiKeyNotice.style.display = 'flex';
        return;
    }

    try {
        setProcessingState(true);
        console.log('Sending message:', messageText); // Debug log

        // Format message based on selected assistance type
        const formattedMessage = formatQueryForAssistanceType(
            messageText,
            elements.assistanceType ? elements.assistanceType.value : 'general'
        );

        // Add user message to chat
        addMessageToChat('user', messageText);
        state.chatHistory.push({ type: 'user', content: messageText });

        // Get AI response
        const response = await sendToGemini(formattedMessage);
        console.log('Received response:', response); // Debug log
        
        // Add AI response to chat
        addMessageToChat('assistant', response);
        state.chatHistory.push({ type: 'assistant', content: response });

        // Save chat history if enabled
        if (state.saveHistory) {
            saveChatHistory();
            updateChatHistoryList();
        }

        // Clear input and adjust height
        elements.messageInput.value = '';
        adjustTextareaHeight();

        // Scroll to bottom with smooth animation
        requestAnimationFrame(() => {
            elements.chatMessages.scrollTo({
                top: elements.chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        });

    } catch (error) {
        console.error('Error sending message:', error);
        addMessageToChat('system', `Error: ${error.message}`);
    } finally {
        setProcessingState(false);
        // Re-enable input after processing
        if (window.innerWidth <= 768) {
            elements.messageInput.focus();
        }
    }
}

// Send message to the Gemini API with streaming support
async function sendToGemini(prompt) {
    try {
        // More lenient API key validation
        if (!state.apiKey) {
            throw new Error('API key is required');
        }

        // Construct the full context with chat history and system prompt
        const fullContext = constructPromptWithContext(prompt);
        const streamingUrl = `${API_BASE_URL}/models/${MODEL_NAME}:streamGenerateContent`;
        
        // Create message container ahead of time
        const messageContainer = addEmptyMessage('assistant');

        console.log('Sending request to API:', fullContext); // Debug log
        const response = await fetch(`${streamingUrl}?key=${state.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: fullContext }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        let fullResponse = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            // Decode and process the chunk
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    if (line.startsWith('data: ')) {
                        const jsonData = JSON.parse(line.slice(5));
                        if (jsonData.candidates?.[0]?.content?.parts?.[0]?.text) {
                            const text = jsonData.candidates[0].content.parts[0].text;
                            fullResponse += text;
                            updateMessageContent(messageContainer, fullResponse);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing streaming response:', e);
                }
            }
        }
        
        updateApiStatus(true);
        return fullResponse;
        
    } catch (error) {
        console.error('API Error:', error);
        updateApiStatus(false, error.message);
        
        // Show API key notice if the error is related to authentication
        if (error.message.includes('API key') || error.message.includes('authentication')) {
            elements.apiKeyNotice.style.display = 'flex';
        }
        
        throw error;
    }
}

// Create an empty message container and return it
function addEmptyMessage(type) {
    const container = document.createElement('div');
    container.className = `message message-${type}`;
    
    const content = document.createElement('div');
    content.className = 'message-content';
    container.appendChild(content);
    
    elements.chatMessages.appendChild(container);
    return container;
}

// Update message content with new text
function updateMessageContent(container, text) {
    const content = container.querySelector('.message-content');
    const processedContent = processMessageContent(text);
    content.innerHTML = processedContent;
    
    // Scroll to bottom smoothly
    requestAnimationFrame(() => {
        elements.chatMessages.scrollTo({
            top: elements.chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    });
}

// Improved context construction
function constructPromptWithContext(userPrompt) {
    // Start with system prompt
    let fullPrompt = `${DEFAULT_SYSTEM_PROMPT}\n\n`;
    
    // Add relevant context
    if (state.currentContext) {
        fullPrompt += `Current context:\n${state.currentContext}\n\n`;
    }
    
    // Add recent chat history (limit to last few messages for context)
    const recentHistory = state.chatHistory.slice(-5);
    if (recentHistory.length > 0) {
        fullPrompt += "Recent conversation:\n";
        recentHistory.forEach(msg => {
            const role = msg.type === 'user' ? 'User' : 'CTFBot';
            fullPrompt += `${role}: ${msg.content}\n`;
        });
        fullPrompt += "\n";
    }
    
    // Add current user message
    fullPrompt += `User: ${userPrompt}\n\nCTFBot:`;
    
    return fullPrompt;
}

// Format the query based on assistance type
function formatQueryForAssistanceType(userMessage, assistanceType) {
    let formattedPrompt = '';
    
    // Format prompt based on assistance type
    switch (assistanceType) {
        case 'analyze':
            formattedPrompt = `Please analyze this CTF challenge. Identify the likely category, potential techniques to solve it, and provide initial guidance on how to approach it without giving away the full solution:\n\n${userMessage}`;
            break;
        case 'hint':
            formattedPrompt = `Please provide a subtle hint for this CTF challenge. The hint should point me in the right direction without spoiling the challenge or giving away the solution:\n\n${userMessage}`;
            break;
        case 'approach':
            formattedPrompt = `Please suggest a step-by-step approach to solve this CTF challenge. Include tools, techniques, and methodology that would be helpful:\n\n${userMessage}`;
            break;
        case 'explain':
            formattedPrompt = `Please explain the following security concept or technique in the context of CTF challenges. Include examples and use cases where applicable:\n\n${userMessage}`;
            break;
        default:
            formattedPrompt = userMessage;
    }
    
    return formattedPrompt;
}

// Construct prompt with history and system prompt
function constructPromptWithHistory(userPrompt) {
    // Start with system prompt
    let fullPrompt = `${DEFAULT_SYSTEM_PROMPT}\n\n`;
    
    // Add a reduced version of chat history (last few exchanges only)
    const relevantHistory = state.chatHistory.slice(-MAX_HISTORY_LENGTH);
    if (relevantHistory.length > 0) {
        fullPrompt += "Previous conversation:\n";
        relevantHistory.forEach(msg => {
            const role = msg.type === 'user' ? 'User' : 'CTFBot';
            fullPrompt += `${role}: ${msg.content}\n`;
        });
        fullPrompt += "\n";
    }
    
    // Add current user message
    fullPrompt += `User: ${userPrompt}\n\nCTFBot:`;
    
    return fullPrompt;
}

// Add message to chat UI
function addMessageToChat(type, content) {
    // Hide welcome screen when messages are added
    if (elements.welcomeScreen) {
        elements.welcomeScreen.style.display = 'none';
    }
    
    // Format message and show in chat
    const messageHtml = processMessageContent(content);
    elements.chatMessages.innerHTML += `<div class="message message-${type}"><div class="message-content">${messageHtml}</div></div>`;
    
    // Clear input field
    elements.messageInput.value = '';
}

// Process message content for formatting
function processMessageContent(content) {
    // Escape HTML to prevent XSS
    let processed = escapeHtml(content);
    
    // Structure code blocks (```code aiming```)
    processed = processed.replace(/```([\s\S]*?```)/g, '$C0$1$C1');
    
    // Escape bracketed text
    processed = processed.replace(/\[(.*?)\]/g, '<s>$1</s>');
    
    // Convert URLs to clickable links
    processed = processed.replace(/^(http:\/\/|https:\/\/|mailto:|mailto:)(\S+)\b/g, (match) => {
        return '<a href="' + match + '" target=\"_blank\" rel=\"noopener noreferrer\">' + match + '</a>';
    });
    
    // Process new lines
    return processed.replace(/\r?\n|\r/g, '<br>');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Set the processing state (loading indicator, button state)
function setProcessingState(isProcessing) {
    state.isProcessing = isProcessing;
    elements.sendBtn.disabled = isProcessing;
    
    // Show/hide typing indicator
    elements.typingIndicator.style.display = isProcessing ? 'block' : 'none';
    
    // Hide the welcome screen when processing
    if (!isProcessing && elements.welcomeScreen) {
        elements.welcomeScreen.style.display = 'none';
    }
}

// Check API status
async function checkApiStatus() {
    try {
        // Validate API key format first
        if (!state.apiKey || !/^[A-Za-z0-9-_]{39}$/.test(state.apiKey)) {
            updateApiStatus(false, 'Invalid API key format');
            elements.apiKeyNotice.style.display = 'flex';
            return;
        }

        // Simple test request to see if the API is accessible
        const testURL = `${API_BASE_URL}/models?key=${state.apiKey}`;
        const response = await fetch(testURL);
        const data = await response.json();
        
        if (data.error) {
            updateApiStatus(false, data.error.message);
            elements.apiKeyNotice.style.display = 'flex';
        } else {
            updateApiStatus(true);
            elements.apiKeyNotice.style.display = 'none';
        }
    } catch (error) {
        updateApiStatus(false, error.message);
        elements.apiKeyNotice.style.display = 'flex';
    }
}

// Improved API status check
async function checkApiKeyStatus() {
    try {
        if (!state.apiKey) {
            updateApiStatus(false, 'API key required');
            elements.apiKeyNotice.style.display = 'flex';
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const testURL = `${API_BASE_URL}/models/${MODEL_NAME}?key=${state.apiKey}`;
        const response = await fetch(testURL, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        updateApiStatus(true);
        elements.apiKeyNotice.style.display = 'none';
        
    } catch (error) {
        console.error('API Status Check Error:', error);
        const errorMessage = error.name === 'AbortError' ? 
            'Connection timeout - please try again' : error.message;
        updateApiStatus(false, errorMessage);
        elements.apiKeyNotice.style.display = 'flex';
    }
}

// Update API status indicator
function updateApiStatus(isConnected, errorMessage = '') {
    elements.apiStatusIndicator.classList.toggle('connected', isConnected);
    elements.apiStatusIndicator.classList.toggle('error', !isConnected);
    
    if (isConnected) {
        elements.apiStatusText.textContent = 'API Status: Connected';
        elements.apiKeyNotice.style.display = 'none';
    } else {
        const displayError = errorMessage === 'Invalid API key format' ? 
            'Invalid API key format - Please check your API key' : 
            `API Status: Error - ${errorMessage}`;
        elements.apiStatusText.textContent = displayError;
        elements.apiKeyNotice.style.display = 'flex';
    }
}

// Open settings modal
function openSettingsModal() {
    elements.settingsModal.classList.add('show');
}

// Close settings modal
function closeSettingsModal() {
    elements.settingsModal.classList.remove('show');
}

// Save settings
async function saveSettings() {
    const newApiKey = elements.apiKeyInput.value.trim();
    if (newApiKey && newApiKey !== state.apiKey) {
        state.apiKey = newApiKey;
        localStorage.setItem('ctfbot_api_key', newApiKey);
        await checkApiKeyStatus();
    }
    
    // Save history preference
    state.saveHistory = elements.historyToggle.checked;
    localStorage.setItem('ctfbot_save_history', state.saveHistory);
    
    if (!state.saveHistory) {
        clearChatHistory();
    }
    
    closeSettingsModal();
}

// Toggle between light and dark theme
function toggleTheme() {
    // Get the current theme
    const currentTheme = state.theme;
    
    // Determine the new theme
    let newTheme;
    if (currentTheme === 'system') {
        newTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
    } else {
        newTheme = currentTheme === 'light' ? 'dark' : 'light';
    }
    
    // Update state and localStorage
    state.theme = newTheme;
    localStorage.setItem('ctfbot_theme', newTheme);
    
    // Apply the theme
    applyTheme();
    
    // Update theme buttons in settings
    elements.themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === newTheme);
    });
}

// Apply current theme with improved handling
function applyTheme() {
    const theme = state.theme;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Determine the actual theme to apply
    const effectiveTheme = theme === 'system' ? 
        (systemPrefersDark ? 'dark' : 'light') : 
        theme;
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    // Update theme icons
    const moonIcon = document.querySelector('.moon-icon');
    const sunIcon = document.querySelector('.sun-icon');
    
    if (moonIcon && sunIcon) {
        if (effectiveTheme === 'dark') {
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        } else {
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        }
    }
    
    // Store the effective theme
    document.documentElement.style.setProperty('--effective-theme', effectiveTheme);
}

// Save chat history to localStorage
function saveChatHistory() {
    if (state.saveHistory) {
        try {
            localStorage.setItem('ctfbot_chat_history', JSON.stringify(state.chatHistory));
        } catch (e) {
            console.error('Error saving chat history:', e);
        }
    }
}

// Load chat history from localStorage
function loadChatHistory() {
    if (state.saveHistory) {
        try {
            const savedHistory = localStorage.getItem('ctfbot_chat_history');
            if (savedHistory) {
                state.chatHistory = JSON.parse(savedHistory);
                
                // Display loaded messages in the chat
                state.chatHistory.forEach(msg => {
                    addMessageToChat(msg.type, msg.content);
                });
            }
        } catch (e) {
            console.error('Error loading chat history:', e);
        }
    }
}

// Clear chat history
function clearChatHistory() {
    state.chatHistory = [];
    localStorage.removeItem('ctfbot_chat_history');
}

// Toggle chat history sidebar
function toggleChatHistory() {
    const isVisible = elements.chatHistorySidebar.classList.contains('show');
    elements.chatHistorySidebar.classList.toggle('show');
    elements.sidebarOverlay.classList.toggle('show');
}

// Add a new function to update chat history list
function updateChatHistoryList() {
    // Clear existing history list
    elements.chatHistoryList.innerHTML = '';
    
    if (state.chatHistory.length === 0) {
        const emptyHistory = document.createElement('div');
        emptyHistory.classList.add('empty-history');
        emptyHistory.textContent = 'No chat history yet';
        elements.chatHistoryList.appendChild(emptyHistory);
        return;
    }
    
    // Group messages by conversation
    let conversations = [];
    let currentConversation = [];
    
    state.chatHistory.forEach(msg => {
        currentConversation.push(msg);
        if (msg.type === 'system' && msg.content.includes('Hello! I\'m CTFBot')) {
            conversations.push(currentConversation);
            currentConversation = [];
        }
    });
    
    // Add remaining messages as current conversation
    if (currentConversation.length > 0) {
        conversations.push(currentConversation);
    }
    
    // Create chat history items
    conversations.forEach((conversation, index) => {
        const chatItem = document.createElement('div');
        chatItem.classList.add('chat-history-item');
        
        // Find first user message for title
        const firstUserMsg = conversation.find(msg => msg.type === 'user');
        const title = firstUserMsg ? 
            (firstUserMsg.content.length > 30 ? 
                firstUserMsg.content.substring(0, 30) + '...' : 
                firstUserMsg.content) :
            'New Conversation';
        
        const date = new Date().toLocaleDateString();
        
        chatItem.innerHTML = `
            <div class="chat-info">
                <div class="chat-title">${title}</div>
                <div class="chat-date">${date}</div>
            </div>
            <button class="delete-chat-btn" aria-label="Delete conversation">×</button>
        `;
        
        // Add click handler to load conversation
        chatItem.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-chat-btn')) {
                e.stopPropagation();
                deleteConversation(index);
            } else {
                loadConversation(conversation);
            }
        });
        
        elements.chatHistoryList.appendChild(chatItem);
    });
}

// Load a conversation
function loadConversation(conversation) {
    // Clear current chat
    while (elements.chatMessages.firstChild) {
        elements.chatMessages.removeChild(elements.chatMessages.firstChild);
    }
    
    // Hide welcome screen
    elements.welcomeScreen.style.display = 'none';
    
    // Load conversation messages
    conversation.forEach(msg => {
        addMessageToChat(msg.type, msg.content);
    });
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        toggleChatHistory();
    }
}

// Delete conversation
function deleteConversation(index) {
    const conversations = [];
    let currentConversation = [];
    
    state.chatHistory.forEach(msg => {
        currentConversation.push(msg);
        if (msg.type === 'system' && msg.content.includes('Hello! I\'m CTFBot')) {
            conversations.push(currentConversation);
            currentConversation = [];
        }
    });
    
    if (currentConversation.length > 0) {
        conversations.push(currentConversation);
    }
    
    // Remove the conversation
    conversations.splice(index, 1);
    
    // Flatten conversations back into chat history
    state.chatHistory = conversations.flat();
    
    // Save updated history
    if (state.saveHistory) {
        saveChatHistory();
    }
    
    // Updated UI
    updateChatHistoryList();
}

// Select the model used for API requests
async function updateApiUrl() {
    const model = state.selectedModel;
    state.currentApiUrl = `${API_BASE_URL}/models/${model}:generateContent`;
}

// Update model select dropdown
function updateModelSelect() {
    const modelSelects = document.querySelectorAll('#model-select');
    modelSelects.forEach(select => {
        select.innerHTML = '';
        
        state.availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.title = model.description;
            option.selected = model.id === state.selectedModel;
            select.appendChild(option);
        });
        
        // Enable/disable based on whether we have models
        select.disabled = state.availableModels.length === 0;
        
        // Update the API URL for the selected model
        updateApiUrl();
    });
}

// Add a new function check on model selection change
if (elements.modelSelect) {
    elements.modelSelect.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        selectedValue === state.selectedModel || showUpdate();
    });
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);