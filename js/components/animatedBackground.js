/**
 * Animated Background Controller
 * Manages gradient, slideshow, and particle animations
 */
const AnimatedBackgroundComponent = {
  // State
  currentType: 'none', // 'none', 'color', 'gradient', 'slideshow', 'particles'
  config: null,
  eventsBound: false,

  // Animation frames
  particleAnimationId: null,
  slideshowTimerId: null,

  // Canvas for particles
  canvas: null,
  ctx: null,
  particles: [],
  mousePos: { x: null, y: null },

  // Slideshow state
  currentSlideIndex: 0,
  slideshowImages: [],
  shuffledOrder: [],

  // DOM references
  customizer: null,
  bgLayer: null,

  // Gradient presets — curated mesh gradient palettes
  gradientPresets: {
    aurora:   { base: '#080b1a', colors: ['#00d4ff', '#7c3aed', '#0ea5e9'] },
    sunset:   { base: '#1a0c0a', colors: ['#f43f5e', '#f59e0b', '#ec4899'] },
    ocean:    { base: '#080d14', colors: ['#0077b6', '#00b4d8', '#38bdf8'] },
    neon:     { base: '#0f0a1a', colors: ['#8b5cf6', '#ec4899', '#6366f1'] },
    forest:   { base: '#081410', colors: ['#10b981', '#059669', '#14b8a6'] },
    midnight: { base: '#08081a', colors: ['#3b82f6', '#1d4ed8', '#6366f1'] }
  },

  /**
   * Initialize component
   */
  async init(settings) {
    this.bgLayer = document.getElementById('background-layer');

    const appearance = settings.appearance || {};
    this.config = appearance.animatedBgConfig || this.getDefaultConfig();
    this.currentType = this.config.type || 'none';

    // Load slideshow images from local storage
    await this.loadImages();

    // Restore UI state from config
    this.restoreSettings();

    // Bind events
    this.bindEvents();

    // Update panel visibility
    this.updatePanelVisibility();

    // Apply background based on type
    this.applyBackground();
  },

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      type: 'none',
      color: {
        value: '#1a1a2e'
      },
      gradient: {
        preset: 'aurora',
        colors: ['#00d4ff', '#7c3aed', '#0ea5e9']
      },
      slideshow: {
        speed: 8,
        crossfade: 1500,
        transition: 'fade',
        shuffle: false
      },
      particles: {
        style: 'dots',
        shapes: ['dots'],
        colors: ['#8B5CF6', '#3B82F6', '#10B981'],
        density: 40,
        speed: 3,
        opacity: 30,
        scale: 100,
        mouseInteraction: 'none'
      }
    };
  },

  /**
   * Bind UI events
   */
  bindEvents() {
    // Prevent duplicate event binding
    if (this.eventsBound) return;
    this.eventsBound = true;

    // Background type tabs
    document.querySelectorAll('.bg-type-tab').forEach(btn => {
      btn.addEventListener('click', () => this.handleTypeChange(btn.dataset.bgtype));
    });

    // Color controls
    this.bindColorControls();

    // Gradient controls
    this.bindGradientControls();

    // Slideshow controls
    this.bindSlideshowControls();

    // Particle controls
    this.bindParticleControls();
  },

  /**
   * Bind color-specific controls
   */
  bindColorControls() {
    // Color presets
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', () => this.handleColorPresetChange(btn.dataset.color));
    });

    // Custom color picker
    const customColor = document.getElementById('custom-bg-color');
    customColor?.addEventListener('input', (e) => this.handleColorChange(e.target.value));
  },

  /**
   * Handle color preset change
   */
  handleColorPresetChange(color) {
    // Update UI
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === color);
    });

    // Update custom picker
    const customPicker = document.getElementById('custom-bg-color');
    if (customPicker) customPicker.value = color;

    this.handleColorChange(color);
  },

  /**
   * Handle color change
   */
  handleColorChange(color) {
    if (!this.config.color) this.config.color = {};
    this.config.color.value = color;
    this.applyColor();
    this.saveConfig();
  },

  /**
   * Bind gradient-specific controls
   */
  bindGradientControls() {
    // Preset cards
    document.querySelectorAll('.gradient-preset').forEach(card => {
      card.addEventListener('click', () => this.handlePresetChange(card.dataset.preset));
    });

    // Color pickers (in color-pickers)
    document.querySelectorAll('#bg-gradient-panel .color-pickers .color-picker-input').forEach(picker => {
      picker.addEventListener('input', () => {
        // Clear preset when manually changing colors
        document.querySelectorAll('.gradient-preset').forEach(c => c.classList.remove('active'));
        this.config.gradient.preset = null;
        this.updateGradient();
      });
    });
  },

  /**
   * Handle preset change
   */
  handlePresetChange(preset) {
    const presetData = this.gradientPresets[preset];
    if (!presetData) return;

    // Update UI
    document.querySelectorAll('.gradient-preset').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === preset);
    });

    // Apply preset colors to pickers
    document.querySelectorAll('#bg-gradient-panel .color-pickers .color-picker-input').forEach((picker, i) => {
      if (presetData.colors[i]) picker.value = presetData.colors[i];
    });

    this.config.gradient.preset = preset;
    this.updateGradient();
  },

  /**
   * Bind slideshow-specific controls
   */
  bindSlideshowControls() {
    // File upload - the label already triggers the input, just listen for change
    const uploadInput = document.getElementById('image-upload');
    uploadInput?.addEventListener('change', (e) => this.handleImageUpload(e.target.files));

    // Drag and drop on upload zone
    const uploadZone = document.getElementById('upload-zone');
    uploadZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    uploadZone?.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });
    uploadZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      this.handleImageUpload(e.dataTransfer.files);
    });

    // URL input
    const addUrlBtn = document.getElementById('add-url-btn');
    addUrlBtn?.addEventListener('click', () => this.handleAddImageUrl());

    const urlInput = document.getElementById('image-url-input');
    urlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAddImageUrl();
    });

    // Transition pills
    document.querySelectorAll('#bg-slideshow-panel .pill[data-transition]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.pill-group').querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateSlideshow();
      });
    });

    // Shuffle toggle
    const shuffleToggle = document.getElementById('shuffle-toggle');
    shuffleToggle?.addEventListener('change', () => this.updateSlideshow());

    // Speed/crossfade sliders
    const speedSlider = document.getElementById('slideshow-speed');
    speedSlider?.addEventListener('input', () => {
      this.updateSliderValue('slideshow-speed');
      this.updateSlideshow();
    });

    const crossfadeSlider = document.getElementById('crossfade-duration');
    crossfadeSlider?.addEventListener('input', () => {
      this.updateSliderValue('crossfade-duration');
      this.updateSlideshow();
    });
  },

  /**
   * Update slider value display
   */
  updateSliderValue(sliderId) {
    const slider = document.getElementById(sliderId);
    const valueEl = document.querySelector(`.range-value[data-for="${sliderId}"]`);
    if (slider && valueEl) {
      if (sliderId === 'crossfade-duration') {
        valueEl.textContent = (slider.value / 1000).toFixed(1) + 's';
      } else {
        valueEl.textContent = slider.value + 's';
      }
    }
  },

  /**
   * Bind particle-specific controls
   */
  bindParticleControls() {
    // Style pills
    document.querySelectorAll('#bg-particles-panel .pill[data-style]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.pill-group').querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateParticles();
      });
    });

    // Shape buttons (multi-select)
    document.querySelectorAll('.shape-btn').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('selected');
        // Ensure at least one is selected
        const selected = document.querySelectorAll('.shape-btn.selected');
        if (selected.length === 0) {
          toggle.classList.add('selected');
        }
        this.updateParticles();
      });
    });

    // Color pickers (3 of them)
    document.querySelectorAll('.particle-color').forEach(picker => {
      picker.addEventListener('input', () => this.updateParticles());
    });

    // Mouse interaction pills
    document.querySelectorAll('#bg-particles-panel .pill[data-interaction]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.pill-group').querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateParticles();
      });
    });

    // Sliders
    ['particle-density', 'particle-speed', 'particle-opacity', 'particle-scale'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => this.updateParticles());
    });

    // Track mouse for interaction
    document.addEventListener('mousemove', (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    });
    document.addEventListener('mouseleave', () => {
      this.mousePos.x = null;
      this.mousePos.y = null;
    });
  },

  /**
   * Update panel visibility based on current type
   */
  updatePanelVisibility() {
    // Update tabs
    document.querySelectorAll('.bg-type-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.bgtype === this.currentType);
    });

    // Show/hide panels
    document.querySelectorAll('.bg-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const panelId = `bg-${this.currentType}-panel`;
    document.getElementById(panelId)?.classList.add('active');
  },

  /**
   * Handle background type change
   */
  handleTypeChange(type) {
    if (type === this.currentType) return;

    this.stopAllAnimations();
    this.currentType = type;
    this.config.type = type;

    // Update UI
    this.updatePanelVisibility();

    // Apply background
    this.applyBackground();

    this.saveConfig();
  },

  /**
   * Apply background based on current type
   */
  applyBackground() {
    this.stopAllAnimations();

    switch (this.currentType) {
      case 'none':
        this.clearBackground();
        break;
      case 'color':
        this.applyColor();
        break;
      case 'gradient':
        this.applyGradient();
        break;
      case 'slideshow':
        this.applySlideshow();
        break;
      case 'particles':
        this.applyParticles();
        break;
    }
  },

  /**
   * Clear background
   */
  clearBackground() {
    if (this.bgLayer) {
      this.bgLayer.style.background = '';
      this.bgLayer.innerHTML = '';
    }
    document.body.classList.remove('has-bg-image');
  },

  /**
   * Apply solid color background
   */
  applyColor() {
    if (!this.bgLayer) return;
    const color = this.config.color?.value || '#1a1a2e';
    this.bgLayer.style.background = color;
    this.bgLayer.innerHTML = '';
  },

  /**
   * Stop all animations
   */
  stopAllAnimations() {
    // Stop particles
    if (this.particleAnimationId) {
      cancelAnimationFrame(this.particleAnimationId);
      this.particleAnimationId = null;
    }
    this.canvas?.classList.remove('active');

    // Stop slideshow
    if (this.slideshowTimerId) {
      clearInterval(this.slideshowTimerId);
      this.slideshowTimerId = null;
    }

    // Hide WebGL canvas
    WebGLTransitions.hide();

    // Clear background layer
    if (this.bgLayer) {
      this.bgLayer.className = 'background-layer';
      this.bgLayer.style.background = '';
      this.bgLayer.style.backgroundSize = '';
      this.bgLayer.style.animation = '';
      this.bgLayer.innerHTML = '';
    }

    document.body.classList.remove('has-bg-gradient');
  },

  /**
   * Apply gradient animation
   */
  applyGradient() {
    if (!this.bgLayer) return;

    const colors = this.getGradientColors();
    const preset = this.config.gradient?.preset;
    const base = preset && this.gradientPresets[preset]
      ? this.gradientPresets[preset].base
      : this.deriveBaseColor(colors);

    document.body.classList.add('has-bg-gradient');
    this.bgLayer.style.background = this.buildMeshGradient(colors, base);
  },

  /**
   * Build a layered mesh gradient from colors and a base
   */
  buildMeshGradient(colors, base) {
    const c = colors.map(hex => this.hexToRgba(hex));
    return [
      `radial-gradient(ellipse at 15% 85%, rgba(${c[0]},0.45) 0%, transparent 70%)`,
      `radial-gradient(ellipse at 85% 15%, rgba(${c[1]},0.4) 0%, transparent 65%)`,
      `radial-gradient(ellipse at 50% 45%, rgba(${c[2]},0.18) 0%, transparent 80%)`,
      `radial-gradient(ellipse at 75% 70%, rgba(${c[0]},0.12) 0%, transparent 55%)`,
      base
    ].join(', ');
  },

  /**
   * Convert hex to "r,g,b" string for use in rgba()
   */
  hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  },

  /**
   * Derive a dark base color from accent colors
   */
  deriveBaseColor(colors) {
    const rgbs = colors.map(hex => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    }));
    const avg = {
      r: rgbs.reduce((s, c) => s + c.r, 0) / rgbs.length,
      g: rgbs.reduce((s, c) => s + c.g, 0) / rgbs.length,
      b: rgbs.reduce((s, c) => s + c.b, 0) / rgbs.length
    };
    // Blend 8% of the average with near-black for a subtle tint
    const blend = 0.08;
    const r = Math.round(avg.r * blend + 10 * (1 - blend));
    const g = Math.round(avg.g * blend + 10 * (1 - blend));
    const b = Math.round(avg.b * blend + 10 * (1 - blend));
    return '#' + [r, g, b].map(v => Math.max(v, 5).toString(16).padStart(2, '0')).join('');
  },

  /**
   * Get gradient colors from pickers
   */
  getGradientColors() {
    const pickers = document.querySelectorAll('#bg-gradient-panel .color-pickers .color-picker-input');
    return Array.from(pickers).map(p => p.value);
  },

  /**
   * Update gradient with current settings
   */
  updateGradient() {
    this.config.gradient = {
      preset: this.config.gradient?.preset || null,
      colors: this.getGradientColors()
    };

    if (this.currentType === 'gradient') {
      this.applyGradient();
    }

    this.saveConfig();
  },

  /**
   * Apply slideshow animation
   */
  async applySlideshow() {
    if (this.slideshowImages.length === 0 || !this.bgLayer) return;

    document.body.classList.add('has-bg-gradient');
    this.bgLayer.innerHTML = '';

    const crossfade = parseInt(document.getElementById('crossfade-duration')?.value || 1500);
    const transition = document.querySelector('#bg-slideshow-panel .pill[data-transition].active')?.dataset.transition || 'fade';
    const shuffle = document.getElementById('shuffle-toggle')?.checked || false;

    // Build play order
    this.shuffledOrder = [...Array(this.slideshowImages.length).keys()];
    if (shuffle) this.shuffleArray(this.shuffledOrder);

    // Create image elements
    this.slideshowImages.forEach((src, i) => {
      const div = document.createElement('div');
      div.className = 'slideshow-image';
      if (this.shuffledOrder[0] === i) div.classList.add('active');
      div.style.backgroundImage = `url(${src})`;
      div.style.transition = `opacity ${crossfade}ms var(--motion-easing-standard)`;
      div.dataset.index = i;
      this.bgLayer.appendChild(div);
    });

    // Start timer if multiple images
    if (this.slideshowImages.length > 1) {
      const interval = parseInt(document.getElementById('slideshow-speed')?.value || 8) * 1000;
      this.currentSlideIndex = 0;
      this.slideshowTimerId = setInterval(() => this.advanceSlide(transition, crossfade), interval);
    }
  },

  /**
   * Shuffle an array in place (Fisher-Yates)
   */
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  },

  /**
   * Advance to next slide
   */
  advanceSlide(transition = 'fade', crossfade = 1500) {
    const slides = this.bgLayer?.querySelectorAll('.slideshow-image');
    if (!slides || slides.length < 2) return;

    const currentIdx = this.shuffledOrder[this.currentSlideIndex];
    let nextSlidePosition = (this.currentSlideIndex + 1) % this.shuffledOrder.length;

    // Reshuffle when looping back to start
    if (nextSlidePosition === 0 && document.getElementById('shuffle-toggle')?.checked) {
      this.shuffleArray(this.shuffledOrder);
    }

    const nextIdx = this.shuffledOrder[nextSlidePosition];
    const currentSlide = slides[currentIdx];
    const nextSlide = slides[nextIdx];

    switch (transition) {
      case 'slide':
        // Position next slide off-screen right
        nextSlide.style.transition = 'none';
        nextSlide.style.transform = 'translateX(100%)';
        nextSlide.style.opacity = '1';
        nextSlide.classList.add('active');
        void nextSlide.offsetHeight; // force reflow
        // Animate both
        nextSlide.style.transition = `transform ${crossfade}ms var(--motion-easing-emphasized)`;
        currentSlide.style.transition = `transform ${crossfade}ms var(--motion-easing-emphasized)`;
        nextSlide.style.transform = 'translateX(0)';
        currentSlide.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          currentSlide.classList.remove('active');
          currentSlide.style.transform = '';
          currentSlide.style.transition = '';
          currentSlide.style.opacity = '';
          nextSlide.style.transition = `opacity ${crossfade}ms var(--motion-easing-standard)`;
          nextSlide.style.transform = '';
        }, crossfade + 50);
        break;

      case 'zoom':
        nextSlide.style.transition = 'none';
        nextSlide.style.transform = 'scale(0.85)';
        nextSlide.style.opacity = '0';
        nextSlide.classList.add('active');
        void nextSlide.offsetHeight;
        nextSlide.style.transition = `transform ${crossfade}ms var(--motion-easing-emphasized), opacity ${Math.round(crossfade * 0.6)}ms ease`;
        nextSlide.style.transform = 'scale(1)';
        nextSlide.style.opacity = '1';
        setTimeout(() => {
          currentSlide.classList.remove('active');
          currentSlide.style.opacity = '';
          nextSlide.style.transition = `opacity ${crossfade}ms var(--motion-easing-standard)`;
          nextSlide.style.transform = '';
        }, crossfade + 50);
        break;

      default: // fade
        currentSlide.classList.remove('active');
        nextSlide.classList.add('active');
    }

    this.currentSlideIndex = nextSlidePosition;
  },

  /**
   * Handle image upload
   */
  async handleImageUpload(files) {
    if (!files || files.length === 0) return;

    // Process each file
    const promises = Array.from(files).map(file => {
      return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
          resolve();
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          this.slideshowImages.push(e.target.result);
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
      });
    });

    await Promise.all(promises);

    // Render once after all images are added
    this.renderGallery();

    if (this.currentType === 'slideshow') {
      this.stopAllAnimations();
      this.applySlideshow();
    }

    await this.saveImages();
    this.saveConfig();

    // Clear the input so the same file can be selected again
    const uploadInput = document.getElementById('image-upload');
    if (uploadInput) uploadInput.value = '';
  },

  /**
   * Handle add image URL
   */
  async handleAddImageUrl() {
    const input = document.getElementById('image-url-input');
    const url = input?.value?.trim();
    if (!url) return;

    this.slideshowImages.push(url);
    this.renderGallery();

    if (this.currentType === 'slideshow') {
      this.stopAllAnimations();
      this.applySlideshow();
    }

    await this.saveImages();
    this.saveConfig();

    if (input) input.value = '';
  },

  /**
   * Remove image from slideshow
   */
  async removeImage(index) {
    this.slideshowImages.splice(index, 1);
    this.renderGallery();

    if (this.currentType === 'slideshow') {
      this.currentSlideIndex = 0;
      this.stopAllAnimations();
      if (this.slideshowImages.length > 0) {
        this.applySlideshow();
      }
    }

    await this.saveImages();
    this.saveConfig();
  },

  /**
   * Render image gallery
   */
  renderGallery() {
    const gallery = document.getElementById('slideshow-gallery');
    if (!gallery) return;

    gallery.querySelectorAll('.gallery-image').forEach(el => el.remove());

    const addBtn = gallery.querySelector('.upload-btn');
    this.slideshowImages.forEach((src, i) => {
      const div = document.createElement('div');
      div.className = 'gallery-image';
      div.innerHTML = `
        <img src="${src}" alt="Background ${i + 1}">
        <button class="remove-btn" data-index="${i}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;
      div.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeImage(i);
      });
      gallery.insertBefore(div, addBtn);
    });
  },

  /**
   * Update slideshow settings
   */
  updateSlideshow() {
    this.config.slideshow = {
      speed: parseInt(document.getElementById('slideshow-speed')?.value || 8),
      crossfade: parseInt(document.getElementById('crossfade-duration')?.value || 1500),
      transition: document.querySelector('#bg-slideshow-panel .pill[data-transition].active')?.dataset.transition || 'fade',
      shuffle: document.getElementById('shuffle-toggle')?.checked || false
    };

    if (this.currentType === 'slideshow' && this.slideshowImages.length > 0) {
      this.stopAllAnimations();
      this.applySlideshow();
    }

    this.saveConfig();
  },

  /**
   * Create canvas for particles
   */
  createCanvas() {
    if (this.canvas) return;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'particles-canvas';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  },

  /**
   * Resize canvas to window size
   */
  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  /**
   * Apply particle animation
   */
  applyParticles() {
    this.createCanvas();
    if (!this.canvas || !this.ctx) return;

    document.body.classList.add('has-bg-gradient');
    this.canvas.classList.add('active');
    this.initParticles();
    this.animateParticles();
  },

  /**
   * Get selected shapes
   */
  getSelectedShapes() {
    const selected = document.querySelectorAll('.shape-btn.selected');
    return Array.from(selected).map(c => c.dataset.shape);
  },

  /**
   * Get particle colors
   */
  getParticleColors() {
    const pickers = document.querySelectorAll('.particle-color');
    return Array.from(pickers).map(p => p.value);
  },

  /**
   * Initialize particles
   */
  initParticles() {
    const density = parseInt(document.getElementById('particle-density')?.value || 40);
    const scale = parseInt(document.getElementById('particle-scale')?.value || 100) / 100;
    const count = Math.floor((this.canvas.width * this.canvas.height) / (15000 - density * 100));
    const shapes = this.getSelectedShapes();
    const colors = this.getParticleColors();

    this.particles = [];
    for (let i = 0; i < Math.min(count, 200); i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: (Math.random() * 3 + 1) * scale,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2
      });
    }
  },

  /**
   * Draw a shape
   */
  drawShape(ctx, shape, x, y, size, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    switch (shape) {
      case 'stars':
        this.drawStar(ctx, 0, 0, 5, size * 2, size);
        break;
      case 'squares':
        ctx.fillRect(-size, -size, size * 2, size * 2);
        break;
      case 'triangles':
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.5);
        ctx.lineTo(-size * 1.3, size);
        ctx.lineTo(size * 1.3, size);
        ctx.closePath();
        ctx.fill();
        break;
      case 'hearts':
        this.drawHeart(ctx, 0, 0, size * 1.5);
        break;
      default: // dots
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  },

  /**
   * Draw a 5-point star
   */
  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  },

  /**
   * Draw a heart shape
   */
  drawHeart(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size / 4);
    ctx.bezierCurveTo(x - size / 2, y + size / 2, x, y + size * 0.75, x, y + size);
    ctx.bezierCurveTo(x, y + size * 0.75, x + size / 2, y + size / 2, x + size / 2, y + size / 4);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 4);
    ctx.fill();
  },

  /**
   * Animate particles
   */
  animateParticles() {
    if (!this.canvas || !this.ctx) return;

    const style = document.querySelector('#bg-particles-panel .pill[data-style].active')?.dataset.style || 'dots';
    const speed = parseInt(document.getElementById('particle-speed')?.value || 3) / 3;
    const opacity = parseInt(document.getElementById('particle-opacity')?.value || 30) / 100;
    const mouseInteraction = document.querySelector('#bg-particles-panel .pill[data-interaction].active')?.dataset.interaction || 'none';

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update and draw particles
    this.particles.forEach((p, i) => {
      // Apply mouse interaction
      if (mouseInteraction !== 'none' && this.mousePos.x !== null) {
        const dx = this.mousePos.x - p.x;
        const dy = this.mousePos.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 150;

        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist * 0.5;
          const angle = Math.atan2(dy, dx);

          if (mouseInteraction === 'attract') {
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
          } else if (mouseInteraction === 'repel') {
            p.vx -= Math.cos(angle) * force;
            p.vy -= Math.sin(angle) * force;
          }
        }
      }

      // Apply friction
      p.vx *= 0.99;
      p.vy *= 0.99;

      // Ensure minimum velocity
      const minVel = 0.1;
      if (Math.abs(p.vx) < minVel) p.vx = (Math.random() - 0.5) * minVel * 2;
      if (Math.abs(p.vy) < minVel) p.vy = (Math.random() - 0.5) * minVel * 2;

      // Update position
      p.x += p.vx * speed;
      p.y += p.vy * speed;
      p.rotation += 0.01 * speed;

      // Wrap around edges
      if (p.x < -10) p.x = this.canvas.width + 10;
      if (p.x > this.canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = this.canvas.height + 10;
      if (p.y > this.canvas.height + 10) p.y = -10;

      // Draw based on style
      this.ctx.globalAlpha = opacity;
      this.ctx.fillStyle = p.color;
      this.ctx.strokeStyle = p.color;
      this.ctx.lineWidth = 1;

      if (style === 'dots' || style === 'network') {
        this.drawShape(this.ctx, p.shape, p.x, p.y, p.size, p.rotation);
      }

      if (style === 'lines' || style === 'network') {
        // Draw connections to nearby particles
        for (let j = i + 1; j < this.particles.length; j++) {
          const p2 = this.particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            this.ctx.globalAlpha = opacity * (1 - dist / 150);
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
          }
        }
      }
    });

    this.particleAnimationId = requestAnimationFrame(() => this.animateParticles());
  },

  /**
   * Update particles with current settings
   */
  updateParticles() {
    this.config.particles = {
      style: document.querySelector('#bg-particles-panel .pill[data-style].active')?.dataset.style || 'dots',
      shapes: this.getSelectedShapes(),
      colors: this.getParticleColors(),
      density: parseInt(document.getElementById('particle-density')?.value || 40),
      speed: parseInt(document.getElementById('particle-speed')?.value || 3),
      opacity: parseInt(document.getElementById('particle-opacity')?.value || 30),
      scale: parseInt(document.getElementById('particle-scale')?.value || 100),
      mouseInteraction: document.querySelector('#bg-particles-panel .pill[data-interaction].active')?.dataset.interaction || 'none'
    };

    if (this.currentType === 'particles') {
      this.initParticles();
    }

    this.saveConfig();
  },

  /**
   * Handle source tab change (upload vs URL)
   */
  handleSourceTabChange(source) {
    document.querySelectorAll('.source-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.source === source);
    });

    document.getElementById('upload-source')?.classList.toggle('hidden', source !== 'upload');
    document.getElementById('url-source')?.classList.toggle('hidden', source !== 'url');
  },

  /**
   * Save current configuration
   */
  async saveConfig() {
    await Storage.saveAppearance({ animatedBgConfig: this.config });
  },

  /**
   * Save images to local storage (for slideshow)
   */
  async saveImages() {
    try {
      await chrome.storage.local.set({
        slideshowImages: this.slideshowImages
      });
    } catch (error) {
      console.error('Error saving images:', error);
    }
  },

  /**
   * Load images from local storage
   */
  async loadImages() {
    try {
      const result = await chrome.storage.local.get('slideshowImages');
      this.slideshowImages = result.slideshowImages || [];
      this.renderGallery();
    } catch (error) {
      console.error('Error loading images:', error);
    }
  },

  /**
   * Restore settings from config
   */
  restoreSettings() {
    if (!this.config) return;

    // Set current type
    this.currentType = this.config.type || 'none';

    // Restore color settings
    if (this.config.color) {
      const color = this.config.color.value || '#1a1a2e';
      const customPicker = document.getElementById('custom-bg-color');
      if (customPicker) customPicker.value = color;

      // Update preset selection
      document.querySelectorAll('.color-preset').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
      });
    }

    // Restore gradient settings
    if (this.config.gradient) {
      // Preset
      if (this.config.gradient.preset) {
        document.querySelectorAll('.gradient-preset').forEach(c => {
          c.classList.toggle('active', c.dataset.preset === this.config.gradient.preset);
        });
      }

      // Colors
      const colors = this.config.gradient.colors || [];
      document.querySelectorAll('#bg-gradient-panel .color-pickers .color-picker-input').forEach((picker, i) => {
        if (colors[i]) picker.value = colors[i];
      });
    }

    // Restore slideshow settings
    if (this.config.slideshow) {
      const speedSlider = document.getElementById('slideshow-speed');
      if (speedSlider) {
        speedSlider.value = this.config.slideshow.speed || 8;
        this.updateSliderValue('slideshow-speed');
      }

      const crossfadeSlider = document.getElementById('crossfade-duration');
      if (crossfadeSlider) {
        crossfadeSlider.value = this.config.slideshow.crossfade || 1500;
        this.updateSliderValue('crossfade-duration');
      }

      // Transition
      const transBtn = document.querySelector(`#bg-slideshow-panel .pill[data-transition="${this.config.slideshow.transition}"]`);
      if (transBtn) {
        transBtn.closest('.pill-group')?.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        transBtn.classList.add('active');
      }

      // Shuffle
      const shuffleToggle = document.getElementById('shuffle-toggle');
      if (shuffleToggle) shuffleToggle.checked = this.config.slideshow.shuffle || false;
    }

    // Restore particle settings
    if (this.config.particles) {
      // Style
      const styleBtn = document.querySelector(`#bg-particles-panel .pill[data-style="${this.config.particles.style}"]`);
      if (styleBtn) {
        styleBtn.closest('.pill-group')?.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        styleBtn.classList.add('active');
      }

      // Shapes (multi-select)
      const shapes = this.config.particles.shapes || ['dots'];
      document.querySelectorAll('.shape-btn').forEach(toggle => {
        toggle.classList.toggle('selected', shapes.includes(toggle.dataset.shape));
      });

      // Colors
      const colors = this.config.particles.colors || ['#8B5CF6', '#3B82F6', '#10B981'];
      document.querySelectorAll('.particle-color').forEach((picker, i) => {
        if (colors[i]) picker.value = colors[i];
      });

      // Mouse interaction
      const mouseBtn = document.querySelector(`#bg-particles-panel .pill[data-interaction="${this.config.particles.mouseInteraction}"]`);
      if (mouseBtn) {
        mouseBtn.closest('.pill-group')?.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        mouseBtn.classList.add('active');
      }

      // Sliders
      const densitySlider = document.getElementById('particle-density');
      if (densitySlider) densitySlider.value = this.config.particles.density || 40;

      const particleSpeedSlider = document.getElementById('particle-speed');
      if (particleSpeedSlider) particleSpeedSlider.value = this.config.particles.speed || 3;

      const opacitySlider = document.getElementById('particle-opacity');
      if (opacitySlider) opacitySlider.value = this.config.particles.opacity || 30;

      const scaleSlider = document.getElementById('particle-scale');
      if (scaleSlider) scaleSlider.value = this.config.particles.scale || 100;
    }
  }
};
