// CTFBot - Main JavaScript file
// This implements the Gemini API integration and UI functionality

// Constants and configuration
const DEFAULT_API_KEY = ""; // No default API key - users must provide their own
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1";
const MODEL_NAME = "gemini-pro";
const API_URL = `${API_BASE_URL}/models/${MODEL_NAME}:generateContent`;
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

// Add new function to handle new chat
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

// Interactive Cube Implementation
const cubeElements = {
    cube: document.querySelector('.cube'),
    faces: document.querySelectorAll('.cube-face')
};

// Create CTFBot ASCII Logo
const ctfbotAsciiLogo = `
 ██████╗████████╗███████╗██████╗  ██████╗ ████████╗
██╔════╝╚══██╔══╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝
██║        ██║   █████╗  ██████╔╝██║   ██║   ██║   
██║        ██║   ██╔══╝  ██╔══██╗██║   ██║   ██║   
╚██████╗   ██║   ██║     ██████╔╝╚██████╔╝   ██║   
 ╚═════╝   ╚═╝   ╚═╝     ╚═════╝  ╚═════╝    ╚═╝   
`;

// Initialize the cube
function initCube() {
    if (!cubeElements.cube) return;
    
    // Apply ASCII art to all faces
    cubeElements.faces.forEach(face => {
        face.textContent = ctfbotAsciiLogo;
    });
    
    // Set up cube rotation variables
    let isDragging = false;
    let previousMousePosition = {
        x: 0,
        y: 0
    };
    let rotationSpeed = {
        x: 0.2,
        y: 0.2
    };
    let cubeRotation = {
        x: -20,
        y: -20
    };
    
    // Add auto-rotation animation
    function autoRotate() {
        if (!isDragging) {
            cubeRotation.x += rotationSpeed.x;
            cubeRotation.y += rotationSpeed.y;
            updateCubeRotation();
        }
        requestAnimationFrame(autoRotate);
    }
    
    // Start auto-rotation if user hasn't disabled reduced motion
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        autoRotate();
    }
    
    // Update cube rotation based on current rotation values
    function updateCubeRotation() {
        cubeElements.cube.style.transform = `rotateX(${cubeRotation.x}deg) rotateY(${cubeRotation.y}deg)`;
    }
    
    // Mouse event handlers
    cubeElements.cube.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    // Touch event handlers for mobile
    cubeElements.cube.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.touches[0];
        startDrag({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    });
    
    document.addEventListener('touchmove', e => {
        if (isDragging) {
            e.preventDefault();
            const touch = e.touches[0];
            drag({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
        }
    });
    
    document.addEventListener('touchend', stopDrag);
    
    // Start dragging
    function startDrag(e) {
        isDragging = true;
        previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };
        cubeElements.cube.style.transition = 'none';
    }
    
    // Handle dragging motion
    function drag(e) {
        if (isDragging) {
            const dx = e.clientX - previousMousePosition.x;
            const dy = e.clientY - previousMousePosition.y;
            
            cubeRotation.y += dx * 0.5;
            cubeRotation.x -= dy * 0.5;
            
            updateCubeRotation();
            
            previousMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
        }
    }
    
    // Stop dragging
    function stopDrag() {
        isDragging = false;
        cubeElements.cube.style.transition = 'transform 1s ease';
    }
}

// Initialize the application
// App loading state management
const loadingStates = {
    init: {
        message: 'Initializing CTFBot...',
        progress: 0
    },
    api: {
        message: 'Checking API connection...',
        progress: 25
    },
    history: {
        message: 'Loading chat history...',
        progress: 50
    },
    theme: {
        message: 'Applying preferences...',
        progress: 75
    },
    ready: {
        message: 'Ready!',
        progress: 100
    }
};

// Initialize the application with loading states
async function init() {
    try {
        // Create loading overlay
        const loadingOverlay = createLoadingOverlay();
        document.body.appendChild(loadingOverlay);
        
        // Update loading state - Init
        updateLoadingState(loadingStates.init);
        
        // Apply theme immediately
        applyTheme();
        await delay(300); // Small delay for visual feedback
        
        // Check API status
        updateLoadingState(loadingStates.api);
        if (state.apiKey) {
            elements.apiKeyInput.value = state.apiKey;
            await checkApiKeyStatus();
        }
        await delay(300);
        
        // Load chat history
        updateLoadingState(loadingStates.history);
        await loadChatHistory();
        await delay(300);
        
        // Apply preferences
        updateLoadingState(loadingStates.theme);
        setupEventListeners();
        adjustTextareaHeight();
        await delay(300);
        
        // Ready state
        updateLoadingState(loadingStates.ready);
        await delay(500);
        
        // Remove loading overlay with fade out
        loadingOverlay.style.opacity = '0';
        await delay(300);
        loadingOverlay.remove();
        
        // Show welcome animation
        elements.welcomeScreen.style.opacity = '0';
        elements.welcomeScreen.style.display = 'block';
        await delay(100);
        elements.welcomeScreen.style.opacity = '1';
        
    } catch (error) {
        console.error('Initialization error:', error);
        toast.show('Error initializing application: ' + error.message, 'error');
    }
}

