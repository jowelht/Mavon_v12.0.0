if (!customElements.get("color-swatch-variant")) {
  customElements.define(
    "color-swatch-variant",
    class ColorSwatchVariant extends HTMLElement {
      constructor() {
        super();
        this.addEventListener("click", this.onClickHandler.bind(this));
      }

      onClickHandler() {
        const variantId = this.dataset.variantId;
        const productHandle = this.dataset.productHandle;
        const productCard = this.closest(".product-grid-item");

        if (!variantId || !productHandle || !productCard) return;

        fetch(
          `/products/${productHandle}?variant=${variantId}&view=colorswatch`
        )
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(
              responseText,
              "text/html"
            );

            // Update thumbnail image
            const imgDest = productCard.querySelector(".media img");
            const imgSrc = html.querySelector(".media img");
            if (imgSrc && imgDest) {
              imgDest.src = imgSrc.src;
              imgDest.srcset = imgSrc.srcset;
            }

            // Update product link
            const linkDest =
              productCard.querySelector(".product__card--link");
            const linkSrc = html.querySelector(".product__card--link");
            if (linkDest && linkSrc) {
              linkDest.setAttribute("href", linkSrc.getAttribute("href"));
            }

            // Update title
            const titleDest = productCard.querySelector(
              ".product-grid-item__title"
            );
            const titleSrc = html.querySelector(".product-grid-item__title");
            if (titleSrc && titleDest)
              titleDest.innerHTML = titleSrc.innerHTML;

            // Update price
            const priceDest = productCard.querySelector(".price");
            const priceSrc = html.querySelector(".price");
            if (priceSrc && priceDest)
              priceDest.innerHTML = priceSrc.innerHTML;
          })
          .catch((e) => {
            console.error(e);
          });

        // Toggle active state
        const allSwatches = productCard.querySelectorAll(
          ".product--color-swatch"
        );
        allSwatches.forEach((btn) => btn.classList.remove("checked-color"));
        this.classList.add("checked-color");
      }
    }
  );
}
