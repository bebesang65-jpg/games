/**
 * IRON FIST LEAGUE — Dashboard/Profile Screen
 * Shows user stats, unlocked characters, and progression
 */

import { CHARACTER_DATA } from '../data/characters.js';
import { authService } from './auth-professional.js';

/**
 * Initialize dashboard screen
 */
export function initDashboard() {
  // Add dashboard button to main menu if it doesn't exist
  addDashboardButton();
  
  // Setup dashboard screen if needed
  setupDashboardScreen();
}

/**
 * Add dashboard button to main menu
 */
function addDashboardButton() {
  const mainNav = document.getElementById('main-nav');
  if (!mainNav) return;
  
  // Check if dashboard button already exists
  if (document.querySelector('[data-action="dashboard"]')) return;
  
  // Create dashboard button
  const dashboardBtn = document.createElement('button');
  dashboardBtn.className = 'nav-item';
  dashboardBtn.dataset.action = 'dashboard';
  dashboardBtn.setAttribute('tabindex', '0');
  
  dashboardBtn.innerHTML = `
    <span class="nav-icon">📊</span>PROFILE
    <span class="nav-desc">View stats & unlocked characters</span>
  `;
  
  // Insert before the exit button
  const exitBtn = document.querySelector('[data-action="exit"]');
  if (exitBtn) {
    mainNav.insertBefore(dashboardBtn, exitBtn);
  } else {
    mainNav.appendChild(dashboardBtn);
  }
  
  // Add click handler
  dashboardBtn.addEventListener('click', showDashboard);
}

/**
 * Setup dashboard screen HTML
 */
function setupDashboardScreen() {
  // Check if dashboard screen already exists
  if (document.getElementById('screen-dashboard')) return;
  
  const screensContainer = document.querySelector('body > div:first-child')?.parentElement || document.body;
  
  const dashboardScreen = document.createElement('div');
  dashboardScreen.id = 'screen-dashboard';
  dashboardScreen.className = 'screen';
  
  dashboardScreen.innerHTML = `
    <div class="menu-bg-overlay"></div>
    <div class="menu-scanline" aria-hidden="true"></div>
    
    <div class="dashboard-content">
      <div class="dashboard-header">
        <button class="screen-back-btn" id="dashboard-back-btn" aria-label="Back to Main Menu">← BACK</button>
        <div class="dashboard-title">FIGHTER PROFILE</div>
        <button class="btn-logout" id="btn-logout">LOGOUT</button>
      </div>
      
      <div class="dashboard-body">
        <!-- Left: User Stats -->
        <div class="dashboard-stats">
          <div class="stats-header">
            <div class="stats-username" id="stats-username">FIGHTER</div>
            <div class="stats-status" id="stats-status"></div>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">TOTAL POINTS</div>
              <div class="stat-value" id="stat-points">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">MATCHES PLAYED</div>
              <div class="stat-value" id="stat-matches">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">MATCHES WON</div>
              <div class="stat-value" id="stat-wins">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">WIN RATE</div>
              <div class="stat-value" id="stat-winrate">0%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">HIGHEST COMBO</div>
              <div class="stat-value" id="stat-combo">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">CHARACTERS UNLOCKED</div>
              <div class="stat-value" id="stat-unlocked">2/10</div>
            </div>
          </div>
          
          <div class="progress-section">
            <div class="progress-header">NEXT CHARACTER UNLOCK</div>
            <div class="progress-info" id="progress-info">Earn 100 points to unlock CINDER</div>
            <div class="progress-bar">
              <div class="progress-fill" id="progress-fill"></div>
            </div>
            <div class="progress-text" id="progress-text">0/100 points</div>
          </div>
        </div>
        
        <!-- Right: Unlocked Characters -->
        <div class="dashboard-characters">
          <div class="characters-header">UNLOCKED CHARACTERS</div>
          <div class="characters-grid" id="characters-grid">
            <!-- Populated by JavaScript -->
          </div>
          
          <div class="dashboard-hint" id="dashboard-hint">
            Play matches to earn points and unlock more characters!
          </div>
        </div>
      </div>
    </div>
    
    <div class="menu-bottom-bar" aria-hidden="true">
      <span>ESC BACK</span>
      <span>PROFILE VIEW</span>
      <span>LOGOUT ACCOUNT</span>
    </div>
  `;
  
  screensContainer.appendChild(dashboardScreen);
  
  // Setup event listeners
  setupDashboardListeners();
}

/**
 * Setup dashboard event listeners
 */
