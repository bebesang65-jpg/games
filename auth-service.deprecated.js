/**
 * IRON FIST LEAGUE — Professional Authentication Service
 * Secure client-side authentication with backend-ready architecture
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Storage keys
  STORAGE_KEYS: {
    USERS: 'ifl_users_v2',
    SESSIONS: 'ifl_sessions_v2',
    CURRENT_SESSION: 'ifl_current_session_v2',
    GUEST_DATA: 'ifl_guest_data_v2',
    SETTINGS: 'ifl_user_settings'
  },
  
  // Security settings
  SECURITY: {
    MIN_PASSWORD_LENGTH: 8,
    SALT_ROUNDS: 10, // For hypothetical bcrypt implementation
    SESSION_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000 // 15 minutes in milliseconds
  },
  
  // Validation rules
  VALIDATION: {
    USERNAME: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 20,
      PATTERN: /^[a-zA-Z0-9_-]+$/ // Alphanumeric, underscore, hyphen
    },
    EMAIL: {
      PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    PASSWORD: {
      REQUIREMENTS: {
        MIN_LENGTH: 8,
        REQUIRE_UPPERCASE: true,
        REQUIRE_LOWERCASE: true,
        REQUIRE_NUMBER: true,
        REQUIRE_SPECIAL: false
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
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Simple hash function for demo purposes
 * In production, use proper bcrypt or similar
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Secure password hashing (simplified for demo)
 * In production, use: bcrypt.hash(password, saltRounds)
 */
function hashPassword(password) {
  // This is a simplified version for demo
  // In real implementation, use proper bcrypt
  const salt = 'ifl_salt_' + Math.random().toString(36).substr(2, 10);
  return {
    hash: simpleHash(password + salt),
    salt: salt,
    version: 'v1'
  };
}

/**
 * Verify password (simplified for demo)
 * In production, use: bcrypt.compare(password, storedHash)
 */
function verifyPassword(password, storedHash, salt) {
  // Simplified verification
  return simpleHash(password + salt) === storedHash;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return CONFIG.VALIDATION.EMAIL.PATTERN.test(email);
}

/**
 * Validate username
 */
function isValidUsername(username) {
  const { MIN_LENGTH, MAX_LENGTH, PATTERN } = CONFIG.VALIDATION.USERNAME;
  return (
    username.length >= MIN_LENGTH &&
    username.length <= MAX_LENGTH &&
    PATTERN.test(username)
  );
}

/**
 * Validate password strength
 */
function validatePasswordStrength(password) {
  const { REQUIREMENTS } = CONFIG.VALIDATION.PASSWORD;
  const errors = [];
  
  if (password.length < REQUIREMENTS.MIN_LENGTH) {
    errors.push(`Password must be at least ${REQUIREMENTS.MIN_LENGTH} characters`);
  }
  
  if (REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (REQUIREMENTS.REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// STORAGE MANAGEMENT
// ============================================================================

/**
 * Get all users from storage
 */
function getUsers() {
  try {
    const usersJson = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
    return usersJson ? JSON.parse(usersJson) : [];
  } catch (error) {
    console.error('Error reading users from storage:', error);
    return [];
  }
}

/**
 * Save user to storage
 */
function saveUser(user) {
  try {
    const users = getUsers();
    const index = users.findIndex(u => u.id === user.id);
    
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(users));
    return true;
  } catch (error) {
    console.error('Error saving user:', error);
    return false;
  }
}

/**
 * Get user by username or email
 */
function getUserByIdentifier(identifier) {
  const users = getUsers();
  return users.find(u => 
    u.username.toLowerCase() === identifier.toLowerCase() ||
    u.email.toLowerCase() === identifier.toLowerCase()
  );
}

/**
 * Get user by ID
 */
function getUserById(userId) {
  const users = getUsers();
  return users.find(u => u.id === userId);
}

/**
 * Check if username or email is taken
 */
function isIdentifierTaken(identifier) {
  const users = getUsers();
  return users.some(u => 
    u.username.toLowerCase() === identifier.toLowerCase() ||
    u.email.toLowerCase() === identifier.toLowerCase()
  );
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new session
 */
function createSession(userId) {
  const session = {
    id: generateId(),
    userId: userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + CONFIG.SECURITY.SESSION_DURATION,
    userAgent: navigator.userAgent,
    ip: 'local' // In production, get from server
  };
  
  // Save session
  const sessions = getSessions();
  sessions.push(session);
  localStorage.setItem(CONFIG.STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  
  // Set as current session
  localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session.id));
  
  return session;
}

/**
 * Get all sessions
 */
function getSessions() {
  try {
    const sessionsJson = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSIONS);
    return sessionsJson ? JSON.parse(sessionsJson) : [];
  } catch (error) {
    console.error('Error reading sessions:', error);
    return [];
  }
}

/**
 * Get current session
 */
function getCurrentSession() {
  try {
    const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION);
    if (!sessionId) return null;
    
    const sessions = getSessions();
    const session = sessions.find(s => s.id === JSON.parse(sessionId));
    
    // Check if session is expired
    if (session && session.expiresAt > Date.now()) {
      return session;
    } else {
      // Session expired, clear it
      localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION);
      return null;
    }
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
}

