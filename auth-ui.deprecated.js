/**
 * IRON FIST LEAGUE — Authentication UI Manager
 * Professional UI handling for login, registration, and authentication flows
 */

import { authService, isValidEmail, isValidUsername, validatePasswordStrength } from './auth-service.js';

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

class AuthUIState {
  constructor() {
    this.currentForm = 'welcome'; // 'welcome', 'login', 'signup'
    this.isLoading = false;
    this.errors = [];
    this.successMessage = '';
  }
  
  setForm(form) {
    this.currentForm = form;
    this.errors = [];
    this.successMessage = '';
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
  
  clear() {
    this.errors = [];
    this.successMessage = '';
    this.isLoading = false;
  }
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

class AuthUIComponents {
  /**
   * Show loading overlay
   */
  static showLoading(message = 'Loading...') {
    let overlay = document.getElementById('auth-loading-overlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'auth-loading-overlay';
      overlay.className = 'auth-loading-overlay';
      overlay.innerHTML = `
        <div class="auth-loading-content">
          <div class="auth-loading-spinner"></div>
          <div class="auth-loading-text">${message}</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    
    overlay.style.display = 'flex';
  }
  
  /**
   * Hide loading overlay
   */
  static hideLoading() {
    const overlay = document.getElementById('auth-loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
  
  /**
   * Show error message
   */
  static showError(message, elementId = null) {
    // Remove any existing error
    this.hideError();
    
    const errorEl = document.createElement('div');
    errorEl.className = 'auth-error-message';
    errorEl.innerHTML = `
      <div class="auth-error-icon">⚠</div>
      <div class="auth-error-text">${message}</div>
    `;
    
    if (elementId) {
      const target = document.getElementById(elementId);
      if (target) {
        target.parentNode.insertBefore(errorEl, target.nextSibling);
      }
    } else {
      // Show as toast
      errorEl.style.position = 'fixed';
      errorEl.style.top = '20px';
      errorEl.style.right = '20px';
      errorEl.style.zIndex = '10000';
      document.body.appendChild(errorEl);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        if (errorEl.parentNode) {
          errorEl.parentNode.removeChild(errorEl);
        }
      }, 5000);
    }
  }
  
  /**
   * Hide error message
   */
  static hideError() {
    const errors = document.querySelectorAll('.auth-error-message');
    errors.forEach(error => {
      if (error.parentNode) {
        error.parentNode.removeChild(error);
      }
    });
  }
  
  /**
   * Show success message
   */
  static showSuccess(message) {
    // Remove any existing success message
    this.hideSuccess();
    
    const successEl = document.createElement('div');
    successEl.className = 'auth-success-message';
    successEl.innerHTML = `
      <div class="auth-success-icon">✓</div>
      <div class="auth-success-text">${message}</div>
    `;
    
    successEl.style.position = 'fixed';
    successEl.style.top = '20px';
    successEl.style.right = '20px';
    successEl.style.zIndex = '10000';
    document.body.appendChild(successEl);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (successEl.parentNode) {
        successEl.parentNode.removeChild(successEl);
      }
    }, 3000);
  }
  
  /**
   * Hide success message
   */
  static hideSuccess() {
    const successes = document.querySelectorAll('.auth-success-message');
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
    
    // Update toggle button text if it exists
    const toggleBtn = document.querySelector(`[data-toggle="${inputId}"]`);
    if (toggleBtn) {
      toggleBtn.textContent = type === 'password' ? '👁' : '👁‍🗨';
    }
  }
  
  /**
   * Update form validation state
   */
  static updateValidationState(input, isValid, message = '') {
    input.classList.remove('is-valid', 'is-invalid');
    
    if (isValid) {
      input.classList.add('is-valid');
    } else if (input.value.trim() !== '') {
      input.classList.add('is-invalid');
    }
    
    // Show/hide validation message
    const messageId = `${input.id}-validation`;
    let messageEl = document.getElementById(messageId);
    
    if (!isValid && message) {
      if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = messageId;
        messageEl.className = 'auth-validation-message';
        input.parentNode.appendChild(messageEl);
      }
      messageEl.textContent = message;
      messageEl.style.display = 'block';
    } else if (messageEl) {
      messageEl.style.display = 'none';
    }
  }
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

class FormValidator {
  /**
   * Validate login form
   */
  static validateLoginForm(username, password) {
    const errors = [];
    
    if (!username.trim()) {
      errors.push('Username or email is required');
    }
    
    if (!password) {
      errors.push('Password is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
  
  /**
   * Validate registration form
   */
  static validateRegistrationForm(username, email, password, confirmPassword, agreeTerms) {
    const errors = [];
    
    // Username validation
    if (!username.trim()) {
      errors.push('Username is required');
    } else if (!isValidUsername(username)) {
      errors.push('Username must be 3-20 characters and can only contain letters, numbers, underscores, and hyphens');
    }
    
    // Email validation
    if (!email.trim()) {
      errors.push('Email is required');
    } else if (!isValidEmail(email)) {
      errors.push('Please enter a valid email address');
    }
    
    // Password validation
    if (!password) {
      errors.push('Password is required');
    } else {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
      }
    }
    
    // Confirm password
    if (!confirmPassword) {
      errors.push('Please confirm your password');
    } else if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }
    
    // Terms agreement
    if (!agreeTerms) {
      errors.push('You must agree to the Terms and Privacy Policy');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

// ============================================================================
// AUTHENTICATION UI MANAGER
// ============================================================================

class AuthUIManager {
  constructor() {
    this.state = new AuthUIState();
    this.initialized = false;
  }
  
  /**
   * Initialize authentication UI
   */
  async initialize() {
    if (this.initialized) return;
    
    // Setup event listeners
    this.setupWelcomeScreen();
    this.setupLoginForm();
    this.setupSignupForm();
    
    // Check if user is already logged in
    if (authService.isLoggedIn()) {
      this.navigateToMainMenu();
    }
    
    this.initialized = true;
  }
  
  /**
   * Setup welcome screen
   */
  setupWelcomeScreen() {
    // Login button
    const loginBtn = document.getElementById('welcome-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        this.showLoginForm();
      });
    }
    
    // Signup button
    const signupBtn = document.getElementById('welcome-signup');
    if (signupBtn) {
      signupBtn.addEventListener('click', () => {
        this.showSignupForm();
      });
    }
    
    // Guest button
    const guestBtn = document.getElementById('welcome-guest');
    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        this.handleGuestLogin();
      });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('screen-welcome')?.classList.contains('active')) {
        switch (e.key) {
          case 'Enter':
            if (this.state.currentForm === 'welcome') {
              this.showLoginForm();
            }
            break;
          case 'Escape':
            // Skip intro - go directly to login
            this.showLoginForm();
            break;
          case '1':
            this.showLoginForm();
            break;
          case '2':
            this.showSignupForm();
            break;
          case '3':
            this.handleGuestLogin();
            break;
        }
      }
    });
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
    const backButton = document.getElementById('login-back');
    
    // Show/hide password
    if (showPasswordBtn && passwordInput) {
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
        this.showSignupForm();
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
    
    // Enter key support
    if (loginForm) {
      loginForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleLogin();
        }
      });
    }
    
    // Real-time validation
    if (usernameInput) {
      usernameInput.addEventListener('blur', () => {
        const value = usernameInput.value.trim();
        if (value) {
          const isValid = value.includes('@') ? isValidEmail(value) : isValidUsername(value);
          AuthUIComponents.updateValidationState(
            usernameInput, 
            isValid, 
            isValid ? '' : 'Please enter a valid username or email'
          );
        }
      });
    }
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
      showPasswordBtn.addEventListener('click', () => {
        AuthUIComponents.togglePasswordVisibility('signup-password');
      });
    }
    
    if (showConfirmBtn && confirmInput) {
      showConfirmBtn.addEventListener('click', () => {
        AuthUIComponents.togglePasswordVisibility('signup-confirm');
      });
    }
    
    // Login link
    if (loginLink) {
      loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showLoginForm();
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
    
    // Enter key support
    if (signupForm) {
      signupForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSignup();
        }
      });
    }
    
    // Real-time validation
    if (usernameInput) {
      usernameInput.addEventListener('blur', () => {
        const value = usernameInput.value.trim();
        if (value) {
          const isValid = isValidUsername(value);
          AuthUIComponents.updateValidationState(
            usernameInput,
            isValid,
            isValid ? '' : 'Username must be 3-20 characters (letters, numbers, _, -)'
          );
        }
      });
    }
    
    if (emailInput) {
      emailInput.addEventListener('blur', () => {
        const value = emailInput.value.trim();
        if (value) {
          const isValid = isValidEmail(value);
          AuthUIComponents.updateValidationState(
            emailInput,
            isValid,
            isValid ? '' : 'Please enter a valid email address'
          );
        }
      });
    }
    
    if (passwordInput) {
      passwordInput.addEventListener('blur', () => {
        const value = passwordInput.value;
        if (value) {
          const validation = validatePasswordStrength(value);
          AuthUIComponents.updateValidationState(
            passwordInput,
            validation.isValid,
            validation.errors.length > 0 ? validation.errors[0] : ''
          );
        }
      });
    }
    
    if (confirmInput) {
      confirmInput.addEventListener('blur', () => {
        const password = passwordInput.value;
        const confirm = confirmInput.value;
        if (confirm) {
          const isValid = password === confirm;
          AuthUIComponents.updateValidationState(
            confirmInput,
            isValid,
            isValid ? '' : 'Passwords do not match'
          );
        }
      });
    }
  }
  
  /**
   * Show welcome screen
   */
  showWelcomeScreen() {
    this.state.setForm('welcome');
    this.switchScreen('WELCOME');
  }
  
  /**
   * Show login form
   */
  showLoginForm() {
    this.state.setForm('login');
    this.switchScreen('LOGIN');
    
    // Focus on username field
    setTimeout(() => {
      const usernameInput = document.getElementById('login-username');
      if (usernameInput) {
        usernameInput.focus();
      }
    }, 300);
  }
  
  /**
   * Show signup form
   */
  showSignupForm() {
    this.state.setForm('signup');
    this.switchScreen('LOGIN'); // Using same screen, different tab
    
    // Switch to signup tab
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    
    if (loginTab && signupTab) {
      loginTab.classList.remove('active');
      signupTab.classList.add('active');
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
   * Show forgot password
   */
  showForgotPassword() {
    // For simplicity, we'll just show a message
    AuthUIComponents.showError('Password reset feature is currently unavailable. Please contact support.');
  }
  
  /**
   * Switch screen
   */
  switchScreen(screenKey) {
    if (window.__iflShowScreen) {
      window.__iflShowScreen(screenKey);
    } else {
      // Fallback: manually show screen
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });
      document.getElementById(`screen-${screenKey.toLowerCase()}`)?.classList.add('active');
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
    if (!validation.isValid) {
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
    const validation = FormValidator.validateRegistrationForm(
      username, email, password, confirmPassword, agreeTerms
    );
    
    if (!validation.isValid) {
      AuthUIComponents.showError(validation.errors[0]);
      return;
    }
    
    // Show loading
    this.state.setLoading(true);
    AuthUIComponents.showLoading('Creating account...');
    
    try {
      // Attempt registration
      const result = await authService.register({
        username,
        email,
        password
      });
      
      if (result.success) {
        AuthUIComponents.showSuccess('Account created successfully!');
        
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
   * Logout
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
// EXPORTS
// ============================================================================

// Create singleton instance
const authUIManager = new AuthUIManager();

// Export manager
export { authUIManager };

// Initialize on import
authUIManager.initialize().catch(console.error);