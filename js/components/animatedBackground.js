/**
 * Animated Background Controller
 * Manages gradient, slideshow, and particle animations
 */
const AnimatedBackgroundComponent = {
  // State
  currentType: 'none', // 'none', 'color', 'gradient', 'slideshow', 'particles'
  config: null,
  eventsBound: false,
  previewInitialized: false,

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
  webglTextures: [],
  useWebGL: false,

  // DOM references
  customizer: null,
  bgLayer: null,

  // Gradient presets
  gradientPresets: {
    aurora: ['#00d4ff', '#090979', '#020024', '#00d4ff', '#00d4ff', '#090979'],
    sunset: ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#ff6b6b', '#feca57'],
    ocean: ['#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#0077b6', '#00b4d8'],
    neon: ['#ff00ff', '#00ffff', '#ff00ff', '#ffff00', '#00ffff', '#ff00ff'],
    forest: ['#2d5016', '#4a7c23', '#6b8e23', '#228b22', '#2d5016', '#4a7c23'],
    midnight: ['#0c1445', '#1a1a2e', '#16213e', '#0f3460', '#0c1445', '#1a1a2e']
  },

  /**
   * Initialize component
   */
  async init(settings) {
    this.bgLayer = document.getElementById('background-layer');

    const appearance = settings.appearance || {};
    this.config = appearance.animatedBgConfig || this.getDefaultConfig();
    this.currentType = this.config.type || 'none';

    // Check WebGL support and add class to body
    if (WebGLTransitions.isSupported()) {
      document.body.classList.add('webgl-supported');
    }

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
        preset: null,
        colors: ['#ee7752', '#e73c7e', '#23a6d5', '#23d5ab', '#667eea', '#764ba2'],
        gradientType: 'linear',
        animationStyle: 'shift',
        direction: '-45deg',
        speed: 15
      },
      slideshow: {
        speed: 8,
        crossfade: 1500,
        transition: 'fade',
        webglTransition: null,
        kenBurns: false,
        filter: 'none',
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

    // Gradient type pills
    document.querySelectorAll('#bg-gradient-panel .pill[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.pill-group').querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateGradient();
      });
    });

    // Animation style pills
    document.querySelectorAll('#bg-gradient-panel .pill[data-style]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.pill-group').querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateGradient();
      });
    });

    // Speed slider
    const speedSlider = document.getElementById('gradient-speed');
    speedSlider?.addEventListener('input', () => this.updateGradient());
  },

  /**
   * Handle preset change
   */
  handlePresetChange(preset) {
    if (!this.gradientPresets[preset]) return;

    // Update UI
    document.querySelectorAll('.gradient-preset').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === preset);
    });

    // Apply preset colors
    const colors = this.gradientPresets[preset];
    document.querySelectorAll('#bg-gradient-panel .color-pickers .color-picker-input').forEach((picker, i) => {
      if (colors[i]) picker.value = colors[i];
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

    // CSS Transition pills
    document.querySelectorAll('#bg-slideshow-panel .pill[data-transition]').forEach(btn => {
      btn.addEventListener('click', () => {
        // Deselect all CSS transitions and WebGL transitions
        document.querySelectorAll('#bg-slideshow-panel .pill[data-transition]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#bg-slideshow-panel .webgl-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.useWebGL = false;
        this.updateSlideshow();
      });
    });

    // WebGL Transition buttons
    document.querySelectorAll('#bg-slideshow-panel .webgl-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        // Deselect all CSS transitions and WebGL transitions
        document.querySelectorAll('#bg-slideshow-panel .pill[data-transition]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#bg-slideshow-panel .webgl-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.useWebGL = true;

        // Play preview
        const transitionType = btn.dataset.webgl;
        this.playTransitionPreview(transitionType);

        // Update label
        const label = document.getElementById('preview-transition-name');
        if (label) label.textContent = transitionType;

        this.updateSlideshow();
      });
    });

    // Preview replay button
    document.getElementById('preview-play-btn')?.addEventListener('click', () => {
      if (WebGLTransitions.preview.currentType) {
        WebGLTransitions.preview.replay();
      }
    });

    // Filter pills
    document.querySelectorAll('#bg-slideshow-panel .pill[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.pill-group').querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateSlideshow();
      });
    });

    // Ken Burns toggle
    const kenBurnsToggle = document.getElementById('ken-burns-toggle');
    kenBurnsToggle?.addEventListener('change', () => this.updateSlideshow());

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
   * Initialize transition preview
   */
  initTransitionPreview() {
    if (!this.previewInitialized && WebGLTransitions.isSupported()) {
      // Small delay to ensure canvas is rendered
      setTimeout(async () => {
        if (WebGLTransitions.preview.init()) {
          this.previewInitialized = true;
          // Load user images if available
          await this.updatePreviewImages();
        }
      }, 100);
    }
  },

  /**
   * Update preview with user's slideshow images
   */
  async updatePreviewImages() {
    if (this.slideshowImages.length >= 2) {
      await WebGLTransitions.preview.loadUserImages(this.slideshowImages);
      // Refresh the idle display to show user image
      WebGLTransitions.preview.showIdle();
    }
  },

  /**
   * Play transition preview
   */
  playTransitionPreview(transitionType) {
    if (!this.previewInitialized) {
      this.initTransitionPreview();
      // Wait for init then play
      setTimeout(() => {
        WebGLTransitions.preview.play(transitionType);
      }, 200);
    } else {
      WebGLTransitions.preview.play(transitionType);
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

    // Initialize preview when switching to slideshow
    if (type === 'slideshow') {
      this.initTransitionPreview();
    }

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
    const gradientType = document.querySelector('#bg-gradient-panel .pill[data-type].active')?.dataset.type || 'linear';
    const animStyle = document.querySelector('#bg-gradient-panel .pill[data-style].active')?.dataset.style || 'shift';
    const direction = '-45deg'; // Fixed direction since we removed direction buttons
    const speed = document.getElementById('gradient-speed')?.value || 15;

    document.body.classList.add('has-bg-gradient');

    // Build gradient based on type
    let gradient;
    switch (gradientType) {
      case 'radial':
        gradient = `radial-gradient(circle, ${colors.join(', ')})`;
        break;
      case 'conic':
        gradient = `conic-gradient(from 0deg, ${colors.join(', ')})`;
        break;
      default:
        gradient = `linear-gradient(${direction}, ${colors.join(', ')})`;
    }

    this.bgLayer.style.background = gradient;
    this.bgLayer.style.backgroundSize = '400% 400%';

    // Apply animation style
    this.bgLayer.className = 'background-layer';
    switch (animStyle) {
      case 'pulse':
        this.bgLayer.classList.add('anim-pulse');
        break;
      case 'wave':
        this.bgLayer.classList.add('anim-wave');
        break;
      default: // shift
        this.bgLayer.style.animation = `gradientShift ${speed}s ease infinite`;
    }
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
    // Update config
    this.config.gradient = {
      preset: this.config.gradient?.preset || null,
      colors: this.getGradientColors(),
      gradientType: document.querySelector('#bg-gradient-panel .pill[data-type].active')?.dataset.type || 'linear',
      animationStyle: document.querySelector('#bg-gradient-panel .pill[data-style].active')?.dataset.style || 'shift',
      direction: '-45deg',
      speed: parseInt(document.getElementById('gradient-speed')?.value || 15)
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
    const webglTransition = this.config.slideshow?.webglTransition || null;
    const filter = document.querySelector('#bg-slideshow-panel .pill[data-filter].active')?.dataset.filter || 'none';
    const kenBurns = document.getElementById('ken-burns-toggle')?.checked || false;
    const shuffle = document.getElementById('shuffle-toggle')?.checked || false;

    this.useWebGL = !!webglTransition && WebGLTransitions.isSupported();

    // Create shuffled order if needed
    if (shuffle) {
      this.shuffledOrder = [...Array(this.slideshowImages.length).keys()];
      for (let i = this.shuffledOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.shuffledOrder[i], this.shuffledOrder[j]] = [this.shuffledOrder[j], this.shuffledOrder[i]];
      }
    } else {
      this.shuffledOrder = [...Array(this.slideshowImages.length).keys()];
    }

    // If using WebGL transitions
    if (this.useWebGL) {
      await this.applyWebGLSlideshow(webglTransition, crossfade, shuffle);
      return;
    }

    // Otherwise use CSS transitions
    // Create image elements
    this.slideshowImages.forEach((src, i) => {
      const div = document.createElement('div');
      const isFirst = (shuffle ? this.shuffledOrder[0] === i : i === 0);

      div.className = 'slideshow-image';
      if (isFirst) div.classList.add('active');

      // Apply filter
      if (filter !== 'none') {
        div.classList.add(`filter-${filter}`);
      }

      // Apply Ken Burns
      if (kenBurns) {
        div.classList.add('ken-burns');
        // Randomize Ken Burns direction
        const directions = [
          'translate(0, 0) scale(1)',
          'translate(-3%, -3%) scale(1.15)',
          'translate(3%, -3%) scale(1.15)',
          'translate(-3%, 3%) scale(1.15)',
          'translate(3%, 3%) scale(1.15)'
        ];
        const randomStart = directions[Math.floor(Math.random() * directions.length)];
        div.style.setProperty('--ken-burns-start', randomStart);
      }

      div.style.backgroundImage = `url(${src})`;

      // Set transition based on type
      if (transition === 'fade') {
        div.style.transition = `opacity ${crossfade}ms var(--motion-easing-standard)`;
      }

      div.dataset.index = i;
      this.bgLayer.appendChild(div);
    });

    // Start slideshow timer
    const interval = (parseInt(document.getElementById('slideshow-speed')?.value || 8)) * 1000;

    this.currentSlideIndex = 0;
    this.slideshowTimerId = setInterval(() => this.advanceSlide(transition, crossfade), interval);
  },

  /**
   * Apply WebGL slideshow
   */
  async applyWebGLSlideshow(transitionType, crossfade, shuffle) {
    // Initialize WebGL if needed
    if (!WebGLTransitions.init()) {
      console.warn('WebGL init failed, falling back to CSS');
      this.useWebGL = false;
      this.applySlideshow();
      return;
    }

    // Set the transition type
    WebGLTransitions.setTransition(transitionType);

    // Preload all textures
    await WebGLTransitions.preloadTextures(this.slideshowImages);

    // Get first texture and display it
    const firstIdx = this.shuffledOrder[0];
    const firstTexture = await WebGLTransitions.loadTexture(this.slideshowImages[firstIdx]);

    WebGLTransitions.show();
    WebGLTransitions.displayStatic(firstTexture);

    // Start slideshow timer
    const interval = (parseInt(document.getElementById('slideshow-speed')?.value || 8)) * 1000;

    this.currentSlideIndex = 0;
    this.slideshowTimerId = setInterval(() => this.advanceWebGLSlide(transitionType, crossfade), interval);
  },

  /**
   * Advance WebGL slide
   */
  async advanceWebGLSlide(transitionType, crossfade) {
    if (this.slideshowImages.length < 2) return;

    const currentIdx = this.shuffledOrder[this.currentSlideIndex];
    const nextSlidePosition = (this.currentSlideIndex + 1) % this.shuffledOrder.length;
    const nextIdx = this.shuffledOrder[nextSlidePosition];

    try {
      const currentTexture = await WebGLTransitions.loadTexture(this.slideshowImages[currentIdx]);
      const nextTexture = await WebGLTransitions.loadTexture(this.slideshowImages[nextIdx]);

      WebGLTransitions.transition(currentTexture, nextTexture, crossfade, () => {
        // Transition complete
        this.currentSlideIndex = nextSlidePosition;
      });
    } catch (error) {
      console.error('WebGL transition error:', error);
      this.currentSlideIndex = nextSlidePosition;
    }
  },

  /**
   * Advance to next slide
   */
  advanceSlide(transition = 'fade', crossfade = 1500) {
    const slides = this.bgLayer?.querySelectorAll('.slideshow-image');
    if (!slides || slides.length < 2) return;

    const currentIdx = this.shuffledOrder[this.currentSlideIndex];
    const nextSlidePosition = (this.currentSlideIndex + 1) % this.shuffledOrder.length;
    const nextIdx = this.shuffledOrder[nextSlidePosition];

    const currentSlide = slides[currentIdx];
    const nextSlide = slides[nextIdx];

    // Apply transition effect
    switch (transition) {
      case 'slide':
        currentSlide.classList.add('slide-exit');
        nextSlide.classList.add('slide-enter');
        nextSlide.classList.add('active');
        setTimeout(() => {
          nextSlide.classList.remove('slide-enter');
          nextSlide.classList.add('slide-active');
        }, 50);
        setTimeout(() => {
          currentSlide.classList.remove('active', 'slide-exit', 'slide-active');
          nextSlide.classList.remove('slide-active');
        }, 600);
        break;

      case 'zoom':
        nextSlide.classList.add('zoom-enter');
        nextSlide.classList.add('active');
        setTimeout(() => {
          nextSlide.classList.remove('zoom-enter');
          nextSlide.classList.add('zoom-active');
          currentSlide.classList.remove('active');
        }, 50);
        setTimeout(() => {
          nextSlide.classList.remove('zoom-active');
        }, 800);
        break;

      case 'blur':
        nextSlide.classList.add('blur-enter');
        nextSlide.classList.add('active');
        setTimeout(() => {
          nextSlide.classList.remove('blur-enter');
          nextSlide.classList.add('blur-active');
          currentSlide.classList.remove('active');
        }, 50);
        setTimeout(() => {
          nextSlide.classList.remove('blur-active');
        }, 800);
        break;

      default: // fade
        currentSlide.classList.remove('active');
        nextSlide.classList.add('active');
    }

    // Reset Ken Burns on next slide
    const kenBurns = document.getElementById('ken-burns-toggle')?.checked || false;
    if (kenBurns) {
      nextSlide.style.animation = 'none';
      void nextSlide.offsetHeight;
      nextSlide.style.animation = '';
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

    // Update preview with new images
    if (this.previewInitialized) {
      this.updatePreviewImages();
    }

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

    // Add the URL to images
    this.slideshowImages.push(url);
    this.renderGallery();

    if (this.currentType === 'slideshow') {
      this.stopAllAnimations();
      this.applySlideshow();
    }

    await this.saveImages();
    this.saveConfig();

    // Update preview with new images
    if (this.previewInitialized) {
      this.updatePreviewImages();
    }

    // Clear input
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

    // Update preview with remaining images
    if (this.previewInitialized) {
      this.updatePreviewImages();
    }
  },

  /**
   * Render image gallery
   */
  renderGallery() {
    const gallery = document.getElementById('slideshow-gallery');
    if (!gallery) return;

    // Clear existing (except add button)
    gallery.querySelectorAll('.gallery-image').forEach(el => el.remove());

    // Add images before the add-image-card
    const addBtn = gallery.querySelector('.add-image-card');
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
    // Get active WebGL transition (if any)
    const activeWebGL = document.querySelector('#bg-slideshow-panel .webgl-chip.active');
    const webglTransition = activeWebGL ? activeWebGL.dataset.webgl : null;

    this.config.slideshow = {
      speed: parseInt(document.getElementById('slideshow-speed')?.value || 8),
      crossfade: parseInt(document.getElementById('crossfade-duration')?.value || 1500),
      transition: document.querySelector('#bg-slideshow-panel .pill[data-transition].active')?.dataset.transition || 'fade',
      webglTransition: webglTransition,
      kenBurns: document.getElementById('ken-burns-toggle')?.checked || false,
      filter: document.querySelector('#bg-slideshow-panel .pill[data-filter].active')?.dataset.filter || 'none',
      shuffle: document.getElementById('shuffle-toggle')?.checked || false
    };

    this.useWebGL = !!webglTransition;

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

      // Gradient type
      const typeBtn = document.querySelector(`#bg-gradient-panel .pill[data-type="${this.config.gradient.gradientType}"]`);
      if (typeBtn) {
        typeBtn.closest('.pill-group')?.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        typeBtn.classList.add('active');
      }

      // Animation style
      const animBtn = document.querySelector(`#bg-gradient-panel .pill[data-style="${this.config.gradient.animationStyle}"]`);
      if (animBtn) {
        animBtn.closest('.pill-group')?.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        animBtn.classList.add('active');
      }

      // Speed
      const speedSlider = document.getElementById('gradient-speed');
      if (speedSlider) speedSlider.value = this.config.gradient.speed || 15;
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

      // Transition (CSS or WebGL)
      if (this.config.slideshow.webglTransition) {
        // WebGL transition - deselect CSS transitions and select WebGL button
        document.querySelectorAll('#bg-slideshow-panel .pill[data-transition]').forEach(b => b.classList.remove('active'));
        const webglBtn = document.querySelector(`#bg-slideshow-panel .webgl-chip[data-webgl="${this.config.slideshow.webglTransition}"]`);
        if (webglBtn) {
          document.querySelectorAll('#bg-slideshow-panel .webgl-chip').forEach(b => b.classList.remove('active'));
          webglBtn.classList.add('active');
        }
        this.useWebGL = true;
      } else {
        // CSS transition
        const transBtn = document.querySelector(`#bg-slideshow-panel .pill[data-transition="${this.config.slideshow.transition}"]`);
        if (transBtn) {
          transBtn.closest('.pill-group')?.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
          transBtn.classList.add('active');
        }
        this.useWebGL = false;
      }

      // Filter
      const filterBtn = document.querySelector(`#bg-slideshow-panel .pill[data-filter="${this.config.slideshow.filter}"]`);
      if (filterBtn) {
        filterBtn.closest('.pill-group')?.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        filterBtn.classList.add('active');
      }

      // Ken Burns
      const kenBurnsToggle = document.getElementById('ken-burns-toggle');
      if (kenBurnsToggle) kenBurnsToggle.checked = this.config.slideshow.kenBurns || false;

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
