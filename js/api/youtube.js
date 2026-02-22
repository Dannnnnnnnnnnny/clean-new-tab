/**
 * YouTube History API - Shows recently watched YouTube videos from browser history
 */
const YouTubeAPI = {
  /**
   * Extract video ID from YouTube URL
   */
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  },

  /**
   * Get thumbnail URL for a video
   */
  getThumbnail(videoId, quality = 'mqdefault') {
    // mqdefault = 320x180, hqdefault = 480x360, maxresdefault = 1280x720
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
  },

  /**
   * Extract video title from page title (removes " - YouTube" suffix)
   */
  cleanTitle(title) {
    return title.replace(/\s*-\s*YouTube\s*$/i, '').trim();
  },

  /**
   * Get YouTube videos from browser history
   */
  async getVideos(maxResults = 12) {
    try {
      // Search history for YouTube watch pages
      const results = await chrome.history.search({
        text: 'youtube.com/watch',
        maxResults: 200, // Get more to filter duplicates
        startTime: 0
      });

      // Also search for YouTube Shorts
      const shortsResults = await chrome.history.search({
        text: 'youtube.com/shorts',
        maxResults: 50,
        startTime: 0
      });

      // Combine and process results
      const allResults = [...results, ...shortsResults];
      const seen = new Set();
      const videos = [];

      for (const item of allResults) {
        if (!item.url) continue;

        const videoId = this.extractVideoId(item.url);
        if (!videoId || seen.has(videoId)) continue;

        seen.add(videoId);
        videos.push({
          id: videoId,
          url: item.url,
          title: this.cleanTitle(item.title || 'Untitled Video'),
          thumbnail: this.getThumbnail(videoId, 'mqdefault'),
          thumbnailHQ: this.getThumbnail(videoId, 'hqdefault'),
          lastVisit: item.lastVisitTime,
          visitCount: item.visitCount || 1,
          isShort: item.url.includes('/shorts/')
        });

        if (videos.length >= maxResults) break;
      }

      // Sort by last visit time (most recent first)
      videos.sort((a, b) => b.lastVisit - a.lastVisit);

      return videos;
    } catch (error) {
      console.error('Error fetching YouTube history:', error);
      return [];
    }
  },

  /**
   * Format relative time
   */
  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }
};
