// CTFBot - Main JavaScript file
// This implements the Gemini API integration and UI functionality

// Constants and configuration
const DEFAULT_API_KEY = ""; // No default API key - users must provide their own
const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent"; // Using gemini-2.0-flash model
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
    isProcessing: false,
    currentContext: ''
};

// Define elements object to store references to DOM elements
const elements = {
    chatMessages: document.getElementById('chat-messages'),
    welcomeScreen: document.getElementById('welcome-screen'),
    messageInput: document.getElementById('message-input'),
    assistanceType: document.getElementById('assistance-type'),
    apiKeyInput: document.getElementById('api-key'),
    apiKeyNotice: document.getElementById('api-key-notice'),
    settingsModal: document.getElementById('settings-modal'),
    themeButtons: document.querySelectorAll('.theme-btn'),
    sendBtn: document.getElementById('send-btn'),
    typingIndicator: document.getElementById('typing-indicator'),
    settingsBtn: document.getElementById('settings-btn'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings'),
    setupApiKey: document.getElementById('setup-api-key')
};

// Add event listener to setup API key button
if (elements.setupApiKey) {
    elements.setupApiKey.addEventListener('click', () => {
        openSettingsModal();
        // Focus on the API key input
        if (elements.apiKeyInput) {
            elements.apiKeyInput.focus();
        }
    });
}

// Add event listener to close settings button
if (elements.closeSettings) {
    elements.closeSettings.addEventListener('click', closeSettingsModal);
}

// Function to save settings
function saveSettings() {
    const apiKey = elements.apiKeyInput.value.trim();
    const theme = document.querySelector('.theme-btn.active').getAttribute('data-theme');

    // Save settings to local storage
    localStorage.setItem('ctfbot_api_key', apiKey);
    localStorage.setItem('ctfbot_theme', theme);

    // Update state
    state.apiKey = apiKey;
    state.theme = theme;

    // Apply theme
    applyTheme();

    // Check API status with new key
    checkApiKeyStatus().then(isValid => {
        if (isValid) {
            elements.apiKeyNotice.style.display = 'none';
            elements.welcomeScreen.style.display = 'block';
        }
    });

    // Close settings modal
    closeSettingsModal();

    // Show toast notification
    toast.show('Settings saved successfully', 'success');
}

// Send a message to the Gemini API and add it to chat
async function sendMessage(message) {
    if (!message.trim()) {
        return; // Don't send empty messages
    }

    if (!state.apiKey) {
        toast.show('API key required', 'error');
        elements.apiKeyNotice.style.display = 'flex';
        return;
    }

    // Clear input and adjust height immediately
    if (elements.messageInput) {
        elements.messageInput.value = '';
        adjustTextareaHeight();
        elements.messageInput.focus(); // Keep focus on input
    }

    // Display user message
    displayMessage(message, true);

    // Set processing state
    setProcessingState(true);

    try {
        // Call the API
        const response = await fetch(`${API_URL}?key=${state.apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${DEFAULT_SYSTEM_PROMPT}\n\nUser: ${message}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
            }),
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format from API');
        }

        const botResponse = data.candidates[0].content.parts[0].text;
        displayMessage(botResponse, false);

    } catch (error) {
        console.error('Error sending message:', error);
        displayMessage('Error: ' + error.message, false, true);
        toast.show('Failed to get response from API', 'error');
    } finally {
        setProcessingState(false);
    }
}

// Function to display a message in the chat
function displayMessage(content, isUser = true, isError = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'message-user' : 'message-assistant'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${isError ? 'error' : ''}`;
    contentDiv.textContent = content;
    
    messageElement.appendChild(contentDiv);
    
    if (elements.chatMessages) {
        elements.chatMessages.appendChild(messageElement);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
}

// Update the input field event listeners
function setupMessageInput() {
    if (!elements.messageInput || !elements.sendBtn) return;

    // Handle send button click
    elements.sendBtn.addEventListener('click', () => {
        const message = elements.messageInput.value.trim();
        if (message) {
            sendMessage(message);
        }
    });

    // Handle Enter key (but allow Shift+Enter for new lines)
    elements.messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const message = elements.messageInput.value.trim();
            if (message) {
                sendMessage(message);
            }
        }
    });

    // Auto-resize input field
    elements.messageInput.addEventListener('input', () => {
        adjustTextareaHeight();
    });
}

// Initialize event listeners
function initEventListeners() {
    setupMessageInput();
    setupEventListeners(); // This sets up other event listeners we already have
}

// Initialize the application
async function init() {
    try {
        // Apply theme immediately
        applyTheme();

        // Set up all event listeners
        initEventListeners();

        // Check API status only if we have an API key
        if (state.apiKey) {
            elements.apiKeyInput.value = state.apiKey;
            const isApiValid = await checkApiKeyStatus();
            if (isApiValid) {
                elements.apiKeyNotice.style.display = 'none';
                elements.welcomeScreen.style.display = 'block';
            }
        }

        // Initial textarea height adjustment
        adjustTextareaHeight();

    } catch (error) {
        console.error('Initialization error:', error);
        toast.show('Error initializing application: ' + error.message, 'error');
    }
}

// Create loading overlay element
// Remove loading states and overlay since we don't need them anymore
function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-logo">
                <img src="assets/images/ctfbot-logo.svg" alt="CTFBot Logo" />
            </div>
            <div class="loading-progress">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div class="loading-message">Initializing...</div>
            </div>
        </div>
    `;
    return overlay;
}

// Update loading state
function updateLoadingState(state) {
    const progressFill = document.querySelector('.progress-fill');
    const loadingMessage = document.querySelector('.loading-message');

    if (progressFill && loadingMessage) {
        progressFill.style.width = `${state.progress}%`;
        loadingMessage.textContent = state.message;
    }
}

// Open settings modal
function openSettingsModal() {
    if (!elements.settingsModal) return;
    
    // Clear any previous settings
    elements.apiKeyInput.value = state.apiKey || '';
    
    // Update theme buttons
    elements.themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === state.theme);
    });
    
    // Add modal show class
    elements.settingsModal.classList.add('show');
    
    // Focus on API key input
    elements.apiKeyInput.focus();
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
}

// Sets processing state to show/hide typing indicator
function setProcessingState(isProcessing) {
    state.isProcessing = isProcessing;

    // Show/hide typing indicator and loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = isProcessing ? 'flex' : 'none';
    }

    // Show/hide typing indicator
    if (elements.typingIndicator) {
        elements.typingIndicator.style.display = isProcessing ? 'flex' : 'none';
    }

    // Enable/disable send button
    if (elements.sendBtn) {
        elements.sendBtn.disabled = isProcessing;
    }

    // Enable/disable message input
    if (elements.messageInput) {
        elements.messageInput.disabled = isProcessing;
    }
}

// Close settings modal
function closeSettingsModal() {
    if (!elements.settingsModal) return;
    
    // Remove modal show class
    elements.settingsModal.classList.remove('show');
    
    // Restore background scrolling
    document.body.style.overflow = '';
}

// Close modal when clicking outside
elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
        closeSettingsModal();
    }
});

// Close modal when pressing Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.settingsModal.classList.contains('show')) {
        closeSettingsModal();
    }
});

// Apply the current theme
function applyTheme() {
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Determine the theme to use
    let themeToApply = state.theme;
    if (state.theme === 'system') {
        themeToApply = prefersDarkMode ? 'dark' : 'light';
    }
    
    // Apply theme attributes
    document.documentElement.setAttribute('data-theme', themeToApply);
    
    // Update theme toggle button appearance
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.classList.toggle('dark-mode', themeToApply === 'dark');
    }
    
    // Highlight selected theme in settings
    if (elements.themeButtons) {
        elements.themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme') === state.theme);
        });
    }
}

// Toggle between light and dark theme
function toggleTheme() {
    // Get current theme
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    // Toggle to opposite theme
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Update state
    state.theme = newTheme;
    localStorage.setItem('ctfbot_theme', newTheme);
    
    // Apply the new theme
    applyTheme();
    
    // Show toast notification
    toast.show(`Switched to ${newTheme} theme`, 'info');
}

// Update API status indicator and text
function updateApiStatus(isConnected, message = '') {
    const indicator = document.getElementById('api-status-indicator');
    const statusText = document.getElementById('api-status-text');
    
    if (indicator) {
        indicator.classList.toggle('connected', isConnected);
    }
    
    if (statusText) {
        statusText.textContent = isConnected ? 'Connected' : message || 'Disconnected';
    }
}

// Save chat history to localStorage
function saveChatHistory() {
    if (!state.saveHistory) return;
    
    try {
        localStorage.setItem('ctfbot_chat_history', JSON.stringify(state.chatHistory));
    } catch (error) {
        console.error('Error saving chat history:', error);
        toast.show('Error saving chat history', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Theme button listeners
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.theme = btn.getAttribute('data-theme');
            applyTheme();
        });
    });

    // Settings button listener
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', openSettingsModal);
    }

    // Message input auto-resize
    if (elements.messageInput) {
        elements.messageInput.addEventListener('input', adjustTextareaHeight);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        if (elements.messageInput) {
            adjustTextareaHeight();
        }
    });
}

// Check API key status
async function checkApiKeyStatus() {
    if (!state.apiKey) {
        updateApiStatus(false, 'API key required');
        return false;
    }

    try {
        // Make a minimal API call to validate the key
        const response = await fetch(`${API_URL}?key=${state.apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "test"
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `Error ${response.status}: ${response.statusText}`;
            updateApiStatus(false, errorMessage);
            console.error('API key validation error:', errorMessage);
            return false;
        }

        // If we got here, API key is valid
        updateApiStatus(true);
        return true;

    } catch (error) {
        updateApiStatus(false, error.message);
        console.error('Error checking API key status:', error);
        return false;
    }
}

