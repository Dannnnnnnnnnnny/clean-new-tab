/**
 * Top Sites grid component
 */
const TopSitesComponent = {
  container: null,

  /**
   * Initialize the component
   */
  async init(settings) {
    this.container = document.getElementById('top-sites');
    if (!this.container) return;

    const section = document.querySelector('.top-sites-section');
    if (!settings.showTopSites) {
      section?.classList.add('hidden');
      return;
    }
    section?.classList.remove('hidden');

    await this.render(settings.topSitesCount);
  },

  /**
   * Render the top sites grid
   */
  async render(count = 8) {
    if (!this.container) return;

    const sites = await TopSitesAPI.get(count);

    if (sites.length === 0) {
      this.container.innerHTML = '<div class="empty-state">No top sites yet</div>';
      return;
    }

    this.container.innerHTML = sites.map(site => this.createSiteItem(site)).join('');
    this.bindEvents();
  },

  /**
   * Create HTML for a single site item
   */
  createSiteItem(site) {
    const title = site.title || this.getDomainFromUrl(site.url);
    const shortTitle = title.length > 12 ? title.substring(0, 12) + '...' : title;

    return `
      <a href="${this.escapeHtml(site.url)}" class="top-site-item" title="${this.escapeHtml(title)}">
        <div class="top-site-favicon">
          <img src="${Favicon.getUrl(site.url)}" alt="" loading="lazy"
               onerror="this.src='${Favicon.getDefaultIcon()}'">
        </div>
        <span class="top-site-title">${this.escapeHtml(shortTitle)}</span>
      </a>
    `;
  },

  /**
   * Extract domain from URL for display
   */
  getDomainFromUrl(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Bind click events
   */
  bindEvents() {
    // Links handle navigation naturally, no extra binding needed
  }
};
