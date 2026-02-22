/**
 * YouTube Videos Grid Component
 * Displays recently watched YouTube videos in a clean grid
 */
const YouTubeComponent = {
  container: null,
  section: null,

  /**
   * Initialize the component
   */
  async init(settings) {
    this.container = document.getElementById('youtube-grid');
    this.section = document.getElementById('youtube-section');

    if (!this.container || !this.section) return;

    // Check if YouTube section should be shown
    if (settings.showYouTube === false) {
      this.section.classList.add('hidden');
      return;
    }

    this.section.classList.remove('hidden');
    await this.render(settings);
  },

  /**
   * Render the YouTube grid
   */
  async render(settings) {
    const count = settings.youtubeCount || 6;
    const videos = await YouTubeAPI.getVideos(count);

    if (videos.length === 0) {
      this.container.innerHTML = `
        <div class="youtube-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
            <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
          </svg>
          <span>No videos yet</span>
        </div>
      `;
      return;
    }

    this.container.innerHTML = videos.map(video => this.createVideoCard(video)).join('');
    this.bindEvents();
  },

  /**
   * Create a video card element
   */
  createVideoCard(video) {
    const timeAgo = YouTubeAPI.formatTime(video.lastVisit);
    const shortBadge = video.isShort ? '<span class="youtube-badge">Short</span>' : '';

    return `
      <a href="${video.url}" class="youtube-card" data-video-id="${video.id}">
        <div class="youtube-thumbnail">
          <img src="${video.thumbnail}" alt="" loading="lazy" />
          <div class="youtube-play">
            <div class="youtube-play-btn">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.69L9.54 5.98A.998.998 0 0 0 8 6.82"/>
              </svg>
            </div>
          </div>
          ${shortBadge}
        </div>
        <div class="youtube-info">
          <div class="youtube-title">${this.escapeHtml(video.title)}</div>
          <div class="youtube-meta">${timeAgo}</div>
        </div>
      </a>
    `;
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
   * Bind event listeners
   */
  bindEvents() {
    // Add hover effect for thumbnail quality upgrade
    this.container.querySelectorAll('.youtube-card').forEach(card => {
      const img = card.querySelector('img');
      const videoId = card.dataset.videoId;

      // Preload HQ thumbnail on hover
      card.addEventListener('mouseenter', () => {
        const hqSrc = YouTubeAPI.getThumbnail(videoId, 'hqdefault');
        const preload = new Image();
        preload.onload = () => {
          img.src = hqSrc;
        };
        preload.src = hqSrc;
      });
    });
  }
};
