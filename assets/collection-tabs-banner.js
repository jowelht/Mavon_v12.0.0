/**
 * Collection Tabs Banner Component - Minimal Swiper Integration
 * Uses existing global Swiper v6
 */

class CollectionTabsBanner extends HTMLElement {
  constructor() {
    super();
    
    this.sectionId = this.dataset.sectionId;
    this.autoChange = this.dataset.autoChange === 'true' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.changeDelay = parseInt(this.dataset.changeDelay) * 1000 || 3000;
    this.tabToggleType = this.dataset.tabToggleType || 'click';

    // New slider auto-rotate settings
    this.sliderAutoRotate = this.dataset.sliderAutoRotate === 'true' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sliderChangeSpeed = parseInt(this.dataset.sliderChangeSpeed) * 1000 || 3000;

    // Column settings
    this.productsShowXl = parseInt(this.dataset.productsShowXl) || 3;
    this.productsShowSm = parseInt(this.dataset.productsShowSm) || 2;
    
    this.currentIndex = 0;
    this.autoInterval = null;
    this.progressInterval = null;
    this.isReady = false;
    this.hasInteracted = false;
    this.isHovered = false;
    this.hoverTimeout = null;
    
    this._tabs = null;
    this._banners = null;
    this.swiperInstances = new Map(); // Store Swiper instances by tab index
  }
  
  get tabs() {
    if (!this._tabs) this._tabs = this.querySelectorAll('.collection-tab-item');
    return this._tabs;
  }
  
  get banners() {
    if (!this._banners) this._banners = this.querySelectorAll('.collection-banner-item');
    return this._banners;
  }
  
