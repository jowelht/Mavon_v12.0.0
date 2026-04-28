// revealed-text-with-images.js
class TextLayered extends HTMLElement {
  constructor() {
    super();
    this.init();
  }

  init() {
    this.bannerHeading = this.querySelector(".text_layer__content");
    if (!this.bannerHeading) {
      console.warn("[TextLayered] Element '.text_layer__content' not found.");
      return;
    }

    // Store initial content and configuration
    this.sanitizedText = Array.from(this.bannerHeading.childNodes);
    this.animationConfig = {
      viewportTrigger: 0.7,
      minOpacity: 0.1,
      maxScale: 1,
      minScale: 0.5,
      scrollThrottle: 10,
    };

    // Initialize
    this.initializeContent();
    this.setupEventListeners();
    this.animateContent(); // Initial animation
  }

  setupEventListeners() {
    // Throttle scroll handler for better performance
    this.handleScroll = this.throttle(() => {
      requestAnimationFrame(() => this.animateContent());
    }, this.animationConfig.scrollThrottle);

    window.addEventListener("scroll", this.handleScroll);
    window.addEventListener("resize", this.handleScroll);
  }

  throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  initializeContent() {
    this.bannerHeading.innerHTML = "";
    this.sanitizedText.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        this.processTextNode(node);
      } else {
        this.processElementNode(node);
      }
    });
  }

  processTextNode(node) {
    const words = node.textContent.trim().split(/\s+/);

    words.forEach((word, index) => {
      // Create word container
      const wordContainer = document.createElement("p");
      wordContainer.className = "text-word";

      // Process each character
      Array.from(word).forEach((char) => {
        const charDiv = document.createElement("div");
        charDiv.className = "text-char";
        charDiv.textContent = char;
        wordContainer.appendChild(charDiv);
      });

      this.bannerHeading.appendChild(wordContainer);

      // Add space between words
      if (index < words.length - 1) {
        const spaceDiv = document.createElement("div");
        spaceDiv.className = "text-space";
        spaceDiv.innerHTML = "&nbsp;";
        this.bannerHeading.appendChild(spaceDiv);
      }
    });
  }

  processElementNode(node) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = node.outerHTML;
    this.bannerHeading.appendChild(wrapper.firstChild);
  }

  animateContent() {
    const viewportHeight = window.innerHeight;
    const elements = {
      chars: this.bannerHeading.querySelectorAll(".text-char"),
      spaces: this.bannerHeading.querySelectorAll(".text-space"),
      media: this.bannerHeading.querySelectorAll(".text_layre__media span"),
    };

    // Animate characters
    elements.chars.forEach((char, index) => {
      const { top, left } = char.getBoundingClientRect();
      const topOffset =
        top - viewportHeight * this.animationConfig.viewportTrigger;
      const opacity = Math.max(
        this.animationConfig.minOpacity,
        Math.min(1, 1 - (topOffset * 0.01 + left * 0.001)),
      );

      const translateY = Math.min(
        10,
        Math.max(topOffset * 0.1 + left * 0.01, 0),
      );

      char.style.cssText = `
        opacity: ${opacity.toFixed(4)};
        transform: translateY(${translateY.toFixed(4)}px);
      `;
    });

    // Animate media elements
    elements.media.forEach((media) => {
      const { top, left } = media.getBoundingClientRect();
      const topOffset =
        top - viewportHeight * this.animationConfig.viewportTrigger;
      const scale = Math.max(
        this.animationConfig.minScale,
        Math.min(
          this.animationConfig.maxScale,
          1 - (topOffset * 0.01 + left * 0.001),
        ),
      );
      const widthValue = Math.max(
        40,
        Math.min(100, left * 0.001 - topOffset * 1),
      );
      media.style.cssText = `
        opacity: ${scale.toFixed(4)};
        width: ${widthValue}px;
        transition: width 500ms, opacity 500ms linear;
      `;
    });
  }
  disconnectedCallback() {
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("resize", this.handleScroll);
  }
}

// Register the custom element
if (!customElements.get("text-layered")) {
  customElements.define("text-layered", TextLayered);
}