// Create loading overlay element
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

// Helper function for creating delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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

    // Add new chat button handler
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
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

// Add a new function to improve code block handling
function processMessageContent(content) {
    if (!content) return '';
    
    // Escape HTML to prevent XSS
    let processed = escapeHtml(content);
    
    // Handle code blocks with language specification
    processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        const highlightedCode = Prism.highlight(
            code.trim(),
            Prism.languages[language] || Prism.languages.plaintext,
            language
        );
        return `
            <div class="code-block" role="region" aria-label="Code block ${language}">
                <div class="code-header">
                    <span class="code-language">${language}</span>
                    <button class="copy-btn" onclick="copyCode(this)" aria-label="Copy code">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                </div>
                <pre class="line-numbers"><code class="language-${language}">${highlightedCode}</code></pre>
            </div>`;
    });
    
    // Handle inline code
    processed = processed.replace(/`([^`]+)`/g, (match, code) => {
        const highlighted = Prism.highlight(
            code,
            Prism.languages.plaintext,
            'plaintext'
        );
        return `<code class="inline-code">${highlighted}</code>`;
    });
    
    // Convert URLs to clickable links with security attributes
    processed = processed.replace(
        /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="external-link">$1</a>'
    );
    
    // Process new lines and preserve spacing
    return processed.replace(/\n/g, '<br>');
}

// Toast notification system
const toast = {
    container: null,
    
    init() {
        // Create toast container if it doesn't exist
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'info', duration = 3000) {
        this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = message;
        
        this.container.appendChild(toast);
        
        // Trigger reflow for animation
        toast.offsetHeight;
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                this.container.removeChild(toast);
            }, 300);
        }, duration);
    }
};

// Update API status with toast notifications
function updateApiStatus(isConnected, errorMessage = '') {
    elements.apiStatusIndicator.classList.toggle('connected', isConnected);
    elements.apiStatusText.textContent = isConnected ? 
        'API Status: Connected' : 
        `API Status: ${errorMessage || 'Disconnected'}`;
    
    if (isConnected) {
        toast.show('Successfully connected to Gemini API', 'success');
        elements.apiKeyNotice.style.display = 'none';
    } else {
        toast.show(`API Error: ${errorMessage}`, 'error');
        if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
            elements.apiKeyNotice.style.display = 'flex';
        }
    }
}

// Update copy code function to use toast
function copyCode(button) {
    const codeBlock = button.closest('.code-block');
    const code = codeBlock.querySelector('code').textContent;
    
    navigator.clipboard.writeText(code).then(() => {
        toast.show('Code copied to clipboard', 'success');
        button.classList.add('success');
        setTimeout(() => button.classList.remove('success'), 2000);
    }).catch(err => {
        toast.show('Failed to copy code', 'error');
        button.classList.add('error');
        setTimeout(() => button.classList.remove('error'), 2000);
    });
}

// Nice Feedback copy code function
function copyFeedback() {
    const feedbackButton = document.getElementById('copy-feedback');
    if (elements.apiStatusIndicator.classList.contains('connected')) {
        toast.show('Feedback Received, Thank you!', 'success');
        feedbackButton.classList.add('success');
        setTimeout(() => feedbackButton.classList.remove('success'), 2000);
    } else {
        toast.show('Could not send Feedback', 'error');
        feedbackButton.classList.add('error');
        setTimeout(() => feedbackButton.classList.remove('error'), 2000);
    }
}

// Add toast notifications to settings save
async function saveSettings() {
    const newApiKey = elements.apiKeyInput.value.trim();
    
    try {
        if (newApiKey && newApiKey !== state.apiKey) {
            state.apiKey = newApiKey;
            localStorage.setItem('ctfbot_api_key', newApiKey);
            const isValid = await checkApiKeyStatus();
            if (isValid) {
                toast.show('Settings saved successfully', 'success');
            }
        }
        
        state.saveHistory = elements.historyToggle.checked;
        localStorage.setItem('ctfbot_save_history', state.saveHistory);
        
        if (!state.saveHistory) {
            clearChatHistory();
            toast.show('Chat history cleared', 'info');
        }
        
        closeSettingsModal();
    } catch (error) {
        toast.show('Failed to save settings: ' + error.message, 'error');
    }
}

// Add new functions for chat history pagination
function loadChatHistory() {
    if (state.saveHistory) {
        try {
            const savedHistory = localStorage.getItem('ctfbot_chat_history');
            if (savedHistory) {
                state.chatHistory = JSON.parse(savedHistory);
                state.totalHistoryPages = Math.ceil(state.chatHistory.length / MESSAGES_PER_PAGE);
                
                // Only load the most recent page initially
                loadHistoryPage(state.totalHistoryPages - 1);
            }
        } catch (e) {
            console.error('Error loading chat history:', e);
        }
    }
}

function loadHistoryPage(pageNumber) {
    // Clear current chat
    elements.chatMessages.innerHTML = '';
    
    const start = pageNumber * MESSAGES_PER_PAGE;
    const end = Math.min(start + MESSAGES_PER_PAGE, state.chatHistory.length);
    
    // Load only messages for current page
    const pageMessages = state.chatHistory.slice(start, end);
    pageMessages.forEach(msg => {
        addMessageToChat(msg.type, msg.content, false); // false = don't scroll
    });
    
    state.historyPage = pageNumber;
    updatePaginationControls();
}

function updatePaginationControls() {
    const paginationContainer = document.getElementById('pagination-controls');
    if (!paginationContainer) return;
    
    paginationContainer.innerHTML = '';
    
    if (state.totalHistoryPages <= 1) return;
    
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = state.historyPage === 0;
    prevBtn.onclick = () => loadHistoryPage(state.historyPage - 1);
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = state.historyPage === state.totalHistoryPages - 1;
    nextBtn.onclick = () => loadHistoryPage(state.historyPage + 1);
    
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${state.historyPage + 1} of ${state.totalHistoryPages}`;
    
    paginationContainer.append(prevBtn, pageInfo, nextBtn);
}