  connectedCallback() {
    if (this.isReady) return;
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      setTimeout(() => this.init(), 100);
    }
  }
  
  disconnectedCallback() {
    this.cleanup();
  }
  
  init() {
    if (this.isReady || !this.tabs.length) return;
    
    this.bindEvents();
    this.setupA11y();
    
    // Set first tab as active initially
    this.goTo(0, false);
    
    // Initialize Swiper for the default active tab after DOM is ready
    setTimeout(() => {
      this.initSwiperForTab(this.currentIndex);
    }, 200);
    
    if (this.autoChange) {
      setTimeout(() => {
        this.startAuto();
      }, 1000);
    }
    
    this.isReady = true;
  }

  /**
   * Initialize Swiper for a specific tab
   */
  initSwiperForTab(tabIndex) {
    if (!window.Swiper) return;

    const tab = this.tabs[tabIndex];
    if (!tab) return;

    const swiperContainer = tab.querySelector('.collection-banner-products-slider');
    if (!swiperContainer || this.swiperInstances.has(tabIndex)) return;

    try {
      // Configure autoplay based on settings
      const autoplayConfig = this.sliderAutoRotate ? {
        delay: this.sliderChangeSpeed,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      } : false;


      const swiperInstance = new Swiper(swiperContainer, {
        slidesPerView: this.productsShowSm,
        spaceBetween: 20,
        autoplay: autoplayConfig,
        navigation: {
          nextEl: tab.querySelector(".swiper-button-next"),
          prevEl: tab.querySelector(".swiper-button-prev"),
        },
        pagination: {
          el: tab.querySelector(".swiper-pagination"),
          clickable: true,
        },
        breakpoints: {
          750: {
            slidesPerView: 2,
          },
          992: {
            slidesPerView: this.productsShowXl,
          }
        }
      });

      this.swiperInstances.set(tabIndex, swiperInstance);

      // Calculate and set thumbnail height for navigation positioning
      this.setupSlideThumbHeight(tab);

    } catch (error) {
      console.error('Failed to initialize Swiper:', error);
    }
  }

  /**
   * Setup slide thumbnail height calculation for navigation positioning
   */
  setupSlideThumbHeight(tabElement) {
    const slideThumbHeight = () => {
      const productThumbnails = tabElement.querySelectorAll(".card--client-height");
      if (productThumbnails.length > 0) {
        const productThumbnailHeight = productThumbnails[0];
        tabElement.style.setProperty(
          "--slider-navigation-top-offset",
          `${productThumbnailHeight.clientHeight / 2}px`
        );
      }
    };
    
    // Calculate initially
    slideThumbHeight();
    
    // Store reference for cleanup
    const resizeHandler = () => {
      slideThumbHeight();
    };
    
    // Add resize listener
    window.addEventListener("resize", resizeHandler);
    
    // Store the resize handler for cleanup
    if (!this.resizeHandlers) {
      this.resizeHandlers = new Map();
    }
    this.resizeHandlers.set(tabElement, resizeHandler);
  }


  /**
   * Destroy Swiper for a specific tab
   */
  destroySwiperForTab(tabIndex) {
    const swiperInstance = this.swiperInstances.get(tabIndex);
    if (swiperInstance) {
      swiperInstance.destroy(true, true);
      this.swiperInstances.delete(tabIndex);
    }
  }
  
  bindEvents() {
    this.tabs.forEach((tab, i) => {
      const summary = tab.querySelector('summary');
      if (summary) {
        
        if (this.tabToggleType === 'click') {
          summary.addEventListener('click', (e) => {
            e.preventDefault();
            this.goTo(i, false);
          });
        } else if (this.tabToggleType === 'hover') {
          summary.addEventListener('mouseenter', () => {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = setTimeout(() => {
              this.goTo(i, false);
            }, 200);
          });
          
          summary.addEventListener('mouseleave', () => {
            clearTimeout(this.hoverTimeout);
          });
          
          summary.addEventListener('click', (e) => {
            e.preventDefault();
            clearTimeout(this.hoverTimeout);
            this.goTo(i, false);
          });
        }
        
        summary.addEventListener('keydown', (e) => {
          let nextIndex = i;
          
          switch (e.key) {
            case 'ArrowDown':
            case 'ArrowRight':
              nextIndex = (i + 1) % this.tabs.length;
              break;
            case 'ArrowUp':
            case 'ArrowLeft':
              nextIndex = i === 0 ? this.tabs.length - 1 : i - 1;
              break;
            case 'Home':
              nextIndex = 0;
              break;
            case 'End':
              nextIndex = this.tabs.length - 1;
              break;
            case 'Enter':
            case ' ':
              this.goTo(i, false);
              return;
            default:
              return;
          }
          
          e.preventDefault();
          const nextTab = this.tabs[nextIndex]?.querySelector('summary');
          if (nextTab) {
            nextTab.focus();
            this.goTo(nextIndex, false);
          }
        });
      }
    });
    
    if (this.autoChange) {
      if (this.tabToggleType === 'hover') {
        this.addEventListener('mouseenter', () => {
          this.isHovered = true;
          this.pauseAuto();
        });
        
        this.addEventListener('mouseleave', () => {
          this.isHovered = false;
          if (!this.hasInteracted) {
            this.resumeAuto();
          }
        });
      } else {
        this.addEventListener('mouseenter', () => {
          this.isHovered = true;
          this.pauseAuto();
        });
        
        this.addEventListener('mouseleave', () => {
          this.isHovered = false;
          if (!this.hasInteracted) {
            this.resumeAuto();
          }
        });
        
        document.addEventListener('mousemove', (e) => {
          const rect = this.getBoundingClientRect();
          const isInsideSection = (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          );
          
          if (isInsideSection && !this.isHovered) {
            this.isHovered = true;
            this.pauseAuto();
          } else if (!isInsideSection && this.isHovered) {
            this.isHovered = false;
            if (!this.hasInteracted) {
              this.resumeAuto();
            }
          }
        });
      }
      
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pauseAuto();
        } else if (!this.hasInteracted && !this.isHovered) {
          this.resumeAuto();
        }
      });
    }
  }
  
  setupA11y() {
    this.tabs.forEach((tab, i) => {
      const summary = tab.querySelector('summary');
      const content = tab.querySelector('.collection-tabs-banner-accordion-content');
      
      if (summary && content) {
        summary.setAttribute('role', 'button');
        summary.setAttribute('aria-expanded', i === this.currentIndex ? 'true' : 'false');
        summary.id = `tab-${this.sectionId}-${i}`;
        content.id = `content-${this.sectionId}-${i}`;
        summary.setAttribute('aria-controls', content.id);
        content.setAttribute('aria-labelledby', summary.id);
      }
    });
  }
  
  goTo(index, isUserInteraction = false) {
    if (index === this.currentIndex || index < 0 || index >= this.tabs.length) return;
    
    const oldIndex = this.currentIndex;
    this.currentIndex = index;
    
    if (isUserInteraction) {
      this.hasInteracted = true;
      this.pauseAuto();
    }
    
    // Update tabs
    this.tabs.forEach((tab, i) => {
      const details = tab.querySelector('details');
      const summary = tab.querySelector('summary');
      
      if (i === index) {
        details?.setAttribute('open', '');
        summary?.setAttribute('aria-expanded', 'true');
        // Initialize Swiper for the active tab
        this.initSwiperForTab(i);
      } else {
        details?.removeAttribute('open');
        summary?.setAttribute('aria-expanded', 'false');
        // Destroy Swiper for inactive tabs to free up resources
        this.destroySwiperForTab(i);
      }
    });
    
    // Update banners
    this.banners.forEach((banner, i) => {
      if (i === index) {
        banner.classList.add('active');
      } else {
        banner.classList.remove('active');
      }
    });
    
    if (this.autoChange && !this.hasInteracted) {
      this.resetAuto();
    }
  }
  
  startAuto() {
    if (!this.autoChange || this.autoInterval || this.hasInteracted || this.isHovered) {
      return;
    }
    
    this.startProgressBar();
    
    this.autoInterval = setInterval(() => {
      if (!document.hidden && !this.hasInteracted && !this.isHovered) {
        const nextIndex = (this.currentIndex + 1) % this.tabs.length;
        this.goTo(nextIndex, false);
      }
    }, this.changeDelay);
  }
  
  startProgressBar() {
    if (!this.autoChange || this.hasInteracted || this.isHovered) return;
    
    this.resetProgressBars();
    
    const activeTab = this.tabs[this.currentIndex];
    if (!activeTab) return;
    
    const progressFill = activeTab.querySelector('.tab-progress-fill');
    if (!progressFill) return;
    
    progressFill.style.width = '0%';
    progressFill.style.transition = 'none';
    progressFill.offsetHeight;
    progressFill.style.transition = `width ${this.changeDelay}ms linear`;
    progressFill.style.width = '100%';
  }
  
  resetProgressBars() {
    this.tabs.forEach(tab => {
      const progressFill = tab.querySelector('.tab-progress-fill');
      if (progressFill) {
        progressFill.style.width = '0%';
        progressFill.style.transition = 'none';
      }
    });
  }
  
  pauseAuto() {
    if (this.autoInterval) {
      clearInterval(this.autoInterval);
      this.autoInterval = null;
    }
    this.resetProgressBars();
  }
  
  resumeAuto() {
    if (this.autoChange && !this.autoInterval && !this.hasInteracted && !this.isHovered) {
      this.startAuto();
    }
  }
  
  resetAuto() {
    if (this.autoChange && !this.hasInteracted) {
      this.pauseAuto();
      setTimeout(() => {
        if (!this.hasInteracted && !this.isHovered) {
          this.startAuto();
        }
      }, 100);
    }
  }
  
  cleanup() {
    this.pauseAuto();
    this.resetProgressBars();
    
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    // Clean up all Swiper instances
    this.swiperInstances.forEach((swiperInstance) => {
      if (swiperInstance && typeof swiperInstance.destroy === 'function') {
        swiperInstance.destroy(true, true);
      }
    });
    this.swiperInstances.clear();
    
    this.isReady = false;
    this.hasInteracted = false;
    this.isHovered = false;
  }
  
  // Public API
  nextTab() { 
    this.hasInteracted = true;
    this.goTo((this.currentIndex + 1) % this.tabs.length, true); 
  }
  prevTab() { 
    this.hasInteracted = true;
    this.goTo(this.currentIndex === 0 ? this.tabs.length - 1 : this.currentIndex - 1, true); 
  }
  goToTab(index) { 
    this.hasInteracted = true;
    this.goTo(index, true); 
  }
}

