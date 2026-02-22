/**
 * History API wrapper
 */
const HistoryAPI = {
  /**
   * Get recent browsing history
   * @param {number} maxResults - Maximum number of results
   * @param {number} daysBack - How many days back to search
   */
  async getRecent(maxResults = 20, daysBack = 7) {
    try {
      const startTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
      const items = await chrome.history.search({
        text: '',
        startTime,
        maxResults
      });
      return items.map(item => ({
        ...item,
        timeAgo: this.formatTimeAgo(item.lastVisitTime)
      }));
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  },

  /**
   * Search history with a query
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum number of results
   */
  async search(query, maxResults = 20) {
    try {
      const items = await chrome.history.search({
        text: query,
        maxResults
      });
      return items.map(item => ({
        ...item,
        timeAgo: this.formatTimeAgo(item.lastVisitTime)
      }));
    } catch (error) {
      console.error('Error searching history:', error);
      return [];
    }
  },

  /**
   * Format timestamp to relative time string
   */
  formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins}m ago`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours}h ago`;
    }
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return `${days}d ago`;
    }

    // For older items, show the date
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }
};
