/**
 * IRON FIST LEAGUE — Authentication UI Manager
 * Handles all UI interactions for login, registration, and user feedback
 */

import { authService, validateUsername, isValidEmail, validatePasswordStrength } from './auth-professional.js';

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

class AuthUIState {
  constructor() {
    this.currentScreen = 'welcome'; // 'welcome', 'login', 'signup'
    this.isLoading = false;
    this.errors = [];
    this.successMessage = '';
    this.formData = {
      login: { identifier: '', password: '', rememberMe: false },
      signup: { username: '', email: '', password: '', confirmPassword: '', agreeTerms: false }
    };
  }
  
  setScreen(screen) {
    this.currentScreen = screen;
    this.clearMessages();
  }
  
  setLoading(loading) {
    this.isLoading = loading;
  }
  
  setErrors(errors) {
    this.errors = Array.isArray(errors) ? errors : [errors];
  }
  
  setSuccess(message) {
    this.successMessage = message;
  }
  
  clearMessages() {
    this.errors = [];
    this.successMessage = '';
  }
  
  updateFormData(form, field, value) {
    if (this.formData[form]) {
      this.formData[form][field] = value;
    }
  }
}

// ============================================================================
// UI COMPONENTS & ANIMATIONS
// ============================================================================

class AuthUIComponents {
  /**
   * Show loading overlay
   */
  static showLoading(message = 'Loading...') {
    // Remove existing overlay
    this.hideLoading();
    
    const overlay = document.createElement('div');
    overlay.id = 'auth-loading-overlay';
    overlay.className = 'auth-loading-overlay';
    overlay.innerHTML = `
      <div class="auth-loading-content">
        <div class="auth-loading-spinner"></div>
        <div class="auth-loading-text">${message}</div>
        <div class="auth-loading-subtext">Please wait...</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add CSS if not already present
    this.ensureLoadingStyles();
  }
  
  /**
   * Hide loading overlay
   */
  static hideLoading() {
    const overlay = document.getElementById('auth-loading-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
  
  /**
   * Show error message
   */
  static showError(message, duration = 5000) {
    // Remove existing error
    this.hideError();
    
    const errorEl = document.createElement('div');
    errorEl.className = 'auth-error-toast';
    errorEl.innerHTML = `
      <div class="error-toast-content">
        <div class="error-icon">⚠</div>
        <div class="error-message">${message}</div>
        <button class="error-close" aria-label="Close">×</button>
      </div>
    `;
    
    document.body.appendChild(errorEl);
    
    // Add close button handler
    const closeBtn = errorEl.querySelector('.error-close');
    closeBtn.addEventListener('click', () => {
      if (errorEl.parentNode) {
        errorEl.parentNode.removeChild(errorEl);
      }
    });
    
    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        if (errorEl.parentNode) {
          errorEl.parentNode.removeChild(errorEl);
        }
      }, duration);
    }
    
    // Add CSS if not already present
    this.ensureToastStyles();
    
    // Animate in
    setTimeout(() => {
      errorEl.classList.add('show');
    }, 10);
  }
  
  /**
   * Hide error message
   */
  static hideError() {
    const errors = document.querySelectorAll('.auth-error-toast');
    errors.forEach(error => {
      if (error.parentNode) {
        error.parentNode.removeChild(error);
      }
    });
  }
  
  /**
   * Show success message
   */
  static showSuccess(message, duration = 3000) {
    // Remove existing success
    this.hideSuccess();
    
    const successEl = document.createElement('div');
    successEl.className = 'auth-success-toast';
    successEl.innerHTML = `
      <div class="success-toast-content">
        <div class="success-icon">✓</div>
        <div class="success-message">${message}</div>
        <button class="success-close" aria-label="Close">×</button>
      </div>
    `;
    
    document.body.appendChild(successEl);
    
    // Add close button handler
    const closeBtn = successEl.querySelector('.success-close');
    closeBtn.addEventListener('click', () => {
      if (successEl.parentNode) {
        successEl.parentNode.removeChild(successEl);
      }
    });
    
    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        if (successEl.parentNode) {
          successEl.parentNode.removeChild(successEl);
        }
      }, duration);
    }
    
    // Add CSS if not already present
    this.ensureToastStyles();
    
    // Animate in
    setTimeout(() => {
      successEl.classList.add('show');
    }, 10);
  }
  
  /**
   * Hide success message
   */
  static hideSuccess() {
    const successes = document.querySelectorAll('.auth-success-toast');
    successes.forEach(success => {
      if (success.parentNode) {
        success.parentNode.removeChild(success);
      }
    });
  }
  
  /**
   * Toggle password visibility
   */
  static togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
    
    // Update toggle button text/icon
    const toggleBtn = document.querySelector(`[data-toggle="${inputId}"]`);
    if (toggleBtn) {
      if (type === 'password') {
        toggleBtn.innerHTML = '👁';
        toggleBtn.setAttribute('aria-label', 'Show password');
      } else {
        toggleBtn.innerHTML = '👁‍🗨';
        toggleBtn.setAttribute('aria-label', 'Hide password');
      }
    }
  }
  
  /**
   * Update input validation state
   */
  static updateInputValidation(input, isValid, message = '') {
    // Remove existing validation classes
    input.classList.remove('valid', 'invalid');
    
    // Remove existing validation message
    const messageId = `${input.id}-validation`;
    let messageEl = document.getElementById(messageId);
    
    if (messageEl && messageEl.parentNode) {
      messageEl.parentNode.removeChild(messageEl);
    }
    
    if (input.value.trim() === '') {
      // Empty field - no validation state
      return;
    }
    
    if (isValid) {
      input.classList.add('valid');
    } else {
      input.classList.add('invalid');
      
      // Show validation message
      if (message) {
        messageEl = document.createElement('div');
        messageEl.id = messageId;
        messageEl.className = 'input-validation-message';
        messageEl.textContent = message;
        messageEl.setAttribute('role', 'alert');
        
        // Insert after input
        input.parentNode.appendChild(messageEl);
      }
    }
  }
  
  /**
   * Ensure loading styles are present
   */
  static ensureLoadingStyles() {
    if (document.getElementById('auth-ui-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'auth-ui-styles';
    styleEl.textContent = `
      .auth-loading-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(10px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        animation: fadeIn 0.3s ease forwards;
      }
      
      .auth-loading-content {
        text-align: center;
        padding: 40px;
        background: rgba(13, 26, 42, 0.95);
        border: 2px solid #ff4444;
        border-radius: 12px;
        box-shadow: 0 0 60px rgba(255, 68, 68, 0.3);
        max-width: 300px;
        width: 90%;
      }
      
      .auth-loading-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(255, 68, 68, 0.3);
        border-top-color: #ff4444;
        border-radius: 50%;
        margin: 0 auto 20px;
        animation: spinnerRotate 1s linear infinite;
      }
      
