/**
 * Search bar component with expandable quick links
 */
const SearchComponent = {
  searchEngines: {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    bing: 'https://www.bing.com/search?q='
  },

  currentEngine: 'google',
  container: null,
  backdrop: null,
  input: null,
  keybind: null,
  isExpanded: false,
  initialFocusDone: false,

  /**
   * Initialize the search component
   */
  init(settings) {
    this.currentEngine = settings.searchEngine || 'google';
    this.container = document.getElementById('search-container');
    this.backdrop = document.getElementById('search-backdrop');
    this.input = document.getElementById('search-input');
    this.keybind = document.getElementById('search-keybind');
    this.bindEvents();

    // Allow focus events to trigger expand after initial page load
    setTimeout(() => {
      this.initialFocusDone = true;
    }, 100);
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    if (!this.input) return;

    // Search on Enter, Tab to toggle, Escape to close
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.input.value.trim()) {
        this.performSearch(this.input.value.trim());
      }
      if (e.key === 'Escape') {
        this.collapse();
      }
      // Tab toggles when inside input
      if (e.key === 'Tab') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Expand on click
    this.input.addEventListener('click', () => this.expand());

    // Expand when typing, collapse when empty
    this.input.addEventListener('input', () => {
      if (this.input.value.length > 0) {
        this.expand();
      } else {
        this.collapse();
      }
    });

    // Close button
    const closeBtn = document.getElementById('search-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapse();
    });

    // Backdrop click to close
    this.backdrop?.addEventListener('click', () => this.collapse());

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isExpanded) {
        this.collapse();
      }
      // Tab to open when not focused on input
      if (e.key === 'Tab' && document.activeElement !== this.input) {
        e.preventDefault();
        this.expand();
        this.input?.focus();
      }
    });
  },

  /**
   * Toggle expanded state
   */
  toggle() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  },

  /**
   * Expand the search container
   */
  expand() {
    if (this.isExpanded) return;
    this.isExpanded = true;
    this.container?.classList.add('expanded');
    this.backdrop?.classList.add('active');
    document.body.classList.add('search-expanded');
  },

  /**
   * Collapse the search container
   */
  collapse() {
    if (!this.isExpanded) return;
    this.isExpanded = false;
    this.input?.blur();
    this.container?.classList.remove('expanded');
    this.backdrop?.classList.remove('active');
    document.body.classList.remove('search-expanded');
  },

  /**
   * Perform a search with the configured engine
   */
  performSearch(query) {
    const baseUrl = this.searchEngines[this.currentEngine] || this.searchEngines.google;
    const searchUrl = baseUrl + encodeURIComponent(query);
    window.location.href = searchUrl;
  },

  /**
   * Update the search engine
   */
  setEngine(engine) {
    if (this.searchEngines[engine]) {
      this.currentEngine = engine;
    }
  }
};
