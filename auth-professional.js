/**
 * IRON FIST LEAGUE — Professional Authentication System
 * Complete, secure authentication with proper validation and session management
 */

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const AUTH_CONFIG = {
  // Storage keys (versioned to avoid conflicts)
  STORAGE: {
    USERS: 'ifl_users_v3',
    SESSIONS: 'ifl_sessions_v3',
    CURRENT_SESSION: 'ifl_current_session_v3',
    GUEST_DATA: 'ifl_guest_data_v3',
    SETTINGS: 'ifl_user_settings_v3'
  },
  
  // Security settings
  SECURITY: {
    MIN_PASSWORD_LENGTH: 8,
    SESSION_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    PASSWORD_HASH_ITERATIONS: 10000 // For PBKDF2 simulation
  },
  
  // Validation rules
  VALIDATION: {
    USERNAME: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 20,
      PATTERN: /^[a-zA-Z0-9_-]+$/,
      ERROR_MESSAGES: {
        TOO_SHORT: 'Username must be at least 3 characters',
        TOO_LONG: 'Username cannot exceed 20 characters',
        INVALID_CHARS: 'Username can only contain letters, numbers, underscores, and hyphens'
      }
    },
    EMAIL: {
      PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      ERROR_MESSAGE: 'Please enter a valid email address'
    },
    PASSWORD: {
      REQUIREMENTS: {
        MIN_LENGTH: 8,
        REQUIRE_UPPERCASE: true,
        REQUIRE_LOWERCASE: true,
        REQUIRE_NUMBER: true,
        REQUIRE_SPECIAL: false
      },
      ERROR_MESSAGES: {
        TOO_SHORT: 'Password must be at least 8 characters',
        NO_UPPERCASE: 'Password must contain at least one uppercase letter',
        NO_LOWERCASE: 'Password must contain at least one lowercase letter',
        NO_NUMBER: 'Password must contain at least one number'
      }
    }
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Simple cryptographic hash simulation
 * Note: In production, use Web Crypto API or proper bcrypt
 */
async function hashPassword(password) {
  // Simulate PBKDF2-like hashing
  const salt = generateId().substr(0, 16);
  let hash = 0;
  
  // Simple hash simulation (replace with proper crypto in production)
  for (let i = 0; i < AUTH_CONFIG.SECURITY.PASSWORD_HASH_ITERATIONS; i++) {
    for (let j = 0; j < password.length; j++) {
      const char = password.charCodeAt(j);
      hash = ((hash << 5) - hash) + char + salt.charCodeAt(j % salt.length);
      hash = hash & hash; // Convert to 32bit integer
    }
  }
  
  return {
    hash: hash.toString(36),
    salt: salt,
    algorithm: 'simulated_pbkdf2',
    iterations: AUTH_CONFIG.SECURITY.PASSWORD_HASH_ITERATIONS
  };
}

/**
 * Verify password against stored hash
 */
async function verifyPassword(password, storedHash, salt, algorithm) {
  // In production, use proper verification based on algorithm
  // For now, simulate the same hashing process
  if (algorithm === 'simulated_pbkdf2') {
    let hash = 0;
    for (let i = 0; i < AUTH_CONFIG.SECURITY.PASSWORD_HASH_ITERATIONS; i++) {
      for (let j = 0; j < password.length; j++) {
        const char = password.charCodeAt(j);
        hash = ((hash << 5) - hash) + char + salt.charCodeAt(j % salt.length);
        hash = hash & hash;
      }
    }
    return hash.toString(36) === storedHash;
  }
  
  return false;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return email && AUTH_CONFIG.VALIDATION.EMAIL.PATTERN.test(email.trim());
}

/**
 * Validate username
 */
function validateUsername(username) {
  const { MIN_LENGTH, MAX_LENGTH, PATTERN, ERROR_MESSAGES } = AUTH_CONFIG.VALIDATION.USERNAME;
  const trimmed = username.trim();
  
  if (trimmed.length < MIN_LENGTH) {
    return { valid: false, error: ERROR_MESSAGES.TOO_SHORT };
  }
  
  if (trimmed.length > MAX_LENGTH) {
    return { valid: false, error: ERROR_MESSAGES.TOO_LONG };
  }
  
  if (!PATTERN.test(trimmed)) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_CHARS };
  }
  
  return { valid: true, username: trimmed };
}