/**
 * End current session
 */
function endSession() {
  const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION);
  if (sessionId) {
    // Remove from sessions list
    const sessions = getSessions();
    const updatedSessions = sessions.filter(s => s.id !== JSON.parse(sessionId));
    localStorage.setItem(CONFIG.STORAGE_KEYS.SESSIONS, JSON.stringify(updatedSessions));
  }
  
  localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION);
}

// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================

class AuthService {
  constructor() {
    this.currentUser = null;
    this.currentSession = null;
    this.isInitialized = false;
  }
  
  /**
   * Initialize authentication service
   */
  async initialize() {
    if (this.isInitialized) return;
    
    // Check for existing session
    this.currentSession = getCurrentSession();
    
    if (this.currentSession) {
      this.currentUser = getUserById(this.currentSession.userId);
      
      // Update last login time
      if (this.currentUser) {
        this.currentUser.lastLogin = Date.now();
        saveUser(this.currentUser);
      }
    }
    
    this.isInitialized = true;
    console.log('AuthService initialized');
  }
  
  /**
   * Register a new user
   */
  async register(userData) {
    const { username, email, password } = userData;
    
    // Validation
    const validationErrors = [];
    
    if (!isValidUsername(username)) {
      validationErrors.push('Username must be 3-20 characters and can only contain letters, numbers, underscores, and hyphens');
    }
    
    if (!isValidEmail(email)) {
      validationErrors.push('Please enter a valid email address');
    }
    
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      validationErrors.push(...passwordValidation.errors);
    }
    
    // Check if username or email is taken
    if (isIdentifierTaken(username)) {
      validationErrors.push('Username is already taken');
    }
    
