/**
 * Optimized Media Showcase Component
 * Fixed synchronization between three sliders during drag interactions
 */
class MediaShowcase extends HTMLElement {
  constructor() {
    super();
    
    this.sectionId = this.dataset.sectionId;
    this.bigSlider = null;
    this.smallSlider = null;
    this.currentSlide = 0;
    this.totalSlides = 0;
    this.autoplayInterval = null;
    this.isInitialized = false;
    this.isUpdating = false; // Prevent sync loops
    this.isDragging = false; // Track drag state
    
    // Settings from data attributes
    this.settings = {
      autoplay: this.dataset.autoplay === 'true',
      autoplayDelay: (parseInt(this.dataset.autoplayDelay) || 5) * 1000,
      showSmallMedia: this.dataset.showSmallMedia === 'true'
    };

    // Bind event handlers
    this.handleNavigation = this.handleNavigation.bind(this);
    this.handlePagination = this.handlePagination.bind(this);
    this.handleThumbnailClick = this.handleThumbnailClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.pauseAutoplay = this.pauseAutoplay.bind(this);
    this.resumeAutoplay = this.resumeAutoplay.bind(this);
  }

  connectedCallback() {
    if (!this.isInitialized) {
      requestAnimationFrame(() => this.init());
    }
  }

  disconnectedCallback() {
    this.destroy();
  }

  init() {
    if (this.isInitialized) return;
    
    this.cacheElements();
    this.totalSlides = this.elements.contentItems.length;
    
    if (this.totalSlides <= 1) {
      this.hideNavigation();
      return;
    }

    if (typeof Swiper === 'undefined') {
      console.warn('Swiper not loaded. Falling back to manual navigation.');
      this.initManualNavigation();
      return;
    }

    this.initSliders();
    this.bindEvents();
    this.syncAllSliders(0);
    this.startAutoplay();
    
    this.isInitialized = true;
  }

  cacheElements() {
    this.elements = {
      bigSlider: this.querySelector(`#big-slider-${this.sectionId}`),
      smallSlider: this.querySelector(`#small-slider-${this.sectionId}`),
      contentItems: this.querySelectorAll('.media-showcase__content-item'),
      contentWrapper: this.querySelector('.media-showcase__content-wrapper'),
      prevBtn: this.querySelector(`#prev-btn-${this.sectionId}`),
      nextBtn: this.querySelector(`#next-btn-${this.sectionId}`),
      paginationDots: this.querySelectorAll('.media-showcase__pagination-dot'),
      smallImages: this.querySelectorAll('.media-showcase__small-image'),
      navigation: this.querySelector('.media-showcase__navigation')
    };
  }

  initSliders() {
    // Initialize big image slider
    if (this.elements.bigSlider) {
      this.bigSlider = new Swiper(this.elements.bigSlider, {
        slidesPerView: 1,
        spaceBetween: 0,
        loop: this.totalSlides > 1,
        speed: 500,
        allowTouchMove: true,
        autoHeight: true,
        grabCursor: true,
        on: {
          // Track drag start/end for better sync control
          touchStart: () => {
            this.isDragging = true;
            this.pauseAutoplay();
          },
          touchEnd: () => {
            this.isDragging = false;
            this.resumeAutoplay();
          },
          // Use slideChangeTransitionEnd instead of slideChange for accurate index
          slideChangeTransitionEnd: (swiper) => {
            if (!this.isUpdating) {
              const realIndex = this.getRealSlideIndex(swiper);
              this.handleSliderChange(realIndex, 'big');
            }
          },
          // Also listen to slideChange for immediate feedback during drag
          slideChange: (swiper) => {
            if (this.isDragging && !this.isUpdating) {
              const realIndex = this.getRealSlideIndex(swiper);
              this.handleSliderChange(realIndex, 'big');
            }
          }
        }
      });
    }

    // Initialize small thumbnail slider
    if (this.elements.smallSlider && this.settings.showSmallMedia) {
      this.smallSlider = new Swiper(this.elements.smallSlider, {
        slidesPerView: 'auto',
        spaceBetween: 10,
        loop: this.totalSlides > 1,
        centeredSlides: true,
        speed: 500,
        allowTouchMove: true,
        grabCursor: true,
        autoHeight: true,
        on: {
          // Track drag start/end
          touchStart: () => {
            this.isDragging = true;
            this.pauseAutoplay();
          },
          touchEnd: () => {
            this.isDragging = false;
            this.resumeAutoplay();
          },
          // Use slideChangeTransitionEnd for accurate sync
          slideChangeTransitionEnd: (swiper) => {
            if (!this.isUpdating) {
              const realIndex = this.getRealSlideIndex(swiper);
              this.handleSliderChange(realIndex, 'small');
            }
          },
          // Also listen during drag for immediate feedback
          slideChange: (swiper) => {
            if (this.isDragging && !this.isUpdating) {
              const realIndex = this.getRealSlideIndex(swiper);
              this.handleSliderChange(realIndex, 'small');
            }
          }
        }
      });
    }
  }

