/**
 * History list component
 */
const HistoryComponent = {
  container: null,

  /**
   * Initialize the component
   */
  async init(settings) {
    this.container = document.getElementById('history-list');
    if (!this.container) return;

    const panel = document.querySelector('.history-panel');
    if (!settings.showHistory) {
      panel?.classList.add('hidden');
      return;
    }
    panel?.classList.remove('hidden');

    await this.render(settings.historyCount);
  },

  /**
   * Render the history list
   */
  async render(count = 20) {
    if (!this.container) return;

    const items = await HistoryAPI.getRecent(count);

    if (items.length === 0) {
      this.container.innerHTML = '<div class="empty-state">No recent history</div>';
      return;
    }

    this.container.innerHTML = items.map(item => this.createHistoryItem(item)).join('');
  },

  /**
   * Create HTML for a single history item
   */
  createHistoryItem(item) {
    const title = item.title || this.getDomainFromUrl(item.url);

    return `
      <a href="${this.escapeHtml(item.url)}" class="history-item" title="${this.escapeHtml(item.title || item.url)}">
        <div class="history-favicon">
          <img src="${Favicon.getUrl(item.url)}" alt="" loading="lazy"
               onerror="this.src='${Favicon.getDefaultIcon()}'">
        </div>
        <div class="history-info">
          <div class="history-title">${this.escapeHtml(title)}</div>
          <div class="history-time">${item.timeAgo}</div>
        </div>
      </a>
    `;
  },

  /**
   * Extract domain from URL
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
  }
};