/**
 * Validate password strength
 */
function validatePasswordStrength(password) {
  const { REQUIREMENTS, ERROR_MESSAGES } = AUTH_CONFIG.VALIDATION.PASSWORD;
  const errors = [];
  
  if (password.length < REQUIREMENTS.MIN_LENGTH) {
    errors.push(ERROR_MESSAGES.TOO_SHORT);
  }
  
  if (REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push(ERROR_MESSAGES.NO_UPPERCASE);
  }
  
  if (REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push(ERROR_MESSAGES.NO_LOWERCASE);
  }
  
  if (REQUIREMENTS.REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push(ERROR_MESSAGES.NO_NUMBER);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    score: calculatePasswordScore(password)
  };
}

/**
 * Calculate password strength score (0-100)
 */
function calculatePasswordScore(password) {
  let score = 0;
  
  // Length contributes up to 40 points
  score += Math.min(40, (password.length / 20) * 40);
  
  // Character variety contributes up to 60 points
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  
  return Math.min(100, score);
}

// ============================================================================
// STORAGE MANAGEMENT
// ============================================================================

class StorageManager {
  /**
   * Get all users from storage
   */
  static getUsers() {
    try {
      const usersJson = localStorage.getItem(AUTH_CONFIG.STORAGE.USERS);
      return usersJson ? JSON.parse(usersJson) : [];
    } catch (error) {
      console.error('Error reading users:', error);
      return [];
    }
  }
  
  /**
   * Save user to storage
   */
  static saveUser(user) {
    try {
      const users = this.getUsers();
      const index = users.findIndex(u => u.id === user.id);
      
      if (index >= 0) {
        users[index] = user;
      } else {
        users.push(user);
      }
      
      localStorage.setItem(AUTH_CONFIG.STORAGE.USERS, JSON.stringify(users));
      return true;
    } catch (error) {
      console.error('Error saving user:', error);
      return false;
    }
  }
  
  /**
   * Get user by identifier (username or email)
   */
  static getUserByIdentifier(identifier) {
    const users = this.getUsers();
    const lowerIdentifier = identifier.toLowerCase().trim();
    
    return users.find(u => 
      u.username.toLowerCase() === lowerIdentifier ||
      u.email.toLowerCase() === lowerIdentifier
    );
  }
  
  /**
   * Get user by ID
   */
  static getUserById(userId) {
    const users = this.getUsers();
    return users.find(u => u.id === userId);
  }
  
  /**
   * Check if identifier is already taken
   */
  static isIdentifierTaken(identifier) {
    const user = this.getUserByIdentifier(identifier);
    return !!user;
  }
  
  /**
   * Create or update session
   */
  static createSession(userId, rememberMe = false) {
    const session = {
      id: generateId(),
      userId: userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (rememberMe ? AUTH_CONFIG.SECURITY.SESSION_DURATION : 24 * 60 * 60 * 1000), // 1 day if not remembered
      userAgent: navigator.userAgent,
      ip: 'local',
      rememberMe: rememberMe
    };
    
    // Save session
    const sessions = this.getSessions();
    sessions.push(session);
    localStorage.setItem(AUTH_CONFIG.STORAGE.SESSIONS, JSON.stringify(sessions));
    
    // Set as current session
    localStorage.setItem(AUTH_CONFIG.STORAGE.CURRENT_SESSION, JSON.stringify(session.id));
    
    return session;
  }
  
  /**
   * Get all sessions
   */
  static getSessions() {
    try {
      const sessionsJson = localStorage.getItem(AUTH_CONFIG.STORAGE.SESSIONS);
      return sessionsJson ? JSON.parse(sessionsJson) : [];
    } catch (error) {
      console.error('Error reading sessions:', error);
      return [];
    }
  }
  
