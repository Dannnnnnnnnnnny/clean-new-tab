# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clean New Tab is a Chrome extension (Manifest V3) that replaces the browser's new tab page with a customizable dashboard featuring top sites, browsing history, bookmarks, YouTube watch history, and animated backgrounds.

## Development

This is a pure JavaScript Chrome extension with no build system. To develop:

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. Changes to files require clicking the refresh button on the extension card

## Architecture

### Entry Points
- `newtab.html` - Main HTML page loaded as the new tab override
- `js/theme-init.js` - Runs first (inline) to prevent theme flashing
- `js/app.js` - Main initialization, loads settings and bootstraps all components

### Module Pattern
All modules use the revealing module pattern as global objects (no ES modules or bundler):

```javascript
const ComponentName = {
  init(settings) { ... },
  // methods
};
```

### Layer Structure

**API Layer** (`js/api/`) - Chrome API wrappers returning promises:
- `storage.js` - Settings persistence via `chrome.storage.sync`, with `Storage.defaults` defining all settings
- `topSites.js`, `history.js`, `bookmarks.js`, `youtube.js` - Data fetching

**Component Layer** (`js/components/`) - UI rendering and event handling:
- Each component has an `init(settings)` method called by `app.js`
- Components re-render when settings change via `Storage.onSettingsChanged()`

**Utils** (`js/utils/`):
- `favicon.js` - Favicon URL generation with fallback handling

### Key Components

**SettingsComponent** (`settings.js`):
- Manages the settings drawer overlay
- Handles theme switching (light/dark/system) and accent colors
- Updates CSS custom properties for theming

**AnimatedBackgroundComponent** (`animatedBackground.js`):
- Manages 5 background types: none, color, gradient, slideshow, particles
- Slideshow supports both CSS transitions and WebGL effects via `WebGLTransitions`
- Images stored in `chrome.storage.local` (separate from sync storage due to size)

**WebGLTransitions** (`webglTransitions.js`):
- GLSL-based image transitions (dissolve, pixelate, ripple, glitch, etc.)
- Has a preview system for transition effects in settings

### Settings Storage

Settings are stored in `chrome.storage.sync` with defaults defined in `Storage.defaults`. The appearance settings nest under `settings.appearance.animatedBgConfig` with type-specific configurations for gradient, slideshow, and particles.

### CSS Architecture

`css/styles.css` uses CSS custom properties for theming:
- `--primary`, `--surface`, `--on-surface` etc. follow Material Design 3 naming
- Theme is set via `[data-theme="dark"]` / `[data-theme="light"]` attribute on `<html>`
