/**
 * Cart drawer upsell: loads Shopify recommendations into the drawer and initializes Swiper.
 * Relies on global Swiper (theme.liquid) and sections/cart-drawer-upsell.liquid for recommendation markup.
 */
if (!customElements.get("cart-drawer-upsell")) {
  class CartDrawerUpsell extends HTMLElement {
    constructor() {
      super();
      this._swiper = null;
    }

    connectedCallback() {
      this._mount = this.querySelector("[data-upsell-mount]");
      this._loading = this.querySelector("[data-upsell-loading]");
      this._viewport = this.querySelector("[data-upsell-viewport]");

      const url = this.dataset.recommendationsUrl;

      if (url) {
        this.loadRecommendations(url);
      } else {
        queueMicrotask(() => this.initSwiperFromHost());
      }
    }

    disconnectedCallback() {
      this.destroySwiper();
    }

    /** Updates heading counter: current / total. */
    updateUpsellCounter() {
      const counter = this.querySelector("[data-upsell-counter]");
      if (!counter) return;

      const swiperEl = this.querySelector("[data-cart-drawer-upsell-swiper]");

      if (swiperEl?.swiper) {
        const sw = swiperEl.swiper;
        const total = sw.slides?.length ?? 0;
        if (total < 1) {
          counter.textContent = "";
          counter.hidden = true;
          return;
        }
        const idx =
          typeof sw.realIndex === "number" && !Number.isNaN(sw.realIndex)
            ? sw.realIndex
            : sw.activeIndex;
        const current = idx + 1;
        counter.hidden = false;
        counter.textContent = `${current}/${total}`;
        return;
      }

      if (swiperEl && !swiperEl.swiper) {
        const total = swiperEl.querySelectorAll(".swiper-slide").length;
        if (total < 1) {
          counter.textContent = "";
          counter.hidden = true;
          return;
        }
        counter.hidden = false;
        counter.textContent = `1/${total}`;
      }
    }

    destroySwiper() {
      const el = this.querySelector("[data-cart-drawer-upsell-swiper]");
      if (el && el.swiper) {
        el.swiper.destroy(true, true);
      }
      this._swiper = null;
    }

    _buildSliderMountHtml(wrapperInnerHtml) {
      return `<div class="swiper cart-drawer-upsell__swiper" data-cart-drawer-upsell-swiper><div class="swiper-wrapper">${wrapperInnerHtml}</div></div>`;
    }

    async loadRecommendations(url) {
      if (!this._mount || !url) return;
      try {
        const res = await fetch(url);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");
        const grid = doc.querySelector("[grid-recommendation]");
        const html = grid ? grid.innerHTML.trim() : "";

        if (this._loading) this._loading.hidden = true;

        if (!html) {
          this.style.display = "none";
          return;
        }

        this.destroySwiper();
        this.style.removeProperty("display");

        this._mount.innerHTML = this._buildSliderMountHtml(html);

        this._mount.hidden = false;
        queueMicrotask(() => this.initSwiperFromHost());
      } catch (e) {
        if (this._loading) this._loading.hidden = true;
        this.style.display = "none";
        console.error("Cart drawer upsell:", e);
      }
    }

    initSwiperFromHost() {
      const el = this.querySelector("[data-cart-drawer-upsell-swiper]");
      if (!el || typeof Swiper === "undefined") return;
      if (el.swiper) {
        el.swiper.destroy(true, true);
      }

      const rtl = document.documentElement.getAttribute("dir") === "rtl";

      const self = this;

      this._swiper = new Swiper(el, {
        slidesPerView: "auto",
        slidesPerGroup: 1,
        spaceBetween: 10,
        resizeObserver: true,
        speed: 380,
        rtl,
        watchOverflow: true,
        threshold: 6,
        resistanceRatio: 0.65,
        grabCursor: true,
        keyboard: { enabled: true, onlyInViewport: true },
        on: {
          init() {
            self.updateUpsellCounter();
          },
          slideChange() {
            self.updateUpsellCounter();
          },
          slideChangeTransitionEnd() {
            self.updateUpsellCounter();
          },
        },
      });
    }
  }

  customElements.define("cart-drawer-upsell", CartDrawerUpsell);
}