      .auth-loading-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 18px;
        font-weight: 900;
        color: #ffffff;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
        margin-bottom: 8px;
      }
      
      .auth-loading-subtext {
        font-family: 'Rajdhani', sans-serif;
        font-size: 14px;
        color: #8acce8;
        font-weight: 600;
      }
      
      @keyframes spinnerRotate {
        to { transform: rotate(360deg); }
      }
      
      @keyframes fadeIn {
        to { opacity: 1; }
      }
    `;
    
    document.head.appendChild(styleEl);
  }
  
  /**
   * Ensure toast styles are present
   */
  static ensureToastStyles() {
    if (document.getElementById('auth-toast-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'auth-toast-styles';
    styleEl.textContent = `
      .auth-error-toast,
      .auth-success-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10001;
        max-width: 400px;
        width: 90%;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
      }
      
      .auth-error-toast.show,
      .auth-success-toast.show {
        transform: translateX(0);
      }
      
      .error-toast-content,
      .success-toast-content {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-radius: 8px;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        letter-spacing: 0.05em;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      
      .error-toast-content {
        background: rgba(222, 78, 78, 0.95);
        border: 1px solid #ff8a8a;
        color: #ffffff;
      }
      
      .success-toast-content {
        background: rgba(78, 222, 168, 0.95);
        border: 1px solid #8affcc;
        color: #000000;
      }
      
      .error-icon,
      .success-icon {
        font-size: 20px;
        margin-right: 12px;
        flex-shrink: 0;
      }
      
      .error-message,
      .success-message {
        flex: 1;
        font-size: 14px;
      }
      
      .error-close,
      .success-close {
        background: none;
        border: none;
        font-size: 20px;
        color: inherit;
        cursor: pointer;
        padding: 0;
        margin-left: 12px;
        flex-shrink: 0;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }
      
      .error-close:hover,
      .success-close:hover {
        opacity: 1;
      }
      
      .input-validation-message {
        font-size: 12px;
        color: #de4e4e;
        font-weight: 600;
        margin-top: 4px;
        padding: 4px 8px;
        background: rgba(222, 78, 78, 0.1);
        border-radius: 4px;
        border-left: 2px solid #de4e4e;
        animation: slideIn 0.3s ease;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    
    document.head.appendChild(styleEl);
  }
}

