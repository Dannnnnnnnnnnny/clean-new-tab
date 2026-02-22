/**
 * Main application entry point
 * Initializes all components when DOM is ready
 */
(async function() {
  'use strict';

  /**
   * Initialize the application
   */
  async function init() {
    try {
      // Load settings
      const settings = await Storage.getSettings();

      // Initialize all components with settings
      SearchComponent.init(settings);
      SettingsComponent.init(settings);
      await AnimatedBackgroundComponent.init(settings);

      // Load data components in parallel
      await Promise.all([
        TopSitesComponent.init(settings),
        HistoryComponent.init(settings),
        BookmarksComponent.init(settings),
        YouTubeComponent.init(settings)
      ]);

      // Show onboarding tip on first run
      OnboardingComponent.init();

      // Listen for settings changes from other tabs/windows
      Storage.onSettingsChanged(async (newSettings) => {
        SettingsComponent.applyTheme(newSettings.theme);
        SearchComponent.setEngine(newSettings.searchEngine);
        await AnimatedBackgroundComponent.init(newSettings);
        await TopSitesComponent.init(newSettings);
        await HistoryComponent.init(newSettings);
        await BookmarksComponent.init(newSettings);
        await YouTubeComponent.init(newSettings);
      });

      console.log('Clean New Tab initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
