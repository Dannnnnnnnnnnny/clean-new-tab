/**
 * Bookmarks API wrapper
 */
const BookmarksAPI = {
  /**
   * Get the entire bookmarks tree
   */
  async getTree() {
    try {
      const tree = await chrome.bookmarks.getTree();
      return tree;
    } catch (error) {
      console.error('Error fetching bookmarks tree:', error);
      return [];
    }
  },

  /**
   * Get bookmarks bar items (first level)
   * Bookmarks bar is typically tree[0].children[0]
   */
  async getBookmarksBar() {
    try {
      const tree = await chrome.bookmarks.getTree();
      // Chrome: tree[0].children[0] is Bookmarks Bar
      // tree[0].children[1] is Other Bookmarks
      const bookmarksBar = tree[0]?.children?.[0];
      return bookmarksBar?.children || [];
    } catch (error) {
      console.error('Error fetching bookmarks bar:', error);
      return [];
    }
  },

  /**
   * Get contents of a specific folder
   * @param {string} folderId - The folder ID
   */
  async getFolderContents(folderId) {
    try {
      const results = await chrome.bookmarks.getChildren(folderId);
      return results;
    } catch (error) {
      console.error('Error fetching folder contents:', error);
      return [];
    }
  },

  /**
   * Search bookmarks
   * @param {string} query - Search query
   */
  async search(query) {
    try {
      const results = await chrome.bookmarks.search(query);
      return results;
    } catch (error) {
      console.error('Error searching bookmarks:', error);
      return [];
    }
  },

  /**
   * Check if a bookmark node is a folder
   */
  isFolder(node) {
    return !node.url;
  }
};