  /**
   * Get the real slide index, handling loop mode correctly
   * This is crucial for proper synchronization
   */
  getRealSlideIndex(swiper) {
    // In loop mode, use realIndex instead of activeIndex
    if (swiper.params.loop) {
      return swiper.realIndex;
    }
    return swiper.activeIndex;
  }

  initManualNavigation() {
    // Fallback for when Swiper isn't available
    this.bindEvents();
    this.syncAllSliders(0);
    this.startAutoplay();
    this.isInitialized = true;
  }

  bindEvents() {
    // Navigation buttons
    if (this.elements.prevBtn) {
      this.elements.prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleNavigation('prev');
      });
    }

    if (this.elements.nextBtn) {
      this.elements.nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleNavigation('next');
      });
    }

    // Pagination dots
    this.elements.paginationDots.forEach((dot, index) => {
      dot.addEventListener('click', () => this.handlePagination(index));
    });

    // Small image clicks
    this.elements.smallImages.forEach((img, index) => {
      img.addEventListener('click', () => this.handleThumbnailClick(index));
    });

    // Keyboard navigation
    this.addEventListener('keydown', this.handleKeydown);
    this.setAttribute('tabindex', '0');

    // Autoplay pause/resume on hover
    if (this.settings.autoplay) {
      this.addEventListener('mouseenter', this.pauseAutoplay);
      this.addEventListener('mouseleave', this.resumeAutoplay);
    }
  }

  handleNavigation(direction) {
    const nextIndex = direction === 'prev' 
      ? (this.currentSlide - 1 + this.totalSlides) % this.totalSlides
      : (this.currentSlide + 1) % this.totalSlides;
    
    this.goToSlide(nextIndex);
    this.pauseAndResumeAutoplay();
  }

  handlePagination(index) {
    this.goToSlide(index);
    this.pauseAndResumeAutoplay();
  }

  handleThumbnailClick(index) {
    this.goToSlide(index);
    this.pauseAndResumeAutoplay();
  }

  handleSliderChange(index, source) {
    // Ensure index is within valid range
    index = Math.max(0, Math.min(index, this.totalSlides - 1));
    this.currentSlide = index;
    this.syncAllSliders(index, source);
  }

  handleKeydown(e) {
    switch (e.key) {
      case 'ArrowLeft':
        this.handleNavigation('prev');
        e.preventDefault();
        break;
      case 'ArrowRight':
        this.handleNavigation('next');
        e.preventDefault();
        break;
      case 'Home':
        this.goToSlide(0);
        e.preventDefault();
        break;
      case 'End':
        this.goToSlide(this.totalSlides - 1);
        e.preventDefault();
        break;
    }
  }

  goToSlide(index) {
    if (index < 0 || index >= this.totalSlides || index === this.currentSlide) return;
    
    this.currentSlide = index;
    this.syncAllSliders(index, 'manual');
  }

  syncAllSliders(slideIndex, source = 'init') {
    if (this.isUpdating && source !== 'manual') return;
    
    this.isUpdating = true;
    this.currentSlide = slideIndex;

    // Use a small delay to ensure proper synchronization during drag
    const syncDelay = this.isDragging ? 50 : 0;
    
    setTimeout(() => {
      // Update big slider
      if (this.bigSlider && source !== 'big') {
        if (this.bigSlider.params.loop) {
          this.bigSlider.slideToLoop(slideIndex, source === 'init' ? 0 : 500);
        } else {
          this.bigSlider.slideTo(slideIndex, source === 'init' ? 0 : 500);
        }
      }

      // Update small slider
      if (this.smallSlider && source !== 'small') {
        if (this.smallSlider.params.loop) {
          this.smallSlider.slideToLoop(slideIndex, source === 'init' ? 0 : 500);
        } else {
          this.smallSlider.slideTo(slideIndex, source === 'init' ? 0 : 500);
        }
      }

      // Update content items with smooth transitions
      this.updateContentItems(slideIndex);

      // Update pagination dots
      this.updatePaginationDots(slideIndex);

      // Update small image states
      this.updateSmallImageStates(slideIndex);

      // Update navigation button states
      this.updateNavigationButtons();

      // Dispatch change event
      this.dispatchEvent(new CustomEvent('media-showcase:slide-change', {
        detail: { 
          currentSlide: slideIndex, 
          totalSlides: this.totalSlides,
          sectionId: this.sectionId
        },
        bubbles: true
      }));
    }, syncDelay);

    // Reset updating flag after animation completes
    setTimeout(() => {
      this.isUpdating = false;
    }, 500 + syncDelay);
  }

  updateContentItems(activeIndex) {
    // Calculate wrapper height based on active content
    const activeItem = this.elements.contentItems[activeIndex];
    if (activeItem && this.elements.contentWrapper) {
      // Temporarily show the active item to measure its height
      activeItem.style.position = 'relative';
      activeItem.style.opacity = '0';
      activeItem.style.visibility = 'visible';
      
      const height = activeItem.offsetHeight;
      this.elements.contentWrapper.style.height = `${height}px`;
      
      // Reset positioning
      activeItem.style.position = '';
      activeItem.style.opacity = '';
      activeItem.style.visibility = '';
    }

    // Update active states
    this.elements.contentItems.forEach((item, index) => {
      const isActive = index === activeIndex;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-hidden', !isActive);
      
      if (isActive) {
        item.style.zIndex = '2';
      } else {
        item.style.zIndex = '1';
      }
    });
  }

  updatePaginationDots(activeIndex) {
    this.elements.paginationDots.forEach((dot, index) => {
      const isActive = index === activeIndex;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-pressed', isActive);
    });
  }

  updateSmallImageStates(activeIndex) {
    this.elements.smallImages.forEach((img, index) => {
      const isActive = index === activeIndex;
      img.classList.toggle('active', isActive);
      img.setAttribute('aria-pressed', isActive);
    });
  }

  updateNavigationButtons() {
    // Only disable buttons if not looping
    const isLooping = this.bigSlider?.params?.loop ?? true;
    
    if (!isLooping && this.elements.prevBtn) {
      const isFirstSlide = this.currentSlide === 0;
      this.elements.prevBtn.disabled = isFirstSlide;
      this.elements.prevBtn.setAttribute('aria-disabled', isFirstSlide);
    }

    if (!isLooping && this.elements.nextBtn) {
      const isLastSlide = this.currentSlide === this.totalSlides - 1;
      this.elements.nextBtn.disabled = isLastSlide;
      this.elements.nextBtn.setAttribute('aria-disabled', isLastSlide);
    }
  }

  startAutoplay() {
    if (!this.settings.autoplay || this.totalSlides <= 1) return;
    
    this.stopAutoplay();
    this.autoplayInterval = setInterval(() => {
      if (!this.isDragging) { // Don't autoplay during drag
        const nextIndex = (this.currentSlide + 1) % this.totalSlides;
        this.goToSlide(nextIndex);
      }
    }, this.settings.autoplayDelay);
  }

  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }

  pauseAutoplay() {
    this.stopAutoplay();
  }

  resumeAutoplay() {
    if (!this.isDragging) { // Only resume if not dragging
      this.startAutoplay();
    }
  }

  pauseAndResumeAutoplay() {
    this.stopAutoplay();
    // Resume after user interaction delay
    setTimeout(() => {
      if (!this.isDragging) {
        this.startAutoplay();
      }
    }, this.settings.autoplayDelay);
  }

  hideNavigation() {
    if (this.elements.navigation) {
      this.elements.navigation.style.display = 'none';
    }
  }

  destroy() {
    this.stopAutoplay();
    
    if (this.bigSlider) {
      this.bigSlider.destroy(true, true);
      this.bigSlider = null;
    }
    
    if (this.smallSlider) {
      this.smallSlider.destroy(true, true);
      this.smallSlider = null;
    }

    // Remove event listeners
    this.removeEventListener('keydown', this.handleKeydown);
    this.removeEventListener('mouseenter', this.pauseAutoplay);
    this.removeEventListener('mouseleave', this.resumeAutoplay);

    this.isInitialized = false;
  }

  refresh() {
    this.destroy();
    setTimeout(() => this.init(), 100);
  }

  // Public API
  getCurrentSlide() { return this.currentSlide; }
  getTotalSlides() { return this.totalSlides; }
  isAutoplayActive() { return !!this.autoplayInterval; }

  // Static initialization
  static initializeAll() {
    document.querySelectorAll('media-showcase').forEach(element => {
      if (!element.isInitialized) {
        element.connectedCallback();
      }
    });
  }
}

// Register custom element
if (!customElements.get('media-showcase')) {
  customElements.define('media-showcase', MediaShowcase);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  MediaShowcase.initializeAll();
});

// Backup initialization
window.addEventListener('load', () => {
  MediaShowcase.initializeAll();
});

// Shopify theme editor support
document.addEventListener('shopify:section:load', (event) => {
  const mediaShowcase = document.querySelector(`media-showcase[data-section-id="${event.detail.sectionId}"]`);
  if (mediaShowcase) {
    setTimeout(() => mediaShowcase.refresh(), 100);
  }
});

document.addEventListener('shopify:section:unload', (event) => {
  const mediaShowcase = document.querySelector(`media-showcase[data-section-id="${event.detail.sectionId}"]`);
  if (mediaShowcase) {
    mediaShowcase.destroy();
  }
});

document.addEventListener('shopify:block:select', (event) => {
  const mediaShowcase = event.target.closest('media-showcase');
  if (mediaShowcase) {
    const slideIndex = Array.from(mediaShowcase.elements.contentItems)
      .findIndex(item => item.contains(event.target));
    if (slideIndex >= 0) {
      mediaShowcase.goToSlide(slideIndex);
    }
  }
});

// Export for external use
window.MediaShowcase = MediaShowcase;