    if (isIdentifierTaken(email)) {
      validationErrors.push('Email is already registered');
    }
    
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors
      };
    }
    
    // Hash password
    const passwordHash = hashPassword(password);
    
    // Create user
    const user = {
      id: generateId(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: passwordHash.hash,
      passwordSalt: passwordHash.salt,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      profile: {
        avatar: null,
        bio: '',
        location: ''
      },
      stats: {
        matchesPlayed: 0,
        matchesWon: 0,
        totalPoints: 0,
        highestCombo: 0,
        rank: 'Beginner',
        unlockedCharacters: ['marcus', 'vesper'],
        unlockedStages: ['underground']
      },
      settings: {
        volume: 0.8,
        difficulty: 'normal',
        controls: 'default',
        language: 'en'
      },
      isVerified: false,
      isActive: true
    };
    
    // Save user
    const saved = saveUser(user);
    
    if (!saved) {
      return {
        success: false,
        errors: ['Failed to create account. Please try again.']
      };
    }
    
    // Create session
    const session = createSession(user.id);
    
    this.currentUser = user;
    this.currentSession = session;
    
    return {
      success: true,
      user: this.getSafeUserData(user),
      session: session
    };
  }
  
  /**
   * Login user
   */
  async login(identifier, password, rememberMe = false) {
    // Find user
    const user = getUserByIdentifier(identifier);
    
    if (!user) {
      return {
        success: false,
        errors: ['Invalid username or password']
      };
    }
    
    // Check if account is locked
    if (user.loginAttempts && user.loginAttempts >= CONFIG.SECURITY.MAX_LOGIN_ATTEMPTS) {
      const lockoutTime = user.lastFailedLogin || 0;
      if (Date.now() - lockoutTime < CONFIG.SECURITY.LOCKOUT_DURATION) {
        return {
          success: false,
          errors: ['Account is temporarily locked. Please try again later.']
        };
      } else {
        // Reset lockout
        user.loginAttempts = 0;
        saveUser(user);
      }
    }
    
    // Verify password
    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    
    if (!isValid) {
      // Increment failed attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      user.lastFailedLogin = Date.now();
      saveUser(user);
      
      return {
        success: false,
        errors: ['Invalid username or password']
      };
    }
    
    // Reset failed attempts
    user.loginAttempts = 0;
    user.lastLogin = Date.now();
    saveUser(user);
    
    // Create session
    const session = createSession(user.id);
    
    this.currentUser = user;
    this.currentSession = session;
    
    return {
      success: true,
      user: this.getSafeUserData(user),
      session: session
    };
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
      stats: {
        matchesPlayed: 0,
        matchesWon: 0,
        totalPoints: 0,
        highestCombo: 0,
        unlockedCharacters: ['marcus', 'vesper'],
        unlockedStages: ['underground']
      },
      settings: {
        volume: 0.8,
        difficulty: 'normal',
        controls: 'default',
        language: 'en'
      }
    };
    
    // Save guest data
    localStorage.setItem(CONFIG.STORAGE_KEYS.GUEST_DATA, JSON.stringify(guestData));
    
    this.currentUser = guestData;
    
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
    endSession();
    localStorage.removeItem(CONFIG.STORAGE_KEYS.GUEST_DATA);
    
    this.currentUser = null;
    this.currentSession = null;
    
    return { success: true };
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
    delete safeUser.loginAttempts;
    delete safeUser.lastFailedLogin;
    
    return safeUser;
  }
  
  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    if (!this.currentUser || this.currentUser.id !== userId) {
      return {
        success: false,
        errors: ['Unauthorized']
      };
    }
    
    const user = getUserById(userId);
    if (!user) {
      return {
        success: false,
        errors: ['User not found']
      };
    }
    
    // Apply updates
    Object.assign(user, updates);
    
    // Save updated user
    const saved = saveUser(user);
    
    if (saved) {
      this.currentUser = user;
      return {
        success: true,
        user: this.getSafeUserData(user)
      };
    } else {
      return {
        success: false,
        errors: ['Failed to update profile']
      };
    }
  }
  
  /**
   * Update user stats
   */
  async updateStats(stats) {
    if (!this.currentUser || this.currentUser.isGuest) {
      return { success: false };
    }
    
    const user = getUserById(this.currentUser.id);
    if (!user) return { success: false };
    
    // Update stats
    Object.assign(user.stats, stats);
    
    // Save
    saveUser(user);
    this.currentUser = user;
    
    return { success: true };
  }
  
  /**
   * Save user settings
   */
  async saveSettings(settings) {
    if (!this.currentUser) return { success: false };
    
    if (this.currentUser.isGuest) {
      // Save guest settings separately
      this.currentUser.settings = settings;
      localStorage.setItem(CONFIG.STORAGE_KEYS.GUEST_DATA, JSON.stringify(this.currentUser));
      return { success: true };
    }
    
    const user = getUserById(this.currentUser.id);
    if (!user) return { success: false };
    
    user.settings = settings;
    saveUser(user);
    this.currentUser = user;
    
    return { success: true };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Create singleton instance
const authService = new AuthService();

// Export functions
export {
  authService,
  isValidEmail,
  isValidUsername,
  validatePasswordStrength,
  CONFIG
};

// Initialize on import
authService.initialize().catch(console.error);