  /**
   * Get current session
   */
  static getCurrentSession() {
    try {
      const sessionIdJson = localStorage.getItem(AUTH_CONFIG.STORAGE.CURRENT_SESSION);
      if (!sessionIdJson) return null;
      
      const sessionId = JSON.parse(sessionIdJson);
      const sessions = this.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      // Check if session is valid and not expired
      if (session && session.expiresAt > Date.now()) {
        return session;
      } else {
        // Session expired or invalid
        this.clearCurrentSession();
        return null;
      }
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }
  
  /**
   * Clear current session
   */
  static clearCurrentSession() {
    localStorage.removeItem(AUTH_CONFIG.STORAGE.CURRENT_SESSION);
  }
  
  /**
   * Save guest data
   */
  static saveGuestData(guestData) {
    try {
      localStorage.setItem(AUTH_CONFIG.STORAGE.GUEST_DATA, JSON.stringify(guestData));
      return true;
    } catch (error) {
      console.error('Error saving guest data:', error);
      return false;
    }
  }
  
  /**
   * Get guest data
   */
  static getGuestData() {
    try {
      const guestJson = localStorage.getItem(AUTH_CONFIG.STORAGE.GUEST_DATA);
      return guestJson ? JSON.parse(guestJson) : null;
    } catch (error) {
      console.error('Error reading guest data:', error);
      return null;
    }
  }
  
  /**
   * Clear guest data
   */
  static clearGuestData() {
    localStorage.removeItem(AUTH_CONFIG.STORAGE.GUEST_DATA);
  }
  
  /**
   * Clear all authentication data (for testing/reset)
   */
  static clearAll() {
    Object.values(AUTH_CONFIG.STORAGE).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================

class AuthenticationService {
  constructor() {
    this.currentUser = null;
    this.currentSession = null;
    this.isInitialized = false;
    this.eventListeners = new Map();
  }
  
  /**
   * Initialize authentication service
   */
  async initialize() {
    if (this.isInitialized) return;
    
    // Check for existing session
    this.currentSession = StorageManager.getCurrentSession();
    
    if (this.currentSession) {
      this.currentUser = StorageManager.getUserById(this.currentSession.userId);
      
      if (this.currentUser) {
        // Update last login time
        this.currentUser.lastLogin = Date.now();
        StorageManager.saveUser(this.currentUser);
        
        this.emit('userRestored', this.getSafeUserData(this.currentUser));
      } else {
        // User not found, clear invalid session
        StorageManager.clearCurrentSession();
        this.currentSession = null;
      }
    } else {
      // Check for guest data
      const guestData = StorageManager.getGuestData();
      if (guestData) {
        this.currentUser = guestData;
        this.emit('guestRestored', guestData);
      }
    }
    
    this.isInitialized = true;
    console.log('AuthenticationService initialized');
  }
  
  /**
   * Register a new user
   */
  async register(userData) {
    const { username, email, password } = userData;
    
    // Validation
    const validationErrors = [];
    
    // Username validation
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      validationErrors.push(usernameValidation.error);
    }
    
    // Email validation
    if (!isValidEmail(email)) {
      validationErrors.push(AUTH_CONFIG.VALIDATION.EMAIL.ERROR_MESSAGE);
    }
    
    // Password validation
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      validationErrors.push(...passwordValidation.errors);
    }
    
    // Check if username or email is taken
    if (StorageManager.isIdentifierTaken(username)) {
      validationErrors.push('Username is already taken');
    }
    
    if (StorageManager.isIdentifierTaken(email)) {
      validationErrors.push('Email is already registered');
    }
    
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors
      };
    }
    