// Register component
if (!customElements.get('collection-tabs-banner')) {
  customElements.define('collection-tabs-banner', CollectionTabsBanner);
}

// Theme integration
window.theme = window.theme || {};

theme.collectionTabsBanner = (function () {
  function CollectionTabsBannerInit(container) {
    const component = container.querySelector('collection-tabs-banner');
    if (component && !component.isReady) {
      component.init();
    }
  }
  return CollectionTabsBannerInit;
})();

// Register with theme.Sections
document.addEventListener('DOMContentLoaded', function() {
  if (window.theme && window.theme.Sections) {
    const sections = new theme.Sections();
    sections.register('collection-tabs-banner', theme.collectionTabsBanner);
  }
});

// Shopify Editor Support
document.addEventListener('shopify:section:load', (e) => {
  const banner = e.target.querySelector('collection-tabs-banner');
  if (banner && !banner.isReady) {
    setTimeout(() => banner.init(), 200);
  }
});

document.addEventListener('shopify:section:unload', (e) => {
  const banner = e.target.querySelector('collection-tabs-banner');
  if (banner) banner.cleanup();
});

document.addEventListener('shopify:block:select', (e) => {
  const banner = e.target.closest('collection-tabs-banner');
  const index = parseInt(e.target.dataset.tabIndex);
  if (banner && !isNaN(index)) {
    banner.goToTab(index);
  }
});

// Simple fallback
if (!window.customElements) {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.collection-tabs-banner-component details').forEach(d => d.open = true);
  });
}