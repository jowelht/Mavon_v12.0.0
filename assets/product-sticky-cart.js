/**
 * Sticky Cart with Bidirectional Synchronization
 *
 * Features:
 * - Variant sync: Main ↔ Sticky
 * - Quantity sync: Main ↔ Sticky
 * - Scroll-based visibility
 */

// ========================================
// STICKY VARIANT SELECT COMPONENT
// ========================================
if (!customElements.get('sticky-variant-select')) {
  class StickyProVariantSelect extends HTMLElement {
    constructor() {
      super();
      this.select = this.querySelector('select');
      this.isUpdating = false;
      this.boundOnChange = this.onStickyVariantChange.bind(this);
    }

    connectedCallback() {
      this.select = this.querySelector('select');
      if (!this.select) return;

      this.select.addEventListener('change', this.boundOnChange);

      // Subscribe to main variant changes
      this.unsubscribeVariant = subscribe(
        PUB_SUB_EVENTS.variantChange,
        this.onMainVariantChange.bind(this)
      );
    }

    disconnectedCallback() {
      this.select?.removeEventListener('change', this.boundOnChange);
      this.unsubscribeVariant?.();
    }

    /**
     * Handle variant change FROM sticky cart → sync TO main product
     */
    onStickyVariantChange(event) {
      if (this.isUpdating) return;

      const variantId = this.select.value;
      const sectionId = this.dataset.section;

      // Update sticky form's hidden input
      const stickyFormInput = document.querySelector('#sticky__selected_variant_id');
      if (stickyFormInput) {
        stickyFormInput.value = variantId;
      }

      // Sync to main product section
      this.syncVariantToMain(variantId, sectionId);
    }

    /**
     * Handle variant change FROM main product → sync TO sticky cart
     */
    onMainVariantChange(event) {
      if (this.isUpdating) return;
      if (!event?.data?.variant) return;

      const eventSectionId = event.data.sectionId;
      const thisSectionId = this.dataset.section;

      // Only respond to events from the same section
      if (eventSectionId !== thisSectionId) return;

      const variantId = event.data.variant.id;

      this.isUpdating = true;

      // Update sticky variant select
      if (this.select) {
        this.select.value = variantId;
      }

      // Update sticky form's hidden input
      const stickyFormInput = document.querySelector('#sticky__selected_variant_id');
      if (stickyFormInput) {
        stickyFormInput.value = variantId;
      }

      this.isUpdating = false;
    }

    /**
     * Sync variant selection from sticky cart to main product
     */
    async syncVariantToMain(variantId, sectionId) {
      this.isUpdating = true;

      const productInfo = document.querySelector(`product-info[data-section="${sectionId}"]`);
      if (!productInfo) {
        this.isUpdating = false;
        return;
      }

      const productUrl = this.dataset.productUrl || productInfo.dataset.url;

      // Update browser URL
      window.history.replaceState({}, '', `${productUrl}?variant=${variantId}`);

      try {
        // Fetch updated section HTML
        const response = await fetch(
          `${productUrl}?variant=${variantId}&section_id=${sectionId}`
        );
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Extract variant data from fetched HTML
        const variantDataEl = doc.querySelector('[data-selected-variant]');
        if (variantDataEl) {
          const variant = JSON.parse(variantDataEl.innerHTML);

          // Apply full product update using the fetched HTML
          this.applyFullProductUpdate(productInfo, doc, variant, sectionId, productUrl);
        }
      } catch (error) {
        console.error('Sticky cart variant sync error:', error);
      }

      this.isUpdating = false;
    }

    /**
     * Apply the full product update using the fetched HTML
     * This mirrors ProductInfo.handleUpdateProductInfo()
     */
    applyFullProductUpdate(productInfo, html, variant, sectionId, productUrl) {
      // 1. Update variant-selects component
      const newVariantSelects = html.querySelector('variant-selects');
      const currentVariantSelects = productInfo.querySelector('variant-selects');

      if (newVariantSelects && currentVariantSelects && typeof HTMLUpdateUtility !== 'undefined') {
        const preProcessCallback = (el) => {
          el.querySelectorAll('.scroll-trigger')
            .forEach(e => e.classList.add('scroll-trigger--cancel'));
        };
        HTMLUpdateUtility.viewTransition(currentVariantSelects, newVariantSelects, [preProcessCallback]);
      }

      // 2. Update hidden form inputs
      this.updateMainVariantInputs(variant, sectionId);

      // 3. Update pickup availability
      const pickupAvailability = productInfo.querySelector('pickup-availability');
      if (pickupAvailability?.update) {
        pickupAvailability.update(variant);
      }

      // 4. Update price, SKU, inventory, etc.
      this.updateProductDetails(productInfo, html, sectionId);

      // 5. Update media gallery
      this.updateMediaGallery(productInfo, html, variant, sectionId);

      // 6. Update submit button state
      this.updateSubmitButton(productInfo, html, variant, sectionId);

      // 7. Update back-in-stock button
      this.updateBackInStockButton(variant, productUrl);

      // 8. Update share button URL
      this.updateShareButton(productInfo, productUrl, variant);

      // 9. Reinitialize Shopify payment buttons
      window?.Shopify?.PaymentButton?.init();

      // 10. Publish variant change for other subscribers
      publish(PUB_SUB_EVENTS.variantChange, {
        data: {
          sectionId: sectionId,
          html: html,
          variant: variant,
          source: 'sticky-cart'
        }
      });
    }

    /**
     * Update price, SKU, inventory and other product details
     */
    updateProductDetails(productInfo, html, sectionId) {
      const updateSourceFromDestination = (id, shouldHide = () => false) => {
        const source = html.getElementById(`${id}-${sectionId}`);
        const destination = productInfo.querySelector(`#${id}-${sectionId}`);
        if (source && destination) {
          destination.innerHTML = source.innerHTML;
          destination.classList.toggle('hidden', shouldHide(source));
        }
      };

      updateSourceFromDestination('price');
      updateSourceFromDestination('Sku', ({ classList }) => classList.contains('hidden'));
      updateSourceFromDestination('inventory__stock');
      updateSourceFromDestination('Barcode');
      updateSourceFromDestination('Volume');
      updateSourceFromDestination('Price-Per-Item', ({ classList }) => classList.contains('hidden'));

      // Update quantity rules visibility
      const quantityRules = productInfo.querySelector(`#Quantity-Rules-${sectionId}`);
      if (quantityRules) quantityRules.classList.remove('hidden');

      const volumeNote = productInfo.querySelector(`#Volume-Note-${sectionId}`);
      if (volumeNote) volumeNote.classList.remove('hidden');
    }

    /**
     * Update the media gallery to show variant's featured media
     */
    updateMediaGallery(productInfo, html, variant, sectionId) {
      if (!variant?.featured_media?.id) return;

      const mediaGallery = productInfo.querySelector('media-gallery');
      if (mediaGallery?.setActiveMedia) {
        mediaGallery.setActiveMedia(`${sectionId}-${variant.featured_media.id}`, true);
      }

      // Update media modal if exists
      const modalContent = document.querySelector(`#ProductModal-${sectionId} .product-media-modal__content`);
      const newModalContent = html.querySelector('product-modal .product-media-modal__content');
      if (modalContent && newModalContent) {
        modalContent.innerHTML = newModalContent.innerHTML;
      }
    }

    /**
     * Update submit button state based on variant availability
     */
    updateSubmitButton(productInfo, html, variant, sectionId) {
      const submitButton = html.getElementById(`ProductSubmitButton-${sectionId}`);
      const productForm = productInfo.querySelector('product-form');

      if (productForm?.toggleSubmitButton) {
        if (!variant) {
          // Variant unavailable
          productForm.toggleSubmitButton({
            disable: true,
            text: window.variantStrings?.unavailable || 'Unavailable',
          });
        } else if (!variant.available) {
          // Variant sold out
          productForm.toggleSubmitButton({
            disable: true,
            text: window.variantStrings?.soldOut || 'Sold out',
          });
        } else {
          // Variant available
          productForm.toggleSubmitButton({
            disable: submitButton?.hasAttribute('disabled') ?? false,
          });
        }
      }

      // Handle preorder state
      const preorderData = html.querySelector('[data-selected-variant-is-preorder]');
      if (preorderData && productForm?.toggleSubmitButton) {
        const isPreorder = JSON.parse(preorderData.innerHTML);
        if (isPreorder) {
          productForm.toggleSubmitButton({
            disable: false,
            isPreorder: true,
          });
        }
      }
    }

    /**
     * Update back-in-stock button visibility
     */
    updateBackInStockButton(variant, productUrl) {
      const backInStockButton = document.querySelector('.notify_me--available');
      const backInStockModal = document.getElementById('back-in-stock-popup');

      if (backInStockButton && backInStockModal) {
        if (!variant?.available) {
          backInStockButton.classList.remove('hidden');
          const productUrlInput = backInStockModal.querySelector('#product--url');
          if (productUrlInput) {
            productUrlInput.value = `${window.location.origin}${productUrl}?variant=${variant.id}`;
          }
        } else {
          backInStockButton.classList.add('hidden');
        }
      }
    }

    /**
     * Update share button URL
     */
    updateShareButton(productInfo, productUrl, variant) {
      const shareButton = productInfo.querySelector('share-button');
      if (shareButton?.updateUrl) {
        const variantParam = variant?.id ? `?variant=${variant.id}` : '';
        shareButton.updateUrl(`${window.shopUrl || window.location.origin}${productUrl}${variantParam}`);
      }
    }

    /**
     * Update hidden variant ID inputs in main product forms
     */
    updateMainVariantInputs(variant, sectionId) {
      const selectors = [
        `#product-form-${sectionId} input[name="id"]`,
        `#product-form-installment-${sectionId} input[name="id"]`
      ];

      selectors.forEach(selector => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = variant.id;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }

  }

  customElements.define('sticky-variant-select', StickyProVariantSelect);
}

// ========================================
// QUANTITY SYNCHRONIZATION
// ========================================
class StickyQuantitySync {
  constructor() {
    this.isUpdating = false;
    this.mainInput = null;
    this.stickyInput = null;
    this.sectionId = null;

    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.cacheElements();
    if (!this.mainInput && !this.stickyInput) return;

    this.bindEvents();
    this.subscribeToEvents();
  }

  cacheElements() {
    const stickyCart = document.querySelector('[data-sticky-cart]');
    if (stickyCart) {
      this.sectionId = stickyCart.dataset.sectionId;
    }

    // Sticky quantity input
    this.stickyInput = document.querySelector('[data-sticky-quantity-input]');

    // Main product quantity input (inside product-info)
    const productInfo = document.querySelector(`product-info[data-section="${this.sectionId}"]`);
    if (productInfo) {
      this.mainInput = productInfo.querySelector('.product-form__quantity .quantity__input');
    }
  }

  bindEvents() {
    // Main quantity → Sticky quantity
    if (this.mainInput) {
      this.mainInput.addEventListener('change', this.onMainQuantityChange.bind(this));
    }

    // Sticky quantity → Main quantity
    if (this.stickyInput) {
      this.stickyInput.addEventListener('change', this.onStickyQuantityChange.bind(this));
    }

    // Handle button clicks (plus/minus) which might not trigger change immediately
    this.bindQuantityButtons();
  }

  bindQuantityButtons() {
    // Main quantity buttons
    const mainQuantityInput = this.mainInput?.closest('quantity-input');
    if (mainQuantityInput) {
      mainQuantityInput.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          // Small delay to let the value update
          setTimeout(() => this.syncMainToSticky(), 50);
        });
      });
    }

    // Sticky quantity buttons
    const stickyQuantityInput = this.stickyInput?.closest('quantity-input');
    if (stickyQuantityInput) {
      stickyQuantityInput.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          setTimeout(() => this.syncStickyToMain(), 50);
        });
      });
    }
  }

  subscribeToEvents() {
    // Listen for quantity sync events from other sources
    subscribe(PUB_SUB_EVENTS.stickyQuantitySync, (data) => {
      if (this.isUpdating) return;
      if (data.sectionId !== this.sectionId) return;

      this.handleQuantitySync(data);
    });

    // Listen for quantity updates (triggered after cart update resets main quantity)
    // This ensures sticky quantity resets when adding to cart from either form
    subscribe(PUB_SUB_EVENTS.quantityUpdate, () => {
      this.syncMainToSticky();
    });
  }

  onMainQuantityChange(event) {
    if (this.isUpdating) return;
    this.syncMainToSticky();
  }

  onStickyQuantityChange(event) {
    if (this.isUpdating) return;
    this.syncStickyToMain();
  }

  syncMainToSticky() {
    if (this.isUpdating || !this.mainInput || !this.stickyInput) return;

    const value = this.mainInput.value;

    this.isUpdating = true;
    this.stickyInput.value = value;
    this.isUpdating = false;

    // Publish sync event
    publish(PUB_SUB_EVENTS.stickyQuantitySync, {
      source: 'main',
      value: value,
      sectionId: this.sectionId
    });
  }

  syncStickyToMain() {
    if (this.isUpdating || !this.mainInput || !this.stickyInput) return;

    const value = this.stickyInput.value;

    this.isUpdating = true;
    this.mainInput.value = value;
    // Trigger change event for any listeners on main input
    this.mainInput.dispatchEvent(new Event('change', { bubbles: true }));
    this.isUpdating = false;

    // Publish sync event
    publish(PUB_SUB_EVENTS.stickyQuantitySync, {
      source: 'sticky',
      value: value,
      sectionId: this.sectionId
    });
  }

  handleQuantitySync(data) {
    this.isUpdating = true;

    if (data.source === 'main' && this.stickyInput) {
      this.stickyInput.value = data.value;
    } else if (data.source === 'sticky' && this.mainInput) {
      this.mainInput.value = data.value;
    }

    this.isUpdating = false;
  }

  refresh() {
    this.cacheElements();
    this.bindEvents();
  }
}

