// CTFBot - Main JavaScript file
// This implements the Gemini API integration and UI functionality

// Constants and configuration
const DEFAULT_API_KEY = ""; // No default API key - users must provide their own
const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent"; // Updated to gemini-2.0-flash model
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

// DOM Elements
const elements = {
    // Chat UI elements
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    assistanceType: document.getElementById('assistance-type'),
    uploadBtn: document.getElementById('upload-btn'),
    fileUpload: document.getElementById('file-upload'),
    loadingIndicator: document.getElementById('loading-indicator'),
    typingIndicator: document.getElementById('typing-indicator'),
    welcomeScreen: document.getElementById('welcome-screen'),
    newChatBtn: document.getElementById('new-chat-btn'),
    
    // API and status elements
    apiStatusIndicator: document.getElementById('api-status-indicator'),
    apiStatusText: document.getElementById('api-status-text'),
    apiKeyNotice: document.getElementById('api-key-notice'),
    setupApiKeyBtn: document.getElementById('setup-api-key'),
    
    // Settings modal elements
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsBtn: document.getElementById('close-settings'),
    apiKeyInput: document.getElementById('api-key'),
    historyToggle: document.getElementById('history-toggle'),
    saveSettingsBtn: document.getElementById('save-settings'),
    themeButtons: document.querySelectorAll('.theme-btn'),
    
    // Theme toggle
    themeToggle: document.getElementById('theme-toggle'),
    
    // Chat history elements
    historyMenuBtn: document.getElementById('history-menu-btn'),
    chatHistorySidebar: document.getElementById('chat-history-sidebar'),
    closeHistoryBtn: document.getElementById('close-history-btn'),
    chatHistoryList: document.getElementById('chat-history-list'),
    sidebarOverlay: document.createElement('div')
};

// State management
const state = {
    apiKey: localStorage.getItem('ctfbot_api_key') || DEFAULT_API_KEY,
    theme: localStorage.getItem('ctfbot_theme') || 'system',
    saveHistory: localStorage.getItem('ctfbot_save_history') !== 'false',
    isProcessing: false,
    chatHistory: [],
    uploadedFiles: [],
    currentContext: ''
};

// Initialize the application
function init() {
    loadChatHistory();
    setupEventListeners();
    applyTheme();
    checkApiKeyStatus();
    checkApiStatus();
    adjustTextareaHeight();
    
    // Auto-fill API key in settings if available
    if (state.apiKey) {
        elements.apiKeyInput.value = state.apiKey;
    }
    
    // Set active theme button
    document.querySelector(`.theme-btn[data-theme="${state.theme}"]`)?.classList.add('active');
    
    // Set history toggle
    elements.historyToggle.checked = state.saveHistory;
    
    // Initialize chat history list
    updateChatHistoryList();
}

// Check if API key is set and show/hide notice
function checkApiKeyStatus() {
    if (!state.apiKey) {
        // No API key set, show notice and disable chat
        elements.apiKeyNotice?.classList.remove('hidden');
        disableChatInterface();
    } else {
        // API key is set, hide notice and enable chat
        elements.apiKeyNotice?.classList.add('hidden');
        enableChatInterface();
    }
}

// Disable chat interface when no API key is set
function disableChatInterface() {
    elements.messageInput.disabled = true;
    elements.sendBtn.disabled = true;
    elements.uploadBtn.disabled = true;
    elements.messageInput.placeholder = "Please set up your API key first...";
}

// Enable chat interface when API key is set
function enableChatInterface() {
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.uploadBtn.disabled = false;
    elements.messageInput.placeholder = "Describe your CTF challenge or ask a question...";
}

