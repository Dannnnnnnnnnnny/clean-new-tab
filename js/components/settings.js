/**
 * Settings overlay component with appearance customization
 */
const SettingsComponent = {
  overlay: null,
  currentSettings: null,
  isAnimating: false,

  // Color palettes for different accent colors
  colorPalettes: {
    '#8B5CF6': { // Purple
      primary: '#8B5CF6',
      primaryContainer: '#F3E8FF',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#5B21B6'
    },
    '#3B82F6': { // Blue
      primary: '#3B82F6',
      primaryContainer: '#DBEAFE',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#1E40AF'
    },
    '#14B8A6': { // Teal
      primary: '#14B8A6',
      primaryContainer: '#CCFBF1',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#0F766E'
    },
    '#EC4899': { // Pink
      primary: '#EC4899',
      primaryContainer: '#FCE7F3',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#BE185D'
    },
    '#F97316': { // Orange
      primary: '#F97316',
      primaryContainer: '#FFEDD5',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#C2410C'
    },
    '#10B981': { // Green
      primary: '#10B981',
      primaryContainer: '#D1FAE5',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#047857'
    }
  },

  /**
   * Initialize the settings component
   */
  init(settings) {
    this.overlay = document.getElementById('settings-overlay');
    this.currentSettings = settings;

    this.applyTheme(settings.theme);
    this.applyAppearance(settings.appearance);
    this.populateForm(settings);
    this.bindEvents();
  },

  /**
   * Populate form with current settings
   */
  populateForm(settings) {
    // Theme buttons (new class: .theme-option)
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });

    // Search engine
    const searchSelect = document.getElementById('search-engine');
    if (searchSelect) searchSelect.value = settings.searchEngine;

    // Checkboxes
    const showTopSites = document.getElementById('show-top-sites');
    const showHistory = document.getElementById('show-history');
    const showBookmarks = document.getElementById('show-bookmarks');
    const showYouTube = document.getElementById('show-youtube');

    if (showTopSites) showTopSites.checked = settings.showTopSites;
    if (showHistory) showHistory.checked = settings.showHistory;
    if (showBookmarks) showBookmarks.checked = settings.showBookmarks;
    if (showYouTube) showYouTube.checked = settings.showYouTube !== false;

    // Counts
    const topSitesCount = document.getElementById('top-sites-count');
    const historyCount = document.getElementById('history-count');
    const youtubeCount = document.getElementById('youtube-count');

    if (topSitesCount) topSitesCount.value = settings.topSitesCount;
    if (historyCount) historyCount.value = settings.historyCount;
    if (youtubeCount) youtubeCount.value = settings.youtubeCount || 6;

    // Appearance
    const appearance = settings.appearance || {};

    // Accent colors (new class: .accent-swatch)
    document.querySelectorAll('.accent-swatch').forEach(swatch => {
      swatch.classList.toggle('active', swatch.dataset.color === appearance.accentColor);
    });

  },

  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Open settings
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn?.addEventListener('click', () => this.open());

    // Close settings
    const closeBtn = document.getElementById('close-settings');
    closeBtn?.addEventListener('click', () => this.close());

    // Close on backdrop click
    const backdrop = this.overlay?.querySelector('.settings-backdrop');
    backdrop?.addEventListener('click', () => this.close());

    // Theme buttons (new class: .theme-option)
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => this.handleThemeChange(btn.dataset.theme));
    });

    // Search engine
    const searchSelect = document.getElementById('search-engine');
    searchSelect?.addEventListener('change', () => this.handleSettingChange());

    // Checkboxes
    ['show-top-sites', 'show-history', 'show-bookmarks', 'show-youtube'].forEach(id => {
      const checkbox = document.getElementById(id);
      checkbox?.addEventListener('change', () => this.handleSettingChange());
    });

    // Counts
    ['top-sites-count', 'history-count', 'youtube-count'].forEach(id => {
      const select = document.getElementById(id);
      select?.addEventListener('change', () => this.handleSettingChange());
    });

    // Accent colors (new class: .accent-swatch)
    document.querySelectorAll('.accent-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => this.handleColorChange(swatch.dataset.color));
    });

    // Note: Background settings are handled by AnimatedBackgroundComponent

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay?.classList.contains('hidden')) {
        this.close();
      }
    });
  },

  /**
   * Open the settings overlay with animation
   */
  open() {
    if (this.isAnimating) return;

    const settingsBtnContainer = document.querySelector('.settings-btn-container');

    // Animate settings button out
    settingsBtnContainer?.classList.add('modal-open');

    // Show overlay
    this.overlay?.classList.remove('hidden');

    // Re-trigger content animations
    this.animateContentIn();
  },

  /**
   * Close the settings overlay with snappy animation
   */
  close() {
    const settingsBtnContainer = document.querySelector('.settings-btn-container');

    // Hide overlay
    this.overlay?.classList.add('hidden');

    // Restore settings button after overlay closes
    setTimeout(() => {
      settingsBtnContainer?.classList.remove('modal-open');
    }, 200);
  },

  /**
   * Animate overlay content in with stagger
   */
  animateContentIn() {
    const header = this.overlay?.querySelector('.settings-header');
    const cards = this.overlay?.querySelectorAll('.settings-card');

    // Reset and retrigger header animation
    if (header) {
      header.style.animation = 'none';
      void header.offsetHeight;
      header.style.animation = '';
    }

    // Re-trigger card animations
    cards?.forEach((card, i) => {
      card.style.animation = 'none';
      void card.offsetHeight;
      card.style.animation = `card-enter 350ms var(--motion-easing-emphasized) forwards`;
      card.style.animationDelay = `${100 + i * 50}ms`;
    });
  },

  /**
   * Handle theme change
   */
  async handleThemeChange(theme) {
    // Update button states (new class: .theme-option)
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Apply theme
    this.applyTheme(theme);

    // Save
    this.currentSettings.theme = theme;
    await Storage.saveSettings({ theme });
  },

  /**
   * Apply theme to document
   */
  applyTheme(theme) {
    let effectiveTheme = theme;

    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.dataset.theme = effectiveTheme;

    // Listen for system theme changes if set to 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        if (this.currentSettings?.theme === 'system') {
          document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
        }
      });
    }
  },

  /**
   * Handle accent color change
   */
  async handleColorChange(color) {
    // Update swatch states (new class: .accent-swatch)
    document.querySelectorAll('.accent-swatch').forEach(swatch => {
      swatch.classList.toggle('active', swatch.dataset.color === color);
    });

    // Apply color
    this.applyAccentColor(color);

    // Save and update local state
    this.currentSettings = await Storage.saveAppearance({ accentColor: color });
  },

  /**
   * Apply accent color to CSS variables
   */
  applyAccentColor(color) {
    const palette = this.colorPalettes[color];
    if (!palette) return;

    const root = document.documentElement;
    root.style.setProperty('--primary', palette.primary);
    root.style.setProperty('--primary-container', palette.primaryContainer);
    root.style.setProperty('--on-primary', palette.onPrimary);
    root.style.setProperty('--on-primary-container', palette.onPrimaryContainer);

    // Update state layer colors based on primary
    const rgb = this.hexToRgb(palette.primary);
    if (rgb) {
      root.style.setProperty('--state-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
      root.style.setProperty('--state-press', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
    }
  },

  // Note: Background handling moved to AnimatedBackgroundComponent

  /**
   * Apply all appearance settings
   */
  applyAppearance(appearance) {
    if (!appearance) return;

    if (appearance.accentColor) {
      this.applyAccentColor(appearance.accentColor);
    }
    // Background is handled by AnimatedBackgroundComponent
  },

  /**
   * Handle general setting changes
   */
  async handleSettingChange() {
    const newSettings = {
      searchEngine: document.getElementById('search-engine')?.value || 'google',
      showTopSites: document.getElementById('show-top-sites')?.checked ?? true,
      showHistory: document.getElementById('show-history')?.checked ?? true,
      showBookmarks: document.getElementById('show-bookmarks')?.checked ?? true,
      showYouTube: document.getElementById('show-youtube')?.checked ?? true,
      topSitesCount: parseInt(document.getElementById('top-sites-count')?.value || '8', 10),
      historyCount: parseInt(document.getElementById('history-count')?.value || '20', 10),
      youtubeCount: parseInt(document.getElementById('youtube-count')?.value || '6', 10)
    };

    // Save settings
    this.currentSettings = await Storage.saveSettings(newSettings);

    // Update search engine
    SearchComponent.setEngine(newSettings.searchEngine);

    // Re-render components
    await TopSitesComponent.init(this.currentSettings);
    await HistoryComponent.init(this.currentSettings);
    await BookmarksComponent.init(this.currentSettings);
    await YouTubeComponent.init(this.currentSettings);
  },

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
};
