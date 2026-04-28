/**
 * Enhanced Cart Discount Handler - Minimal changes to existing code
 * Just adds cart page support to existing cart drawer functionality
 */

if (!customElements.get("cart-discount")) {
  customElements.define(
    "cart-discount",
    class CartDiscount extends HTMLElement {
      constructor() {
        super();
        
        this.form = this.querySelector('.cart-discount__form');
        this.input = this.querySelector('#cart-discount');
        this.applyButton = this.querySelector('.cart-discount__button');
        this.removeButtons = this.querySelectorAll('.cart-discount__remove-btn');
        this.cart = document.querySelector("cart-notification");
        
        // Detect if we're on cart page
        this.isCartPage = window.location.pathname.includes('/cart');
        
        // Error handling properties
        this.activeFetch = null;
        this.discountCodes = this.getExistingDiscounts();
        
        // Store error state to preserve after full HTML update
        this.errorState = {
          isVisible: false,
          errorType: null,
          discountCode: null
        };
        
        this.setupEventListeners();
      }

      setupEventListeners() {
        // Handle form submission for applying discount
        if (this.form) {
          this.form.removeEventListener('submit', this.handleApplyDiscount);
          this.form.addEventListener('submit', this.handleApplyDiscount.bind(this));
        }

        // Handle remove button clicks
        this.removeButtons = this.querySelectorAll('.cart-discount__remove-btn');
        this.removeButtons.forEach(button => {
          button.removeEventListener('click', this.handleRemoveDiscount);
          button.addEventListener('click', this.handleRemoveDiscount.bind(this));
        });
      }

      createAbortController() {
        if (this.activeFetch) {
          this.activeFetch.abort();
        }
        
        const abortController = new AbortController();
        this.activeFetch = abortController;
        return abortController;
      }

      handleApplyDiscount(evt) {
        evt.preventDefault();
        
        const discountCode = this.input.value.trim();
        if (!discountCode) {
          this.showError('general');
          return;
        }
        
        // Check for duplicate discount codes
        const existingDiscounts = this.getExistingDiscounts();
        if (existingDiscounts.includes(discountCode)) {
          this.showError('duplicate');
          return;
        }
      
        this.setLoadingState(true);
        this.clearAllErrors();
        
        const abortController = this.createAbortController();
        
        this.updateCart({ 
          discount: [...existingDiscounts, discountCode].join(',') 
        }, abortController.signal)
          .then((parsedState) => {
            // Check for discount code validation errors
            const discountCodeError = this.validateDiscountCode(parsedState, discountCode);
            if (discountCodeError) {
              this.input.value = '';
              this.showError('discount-code');
              return;
            }
            
            // Check for shipping discount errors
            const shippingError = this.validateShippingDiscount(parsedState, discountCode, existingDiscounts);
            if (shippingError) {
              this.input.value = '';
              this.showError('shipping');
              return;
            }
            
            // Check if discount was actually applied by comparing discount codes
            const newDiscountCodes = this.getDiscountCodesFromResponse(parsedState);
            
            if (!newDiscountCodes.includes(discountCode)) {
              this.input.value = '';
              this.showError('discount-code');
              return;
            }
            
            this.input.value = '';
            this.clearAllErrors();
            
            // Dispatch custom event for successful discount application
            this.dispatchEvent(new CustomEvent('discountApplied', { 
              detail: { discountCode, cartData: parsedState } 
            }));
          })
          .catch(error => {
            console.error('Discount application error:', error);
            
            if (error.name === 'AbortError') {
              return;
            }
            
            if (error.message && error.message.includes('Invalid discount code')) {
              this.showError('discount-code');
            } else if (error.message && error.message.includes('Network')) {
              this.showError('network');
            } else {
              this.showError('general');
            }
          })
          .finally(() => {
            this.setLoadingState(false);
            this.activeFetch = null;
          });
      }

      handleRemoveDiscount(evt) {
        evt.preventDefault();
        
        const button = evt.target.closest('.cart-discount__remove-btn');
        if (!button) {
          console.error('Remove button not found');
          return;
        }
        
        const discountCode = button.dataset.discountCode;
        
        if (!discountCode) {
          console.error('No discount code found for removal');
          return;
        }
        
        this.setRemoveButtonLoadingState(button, true);
        this.clearAllErrors();
        
        const existingDiscounts = this.getExistingDiscounts();
        const index = existingDiscounts.indexOf(discountCode);
        
        if (index === -1) {
          this.setRemoveButtonLoadingState(button, false);
          return;
        }
        
        existingDiscounts.splice(index, 1);
        
        const abortController = this.createAbortController();
        
        this.updateCart({ 
          discount: existingDiscounts.join(',') 
        }, abortController.signal)
          .then((parsedState) => {
            // Dispatch custom event for successful discount removal
            this.dispatchEvent(new CustomEvent('discountRemoved', { 
              detail: { discountCode, cartData: parsedState } 
            }));
          })
          .catch(error => {
            console.error('Discount removal error:', error);
            
            if (error.name !== 'AbortError') {
              this.showError('network');
            }
          })
          .finally(() => {
            this.setRemoveButtonLoadingState(button, false);
            this.activeFetch = null;
          });
      }

      showError(type) {
        // Clear any previous errors
        this.clearAllErrors();
        
        // Update error state
        this.errorState = {
          isVisible: true,
          errorType: type,
          discountCode: this.input ? this.input.value.trim() : null
        };
        
        // Add error class to parent
        this.addErrorClassToParent(type);
      }

      clearAllErrors() {
        this.errorState = {
          isVisible: false,
          errorType: null,
          discountCode: null
        };
        
        this.clearErrorClassesFromParent();
      }

      validateDiscountCode(parsedState, discountCode) {
        if (!parsedState.discount_codes || !Array.isArray(parsedState.discount_codes)) {
          return false;
        }
        
        const discountInfo = parsedState.discount_codes.find(discount => {
          return discount.code === discountCode;
        });
        
        if (discountInfo && discountInfo.applicable === false) {
          return true;
        }
        
        return false;
      }

      validateShippingDiscount(parsedState, discountCode, existingDiscounts) {
        const sectionId = this.dataset.sectionId || (this.isCartPage ? 'main-cart-footer' : 'cart-notification');
        const newHtml = parsedState.sections && parsedState.sections[sectionId];
        
        if (!newHtml) return false;
        
        try {
          const parsedHtml = new DOMParser().parseFromString(newHtml, 'text/html');
          const section = parsedHtml.getElementById(`shopify-section-${sectionId}`);
          const discountPills = section?.querySelectorAll('.cart-discount__pill') || [];
          
          const uiDiscountCodes = Array.from(discountPills)
            .map(pill => pill.dataset.discountCode)
            .filter(Boolean);
          
          const discountInfo = parsedState.discount_codes?.find(discount => {
            return discount.code === discountCode && discount.applicable === true;
          });
          
          return discountInfo && 
                 uiDiscountCodes.length === existingDiscounts.length &&
                 uiDiscountCodes.every(code => existingDiscounts.includes(code));
        } catch (error) {
          console.error('Error validating shipping discount:', error);
          return false;
        }
      }

      updateCart(params, signal) {
        return new Promise((resolve, reject) => {
          const body = JSON.stringify({
            ...params,
            sections: this.getSectionsToRender().map((section) => section.id),
            sections_url: window.location.pathname,
          });

          const overlayElement = document.querySelector(".cart_action_drawer_overlay");
          if (overlayElement) {
            overlayElement.classList.add("active");
          }

          const fetchOptions = {
            ...fetchConfig(),
            body,
            signal
          };

          fetch(`${routes.cart_update_url}`, fetchOptions)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Network error: ${response.status}`);
              }
              return response.text();
            })
            .then((state) => {
              const parsedState = JSON.parse(state);
              
              if (parsedState.errors) {
                reject(new Error('Invalid discount code'));
                return;
              }
              
              if (parsedState.status && parsedState.status !== 200) {
                reject(new Error('Invalid discount code'));
                return;
              }
              
              if (parsedState.message && parsedState.message.includes('error')) {
                reject(new Error('Invalid discount code'));
                return;
              }
              
              // Render updated cart sections
              this.renderContents(parsedState);
              resolve(parsedState);
            })
            .catch((error) => {
              if (error.name === 'AbortError') {
                reject(error);
              } else {
                reject(new Error(`Network error: ${error.message}`));
              }
            })
            .finally(() => {
              if (overlayElement) {
                overlayElement.classList.remove("active");
              }
            });
        });
      }

      // Modified to support both cart page and cart drawer
      getSectionsToRender() {
        if (this.isCartPage) {
          // Cart page sections - use cart.js pattern
          return [
            {
              id: document.getElementById("main-cart-items")?.dataset.id || "main-cart-items",
            },
            {
              id: "cart-live-region-text",
            },
            {
              id: document.getElementById("main-cart-footer")?.dataset.id || "main-cart-footer",
            },
          ];
        } else {
          // Cart drawer sections - existing pattern
          return [
            {
              id: "cart-notification",
            }
          ];
        }
      }

      renderContents(parsedState) {
        // Store current error state before HTML update
        const currentErrorState = { ...this.errorState };
        
        if (this.isCartPage) {
          // Cart page rendering - use cart.js pattern
          this.renderCartPage(parsedState);
        } else {
          // Cart drawer rendering - existing pattern
          this.renderCartDrawer(parsedState);
        }

        // Update references after re-rendering
        this.removeButtons = this.querySelectorAll('.cart-discount__remove-btn');
        this.discountCodes = this.getExistingDiscounts();
        
        // Apply error state after HTML update
        this.applyErrorStateAfterUpdate(currentErrorState);
        
        // Re-setup event listeners after content update
        this.setupEventListeners();
        
        // Dispatch custom event to notify content was updated
        this.dispatchEvent(new CustomEvent('contentUpdated'));
      }

      renderCartPage(parsedState) {
        // Update cart page sections like cart.js does
        const sections = [
          {
            id: "main-cart-items",
            section: document.getElementById("main-cart-items")?.dataset.id,
            selector: ".js-contents",
          },
          {
            id: "cart-live-region-text",
            section: "cart-live-region-text",
            selector: ".shopify-section",
          },
          {
            id: "main-cart-footer",
            section: document.getElementById("main-cart-footer")?.dataset.id,
            selector: ".js-contents",
          },
        ];

        sections.forEach((section) => {
          if (!section.section) return;
          
          const elementToReplace = 
            document.getElementById(section.id)?.querySelector(section.selector) ||
            document.getElementById(section.id);

          if (elementToReplace && parsedState.sections[section.section]) {
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          }
        });

        // Update empty state
        const cartFooter = document.getElementById("main-cart-footer");
        if (cartFooter) {
          cartFooter.classList.toggle("is-empty", parsedState.item_count === 0);
        }
        
        const cartItems = document.querySelector("cart-items");
        if (cartItems) {
          cartItems.classList.toggle("is-empty", parsedState.item_count === 0);
        }
      }

      renderCartDrawer(parsedState) {
        // Existing cart drawer rendering
        const sections = this.getSectionsToRender();
        
        sections.forEach((section) => {
          const elementToReplace = document.getElementById(section.id);
          if (elementToReplace && parsedState.sections[section.id]) {
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.id]
            );
          }
        });
      }

      applyErrorStateAfterUpdate(errorState) {
        if (!errorState.isVisible || !errorState.errorType) {
          return;
        }
        
        // Small delay to ensure DOM is fully updated
        setTimeout(() => {
          // Restore error state
          this.errorState = errorState;
          
          // Add error class to parent div
          this.addErrorClassToParent(errorState.errorType);
          
        }, 100);
      }

      addErrorClassToParent(type) {
        const parentDiv = this.isCartPage ? 
          document.getElementById('main-cart-footer') : 
          document.getElementById('cart-notification');
        
        if (parentDiv) {
          // Clear any existing error classes first
          this.clearErrorClassesFromParent();
          
          // Add specific error class
          const errorClass = `cart-discount-error--${type}`;
          parentDiv.classList.add(errorClass);
        }
      }

      clearErrorClassesFromParent() {
        const parentDiv = this.isCartPage ? 
          document.getElementById('main-cart-footer') : 
          document.getElementById('cart-notification');
        
        if (parentDiv) {
          // Remove all possible error classes
          const errorClasses = [
            'cart-discount-error--general',
            'cart-discount-error--discount-code', 
            'cart-discount-error--shipping',
            'cart-discount-error--network',
            'cart-discount-error--duplicate'
          ];
          
          errorClasses.forEach(errorClass => {
            parentDiv.classList.remove(errorClass);
          });
        }
      }

      getSectionInnerHTML(html, selector = ".shopify-section") {
        return new DOMParser()
          .parseFromString(html, "text/html")
          .querySelector(selector).innerHTML;
      }

      getExistingDiscounts() {
        const discountCodes = [];
        const discountPills = this.querySelectorAll('.cart-discount__pill');
        
        for (const pill of discountPills) {
          if (pill.dataset.discountCode) {
            discountCodes.push(pill.dataset.discountCode);
          }
        }
        
        return discountCodes;
      }

      getDiscountCodesFromResponse(parsedState) {
        const discountCodes = [];
        const sectionId = this.dataset.sectionId || (this.isCartPage ? 'main-cart-footer' : 'cart-notification');
        const newHtml = parsedState.sections && parsedState.sections[sectionId];
        
        if (newHtml) {
          try {
            const parsedHtml = new DOMParser().parseFromString(newHtml, 'text/html');
            const discountPills = parsedHtml.querySelectorAll('.cart-discount__pill');
            
            discountPills.forEach(pill => {
              if (pill.dataset.discountCode) {
                discountCodes.push(pill.dataset.discountCode);
              }
            });
          } catch (error) {
            console.error('Error parsing HTML for discount codes:', error);
          }
        }
        
        return discountCodes;
      }

      setLoadingState(isLoading) {
        if (this.applyButton) {
          this.applyButton.disabled = isLoading;
          this.applyButton.textContent = isLoading ? 'Applying...' : 'Apply';
        }
        if (this.input) {
          this.input.disabled = isLoading;
        }
      }

      setRemoveButtonLoadingState(button, isLoading) {
        if (button) {
          button.disabled = isLoading;
          const textElement = button.querySelector('span');
          if (textElement) {
            textElement.textContent = isLoading ? 'Removing...' : 'Remove';
          }
        }
      }
    }
  );
}