// Event Listeners
function setupEventListeners() {
    // Send message on button click or Enter key
    elements.sendBtn.addEventListener('click', handleSendMessage);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
        
        // Dynamically adjust textarea height
        setTimeout(adjustTextareaHeight, 0);
    });
    
    // Auto-resize textarea as user types
    elements.messageInput.addEventListener('input', adjustTextareaHeight);
    
    // File upload handling
    elements.uploadBtn.addEventListener('click', () => elements.fileUpload.click());
    elements.fileUpload.addEventListener('change', handleFileUpload);
    
    // Settings modal
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.closeSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    
    // API key setup button
    elements.setupApiKeyBtn?.addEventListener('click', openSettingsModal);
    
    // New Chat button
    elements.newChatBtn?.addEventListener('click', startNewChat);
    
    // API Key Instructions toggle
    document.getElementById('get-api-key-instructions').addEventListener('click', (e) => {
        e.preventDefault();
        const instructions = document.getElementById('api-key-instructions');
        instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
    });
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Theme selection in settings
    elements.themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            elements.themeButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
        });
    });
    
    // Chat history sidebar toggle
    elements.historyMenuBtn.addEventListener('click', toggleChatHistory);
    elements.closeHistoryBtn.addEventListener('click', toggleChatHistory);
    
    // Create and setup overlay
    elements.sidebarOverlay.classList.add('sidebar-overlay');
    document.body.appendChild(elements.sidebarOverlay);
    elements.sidebarOverlay.addEventListener('click', toggleChatHistory);
        
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            closeSettingsModal();
        }
    });
}

// Start a new chat
function startNewChat() {
    // Clear the chat interface
    while (elements.chatMessages.firstChild) {
        elements.chatMessages.removeChild(elements.chatMessages.firstChild);
    }
    
    // Show welcome screen
    elements.welcomeScreen.style.display = 'flex';
    
    // Clear chat history from memory
    state.chatHistory = [];
    state.uploadedFiles = [];
    
    // Save empty history if history saving is enabled
    if (state.saveHistory) {
        saveChatHistory();
    }
    
     // Update the chat history sidebar
     updateChatHistoryList();

    // Add initial message
    setTimeout(() => {
        if (elements.chatMessages.children.length <= 2) { // Only welcome screen and typing indicator
            addMessageToChat('system', 'Hello! I\'m CTFBot, your Capture The Flag assistant. Describe your challenge or upload files to get started.');
        }
    }, 100);
}

