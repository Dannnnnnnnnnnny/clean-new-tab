/**
 * WebGL Slideshow Transitions
 * Provides GPU-accelerated transition effects between images
 */
const WebGLTransitions = {
  // WebGL state
  canvas: null,
  gl: null,
  program: null,
  currentProgram: null,

  // Geometry
  positionBuffer: null,
  positionLocation: null,

  // Textures
  textures: new Map(),
  currentTexture: null,
  nextTexture: null,

  // Uniforms
  uniforms: {},

  // Animation state
  isTransitioning: false,
  animationId: null,
  onTransitionComplete: null,

  // Transition type
  currentTransition: 'dissolve',

  // Shader programs cache
  programs: {},

  // Check if WebGL is supported
  isSupported() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch (e) {
      return false;
    }
  },

  /**
   * Initialize WebGL context and resources
   */
  init() {
    if (this.canvas) return true;

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'webgl-slideshow-canvas';
    document.body.appendChild(this.canvas);

    // Get WebGL context
    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    if (!this.gl) {
      console.warn('WebGL not supported');
      return false;
    }

    // Setup canvas size
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Create geometry (fullscreen quad)
    this.createGeometry();

    // Compile all shader programs
    this.compileAllPrograms();

    // Set default program
    this.setTransition('dissolve');

    return true;
  },

  /**
   * Resize canvas to match window
   */
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  },

  /**
   * Create fullscreen quad geometry
   */
  createGeometry() {
    const gl = this.gl;

    // Create buffer with fullscreen quad vertices
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);
  },

  /**
   * Compile a shader
   */
  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  },

  /**
   * Create shader program
   */
  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  },

  /**
   * Vertex shader (shared by all transitions)
   */
  getVertexShader() {
    return `
      attribute vec2 a_position;
      varying vec2 v_uv;

      void main() {
        v_uv = a_position * 0.5 + 0.5;
        v_uv.y = 1.0 - v_uv.y; // Flip Y for correct image orientation
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
  },

  /**
   * Get fragment shader for transition type
   */
  getFragmentShader(type) {
    const header = `
      precision highp float;

      uniform sampler2D u_texture1;
      uniform sampler2D u_texture2;
      uniform float u_progress;
      uniform float u_time;
      uniform vec2 u_resolution;

      varying vec2 v_uv;

      // ============================================
      // UTILITY FUNCTIONS
      // ============================================

      // High-quality random
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      // Hermite interpolation (smoother than linear)
      float hermite(float t) {
        return t * t * (3.0 - 2.0 * t);
      }

      // Quintic interpolation (even smoother)
      float quintic(float t) {
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      }

      // ============================================
      // EASING FUNCTIONS (from GSAP research)
      // ============================================

      float easeInOutCubic(float t) {
        return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
      }

      float easeInOutQuint(float t) {
        return t < 0.5 ? 16.0 * t * t * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 5.0) / 2.0;
      }

      float easeOutElastic(float t) {
        float c4 = (2.0 * 3.14159) / 3.0;
        return t == 0.0 ? 0.0 : t == 1.0 ? 1.0 : pow(2.0, -10.0 * t) * sin((t * 10.0 - 0.75) * c4) + 1.0;
      }

      float easeOutBack(float t) {
        float c1 = 1.70158;
        float c3 = c1 + 1.0;
        return 1.0 + c3 * pow(t - 1.0, 3.0) + c1 * pow(t - 1.0, 2.0);
      }

      // ============================================
      // NOISE FUNCTIONS (from Three.js research)
      // ============================================

      // Simplex noise
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                           -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      // Fractal Brownian Motion (FBM) - layered noise
      float fbm(vec2 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        float maxValue = 0.0;

        for (int i = 0; i < 6; i++) {
          if (i >= octaves) break;
          value += amplitude * snoise(p * frequency);
          maxValue += amplitude;
          amplitude *= 0.5;
          frequency *= 2.0;
        }

        return value / maxValue;
      }

      // Perlin-style noise with hermite interpolation
      float pnoise(vec2 p, float freq) {
        vec2 pi = floor(p * freq);
        vec2 pf = fract(p * freq);

        float fx = hermite(pf.x);
        float fy = hermite(pf.y);

        float n00 = random(pi);
        float n10 = random(pi + vec2(1.0, 0.0));
        float n01 = random(pi + vec2(0.0, 1.0));
        float n11 = random(pi + vec2(1.0, 1.0));

        float nx0 = mix(n00, n10, fx);
        float nx1 = mix(n01, n11, fx);

        return mix(nx0, nx1, fy);
      }

      // Turbulent noise (absolute value creates ridges)
      float turbulence(vec2 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        float maxValue = 0.0;

        for (int i = 0; i < 6; i++) {
          if (i >= octaves) break;
          value += amplitude * abs(snoise(p * frequency));
          maxValue += amplitude;
          amplitude *= 0.5;
          frequency *= 2.0;
        }

        return value / maxValue;
      }

      // Domain warping for organic distortion
      vec2 warpDomain(vec2 p, float strength) {
        float n1 = fbm(p + vec2(0.0, 0.0), 4);
        float n2 = fbm(p + vec2(5.2, 1.3), 4);
        return p + vec2(n1, n2) * strength;
      }
    `;

    const transitions = {
      // ============================================
      // DISSOLVE - Organic noise-based reveal
      // ============================================
      dissolve: `
        vec4 transition(vec2 uv) {
          float t = easeInOutCubic(u_progress);

          // Multi-octave noise for organic dissolve
          vec2 warpedUV = warpDomain(uv * 2.0, 0.3);
          float n = fbm(warpedUV + u_time * 0.2, 5);
          n = n * 0.5 + 0.5;

          // Add subtle detail noise
          float detail = snoise(uv * 20.0) * 0.1;
          n += detail;

          // Create soft edge threshold
          float threshold = t * 1.3 - 0.15;
          float edge = smoothstep(threshold - 0.12, threshold + 0.12, n);

          // Add glow at the dissolve edge
          float glowEdge = smoothstep(threshold - 0.2, threshold, n) -
                          smoothstep(threshold, threshold + 0.1, n);
          vec3 glowColor = vec3(1.0, 0.95, 0.9) * glowEdge * 0.5;

          vec4 color1 = texture2D(u_texture1, uv);
          vec4 color2 = texture2D(u_texture2, uv);

          vec4 result = mix(color1, color2, edge);
          result.rgb += glowColor;

          return result;
        }
      `,

      // ============================================
      // PIXELATE - Mosaic transition with color blend
      // ============================================
      pixelate: `
        vec4 transition(vec2 uv) {
          float t = u_progress;
          float smoothT = easeInOutCubic(t);

          // Calculate pixel size with smooth peak in the middle
          float minPixels = 8.0;
          float maxPixels = min(u_resolution.x, u_resolution.y) * 0.5;

          // Bell curve for pixelation intensity
          float pixelProgress = sin(smoothT * 3.14159);
          float pixels = mix(maxPixels, minPixels, pixelProgress);

          // Add slight noise to pixel grid for organic feel
          vec2 gridPos = floor(uv * pixels);
          float gridNoise = random(gridPos) * 0.02;

          vec2 pixelUV = (gridPos + 0.5) / pixels;

          // Sample both textures
          vec4 color1 = texture2D(u_texture1, pixelUV);
          vec4 color2 = texture2D(u_texture2, pixelUV);

          // Crossfade with slight anticipation
          float mixFactor = smoothstep(0.35, 0.65, t);

          // Color shift during transition
          vec4 mixed = mix(color1, color2, mixFactor);

          // Subtle saturation boost at peak pixelation
          float satBoost = pixelProgress * 0.1;
          float gray = dot(mixed.rgb, vec3(0.299, 0.587, 0.114));
          mixed.rgb = mix(vec3(gray), mixed.rgb, 1.0 + satBoost);

          return mixed;
        }
      `,

      // ============================================
      // RIPPLE - Water drop with realistic physics
      // ============================================
      ripple: `
        vec4 transition(vec2 uv) {
          float t = easeOutBack(u_progress);
          vec2 center = vec2(0.5);
          vec2 delta = uv - center;
          float dist = length(delta);

          // Multiple ripple waves with decay
          float rippleFreq = 30.0;
          float rippleSpeed = 8.0;
          float rippleDecay = 3.0;

          // Primary wave
          float wave1 = sin(dist * rippleFreq - t * rippleSpeed) *
                       exp(-dist * rippleDecay) * (1.0 - t);

          // Secondary wave (smaller, faster)
          float wave2 = sin(dist * rippleFreq * 1.5 - t * rippleSpeed * 1.3) *
                       exp(-dist * rippleDecay * 1.2) * (1.0 - t) * 0.5;

          float wave = (wave1 + wave2) * 0.04;

          // Refraction-like distortion
          vec2 direction = normalize(delta + 0.001);
          vec2 distortedUV = uv + direction * wave;

          // Chromatic aberration at wave peaks
          float chromaStrength = abs(wave) * 0.5;
          vec2 rOffset = direction * chromaStrength * 0.02;
          vec2 bOffset = -direction * chromaStrength * 0.02;

          // Radial reveal from center
          float reveal = smoothstep(0.0, 0.8, t * 2.0 - dist);

          // Sample with chromatic aberration
          vec4 color1;
          color1.r = texture2D(u_texture1, distortedUV + rOffset).r;
          color1.g = texture2D(u_texture1, distortedUV).g;
          color1.b = texture2D(u_texture1, distortedUV + bOffset).b;
          color1.a = 1.0;

          vec4 color2 = texture2D(u_texture2, uv);

          // Caustic-like highlights
          float caustic = pow(max(0.0, wave1 + 0.5), 3.0) * 0.2 * (1.0 - t);

          vec4 result = mix(color1, color2, reveal);
          result.rgb += caustic;

          return result;
        }
      `,

      // ============================================
      // GLITCH - Digital corruption with artifacts
      // ============================================
      glitch: `
        vec4 transition(vec2 uv) {
          float t = u_progress;

          // Intensity peaks at middle of transition
          float intensity = pow(sin(t * 3.14159), 2.0);

          // Time-based randomization
          float glitchTime = floor(u_time * 15.0);

          // Horizontal block displacement
          float blockSize = mix(0.02, 0.15, random(vec2(glitchTime, 1.0)));
          float blockY = floor(uv.y / blockSize) * blockSize;
          float blockRand = random(vec2(blockY, glitchTime));
          float blockShift = (blockRand - 0.5) * 0.15 * intensity;

          // Occasional large shifts
          float bigGlitch = step(0.95, random(vec2(glitchTime, 2.0)));
          blockShift += bigGlitch * (random(vec2(blockY, glitchTime + 1.0)) - 0.5) * 0.3;

          // Vertical jitter
          float jitter = (random(vec2(uv.y * 100.0, glitchTime)) - 0.5) * 0.005 * intensity;

          // Scanlines
          float scanline = sin(uv.y * 300.0 + u_time * 5.0) * 0.03 * intensity;

          // RGB channel separation
          float rgbShift = intensity * 0.02 * (1.0 + bigGlitch * 2.0);

          vec2 distortedUV = uv;
          distortedUV.x += blockShift + jitter;
          distortedUV.y += scanline * 0.5;

          // Clamp to prevent edge artifacts
          distortedUV = clamp(distortedUV, 0.001, 0.999);

          // Select which image to glitch based on progress
          float selector = step(0.5, t);

          vec4 color1, color2;

          // Chromatic aberration
          vec2 rOff = vec2(rgbShift, rgbShift * 0.5);
          vec2 bOff = vec2(-rgbShift, -rgbShift * 0.3);

          if (selector < 0.5) {
            color1.r = texture2D(u_texture1, distortedUV + rOff).r;
            color1.g = texture2D(u_texture1, distortedUV).g;
            color1.b = texture2D(u_texture1, distortedUV + bOff).b;
            color1.a = 1.0;
            color2 = texture2D(u_texture2, uv);
          } else {
            color1 = texture2D(u_texture1, uv);
            color2.r = texture2D(u_texture2, distortedUV + rOff).r;
            color2.g = texture2D(u_texture2, distortedUV).g;
            color2.b = texture2D(u_texture2, distortedUV + bOff).b;
            color2.a = 1.0;
          }

          // Sudden color inversions
          float invertChance = step(0.97, random(vec2(blockY * 10.0, glitchTime)));
          vec4 result = mix(color1, color2, smoothstep(0.4, 0.6, t));

          if (invertChance > 0.5 && intensity > 0.3) {
            result.rgb = 1.0 - result.rgb;
          }

          // Static noise overlay
          float staticNoise = random(uv * u_resolution + glitchTime) * 0.1 * intensity;
          result.rgb += staticNoise - 0.05 * intensity;

          // Brief white flash at transition point
          float flash = exp(-pow((t - 0.5) * 10.0, 2.0)) * 0.4 * step(0.9, random(vec2(glitchTime, 3.0)));
          result.rgb += flash;

          return result;
        }
      `,

      // ============================================
      // WIPE - Diagonal reveal with soft edge
      // ============================================
      wipe: `
        vec4 transition(vec2 uv) {
          float t = easeInOutQuint(u_progress);

          // Diagonal wipe direction
          float angle = 0.785398; // 45 degrees
          vec2 direction = vec2(cos(angle), sin(angle));

          // Calculate position along wipe direction
          float dist = dot(uv - 0.5, direction) + 0.5;

          // Add noise to the edge for organic feel
          float noiseScale = 8.0;
          float edgeNoise = fbm(uv * noiseScale + u_time * 0.5, 3) * 0.15;

          // Soft edge with noise
          float edgeWidth = 0.08;
          float edge = smoothstep(t - edgeWidth + edgeNoise, t + edgeWidth + edgeNoise, dist);

          // Glow at the leading edge
          float glowWidth = 0.15;
          float glow = smoothstep(t - glowWidth, t, dist) - smoothstep(t, t + edgeWidth, dist);
          vec3 glowColor = vec3(1.0, 0.98, 0.95) * glow * 0.6;

          // Shadow behind the edge
          float shadow = smoothstep(t + edgeWidth, t + edgeWidth + 0.1, dist) -
                        smoothstep(t + edgeWidth + 0.1, t + edgeWidth + 0.2, dist);
          float shadowIntensity = shadow * 0.2;

          vec4 color1 = texture2D(u_texture1, uv);
          vec4 color2 = texture2D(u_texture2, uv);

          // Apply shadow to revealed image
          color2.rgb *= (1.0 - shadowIntensity);

          vec4 result = mix(color2, color1, edge);
          result.rgb += glowColor;

          return result;
        }
      `,

      // ============================================
      // MORPH - Liquid distortion blend
      // ============================================
      morph: `
        vec4 transition(vec2 uv) {
          float t = easeInOutCubic(u_progress);

          // Multi-layer domain warping for liquid effect
          float strength = sin(t * 3.14159) * 0.15;

          // First layer of distortion
          vec2 warp1 = warpDomain(uv * 2.0 + u_time * 0.3, strength);

          // Second layer with different frequency
          float n1 = fbm(warp1 * 1.5, 4);
          float n2 = fbm(warp1 * 1.5 + vec2(5.2, 1.3), 4);
          vec2 warp2 = vec2(n1, n2) * strength;

          // Apply warping differently to each image
          vec2 uv1 = uv + warp2 * (1.0 - t);
          vec2 uv2 = uv - warp2 * t;

          // Clamp UVs to prevent edge artifacts
          uv1 = clamp(uv1, 0.0, 1.0);
          uv2 = clamp(uv2, 0.0, 1.0);

          vec4 color1 = texture2D(u_texture1, uv1);
          vec4 color2 = texture2D(u_texture2, uv2);

          // Blend with slight color shift
          float blend = smoothstep(0.0, 1.0, t);

          // Add iridescent color shift at blend zone
          float blendZone = smoothstep(0.3, 0.5, t) - smoothstep(0.5, 0.7, t);
          vec3 iridescent = vec3(
            sin(uv.x * 10.0 + u_time) * 0.5 + 0.5,
            sin(uv.y * 10.0 + u_time + 2.0) * 0.5 + 0.5,
            sin((uv.x + uv.y) * 10.0 + u_time + 4.0) * 0.5 + 0.5
          );

          vec4 result = mix(color1, color2, blend);
          result.rgb += iridescent * blendZone * 0.1;

          return result;
        }
      `,

      // ============================================
      // SWIRL - Vortex with turbulence
      // ============================================
      swirl: `
        vec4 transition(vec2 uv) {
          float t = u_progress;
          float easedT = easeInOutCubic(t);

          vec2 center = vec2(0.5);
          vec2 delta = uv - center;
          float dist = length(delta);
          float angle = atan(delta.y, delta.x);

          // Swirl parameters
          float maxRotation = 4.0 * 3.14159; // 2 full rotations
          float swirlStrength = (1.0 - easedT) * maxRotation;

          // Swirl falloff from center (stronger in middle)
          float falloff = 1.0 - smoothstep(0.0, 0.7, dist);
          float swirlAmount = swirlStrength * falloff * falloff;

          // Add turbulence for organic feel
          float turb = turbulence(uv * 3.0 + u_time * 0.5, 3) * 0.3;
          swirlAmount += turb * (1.0 - easedT);

          // Apply rotation
          float newAngle = angle + swirlAmount;
          vec2 swirlUV = center + vec2(cos(newAngle), sin(newAngle)) * dist;

          // Slight zoom effect
          float zoom = 1.0 + (1.0 - easedT) * 0.1 * falloff;
          swirlUV = center + (swirlUV - center) * zoom;

          // Clamp UVs
          swirlUV = clamp(swirlUV, 0.0, 1.0);

          vec4 color1 = texture2D(u_texture1, swirlUV);
          vec4 color2 = texture2D(u_texture2, uv);

          // Radial blend from center
          float blend = smoothstep(0.2, 0.8, easedT + (1.0 - dist) * 0.3);

          // Motion blur effect (streaking colors)
          float streak = smoothstep(0.3, 0.7, swirlAmount / maxRotation);
          vec3 streakColor = mix(color1.rgb, color2.rgb, 0.5);

          vec4 result = mix(color1, color2, blend);
          result.rgb = mix(result.rgb, streakColor, streak * 0.3 * (1.0 - easedT));

          return result;
        }
      `,

      // ============================================
      // BURN - Fire edge with ember particles
      // ============================================
      burn: `
        vec4 transition(vec2 uv) {
          float t = u_progress;

          // Animated fire noise using FBM
          vec2 fireUV = uv * 4.0;
          fireUV.y -= u_time * 1.5; // Rising motion

          float fireNoise = 0.0;
          float amplitude = 1.0;
          float frequency = 1.0;
          for (int i = 0; i < 5; i++) {
            fireNoise += amplitude * snoise(fireUV * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
          }
          fireNoise = fireNoise * 0.5 + 0.5;

          // Burn edge progression
          float burnLine = t * 1.4 - 0.2;
          float noiseOffset = fireNoise * 0.25;

          // Multiple edge layers for depth
          float burnEdge = uv.y - burnLine + noiseOffset;
          float burned = smoothstep(0.0, 0.05, burnEdge);
          float ember = smoothstep(-0.08, 0.0, burnEdge) - smoothstep(0.0, 0.08, burnEdge);
          float glow = smoothstep(-0.2, -0.05, burnEdge) - smoothstep(-0.05, 0.1, burnEdge);
          float char = smoothstep(-0.02, 0.0, burnEdge) - smoothstep(0.0, 0.02, burnEdge);

          // Fire color gradient (temperature-based)
          vec3 fireColorHot = vec3(1.0, 0.95, 0.8);   // White-hot
          vec3 fireColorMid = vec3(1.0, 0.6, 0.1);    // Orange
          vec3 fireColorCool = vec3(0.8, 0.2, 0.05);  // Dark red
          vec3 charColor = vec3(0.1, 0.05, 0.02);     // Charred black

          // Blend fire colors based on position
          float fireIntensity = ember + glow * 0.5;
          vec3 fireColor = mix(fireColorCool, fireColorMid, smoothstep(0.0, 0.5, fireIntensity));
          fireColor = mix(fireColor, fireColorHot, smoothstep(0.5, 1.0, fireIntensity));

          // Ember particles
          float particleNoise = snoise(uv * 30.0 + vec2(u_time * 2.0, u_time * 3.0));
          float particles = step(0.92, particleNoise) * ember;

          vec4 color1 = texture2D(u_texture1, uv);
          vec4 color2 = texture2D(u_texture2, uv);

          // Apply char darkening to burned area edge
          color2.rgb = mix(color2.rgb, charColor, char * 0.5);

          // Combine everything
          vec4 result = mix(color1, color2, 1.0 - burned);

          // Add fire glow
          result.rgb += fireColor * (ember * 2.0 + glow * 0.8);

          // Add bright ember particles
          result.rgb += vec3(1.0, 0.9, 0.7) * particles * 2.0;

          // Slight heat distortion near burn edge
          float heatDistort = glow * 0.01;
          vec2 heatUV = uv + vec2(snoise(uv * 20.0 + u_time * 5.0) * heatDistort, 0.0);
          if (glow > 0.1) {
            vec4 heatColor = texture2D(u_texture1, heatUV);
            result.rgb = mix(result.rgb, heatColor.rgb, glow * 0.2);
          }

          return result;
        }
      `
    };

    const transitionCode = transitions[type] || transitions.dissolve;

    return header + transitionCode + `
      void main() {
        gl_FragColor = transition(v_uv);
      }
    `;
  },

  /**
   * Compile all transition programs
   */
  compileAllPrograms() {
    const types = ['dissolve', 'pixelate', 'ripple', 'glitch', 'wipe', 'morph', 'swirl', 'burn'];
    const vertexShader = this.getVertexShader();

    for (const type of types) {
      const fragmentShader = this.getFragmentShader(type);
      const program = this.createProgram(vertexShader, fragmentShader);
      if (program) {
        this.programs[type] = program;
      }
    }
  },

  /**
   * Set current transition type
   */
  setTransition(type) {
    if (!this.programs[type]) {
      console.warn(`Unknown transition type: ${type}, falling back to dissolve`);
      type = 'dissolve';
    }

    this.currentTransition = type;
    this.currentProgram = this.programs[type];

    if (this.currentProgram && this.gl) {
      const gl = this.gl;
      gl.useProgram(this.currentProgram);

      // Get uniform locations
      this.uniforms = {
        texture1: gl.getUniformLocation(this.currentProgram, 'u_texture1'),
        texture2: gl.getUniformLocation(this.currentProgram, 'u_texture2'),
        progress: gl.getUniformLocation(this.currentProgram, 'u_progress'),
        time: gl.getUniformLocation(this.currentProgram, 'u_time'),
        resolution: gl.getUniformLocation(this.currentProgram, 'u_resolution')
      };

      // Get attribute location
      this.positionLocation = gl.getAttribLocation(this.currentProgram, 'a_position');
    }
  },

  /**
   * Load an image as a WebGL texture
   */
  async loadTexture(src) {
    // Check cache
    if (this.textures.has(src)) {
      return this.textures.get(src);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const gl = this.gl;
        const texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        // Set texture parameters for non-power-of-2 images
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Cache the texture
        this.textures.set(src, texture);
        resolve(texture);
      };

      img.onerror = () => {
        console.error('Failed to load texture:', src);
        reject(new Error('Failed to load texture'));
      };

      img.src = src;
    });
  },

  /**
   * Preload textures for a list of images
   */
  async preloadTextures(sources) {
    const promises = sources.map(src => this.loadTexture(src).catch(() => null));
    await Promise.all(promises);
  },

  /**
   * Render a frame
   */
  render(texture1, texture2, progress, time = 0) {
    const gl = this.gl;
    if (!gl || !this.currentProgram) return;

    gl.useProgram(this.currentProgram);

    // Clear
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.uniform1i(this.uniforms.texture1, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.uniform1i(this.uniforms.texture2, 1);

    // Set uniforms
    gl.uniform1f(this.uniforms.progress, progress);
    gl.uniform1f(this.uniforms.time, time);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);

    // Bind geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  },

  /**
   * Run a transition animation
   */
  transition(fromTexture, toTexture, duration, onComplete) {
    if (this.isTransitioning) {
      this.stopTransition();
    }

    this.isTransitioning = true;
    this.currentTexture = fromTexture;
    this.nextTexture = toTexture;
    this.onTransitionComplete = onComplete;

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const time = now / 1000;

      this.render(fromTexture, toTexture, progress, time);

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.isTransitioning = false;
        this.currentTexture = toTexture;
        if (this.onTransitionComplete) {
          this.onTransitionComplete();
        }
      }
    };

    this.animationId = requestAnimationFrame(animate);
  },

  /**
   * Stop current transition
   */
  stopTransition() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isTransitioning = false;
  },

  /**
   * Show the canvas
   */
  show() {
    if (this.canvas) {
      this.canvas.classList.add('active');
    }
  },

  /**
   * Hide the canvas
   */
  hide() {
    if (this.canvas) {
      this.canvas.classList.remove('active');
    }
    this.stopTransition();
  },

  /**
   * Display a static texture (no transition)
   */
  displayStatic(texture) {
    this.currentTexture = texture;
    this.render(texture, texture, 0, performance.now() / 1000);
  },

  /**
   * Clean up resources
   */
  destroy() {
    this.stopTransition();

    if (this.gl) {
      // Delete textures
      for (const texture of this.textures.values()) {
        this.gl.deleteTexture(texture);
      }
      this.textures.clear();

      // Delete programs
      for (const program of Object.values(this.programs)) {
        this.gl.deleteProgram(program);
      }
      this.programs = {};

      // Delete buffers
      if (this.positionBuffer) {
        this.gl.deleteBuffer(this.positionBuffer);
      }
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.gl = null;
  },

  // ============================================
  // PREVIEW SYSTEM
  // ============================================

  preview: {
    canvas: null,
    gl: null,
    programs: {},
    positionBuffer: null,
    uniforms: {},
    currentProgram: null,
    animationId: null,
    texture1: null,
    texture2: null,
    userTexture1: null,
    userTexture2: null,
    userImages: [],
    isPlaying: false,

    /**
     * Initialize preview canvas
     */
    init() {
      const canvas = document.getElementById('preview-canvas');
      if (!canvas) return false;

      this.canvas = canvas;

      // Size canvas
      const container = canvas.parentElement;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;

      // Get WebGL context
      this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!this.gl) return false;

      // Create geometry
      const gl = this.gl;
      this.positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
      ]), gl.STATIC_DRAW);

      // Compile programs (use parent's shader code)
      this.compilePrograms();

      // Create demo textures as fallback
      this.createDemoTextures();

      // Show idle state
      this.showIdle();

      return true;
    },

    /**
     * Load user's slideshow images for preview
     */
    async loadUserImages(imageSources) {
      if (!this.gl || !imageSources || imageSources.length < 2) {
        this.userTexture1 = null;
        this.userTexture2 = null;
        this.userImages = [];
        return;
      }

      this.userImages = imageSources;
      const gl = this.gl;

      // Load first two images
      try {
        this.userTexture1 = await this.loadImageTexture(imageSources[0]);
        this.userTexture2 = await this.loadImageTexture(imageSources[1] || imageSources[0]);
      } catch (e) {
        console.warn('Failed to load user images for preview:', e);
        this.userTexture1 = null;
        this.userTexture2 = null;
      }
    },

    /**
     * Load a single image as texture
     */
    loadImageTexture(src) {
      return new Promise((resolve, reject) => {
        const gl = this.gl;
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          const texture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          resolve(texture);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
      });
    },

    /**
     * Get the textures to use (user's or demo)
     */
    getTextures() {
      if (this.userTexture1 && this.userTexture2) {
        return { tex1: this.userTexture1, tex2: this.userTexture2 };
      }
      return { tex1: this.texture1, tex2: this.texture2 };
    },

    /**
     * Compile shader programs for preview
     */
    compilePrograms() {
      const gl = this.gl;
      const types = ['dissolve', 'pixelate', 'ripple', 'glitch', 'wipe', 'morph', 'swirl', 'burn'];

      for (const type of types) {
        const vertexSource = WebGLTransitions.getVertexShader();
        const fragmentSource = WebGLTransitions.getFragmentShader(type);

        const vs = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        if (vs && fs) {
          const program = gl.createProgram();
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);

          if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            this.programs[type] = program;
          }
        }
      }
    },

    compileShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    },

    /**
     * Create colorful demo textures
     */
    createDemoTextures() {
      const gl = this.gl;
      const size = 256;

      // Texture 1: Gradient with pattern
      const data1 = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const u = x / size;
          const v = y / size;

          // Purple to blue gradient with circles
          const dist = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2);
          const pattern = Math.sin(dist * 20) * 0.5 + 0.5;

          data1[i] = Math.floor(100 + pattern * 50 + u * 100);     // R
          data1[i + 1] = Math.floor(50 + v * 80);                   // G
          data1[i + 2] = Math.floor(180 + pattern * 75);            // B
          data1[i + 3] = 255;
        }
      }

      this.texture1 = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Texture 2: Different gradient with pattern
      const data2 = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const u = x / size;
          const v = y / size;

          // Teal to orange gradient with waves
          const wave = Math.sin(u * 10 + v * 5) * 0.5 + 0.5;

          data2[i] = Math.floor(50 + (1 - v) * 200 + wave * 30);    // R
          data2[i + 1] = Math.floor(150 + wave * 50 - u * 50);       // G
          data2[i + 2] = Math.floor(100 + v * 100);                  // B
          data2[i + 3] = 255;
        }
      }

      this.texture2 = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data2);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    },

    /**
     * Show idle state (displays first image)
     */
    showIdle() {
      if (!this.gl || !this.texture1) return;

      const gl = this.gl;
      const program = this.programs.dissolve;
      if (!program) return;

      gl.useProgram(program);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0.1, 0.1, 0.15, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Get locations
      const posLoc = gl.getAttribLocation(program, 'a_position');
      const t1Loc = gl.getUniformLocation(program, 'u_texture1');
      const t2Loc = gl.getUniformLocation(program, 'u_texture2');
      const pLoc = gl.getUniformLocation(program, 'u_progress');
      const timeLoc = gl.getUniformLocation(program, 'u_time');
      const resLoc = gl.getUniformLocation(program, 'u_resolution');

      // Get textures (user's images or demo fallback)
      const { tex1 } = this.getTextures();

      // Bind textures (same texture for both to show static image)
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex1);
      gl.uniform1i(t1Loc, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex1);
      gl.uniform1i(t2Loc, 1);

      // Set uniforms
      gl.uniform1f(pLoc, 0);
      gl.uniform1f(timeLoc, 0);
      gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);

      // Draw
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },

    /**
     * Play transition preview
     */
    play(transitionType) {
      if (!this.gl || !this.programs[transitionType]) return;

      // Stop any running animation
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }

      this.isPlaying = true;
      this.currentType = transitionType;

      const gl = this.gl;
      const program = this.programs[transitionType];
      gl.useProgram(program);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      // Get locations
      const posLoc = gl.getAttribLocation(program, 'a_position');
      const t1Loc = gl.getUniformLocation(program, 'u_texture1');
      const t2Loc = gl.getUniformLocation(program, 'u_texture2');
      const pLoc = gl.getUniformLocation(program, 'u_progress');
      const timeLoc = gl.getUniformLocation(program, 'u_time');
      const resLoc = gl.getUniformLocation(program, 'u_resolution');

      // Get textures (user's images or demo fallback)
      const { tex1, tex2 } = this.getTextures();

      // Bind textures
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex1);
      gl.uniform1i(t1Loc, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex2);
      gl.uniform1i(t2Loc, 1);

      // Set resolution
      gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);

      const duration = 2000; // 2 second preview
      const startTime = performance.now();

      const animate = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const time = now / 1000;

        gl.uniform1f(pLoc, progress);
        gl.uniform1f(timeLoc, time);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        if (progress < 1) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          this.isPlaying = false;
          this.animationId = null;
        }
      };

      this.animationId = requestAnimationFrame(animate);
    },

    /**
     * Replay current transition
     */
    replay() {
      if (this.currentType) {
        this.play(this.currentType);
      }
    }
  }
};
