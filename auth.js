/**
 * IRON FIST LEAGUE — Authentication & User Management (Compatibility Layer)
 * This file provides backward compatibility for the old auth API while using the new authService
 */

import { authService } from './auth-professional.js';

// Default character unlock requirements (for compatibility)
const UNLOCK_REQUIREMENTS = {
  // Base characters (always unlocked)
  marcus: { required: 0, description: "Starting Character" },
  vesper: { required: 0, description: "Starting Character" },
  
  // Unlockable characters
  cinder: { required: 100, description: "Reach 100 points" },
  kang: { required: 50, description: "Reach 50 points" },
  rook: { required: 200, description: "Reach 200 points" },
  zero: { required: 300, description: "Reach 300 points" },
  nova: { required: 150, description: "Reach 150 points" },
  reaper: { required: 250, description: "Reach 250 points" },
  titan: { required: 400, description: "Reach 400 points" },
  sable: { required: 350, description: "Reach 350 points" },
};

/**
 * Initialize authentication system (compatibility function)
 * Note: authService auto-initializes, so this is just for compatibility
 */
export function initAuth() {
  console.log('Auth system initialized (compatibility mode)');
  // authService auto-initializes, nothing to do here
}

/**
 * Setup authentication listeners (compatibility function)
 */
export function setupAuthListeners() {
  console.log('Auth listeners setup (compatibility mode)');
  // Listeners are handled by authUIManager in the new system
}

/**
 * Switch between login/signup tabs (compatibility function)
 */
export function switchAuthTab(tab) {
  console.log(`Switching to ${tab} tab (compatibility mode)`);
  // Tab switching is handled by authUIManager in the new system
}

/**
 * Handle login (compatibility function)
 */
export async function handleLogin() {
  console.log('Login handled by new auth system');
  // Login is handled by authUIManager in the new system
  return { success: false, error: 'Use new auth system' };
}

/**
 * Handle signup (compatibility function)
 */
export async function handleSignup() {
  console.log('Signup handled by new auth system');
  // Signup is handled by authUIManager in the new system
  return { success: false, error: 'Use new auth system' };
}

/**
 * Handle guest login (compatibility function)
 */