// Fetch available models from the Gemini API
async function fetchAvailableModels() {
    try {
        const response = await fetch(`${API_URL}/models?key=${state.apiKey}`);

        const result = await response.json();
        return result.models;
    } catch (error) {
        console.log('Error fetching models', error);
        return [];
    }
}

// Toast functionality
const toast = {
    container: document.getElementById('toast-container'),
    timeouts: new Map(),
    
    show(message, type = 'info', duration = 3000) {
        const toastElement = document.createElement('div');
        toastElement.className = `toast ${type}`;
        toastElement.textContent = message;
        
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
        
        // Add to DOM
        this.container.appendChild(toastElement);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toastElement.classList.add('show');
        });
        
        // Set timeout to remove
        const timeout = setTimeout(() => {
            toastElement.classList.remove('show');
            setTimeout(() => toastElement.remove(), 300);
            this.timeouts.delete(toastElement);
        }, duration);
        
        this.timeouts.set(toastElement, timeout);
        
        return toastElement;
    }
};

// Initialize the application
init();

// Function to adjust the height of the textarea
function adjustTextareaHeight() {
    if (!elements.messageInput) return;
    
    // Reset height to auto to properly calculate new height
    elements.messageInput.style.height = 'auto';
    
    // Calculate the new height (adding a small buffer to prevent scrollbar flicker)
    const newHeight = Math.min(elements.messageInput.scrollHeight + 2, 200);
    
    // Set the new height
    elements.messageInput.style.height = `${newHeight}px`;
    
    // Scroll to bottom if near bottom
    const container = elements.chatMessages;
    if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }
}