// ============================================================================
// FORM VALIDATION & HANDLING
// ============================================================================

class FormValidator {
  /**
   * Validate login form in real-time
   */
  static validateLoginField(field, value) {
    switch (field) {
      case 'identifier':
        if (!value.trim()) {
          return { valid: false, message: 'Username or email is required' };
        }
        // Basic format check
        const isEmail = value.includes('@');
        if (isEmail && !isValidEmail(value)) {
          return { valid: false, message: 'Please enter a valid email address' };
        }
        return { valid: true };
        
      case 'password':
        if (!value) {
          return { valid: false, message: 'Password is required' };
        }
        return { valid: true };
        
      default:
        return { valid: true };
    }
  }
  
  /**
   * Validate signup form in real-time
   */
  static validateSignupField(field, value, formData = {}) {
    switch (field) {
      case 'username':
        if (!value.trim()) {
          return { valid: false, message: 'Username is required' };
        }
        const usernameValidation = validateUsername(value);
        if (!usernameValidation.valid) {
          return { valid: false, message: usernameValidation.error };
        }
        return { valid: true };
        
      case 'email':
        if (!value.trim()) {
          return { valid: false, message: 'Email is required' };
        }
        if (!isValidEmail(value)) {
          return { valid: false, message: 'Please enter a valid email address' };
        }
        return { valid: true };
        
      case 'password':
        if (!value) {
          return { valid: false, message: 'Password is required' };
        }
        const passwordValidation = validatePasswordStrength(value);
        if (!passwordValidation.valid) {
          return { valid: false, message: passwordValidation.errors[0] };
        }
        return { valid: true, score: passwordValidation.score };
        
      case 'confirmPassword':
        if (!value) {
          return { valid: false, message: 'Please confirm your password' };
        }
        if (value !== formData.password) {
          return { valid: false, message: 'Passwords do not match' };
        }
        return { valid: true };
        
      default:
        return { valid: true };
    }
  }
  
  /**
   * Validate complete login form
   */
  static validateLoginForm(identifier, password) {
    const errors = [];
    
    const identifierValidation = this.validateLoginField('identifier', identifier);
    if (!identifierValidation.valid) {
      errors.push(identifierValidation.message);
    }
    
    const passwordValidation = this.validateLoginField('password', password);
    if (!passwordValidation.valid) {
      errors.push(passwordValidation.message);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
  
  /**
   * Validate complete signup form
   */
  static validateSignupForm(username, email, password, confirmPassword, agreeTerms) {
    const errors = [];
    
    const usernameValidation = this.validateSignupField('username', username);
    if (!usernameValidation.valid) {
      errors.push(usernameValidation.message);
    }
    
    const emailValidation = this.validateSignupField('email', email);
    if (!emailValidation.valid) {
      errors.push(emailValidation.message);
    }
    
    const passwordValidation = this.validateSignupField('password', password);
    if (!passwordValidation.valid) {
      errors.push(passwordValidation.message);
    }
    
    const confirmValidation = this.validateSignupField('confirmPassword', confirmPassword, { password });
    if (!confirmValidation.valid) {
      errors.push(confirmValidation.message);
    }
    
    if (!agreeTerms) {
      errors.push('You must agree to the Terms and Privacy Policy');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

// ============================================================================
// MAIN AUTH UI MANAGER
// ============================================================================

class AuthUIManager {
  constructor() {
    this.state = new AuthUIState();
    this.isInitialized = false;
    
    // Bind methods
    this.handleLogin = this.handleLogin.bind(this);
    this.handleSignup = this.handleSignup.bind(this);
    this.handleGuestLogin = this.handleGuestLogin.bind(this);
  }
  
  /**
   * Initialize authentication UI
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Setup welcome screen
      this.setupWelcomeScreen();
      
      // Setup login form
      this.setupLoginForm();
      
      // Setup signup form
      this.setupSignupForm();
      
      // Setup keyboard navigation
      this.setupKeyboardNavigation();
      
      // Check if user is already logged in
      await this.checkExistingSession();
      
      this.isInitialized = true;
      console.log('AuthUIManager initialized');
      
    } catch (error) {
      console.error('Failed to initialize AuthUIManager:', error);
    }
  }
  
  /**
   * Setup welcome screen
   */
  setupWelcomeScreen() {
    // Login button
    const loginBtn = document.getElementById('welcome-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        this.showLoginScreen();
      });
    }
    
    // Signup button
    const signupBtn = document.getElementById('welcome-signup');
    if (signupBtn) {
      signupBtn.addEventListener('click', () => {
        this.showSignupScreen();
      });
    }
    
    // Guest button
    const guestBtn = document.getElementById('welcome-guest');
    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        this.handleGuestLogin();
      });
    }
  }
  
