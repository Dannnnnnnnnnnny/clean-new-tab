/**
 * Onboarding component - shows first-run tip about hiding browser footer
 */
const OnboardingComponent = {
  /**
   * Initialize onboarding
   */
  async init() {
    const dismissed = await this.isDismissed();

    if (!dismissed) {
      this.show();
      this.bindEvents();
    }
  },

  /**
   * Check if onboarding was already dismissed
   */
  async isDismissed() {
    try {
      const result = await chrome.storage.local.get('onboardingDismissed');
      return result.onboardingDismissed === true;
    } catch {
      return false;
    }
  },

  /**
   * Mark onboarding as dismissed
   */
  async setDismissed() {
    try {
      await chrome.storage.local.set({ onboardingDismissed: true });
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
  },

  /**
   * Show the onboarding tip
   */
  show() {
    const el = document.getElementById('onboarding');
    if (el) {
      el.classList.remove('hidden');
    }
  },

  /**
   * Hide the onboarding tip
   */
  hide() {
    const el = document.getElementById('onboarding');
    if (el) {
      el.style.animation = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(8px)';
      el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

      setTimeout(() => {
        el.classList.add('hidden');
      }, 200);
    }
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    const dismissBtn = document.getElementById('onboarding-dismiss');

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.hide();
        this.setDismissed();
      });
    }
  }
};