// Function to adjust textarea height based on content
function adjustTextareaHeight() {
    const textarea = elements.messageInput;
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set the height to the scrollHeight to fit all content
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Send message to the Gemini API
async function handleSendMessage() {
    const message = elements.messageInput.value.trim();
    const assistanceType = elements.assistanceType.value;
    
    // Don't send empty messages
    if (!message && state.uploadedFiles.length === 0) return;
    
    // Check if API key is set
    if (!state.apiKey) {
        openSettingsModal();
        addMessageToChat('system', 'Please set up your Gemini API key to use CTFBot.');
        return;
    }
    
    // Add user message to chat
    addMessageToChat('user', message);
    
    // Clear input field and reset height
    elements.messageInput.value = '';
    adjustTextareaHeight();
    
    // Disable send button and show loading indicator
    setProcessingState(true);
    
    try {
        // Format query based on assistance type
        let formattedPrompt = formatQueryForAssistanceType(message, assistanceType);
        
        // Send to Gemini API
        const response = await sendToGemini(formattedPrompt);
        
        // Add response to chat
        if (response) {
            addMessageToChat('bot', response);
        } else {
            throw new Error("Failed to get a response from Gemini API");
        }
    } catch (error) {
        console.error('Error:', error);
        addMessageToChat('system', `Error: ${error.message || 'Failed to process your request'}`);
    } finally {
        // Re-enable send button and hide loading indicator
        setProcessingState(false);
    }
}

// Format the query based on assistance type
function formatQueryForAssistanceType(userMessage, assistanceType) {
    let formattedPrompt = '';
    
    // Add uploaded file content to context if available
    let fileContext = '';
    if (state.uploadedFiles.length > 0) {
        fileContext = 'I am providing the following file(s):\n\n';
        state.uploadedFiles.forEach(file => {
            fileContext += `File: ${file.name} (${file.type || 'Unknown type'})\n`;
            fileContext += `Content:\n${file.content}\n\n`;
        });
    }
    
    // Format prompt based on assistance type
    switch (assistanceType) {
        case 'analyze':
            formattedPrompt = `Please analyze this CTF challenge. Identify the likely category, potential techniques to solve it, and provide initial guidance on how to approach it without giving away the full solution:\n\n${fileContext}${userMessage}`;
            break;
        case 'hint':
            formattedPrompt = `Please provide a subtle hint for this CTF challenge. The hint should point me in the right direction without spoiling the challenge or giving away the solution:\n\n${fileContext}${userMessage}`;
            break;
        case 'approach':
            formattedPrompt = `Please suggest a step-by-step approach to solve this CTF challenge. Include tools, techniques, and methodology that would be helpful:\n\n${fileContext}${userMessage}`;
            break;
        case 'explain':
            formattedPrompt = `Please explain the following security concept or technique in the context of CTF challenges. Include examples and use cases where applicable:\n\n${userMessage}`;
            break;
        default:
            formattedPrompt = userMessage;
    }
    
    return formattedPrompt;
}

// Send message to Gemini API
async function sendToGemini(prompt) {
    try {
        // Add uploaded files context if any
        const fileContexts = state.uploadedFiles.map(file => file.content).join('\n\n');
        const fullPrompt = fileContexts ? `${prompt}\n\nFile Contents:\n${fileContexts}` : prompt;
        
        // Construct the full context with chat history and system prompt
        const fullContext = constructPromptWithHistory(fullPrompt);
        
        const response = await fetch(`${API_URL}?key=${state.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: fullContext }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                }
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || "API Error");
        }
        
        // Process response and extract text
        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Invalid response format");
        }
    } catch (error) {
        console.error('API Error:', error);
        updateApiStatus(false);
        throw error;
    }
}

// Construct prompt with history and system prompt
function constructPromptWithHistory(userPrompt) {
    // Start with system prompt
    let fullPrompt = DEFAULT_SYSTEM_PROMPT + "\n\n";
    
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
    
    // Add current prompt
    fullPrompt += `User: ${userPrompt}\n\nCTFBot:`;
    
    return fullPrompt;
}

// Add message to chat UI
function addMessageToChat(type, content) {
    // Hide welcome screen when messages are added
    if (elements.welcomeScreen) {
        elements.welcomeScreen.style.display = 'none';
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    // Process content for code blocks, markdown, etc.
    const formattedContent = processMessageContent(content);
    contentDiv.innerHTML = formattedContent;
    
    // Add copy button to code blocks
    const codeBlocks = contentDiv.querySelectorAll('pre');
    codeBlocks.forEach(block => {
        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-btn');
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(block.textContent);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 2000);
        });
        block.parentNode.appendChild(copyBtn);
    });
    
    messageDiv.appendChild(contentDiv);
    elements.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    // Save message to history
    if (state.saveHistory) {
        state.chatHistory.push({ type, content });
        saveChatHistory();
    }
    
    // Update the chat history list if saving history
    if (elements.saveHistory) {
        updateChatHistoryList();
    }
}

// Process message content for formatting
function processMessageContent(content) {
    if (!content) return '';
    
    // Escape HTML to prevent XSS
    let processed = escapeHtml(content);
    
    // Process code blocks (```code```)
    processed = processed.replace(/```([\s\S]*?)```/g, (match, code) => {
        return `<div class="code-block"><pre>${code}</pre></div>`;
    });
    
    // Process inline code (`code`)
    processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Process bold (**text**)
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Process italic (*text*)
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Convert URLs to clickable links
    processed = processed.replace(
        /https?:\/\/[^\s)]+/g, 
        '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>'
    );
    
    // Convert line breaks to <br>
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle file upload
function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Process each file
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const fileContent = e.target.result;
            
            // Add file to state
            state.uploadedFiles.push({
                name: file.name,
                type: file.type,
                content: fileContent
            });
            
            // Add file attachment message
            const fileMessage = `Uploaded file: ${file.name} (${formatFileSize(file.size)})`;
            addMessageToChat('user', fileMessage);
        };
        
        if (file.type.startsWith('text') || 
            file.type === 'application/json' ||
            file.name.match(/\.(txt|js|py|html|css|json|md|cpp|c|h|java|rb|php|sh|bat|ps1|sql|yaml|yml|xml)$/i)) {
            // Read as text if it's a text file
            reader.readAsText(file);
        } else {
            // Read as data URL for binary files
            reader.readAsDataURL(file);
        }
    });
    
    // Reset file input
    event.target.value = null;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// Set the processing state (loading indicator, button state)
function setProcessingState(isProcessing) {
    state.isProcessing = isProcessing;
    elements.sendBtn.disabled = isProcessing;
    
    // Hide the welcome screen when starting to process
    if (isProcessing && elements.welcomeScreen) {
        elements.welcomeScreen.style.display = 'none';
    }
    
    // Show/hide the typing indicator inside the chat
    elements.typingIndicator.style.display = isProcessing ? 'block' : 'none';
    
    // Scroll to make sure typing indicator is visible
    if (isProcessing) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
    
    // Update API status indicator
    elements.apiStatusIndicator.classList.toggle('connected', isProcessing);
}

// Check API status
async function checkApiStatus() {
    try {
        // Simple test request to see if the API is accessible
        const testURL = `https://generativelanguage.googleapis.com/v1beta/models?key=${state.apiKey}`;
        const response = await fetch(testURL);
        const data = await response.json();
        
        if (data.error) {
            updateApiStatus(false, data.error.message);
        } else {
            updateApiStatus(true);
        }
    } catch (error) {
        updateApiStatus(false, error.message);
    }
}

// Update API status indicator
function updateApiStatus(isConnected, errorMessage = '') {
    elements.apiStatusIndicator.classList.toggle('connected', isConnected);
    elements.apiStatusIndicator.classList.toggle('error', !isConnected);
    
    if (isConnected) {
        elements.apiStatusText.textContent = 'API Status: Connected';
    } else {
        elements.apiStatusText.textContent = `API Status: Error${errorMessage ? ' - ' + errorMessage : ''}`;
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
function saveSettings() {
    // Save API key if provided
    const newApiKey = elements.apiKeyInput.value.trim();
    if (newApiKey) {
        state.apiKey = newApiKey;
        localStorage.setItem('ctfbot_api_key', newApiKey);
        checkApiKeyStatus(); // Update UI based on API key presence
    }
    
    // Save theme preference
    const activeThemeBtn = document.querySelector('.theme-btn.active');
    if (activeThemeBtn) {
        state.theme = activeThemeBtn.getAttribute('data-theme');
        localStorage.setItem('ctfbot_theme', state.theme);
        applyTheme();
    }
    
    // Save history preference
    state.saveHistory = elements.historyToggle.checked;
    localStorage.setItem('ctfbot_save_history', state.saveHistory);
    
    // If history is turned off, clear history
    if (!state.saveHistory) {
        clearChatHistory();
    }
    
    // Check API status with new key
    checkApiStatus();
    
    // Close modal
    closeSettingsModal();
}

// Toggle between light and dark theme
function toggleTheme() {
    // If current theme is system or light, switch to dark, otherwise switch to light
    const newTheme = (state.theme === 'system' || state.theme === 'light') ? 'dark' : 'light';
    state.theme = newTheme;
    localStorage.setItem('ctfbot_theme', newTheme);
    
    // Update active theme button in settings
    elements.themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === newTheme);
    });
    
    applyTheme();
}

// Apply current theme
function applyTheme() {
    // Get system preference if theme is set to 'system'
    if (state.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', state.theme);
    }
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

// Listen for system theme changes if using system theme
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') {
        applyTheme();
    }
});

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Toggle chat history sidebar
function toggleChatHistory() {
    const isVisible = elements.chatHistorySidebar.classList.contains('show');
    elements.chatHistorySidebar.classList.toggle('show');
    elements.sidebarOverlay.classList.toggle('show');
    
    // Update aria-expanded attribute for accessibility
    elements.historyMenuBtn.setAttribute('aria-expanded', !isVisible);
}

// New chat button

// Add new function to update chat history list
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
            <div class="chat-title">${title}</div>
            <div class="chat-date">${date}</div>
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

/**
 * Load a conversation
 * @param {object} conversation Previous conversation
 */
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