// Modify addMessageToChat to support pagination
function addMessageToChat(type, content, shouldScroll = true) {
    const messageElement = addEmptyMessage(type);
    const contentElement = messageElement.querySelector('.message-content');
    const processedContent = processMessageContent(content);
    contentElement.innerHTML = processedContent;
    
    if (shouldScroll) {
        requestAnimationFrame(() => {
            elements.chatMessages.scrollTo({
                top: elements.chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        });
    }
    
    // Update pagination if needed
    if (state.chatHistory.length % MESSAGES_PER_PAGE === 0) {
        state.totalHistoryPages = Math.ceil(state.chatHistory.length / MESSAGES_PER_PAGE);
        updatePaginationControls();
    }
}

// Implement size limits in saveChatHistory
function saveChatHistory() {
    if (state.saveHistory) {
        try {
            // Trim history if it exceeds maximum length
            if (state.chatHistory.length > MAX_HISTORY_LENGTH) {
                state.chatHistory = state.chatHistory.slice(-MAX_HISTORY_LENGTH);
            }
            
            // Remove oldest conversations if total conversations exceeds limit
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
            
            while (conversations.length > MAX_CONVERSATIONS) {
                conversations.shift(); // Remove oldest conversation
            }
            
            state.chatHistory = conversations.flat();
            
            localStorage.setItem('ctfbot_chat_history', JSON.stringify(state.chatHistory));
        } catch (e) {
            console.error('Error saving chat history:', e);
            // If storage quota exceeded, remove older items
            if (e.name === 'QuotaExceededError') {
                clearOldestConversation();
                saveChatHistory(); // Try saving again
            }
        }
    }
}

// Add function to clear oldest conversation when storage is full
function clearOldestConversation() {
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
    
    if (conversations.length > 0) {
        conversations.shift(); // Remove oldest conversation
        state.chatHistory = conversations.flat();
    }
}

// Gather info and show the appropriate interaction screen
// Clear chat history
function clearChatHistory() {
    state.chatHistory = [];
    localStorage.removeItem('ctfbot_chat_history');
}

// Toggle chat history sidebar with improved handling
function toggleChatHistory() {
    const isVisible = elements.chatHistorySidebar.classList.contains('show');
    
    if (isVisible) {
        elements.chatHistorySidebar.classList.remove('show');
        elements.sidebarOverlay.classList.remove('show');
        document.body.style.overflow = '';
    } else {
        elements.chatHistorySidebar.classList.add('show');
        elements.sidebarOverlay.classList.add('show');
        // Prevent background scrolling on mobile
        document.body.style.overflow = 'hidden';
        
        // Update chat history list when opening
        updateChatHistoryList();
    }
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
document.addEventListener('DOMContentLoaded', () => {
    init();
    initCube();
});