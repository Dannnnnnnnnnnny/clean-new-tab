/**
 * Storage API wrapper for settings persistence
 */
const Storage = {
  // Default settings
  defaults: {
    theme: 'system',
    searchEngine: 'google',
    showTopSites: true,
    showHistory: true,
    showBookmarks: true,
    showYouTube: true,
    topSitesCount: 8,
    historyCount: 20,
    youtubeCount: 6,
    // Appearance settings
    appearance: {
      accentColor: '#8B5CF6',
      background: 'none',
      animatedBg: false,
      animatedBgConfig: {
        type: 'gradient',
        gradient: {
          preset: null,
          colors: ['#ee7752', '#e73c7e', '#23a6d5', '#23d5ab', '#667eea', '#764ba2'],
          gradientType: 'linear',
          animationStyle: 'shift',
          direction: '-45deg',
          speed: 15
        },
        slideshow: {
          speed: 8,
          crossfade: 1500,
          transition: 'fade',
          webglTransition: null,
          kenBurns: false,
          filter: 'none',
          shuffle: false
        },
        particles: {
          style: 'dots',
          shapes: ['dots'],
          colors: ['#8B5CF6', '#3B82F6', '#10B981'],
          density: 40,
          speed: 3,
          opacity: 30,
          scale: 100,
          mouseInteraction: 'none'
        }
      }
    }
  },

  /**
   * Get all settings, merged with defaults
   */
  async getSettings() {
    try {
      const result = await chrome.storage.sync.get('settings');
      const settings = { ...this.defaults, ...result.settings };
      // Ensure appearance object is properly merged
      settings.appearance = { ...this.defaults.appearance, ...result.settings?.appearance };
      return settings;
    } catch (error) {
      console.error('Error loading settings:', error);
      return { ...this.defaults };
    }
  },

  /**
   * Save settings (merges with existing)
   */
  async saveSettings(newSettings) {
    try {
      const current = await this.getSettings();
      const merged = { ...current, ...newSettings };
      // Handle nested appearance object
      if (newSettings.appearance) {
        merged.appearance = { ...current.appearance, ...newSettings.appearance };
      }
      await chrome.storage.sync.set({ settings: merged });
      return merged;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  },

  /**
   * Save appearance settings specifically
   */
  async saveAppearance(appearanceSettings) {
    try {
      const current = await this.getSettings();
      const merged = {
        ...current,
        appearance: { ...current.appearance, ...appearanceSettings }
      };
      await chrome.storage.sync.set({ settings: merged });
      return merged;
    } catch (error) {
      console.error('Error saving appearance:', error);
      throw error;
    }
  },

  /**
   * Reset settings to defaults
   */
  async resetSettings() {
    try {
      await chrome.storage.sync.set({ settings: this.defaults });
      return { ...this.defaults };
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  },

  /**
   * Listen for settings changes
   */
  onSettingsChanged(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) {
        callback(changes.settings.newValue, changes.settings.oldValue);
      }
    });
  }
};