// Initialize quantity sync
if (!window.stickyQuantitySync) {
  window.stickyQuantitySync = new StickyQuantitySync();
}

// ========================================
// SCROLL BEHAVIOR (Show/Hide Sticky Cart)
// ========================================

// Helper function to get element offset
function TopOffset(el) {
  const rect = el.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return { top: rect.top + scrollTop };
}

// Handle Shopify theme editor events
if (Shopify.designMode && !window.stickyDesignModeListenersAdded) {
  window.stickyDesignModeListenersAdded = true;

  document.addEventListener('shopify:section:load', () => {
    stickyScroll();
    window.stickyQuantitySync?.refresh();
  });
  document.addEventListener('shopify:section:select', () => {
    stickyScroll();
  });
  document.addEventListener('shopify:section:deselect', () => {
    stickyScroll();
  });
}

const stickyScroll = () => {
  // Sync initial variant selection
  const stickySelectedVariant = document.querySelector('#sticky__variant');
  if (stickySelectedVariant) {
    const stickySelectVariantInput = document.querySelector('#sticky__selected_variant_id');
    if (stickySelectVariantInput) {
      stickySelectVariantInput.value = stickySelectedVariant.value;
    }
  }

  const BuyButtonForm = document.querySelector('.product_buy_button_form');
  const productStickyWrapper = document.querySelector('.product__sticky');

  if (!BuyButtonForm || !productStickyWrapper) return;

  // Remove existing scroll listener if it exists
  if (window.stickyScrollHandler) {
    window.removeEventListener('scroll', window.stickyScrollHandler);
  }

  // Create the scroll handler function
  window.stickyScrollHandler = function() {
    document.documentElement.style.setProperty(
      '--sticky-bar-height',
      `${productStickyWrapper.clientHeight}px`
    );

    const BuyButtonOffset = TopOffset(BuyButtonForm);
    const BuyButtonTopOffset = BuyButtonOffset.top;

    if (window.scrollY > BuyButtonTopOffset) {
      productStickyWrapper.classList.add('sticky');
      document.body.classList.add('sticky__cart');
    } else {
      productStickyWrapper.classList.remove('sticky');
      document.body.classList.remove('sticky__cart');
    }
  };

  // Add the scroll listener
  window.addEventListener('scroll', window.stickyScrollHandler);
};

// Initialize on page load
if (!window.stickyScrollInitialized) {
  window.stickyScrollInitialized = true;
  stickyScroll();
}