function setupDashboardListeners() {
  // Back button
  const backBtn = document.getElementById('dashboard-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.__iflShowScreen) {
        window.__iflShowScreen('MAIN_MENU');
      }
    });
  }
  
  // Logout button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout? Your progress will be saved.')) {
        try {
          await authService.logout();
          // Redirect to welcome screen after logout
          if (window.__iflShowScreen) {
            window.__iflShowScreen('WELCOME');
          } else {
            // Fallback: reload page
            window.location.reload();
          }
        } catch (error) {
          console.error('Logout error:', error);
          alert('Failed to logout. Please try again.');
        }
      }
    });
  }
  
  // ESC key to go back
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('screen-dashboard')?.classList.contains('active')) {
      if (window.__iflShowScreen) {
        window.__iflShowScreen('MAIN_MENU');
      }
    }
  });
}

/**
 * Show dashboard screen and populate with user data
 */
export function showDashboard() {
  // Make sure screen exists
  setupDashboardScreen();
  
  // Update screen reference in main.js if needed
  if (window.__iflShowScreen) {
    window.__iflShowScreen('DASHBOARD');
  } else {
    // Fallback: manually show the screen
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    document.getElementById('screen-dashboard')?.classList.add('active');
  }
  
  // Populate with user data
  populateDashboard();
}

/**
 * Populate dashboard with current user data
 */
function populateDashboard() {
  const currentUser = authService.getCurrentUser();
  if (!currentUser) {
    // No user logged in, show message and return
    document.getElementById('stats-username').textContent = 'NOT LOGGED IN';
    document.getElementById('stats-status').textContent = 'PLEASE LOGIN FIRST';
    document.getElementById('stats-status').className = 'stats-status guest';
    return;
  }
  
  // For now, use basic user data - in a real app, we'd need to adapt to new auth structure
  const isGuest = currentUser.type === 'guest';
  const username = currentUser.username || currentUser.email || 'User';
  const stats = currentUser.stats || { totalPoints: 0, matchesPlayed: 0, matchesWon: 0 };
  
  // Calculate win rate
  const winRate = stats.matchesPlayed > 0 ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) : 0;
  
  // Update user info
  document.getElementById('stats-username').textContent = username.toUpperCase();
  document.getElementById('stats-status').textContent = isGuest ? 'GUEST ACCOUNT' : 'REGISTERED FIGHTER';
  document.getElementById('stats-status').className = `stats-status ${isGuest ? 'guest' : 'registered'}`;
  
  // Update stats - using placeholder values for now
  document.getElementById('stat-points').textContent = (stats.totalPoints || 0).toLocaleString();
  document.getElementById('stat-matches').textContent = stats.matchesPlayed || 0;
  document.getElementById('stat-wins').textContent = stats.matchesWon || 0;
  document.getElementById('stat-winrate').textContent = `${winRate}%`;
  document.getElementById('stat-combo').textContent = stats.highestCombo || 0;
  
  // For unlocked characters, we need to adapt to new structure
  // This is a temporary placeholder - in production, we'd need proper character unlock logic
  const unlockedCount = 2; // Default starter characters
  const totalCharacters = Object.keys(CHARACTER_DATA).length;
  document.getElementById('stat-unlocked').textContent = `${unlockedCount}/${totalCharacters}`;
  
  // Create temporary userStats object for compatibility
  const userStats = {
    isGuest,
    username,
    totalPoints: stats.totalPoints || 0,
    matchesPlayed: stats.matchesPlayed || 0,
    matchesWon: stats.matchesWon || 0,
    winRate,
    highestCombo: stats.highestCombo || 0,
    unlockedCount,
    totalCharacters,
    unlockedCharacters: ['marcus', 'vesper'] // Default unlocked characters
  };
  
  // Update progress to next unlock
  updateNextUnlockProgress(userStats);
  
  // Update unlocked characters grid
  updateCharactersGrid(userStats);
  
  // Update hint message
  const hintEl = document.getElementById('dashboard-hint');
  if (hintEl) {
    if (isGuest) {
      hintEl.textContent = 'Create an account to save progress and unlock all characters!';
      hintEl.classList.add('guest-hint');
    } else if (unlockedCount >= totalCharacters) {
      hintEl.textContent = 'Congratulations! You have unlocked all characters!';
      hintEl.classList.add('complete-hint');
    } else {
      hintEl.textContent = 'Play matches to earn points and unlock more characters!';
      hintEl.classList.remove('guest-hint', 'complete-hint');
    }
  }
}

/**
 * Update progress to next character unlock
 */
