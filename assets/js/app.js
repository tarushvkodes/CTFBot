// CTFBot - Main JavaScript file
// This implements the Gemini API integration and UI functionality

// Constants and configuration
const DEFAULT_API_KEY = ""; // No default API key - users must provide their own
const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent"; // Using gemini-2.0-flash model
const MAX_HISTORY_LENGTH = 20; // Maximum number of messages to keep in history
const MAX_CONVERSATIONS = 50; // Maximum number of conversations to store
const MESSAGES_PER_PAGE = 50; // Number of messages to load at once
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
    currentContext: '',
    historyPage: 0, // Current page of history being displayed
    totalHistoryPages: 0 // Total number of history pages
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
    historyToggle: document.getElementById('history-toggle'),
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

// Add event listener to settings button
if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', openSettingsModal);
}

// Add event listener to close settings button
if (elements.closeSettings) {
    elements.closeSettings.addEventListener('click', closeSettingsModal);
}

// Add event listener to save settings button
if (elements.saveSettings) {
    elements.saveSettings.addEventListener('click', saveSettings);
}

// Function to save settings
function saveSettings() {
    const apiKey = elements.apiKeyInput.value.trim();
    const saveHistory = elements.historyToggle.checked;
    const theme = document.querySelector('.theme-btn.active').getAttribute('data-theme');

    // Save settings to local storage
    localStorage.setItem('ctfbot_api_key', apiKey);
    localStorage.setItem('ctfbot_save_history', saveHistory);
    localStorage.setItem('ctfbot_theme', theme);

    // Update state
    state.apiKey = apiKey;
    state.saveHistory = saveHistory;
    state.theme = theme;

    // Apply theme
    applyTheme();

    // Close settings modal
    closeSettingsModal();

    // Show toast notification
    toast.show('Settings saved successfully', 'success');
}

// Add event listener to send button
if (elements.sendBtn) {
    elements.sendBtn.addEventListener('click', async () => {
        const message = elements.messageInput.value.trim();
        if (message) {
            await sendMessage(message);
            elements.messageInput.value = '';
            adjustTextareaHeight();
        }
    });
}

// Add event listener to message input for Enter key
if (elements.messageInput) {
    elements.messageInput.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const message = elements.messageInput.value.trim();
            if (message) {
                await sendMessage(message);
                elements.messageInput.value = '';
                adjustTextareaHeight();
            }
        }
    });
}

// Function to adjust the height of the textarea
function adjustTextareaHeight() {
    if (elements.messageInput) {
        elements.messageInput.style.height = 'auto';
        elements.messageInput.style.height = `${elements.messageInput.scrollHeight}px`;
    }
}

// Function to display a message in the chat
function displayMessage(content, isUser = true) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'message-user' : 'message-assistant'}`;
    messageElement.innerHTML = `<div class="message-content">${content}</div>`;
    elements.chatMessages.appendChild(messageElement);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Hide welcome screen
function startNewChat() {
    // Clear chat messages
    elements.chatMessages.innerHTML = '';
    
    // Show welcome screen
    if (elements.welcomeScreen) {
        elements.welcomeScreen.style.display = 'block';
    }
    
    // Clear chat history
    state.chatHistory = [];
    
    // Clear input field
    if (elements.messageInput) {
        elements.messageInput.value = '';
        adjustTextareaHeight();
    }
    
    // Reset assistance type to default
    if (elements.assistanceType) {
        elements.assistanceType.value = 'analyze';
    }
}

// Initialize the application with loading states - simplified
async function init() {
    try {
        // Apply theme immediately
        applyTheme();

        // Check API status
        if (state.apiKey) {
            elements.apiKeyInput.value = state.apiKey;
            const isApiValid = await checkApiKeyStatus();
            if (!isApiValid) {
                elements.welcomeScreen.style.display = 'none';
                elements.apiKeyNotice.style.display = 'flex';
            }
        } else {
            elements.welcomeScreen.style.display = 'none';
            elements.apiKeyNotice.style.display = 'flex';
        }

        // Load chat history
        await loadChatHistory();

        // Apply preferences and setup
        setupEventListeners();
        adjustTextareaHeight();

        // Show welcome screen immediately
        requestAnimationFrame(() => {
            elements.welcomeScreen.style.opacity = '0';
            elements.welcomeScreen.style.display = 'block';
            requestAnimationFrame(() => {
              elements.welcomeScreen.style.opacity = '1';
            });
        });

    } catch (error) {
        console.error('Initialization error:', error);
        toast.show('Error initializing application: ' + error.message, 'error');

        // Show API key notice if initialization fails
        if (elements.apiKeyNotice) {
            elements.welcomeScreen.style.display = 'none';
            elements.apiKeyNotice.style.display = 'flex';
        }
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
    
    // Populate current settings
    elements.apiKeyInput.value = state.apiKey || '';
    elements.historyToggle.checked = state.saveHistory;
    
    // Highlight the current theme button
    if (elements.themeButtons) {
        elements.themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme') === state.theme);
        });
    }
    
    // Show the modal
    elements.settingsModal.classList.add('show');
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    // Focus on API key input for better UX
    setTimeout(() => elements.apiKeyInput.focus(), 100);
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
    
    // Hide the modal
    elements.settingsModal.classList.remove('show');
    
    // Restore background scrolling
    document.body.style.overflow = '';
}

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

// Check API key status
async function checkApiKeyStatus() {
    if (!state.apiKey) {
        updateApiStatus(false, 'API key required');
        return false;
    }

    try {
        // Make a lightweight request to the API to check auth
        const response = await fetch(`${API_URL}/models?key=${state.apiKey}`);

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || `Error ${response.status}: ${response.statusText}`;
            updateApiStatus(false, errorMessage);
            console.error('API key validation error:', errorMessage); // Log error
            return false;
        }

        // If we got here, API key is valid
        updateApiStatus(true);

        // Hide the API key notice if it was showing
        if (elements.apiKeyNotice) {
            elements.apiKeyNotice.style.display = 'none';
        }

        // Fetch available models if API key is valid
        await fetchAvailableModels();

        return true;

    } catch (error) {
        updateApiStatus(false, error.message);
        console.error('Error checking API key status:', error); // Log error
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

// Send a message to the Gemini API and add it to chat
async function sendMessage(message) {
    if (!state.apiKey) return;

    // Display user message
    displayMessage(message, true);

    // Set processing state
    setProcessingState(true);

    try {
        // Call the API
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${state.apiKey}`
            },
            body: JSON.stringify({ messages: [{ content: message }] }),
        });

        if (!response.ok) {
            console.log('API response error');
            displayMessage('Error: Unable to get a response from the API.', false);
            return;
        }

        const data = await response.json();
        const chatbotResponse = data.generations[0].generations[0].text;

        // Display chatbot response
        displayMessage(chatbotResponse, false);
    } catch (error) {
        console.log('Error sending message:', error);
        displayMessage('Error: Unable to send message.', false);
    } finally {
        // Reset processing state
        setProcessingState(false);
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