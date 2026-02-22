/**
 * Favicon utility for fetching site icons
 */
const Favicon = {
  /**
   * Get favicon URL for a given site URL
   * Uses Google's favicon service as a reliable fallback
   */
  getUrl(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return this.getDefaultIcon();
    }
  },

  /**
   * Get a default icon data URL (simple globe icon)
   */
  getDefaultIcon() {
    return 'data:image/svg+xml,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    `);
  },

  /**
   * Create an img element with favicon
   */
  createImg(url) {
    const img = document.createElement('img');
    img.src = this.getUrl(url);
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => {
      img.src = this.getDefaultIcon();
    };
    return img;
  }
};