  /**
   * Setup login form
   */
  setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    
    // Form elements
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const showPasswordBtn = document.getElementById('login-show-password');
    const rememberCheckbox = document.getElementById('login-remember');
    const forgotPasswordLink = document.getElementById('login-forgot-password');
    const loginButton = document.getElementById('login-submit');
    const signupLink = document.getElementById('login-to-signup');
    const guestButton = document.getElementById('login-guest');
    const backButton = document.getElementById('login-back');
    
    // Show/hide password
    if (showPasswordBtn && passwordInput) {
      showPasswordBtn.setAttribute('data-toggle', 'login-password');
      showPasswordBtn.addEventListener('click', () => {
        AuthUIComponents.togglePasswordVisibility('login-password');
      });
    }
    
    // Forgot password
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showForgotPassword();
      });
    }
    
    // Signup link
    if (signupLink) {
      signupLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSignupScreen();
      });
    }
    
    // Guest button
    if (guestButton) {
      guestButton.addEventListener('click', () => {
        this.handleGuestLogin();
      });
    }
    
    // Back button
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.showWelcomeScreen();
      });
    }
    
    // Form submission
    if (loginButton) {
      loginButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }
    
    // Real-time validation
    if (usernameInput) {
      usernameInput.addEventListener('blur', () => {
        const validation = FormValidator.validateLoginField('identifier', usernameInput.value);
        AuthUIComponents.updateInputValidation(usernameInput, validation.valid, validation.message);
      });
    }
    
    if (passwordInput) {
      passwordInput.addEventListener('blur', () => {
        const validation = FormValidator.validateLoginField('password', passwordInput.value);
        AuthUIComponents.updateInputValidation(passwordInput, validation.valid, validation.message);
      });
    }
    
    // Enter key support
    loginForm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleLogin();
      }
    });
  }
  
  /**
   * Setup signup form
   */
  setupSignupForm() {
    const signupForm = document.getElementById('signup-form');
    if (!signupForm) return;
    
    // Form elements
    const usernameInput = document.getElementById('signup-username');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-confirm');
    const showPasswordBtn = document.getElementById('signup-show-password');
    const showConfirmBtn = document.getElementById('signup-show-confirm');
    const termsCheckbox = document.getElementById('signup-terms');
    const signupButton = document.getElementById('signup-submit');
    const loginLink = document.getElementById('signup-to-login');
    const backButton = document.getElementById('signup-back');
    
    // Show/hide password
    if (showPasswordBtn && passwordInput) {
      showPasswordBtn.setAttribute('data-toggle', 'signup-password');
      showPasswordBtn.addEventListener('click', () => {
        AuthUIComponents.togglePasswordVisibility('signup-password');
      });
    }
    
    if (showConfirmBtn && confirmInput) {
      showConfirmBtn.setAttribute('data-toggle', 'signup-confirm');
      showConfirmBtn.addEventListener('click', () => {
        AuthUIComponents.togglePasswordVisibility('signup-confirm');
      });
    }
    
    // Login link
    if (loginLink) {
      loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showLoginScreen();
      });
    }
    
    // Back button
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.showWelcomeScreen();
      });
    }
    
    // Form submission
    if (signupButton) {
      signupButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSignup();
      });
    }
    
    // Real-time validation
    if (usernameInput) {
      usernameInput.addEventListener('blur', () => {
        const validation = FormValidator.validateSignupField('username', usernameInput.value);
        AuthUIComponents.updateInputValidation(usernameInput, validation.valid, validation.message);
      });
    }
    
    if (emailInput) {
      emailInput.addEventListener('blur', () => {
        const validation = FormValidator.validateSignupField('email', emailInput.value);
        AuthUIComponents.updateInputValidation(emailInput, validation.valid, validation.message);
      });
    }
    
    if (passwordInput) {
      passwordInput.addEventListener('blur', () => {
        const validation = FormValidator.validateSignupField('password', passwordInput.value);
        AuthUIComponents.updateInputValidation(passwordInput, validation.valid, validation.message);
      });
    }
    
    if (confirmInput) {
      confirmInput.addEventListener('blur', () => {
        const formData = {
          password: passwordInput.value
        };
        const validation = FormValidator.validateSignupField('confirmPassword', confirmInput.value, formData);
        AuthUIComponents.updateInputValidation(confirmInput, validation.valid, validation.message);
      });
    }
    
    // Enter key support
    signupForm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSignup();
      }
    });
  }
  
  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      // Only handle if we're on auth screens
      const isAuthScreen = document.getElementById('screen-welcome')?.classList.contains('active') ||
                          document.getElementById('screen-login')?.classList.contains('active');
      
      if (!isAuthScreen) return;
      
      switch (e.key) {
        case 'Escape':
          if (this.state.currentScreen === 'login' || this.state.currentScreen === 'signup') {
            this.showWelcomeScreen();
          }
          break;
          
        case 'Tab':
          // Prevent tab from leaving form
          if (this.state.currentScreen === 'login' || this.state.currentScreen === 'signup') {
            e.preventDefault();
            // Could implement custom tab navigation here
          }
          break;
      }
    });
  }
  
  /**
   * Check for existing session
   */
  async checkExistingSession() {
    if (authService.isLoggedIn()) {
      // User is already logged in, skip auth screens
      this.navigateToMainMenu();
    }
  }
  
  /**
   * Show welcome screen
   */
  showWelcomeScreen() {
    this.state.setScreen('welcome');
    this.switchScreen('WELCOME');
  }
  
  /**
   * Show login screen
   */
  showLoginScreen() {
    this.state.setScreen('login');
    this.switchScreen('LOGIN');
    
    // Ensure login form is active
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginForm && signupForm) {
      loginForm.classList.add('active');
      signupForm.classList.remove('active');
    }
    
    // Update header title
    const headerTitle = document.getElementById('auth-header-title');
    if (headerTitle) {
      headerTitle.textContent = 'ENTER THE ARENA';
    }
    
    // Focus on username field
    setTimeout(() => {
      const usernameInput = document.getElementById('login-username');
      if (usernameInput) {
        usernameInput.focus();
      }
    }, 300);
  }
  
  /**
   * Show signup screen
   */
  showSignupScreen() {
    this.state.setScreen('signup');
    this.switchScreen('LOGIN'); // Using same screen container
    
    // Ensure signup form is active
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginForm && signupForm) {
      loginForm.classList.remove('active');
      signupForm.classList.add('active');
    }
    
    // Update header title
    const headerTitle = document.getElementById('auth-header-title');
    if (headerTitle) {
      headerTitle.textContent = 'JOIN THE LEAGUE';
    }
    
    // Focus on username field
    setTimeout(() => {
      const usernameInput = document.getElementById('signup-username');
      if (usernameInput) {
        usernameInput.focus();
      }
    }, 300);
  }
  
  /**
   * Show forgot password screen
   */
  showForgotPassword() {
    // For now, show a simple message
    AuthUIComponents.showError('Password reset feature coming soon! Please contact support if you need assistance.');
  }
  
  /**
   * Switch screen using game's screen system
   */
  switchScreen(screenKey) {
    if (window.__iflShowScreen) {
      window.__iflShowScreen(screenKey);
    } else {
      // Fallback: manually show screen
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });
      const targetScreen = document.getElementById(`screen-${screenKey.toLowerCase()}`);
      if (targetScreen) {
        targetScreen.classList.add('active');
      }
    }
  }
  
  /**
   * Handle login
   */
  async handleLogin() {
    if (this.state.isLoading) return;
    
    // Get form values
    const username = document.getElementById('login-username')?.value || '';
    const password = document.getElementById('login-password')?.value || '';
    const rememberMe = document.getElementById('login-remember')?.checked || false;
    
    // Validate
    const validation = FormValidator.validateLoginForm(username, password);
    if (!validation.valid) {
      AuthUIComponents.showError(validation.errors[0]);
      return;
    }
    
    // Show loading
    this.state.setLoading(true);
    AuthUIComponents.showLoading('Authenticating...');
    
    try {
      // Attempt login
      const result = await authService.login(username, password, rememberMe);
      
      if (result.success) {
        AuthUIComponents.showSuccess('Login successful!');
        
        // Navigate to main menu after short delay
        setTimeout(() => {
          this.navigateToMainMenu();
        }, 1000);
      } else {
        AuthUIComponents.showError(result.errors[0]);
      }
    } catch (error) {
      console.error('Login error:', error);
      AuthUIComponents.showError('An unexpected error occurred. Please try again.');
    } finally {
      this.state.setLoading(false);
      AuthUIComponents.hideLoading();
    }
  }
  
  /**
   * Handle signup
   */
  async handleSignup() {
    if (this.state.isLoading) return;
    
    // Get form values
    const username = document.getElementById('signup-username')?.value || '';
    const email = document.getElementById('signup-email')?.value || '';
    const password = document.getElementById('signup-password')?.value || '';
    const confirmPassword = document.getElementById('signup-confirm')?.value || '';
    const agreeTerms = document.getElementById('signup-terms')?.checked || false;
    
    // Validate
    const validation = FormValidator.validateSignupForm(
      username, email, password, confirmPassword, agreeTerms
    );
    
    if (!validation.valid) {
      AuthUIComponents.showError(validation.errors[0]);
      return;
    }
    
    // Show loading
    this.state.setLoading(true);
    AuthUIComponents.showLoading('Creating your fighter account...');
    
    try {
      // Attempt registration
      const result = await authService.register({
        username,
        email,
        password
      });
      
      if (result.success) {
        AuthUIComponents.showSuccess('Account created successfully! Welcome to Iron Fist League!');
        
        // Navigate to main menu after short delay
        setTimeout(() => {
          this.navigateToMainMenu();
        }, 1500);
      } else {
        AuthUIComponents.showError(result.errors[0]);
      }
    } catch (error) {
      console.error('Registration error:', error);
      AuthUIComponents.showError('An unexpected error occurred. Please try again.');
    } finally {
      this.state.setLoading(false);
      AuthUIComponents.hideLoading();
    }
  }
  
  /**
   * Handle guest login
   */
  async handleGuestLogin() {
    if (this.state.isLoading) return;
    
    // Show loading
    this.state.setLoading(true);
    AuthUIComponents.showLoading('Entering as guest...');
    
    try {
      // Login as guest
      const result = await authService.loginAsGuest();
      
      if (result.success) {
        AuthUIComponents.showSuccess('Entering as guest. Progress will not be saved.');
        
        // Navigate to main menu after short delay
        setTimeout(() => {
          this.navigateToMainMenu();
        }, 1000);
      } else {
        AuthUIComponents.showError('Failed to enter as guest. Please try again.');
      }
    } catch (error) {
      console.error('Guest login error:', error);
      AuthUIComponents.showError('An unexpected error occurred. Please try again.');
    } finally {
      this.state.setLoading(false);
      AuthUIComponents.hideLoading();
    }
  }
  
  /**
   * Navigate to main menu
   */
  navigateToMainMenu() {
    this.switchScreen('MAIN_MENU');
    
    // Dispatch event for other modules
    document.dispatchEvent(new CustomEvent('userAuthenticated', {
      detail: { user: authService.getCurrentUser() }
    }));
  }
  
  /**
   * Logout current user
   */
  async logout() {
    AuthUIComponents.showLoading('Logging out...');
    
    try {
      await authService.logout();
      this.showWelcomeScreen();
      AuthUIComponents.showSuccess('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      AuthUIComponents.showError('Failed to logout. Please try again.');
    } finally {
      AuthUIComponents.hideLoading();
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

const authUIManager = new AuthUIManager();

// Export for use in other modules
export { authUIManager };

// Auto-initialize when imported
authUIManager.initialize().catch(console.error);