export async function handleGuest() {
  console.log('Guest login handled by new auth system');
  try {
    const result = await authService.loginAsGuest();
    if (result.success) {
      return { success: true, user: result.user };
    }
    return { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Show status message (compatibility function)
 */
export function showStatus(message, type = 'info') {
  console.log(`Status [${type}]: ${message}`);
  // Status messages are handled by authUIManager in the new system
}

/**
 * Get users from storage (compatibility function)
 */
export function getUsersFromStorage() {
  // Redirect to new storage system
  const users = [];
  try {
    // This is a simplified version - real implementation would use StorageManager
    const stored = localStorage.getItem('ifl_users');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error getting users:', error);
  }
  return users;
}

/**
 * Save user to storage (compatibility function)
 */
export function saveUserToStorage(user) {
  // Redirect to new storage system
  try {
    const users = getUsersFromStorage();
    const existingIndex = users.findIndex(u => u.username === user.username);
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem('ifl_users', JSON.stringify(users));
    return true;
  } catch (error) {
    console.error('Error saving user:', error);
    return false;
  }
}

/**
 * Restore session (compatibility function)
 */
export function restoreSession() {
  console.log('Session restore handled by new auth system');
  // Session restore is handled by authService auto-initialization
  return null;
}

/**
 * Get current user (compatibility wrapper)
 */
export function getCurrentUser() {
  const user = authService.getCurrentUser();
  if (!user) return null;
  
  // Convert new user format to old format for compatibility
  return {
    username: user.username || user.email || 'User',
    email: user.email || '',
    totalPoints: user.stats?.totalPoints || 0,
    matchesPlayed: user.stats?.matchesPlayed || 0,
    matchesWon: user.stats?.matchesWon || 0,
    highestCombo: user.stats?.highestCombo || 0,
    unlockedCharacters: ['marcus', 'vesper'], // Default for now
    unlockedStages: ['underground'],
    createdAt: user.createdAt || Date.now(),
    lastLogin: user.lastLogin || Date.now(),
    isGuest: user.type === 'guest',
    stats: user.stats || {}
  };
}

/**
 * Check if user is logged in (compatibility wrapper)
 */
export function isLoggedIn() {
  return authService.isLoggedIn();
}

/**
 * Check if user is guest (compatibility wrapper)
 */
export function isGuest() {
  return authService.isGuest();
}

/**
 * Get unlocked characters for current user (compatibility function)
 */
export function getUnlockedCharacters() {
  const user = getCurrentUser();
  return user?.unlockedCharacters || ['marcus', 'vesper'];
}

/**
 * Check if a character is unlocked (compatibility function)
 */
export function isCharacterUnlocked(characterId) {
  const user = getCurrentUser();
  if (!user) return false;
  
  // Base characters are always unlocked
  if (characterId === 'marcus' || characterId === 'vesper') return true;
  
  // Check if character is in unlocked list
  return user.unlockedCharacters?.includes(characterId) || false;
}

/**
 * Add points to user (compatibility function)
 */
export function addUserPoints(points) {
  const user = getCurrentUser();
  if (!user || user.isGuest) return false;
  
  // Update stats via authService
  authService.updateStats({
    totalPoints: (user.totalPoints || 0) + points
  }).catch(console.error);
  
  return true;
}

/**
 * Check for character unlocks (compatibility function)
 */
export function checkForCharacterUnlocks() {
  const user = getCurrentUser();
  if (!user || user.isGuest) return;
  
  // Simple unlock logic for compatibility
  const points = user.totalPoints || 0;
  const newlyUnlocked = [];
  
  // Check each character requirement
  Object.entries(UNLOCK_REQUIREMENTS).forEach(([charId, requirement]) => {
    if (requirement.required > 0 && points >= requirement.required) {
      if (!user.unlockedCharacters?.includes(charId)) {
        newlyUnlocked.push(charId);
      }
    }
  });
  
  return newlyUnlocked;
}

/**
 * Get character requirements (compatibility function)
 */
export function getCharacterRequirements(characterId) {
  return UNLOCK_REQUIREMENTS[characterId] || { required: 0, description: 'Unknown' };
}

/**
 * Get user stats (compatibility function)
 */
export function getUserStats() {
  const user = getCurrentUser();
  if (!user) return null;
  
  const winRate = user.matchesPlayed > 0 ? Math.round((user.matchesWon / user.matchesPlayed) * 100) : 0;
  const unlockedCount = user.unlockedCharacters?.length || 2;
  
  return {
    username: user.username,
    totalPoints: user.totalPoints || 0,
    matchesPlayed: user.matchesPlayed || 0,
    matchesWon: user.matchesWon || 0,
    winRate,
    highestCombo: user.highestCombo || 0,
    unlockedCount,
    totalCharacters: Object.keys(UNLOCK_REQUIREMENTS).length,
    isGuest: user.isGuest || false,
    unlockedCharacters: user.unlockedCharacters || ['marcus', 'vesper']
  };
}

/**
 * Logout (compatibility wrapper)
 */
export async function logout() {
  try {
    await authService.logout();
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Record match result (compatibility function)
 */
export function recordMatchResult(won = false, pointsEarned = 0, combo = 0) {
  const user = getCurrentUser();
  if (!user || user.isGuest) return;
  
  // Update stats via authService
  const updates = {
    matchesPlayed: (user.matchesPlayed || 0) + 1,
    matchesWon: (user.matchesWon || 0) + (won ? 1 : 0),
    totalPoints: (user.totalPoints || 0) + pointsEarned
  };
  
  if (combo > (user.highestCombo || 0)) {
    updates.highestCombo = combo;
  }
  
  authService.updateStats(updates).catch(console.error);
  
  // Check for unlocks
  checkForCharacterUnlocks();
}

/**
 * Check if guest can access feature (compatibility function)
 */
export function canGuestAccess(feature) {
  const user = getCurrentUser();
  if (!user?.isGuest) return true;
  
  const guestLimitations = {
    'saveProgress': false,
    'unlockCharacters': false,
    'competeOnline': false,
    'customizeControls': true,
    'changeSettings': true
  };
  
  return guestLimitations[feature] !== false;
}

/**
 * Show guest limitation message (compatibility function)
 */
export function showGuestLimitation(feature) {
  const user = getCurrentUser();
  if (!user?.isGuest) return false;
  
  const messages = {
    'saveProgress': 'Create an account to save your progress!',
    'unlockCharacters': 'Register to unlock more characters!',
    'competeOnline': 'Sign up to compete online!'
  };
  
  const message = messages[feature];
  if (message) {
    alert(message);
    return true;
  }
  
  return false;
}