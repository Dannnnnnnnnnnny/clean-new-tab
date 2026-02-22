/**
 * Top Sites API wrapper
 */
const TopSitesAPI = {
  /**
   * Get most visited sites
   * @param {number} limit - Maximum number of sites to return
   */
  async get(limit = 8) {
    try {
      const sites = await chrome.topSites.get();
      return sites.slice(0, limit);
    } catch (error) {
      console.error('Error fetching top sites:', error);
      return [];
    }
  }
};
