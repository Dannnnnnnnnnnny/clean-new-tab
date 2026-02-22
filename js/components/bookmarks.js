/**
 * Bookmarks panel component
 */
const BookmarksComponent = {
  container: null,

  /**
   * Initialize the component
   */
  async init(settings) {
    this.container = document.getElementById('bookmarks-list');
    if (!this.container) return;

    const panel = document.querySelector('.bookmarks-panel');
    if (!settings.showBookmarks) {
      panel?.classList.add('hidden');
      return;
    }
    panel?.classList.remove('hidden');

    await this.render();
  },

  /**
   * Render the bookmarks list
   */
  async render() {
    if (!this.container) return;

    const bookmarks = await BookmarksAPI.getBookmarksBar();

    if (bookmarks.length === 0) {
      this.container.innerHTML = '<div class="empty-state">No bookmarks yet</div>';
      return;
    }

    this.container.innerHTML = bookmarks.map(item => this.createBookmarkItem(item)).join('');
    this.bindEvents();
  },

  /**
   * Create HTML for a bookmark item (handles both bookmarks and folders)
   */
  createBookmarkItem(item) {
    if (BookmarksAPI.isFolder(item)) {
      return this.createFolderItem(item);
    }
    return this.createLinkItem(item);
  },

  /**
   * Create HTML for a bookmark link
   */
  createLinkItem(item) {
    const title = item.title || this.getDomainFromUrl(item.url);

    return `
      <a href="${this.escapeHtml(item.url)}" class="bookmark-item" title="${this.escapeHtml(item.title || item.url)}">
        <div class="bookmark-favicon">
          <img src="${Favicon.getUrl(item.url)}" alt="" loading="lazy"
               onerror="this.src='${Favicon.getDefaultIcon()}'">
        </div>
        <span class="bookmark-title">${this.escapeHtml(title)}</span>
      </a>
    `;
  },

  /**
   * Create HTML for a folder
   */
  createFolderItem(folder) {
    const childrenHtml = folder.children
      ? folder.children.map(child => this.createBookmarkItem(child)).join('')
      : '';

    return `
      <div class="bookmark-folder-wrapper">
        <div class="bookmark-item bookmark-folder" data-folder-id="${folder.id}">
          <div class="bookmark-favicon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <span class="bookmark-title">${this.escapeHtml(folder.title)}</span>
        </div>
        <div class="bookmark-folder-contents" data-parent-id="${folder.id}">
          ${childrenHtml}
        </div>
      </div>
    `;
  },

  /**
   * Bind click events for folders
   */
  bindEvents() {
    if (!this.container) return;

    this.container.querySelectorAll('.bookmark-folder').forEach(folder => {
      folder.addEventListener('click', (e) => {
        e.preventDefault();
        const folderId = folder.dataset.folderId;
        const contents = this.container.querySelector(`[data-parent-id="${folderId}"]`);
        if (contents) {
          contents.classList.toggle('expanded');
        }
      });
    });
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