function updateNextUnlockProgress(userStats) {
  if (userStats.isGuest) {
    document.getElementById('progress-info').textContent = 'Create an account to unlock characters';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-text').textContent = 'Guest accounts cannot unlock characters';
    return;
  }
  
  // Simplified unlock logic for now - all characters unlocked by default
  // In production, this would connect to proper character unlock system
  const allChars = Object.keys(CHARACTER_DATA);
  const unlockedCount = userStats.unlockedCharacters?.length || 2; // Default: marcus and vesper
  
  if (unlockedCount >= allChars.length) {
    document.getElementById('progress-info').textContent = 'All characters unlocked!';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('progress-text').textContent = 'Complete - All characters available';
    return;
  }
  
  // Simple progression: next character unlocks at 100 * (currentUnlocked + 1) points
  const nextRequirement = 100 * (unlockedCount + 1);
  const progressPercent = Math.min(100, (userStats.totalPoints / nextRequirement) * 100);
  const pointsNeeded = nextRequirement - userStats.totalPoints;
  
  // Get next character name (alphabetical order for simplicity)
  const lockedChars = allChars.filter(charId => !userStats.unlockedCharacters?.includes(charId));
  const nextChar = lockedChars[0] || 'cinder';
  const charData = CHARACTER_DATA[nextChar] || { name: 'CINDER' };
  
  document.getElementById('progress-info').textContent = 
    `Earn ${nextRequirement} points to unlock ${charData.name}`;
  document.getElementById('progress-fill').style.width = `${progressPercent}%`;
  document.getElementById('progress-text').textContent = 
    `${userStats.totalPoints}/${nextRequirement} points (${pointsNeeded > 0 ? `${pointsNeeded} more needed` : 'Ready to unlock!'})`;
}

/**
 * Update characters grid with unlocked status
 */
function updateCharactersGrid(userStats) {
  const gridEl = document.getElementById('characters-grid');
  if (!gridEl) return;
  
  gridEl.innerHTML = '';
  
  const allChars = Object.keys(CHARACTER_DATA);
  
  allChars.forEach(charId => {
    const charData = CHARACTER_DATA[charId];
    const isUnlocked = userStats.unlockedCharacters?.includes(charId) || 
                      (charId === 'marcus' || charId === 'vesper');
    // For compatibility, use simple requirements
    const requirements = charId === 'marcus' || charId === 'vesper' 
      ? { required: 0, description: 'Starting Character' }
      : { required: 100, description: 'Reach 100 points' };
    
    const charCard = document.createElement('div');
    charCard.className = `character-card ${isUnlocked ? 'unlocked' : 'locked'}`;
    
    // Create a simple portrait using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // Draw a placeholder portrait (in a real implementation, this would use actual character art)
    drawCharacterPlaceholder(ctx, charId, isUnlocked);
    
    charCard.appendChild(canvas);
    
    const nameEl = document.createElement('div');
    nameEl.className = 'character-name';
    nameEl.textContent = charData.name;
    charCard.appendChild(nameEl);
    
    if (!isUnlocked) {
      const lockEl = document.createElement('div');
      lockEl.className = 'character-lock';
      lockEl.innerHTML = '🔒';
      charCard.appendChild(lockEl);
      
      const reqEl = document.createElement('div');
      reqEl.className = 'character-requirement';
      reqEl.textContent = requirements.required > 0 ? 
        `${requirements.required} pts` : requirements.description;
      charCard.appendChild(reqEl);
    } else {
      const checkEl = document.createElement('div');
      checkEl.className = 'character-check';
      checkEl.innerHTML = '✓';
      charCard.appendChild(checkEl);
    }
    
    gridEl.appendChild(charCard);
  });
}

/**
 * Draw a simple character placeholder
 */
function drawCharacterPlaceholder(ctx, charId, isUnlocked) {
  // Background
  ctx.fillStyle = isUnlocked ? '#1a3a5a' : '#1a1a2e';
  ctx.fillRect(0, 0, 80, 100);
  
  // Border
  ctx.strokeStyle = isUnlocked ? '#4ea8de' : '#5a5a7a';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 78, 98);
  
  // Character initial
  ctx.fillStyle = isUnlocked ? '#8acce8' : '#7a7a9a';
  ctx.font = 'bold 32px Rajdhani';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(charId.charAt(0).toUpperCase(), 40, 50);
  
  // Status text
  ctx.font = '10px Rajdhani';
  ctx.fillStyle = isUnlocked ? '#4edea8' : '#de4e4e';
  ctx.fillText(isUnlocked ? 'UNLOCKED' : 'LOCKED', 40, 85);
}

// Initialize dashboard system when module loads
initDashboard();