    try {
      // Hash password
      const passwordHash = await hashPassword(password);
      
      // Create user object
      const user = {
        id: generateId(),
        username: usernameValidation.username,
        email: email.trim().toLowerCase(),
        passwordHash: passwordHash.hash,
        passwordSalt: passwordHash.salt,
        passwordAlgorithm: passwordHash.algorithm,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        isVerified: false,
        isActive: true,
        loginAttempts: 0,
        lastFailedLogin: null,
        
        // Profile
        profile: {
          avatar: null,
          bio: '',
          location: '',
          title: 'Novice Fighter'
        },
        
        // Game stats
        stats: {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          totalPoints: 0,
          highestCombo: 0,
          rank: 'Beginner',
          unlockedCharacters: ['marcus', 'vesper'],
          unlockedStages: ['underground'],
          favoriteCharacter: 'marcus',
          playTime: 0
        },
        
        // Settings
        settings: {
          volume: 0.8,
          difficulty: 'normal',
          controls: 'default',
          language: 'en',
          showTutorial: true,
          screenShake: true,
          particleEffects: true
        }
      };
      
      // Save user
      const saved = StorageManager.saveUser(user);
      
      if (!saved) {
        return {
          success: false,
          errors: ['Failed to create account. Please try again.']
        };
      }
      
      // Create session (auto-login after registration)
      const session = StorageManager.createSession(user.id, true);
      
      this.currentUser = user;
      this.currentSession = session;
      
      this.emit('userRegistered', this.getSafeUserData(user));
      this.emit('userLoggedIn', this.getSafeUserData(user));
      
      return {
        success: true,
        user: this.getSafeUserData(user),
        session: session
      };
      
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        errors: ['An unexpected error occurred. Please try again.']
      };
    }
  }
  
  /**
   * Login user
   */
  async login(identifier, password, rememberMe = false) {
    // Validation
    if (!identifier.trim() || !password) {
      return {
        success: false,
        errors: ['Please enter both username/email and password']
      };
    }
    
    try {
      // Find user
      const user = StorageManager.getUserByIdentifier(identifier);
      
      if (!user) {
        return {
          success: false,
          errors: ['Invalid username or password']
        };
      }
      
      // Check if account is locked
      if (this.isAccountLocked(user)) {
        return {
          success: false,
          errors: ['Account is temporarily locked. Please try again later.']
        };
      }
      
      // Verify password
      const isValid = await verifyPassword(
        password, 
        user.passwordHash, 
        user.passwordSalt, 
        user.passwordAlgorithm
      );
      
      if (!isValid) {
        // Increment failed attempts
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        user.lastFailedLogin = Date.now();
        StorageManager.saveUser(user);
        
        return {
          success: false,
          errors: ['Invalid username or password']
        };
      }
      
      // Reset failed attempts on successful login
      user.loginAttempts = 0;
      user.lastFailedLogin = null;
      user.lastLogin = Date.now();
      StorageManager.saveUser(user);
      
      // Create session
      const session = StorageManager.createSession(user.id, rememberMe);
      
      this.currentUser = user;
      this.currentSession = session;
      
      this.emit('userLoggedIn', this.getSafeUserData(user));
      
      return {
        success: true,
        user: this.getSafeUserData(user),
        session: session
      };
      
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        errors: ['An unexpected error occurred. Please try again.']
      };
    }
  }
  
  /**
   * Login as guest
   */
  async loginAsGuest() {
    const guestData = {
      id: 'guest_' + generateId(),
      username: 'GUEST',
      email: null,
      isGuest: true,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      
      // Profile
      profile: {
        avatar: null,
        bio: 'Guest Fighter',
        location: 'Arena',
        title: 'Guest'
      },
      
      // Game stats (reset on each guest session)
      stats: {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalPoints: 0,
        highestCombo: 0,
        rank: 'Guest',
        unlockedCharacters: ['marcus', 'vesper'],
        unlockedStages: ['underground'],
        favoriteCharacter: 'marcus',
        playTime: 0
      },
      
      // Settings
      settings: {
        volume: 0.8,
        difficulty: 'normal',
        controls: 'default',
        language: 'en',
        showTutorial: true,
        screenShake: true,
        particleEffects: true
      }
    };
    
    // Save guest data
    StorageManager.saveGuestData(guestData);
    StorageManager.clearCurrentSession();
    
    this.currentUser = guestData;
    this.currentSession = null;
    
    this.emit('guestLoggedIn', guestData);
    
    return {
      success: true,
      user: guestData,
      isGuest: true
    };
  }
  
  /**
   * Logout current user
   */
  async logout() {
    const wasGuest = this.isGuest();
    const oldUser = this.currentUser;
    
    StorageManager.clearCurrentSession();
    
    if (wasGuest) {
      StorageManager.clearGuestData();
    }
    
    this.currentUser = null;
    this.currentSession = null;
    
    if (wasGuest) {
      this.emit('guestLoggedOut', oldUser);
    } else {
      this.emit('userLoggedOut', oldUser);
    }
    
    return { success: true };
  }
  
  /**
   * Check if account is locked due to failed attempts
   */
  isAccountLocked(user) {
    if (!user.loginAttempts || user.loginAttempts < AUTH_CONFIG.SECURITY.MAX_LOGIN_ATTEMPTS) {
      return false;
    }
    
    if (!user.lastFailedLogin) {
      return false;
    }
    
    const lockoutTime = user.lastFailedLogin + AUTH_CONFIG.SECURITY.LOCKOUT_DURATION;
    return Date.now() < lockoutTime;
  }
  
  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser ? this.getSafeUserData(this.currentUser) : null;
  }
  
  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return !!this.currentUser;
  }
  
  /**
   * Check if current user is guest
   */
  isGuest() {
    return this.currentUser?.isGuest === true;
  }
  
  /**
   * Get safe user data (without sensitive information)
   */
  getSafeUserData(user) {
    if (!user) return null;
    
    const safeUser = { ...user };
    
    // Remove sensitive data
    delete safeUser.passwordHash;
    delete safeUser.passwordSalt;
    delete safeUser.passwordAlgorithm;
    delete safeUser.loginAttempts;
    delete safeUser.lastFailedLogin;
    
    return safeUser;
  }
  
  /**
   * Update user stats
   */
  async updateStats(statsUpdate) {
    if (!this.currentUser || this.isGuest()) {
      return { success: false, error: 'Cannot update guest stats' };
    }
    
    try {
      const user = StorageManager.getUserById(this.currentUser.id);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      
      // Update stats
      Object.assign(user.stats, statsUpdate);
      user.stats.playTime = (user.stats.playTime || 0) + (statsUpdate.playTimeDelta || 0);
      
      // Save updated user
      StorageManager.saveUser(user);
      this.currentUser = user;
      
      this.emit('statsUpdated', user.stats);
      
      return { success: true, stats: user.stats };
      
    } catch (error) {
      console.error('Error updating stats:', error);
      return { success: false, error: 'Failed to update stats' };
    }
  }
  
  /**
   * Update user settings
   */
  async updateSettings(settingsUpdate) {
    if (!this.currentUser) {
      return { success: false, error: 'No user logged in' };
    }
    
    try {
      if (this.isGuest()) {
        // Update guest settings
        Object.assign(this.currentUser.settings, settingsUpdate);
        StorageManager.saveGuestData(this.currentUser);
      } else {
        // Update registered user settings
        const user = StorageManager.getUserById(this.currentUser.id);
        if (!user) {
          return { success: false, error: 'User not found' };
        }
        
        Object.assign(user.settings, settingsUpdate);
        StorageManager.saveUser(user);
        this.currentUser = user;
      }
      
      this.emit('settingsUpdated', this.currentUser.settings);
      
      return { success: true, settings: this.currentUser.settings };
      
    } catch (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: 'Failed to update settings' };
    }
  }
  
  /**
   * Event system
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
  
  emit(event, data) {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event);
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

const authService = new AuthenticationService();

// Auto-initialize
authService.initialize().catch(console.error);

// Export for use in other modules
export { 
  authService, 
  AUTH_CONFIG,
  validateUsername,
  isValidEmail,
  validatePasswordStrength,
  calculatePasswordScore,
  StorageManager
};