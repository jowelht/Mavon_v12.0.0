---
name: cart-drawer-upsell-mavon
description: >-
  Documents the Mavon theme cart drawer upsell: theme settings, Liquid structure,
  Product Recommendations API section, custom element, Swiper slider, compact card
  snippet, and CSS container-query slide widths. Use when porting upsell to another
  theme, debugging Swiper/counter/recommendations, or extending the cart drawer.
---

# Cart drawer upsell (Mavon theme)

Blueprint for the **cart drawer “You May Also Like”** block: manual vs Shopify recommendations, **Swiper** carousel, heading counter, compact product rows, and theme editor settings.

---

## Overview

- **Where it appears:** Inside the cart **drawer** only (`snippets/cart-notification-children.liquid`), below line items, when upsell is enabled and `cart` is not empty.
- **Layout:** Always a **horizontal Swiper** (`slidesPerView: "auto"`). Each slide is a compact row (image, title/price, add / quick-add).
- **Sources:** Theme setting **Automatic** fetches HTML via `routes.product_recommendations_url` into a **hidden mount**, then mounts Swiper in JS. **Manual** renders slides server-side from a product list or collection.
- **Exclusions:** Products already in the cart are skipped (ID list built in Liquid, `needle` / `contains` checks).
- **Dependencies:** Global **Swiper** + `swiper-bundle` CSS/JS from `layout/theme.liquid`. **product-form.js** and **quick-add.js** load with upsell for add-to-cart and multi-variant quick view.

---

## File map

| Role | Path |
|------|------|
| Main snippet (custom element shell + manual vs automatic markup) | `snippets/cart-drawer-upsell.liquid` |
| Compact card (image, price, simple add / quick-view) | `snippets/cart-drawer-upsell-product-card.liquid` |
| API fragment only (`section_id=cart-drawer-upsell`) | `sections/cart-drawer-upsell.liquid` |
| Drawer insertion | `snippets/cart-notification-children.liquid` → `{% render 'cart-drawer-upsell' %}` |
| Custom element + fetch + Swiper | `assets/cart-drawer-upsell.js` |
| Scoped styles (BEM-style `cart-drawer-upsell*` / `cart-drawer-upsell-compact*`) | `assets/component-cart-drawer-upsell.css` |
| Drawer flex layout hook for upsell | `assets/component-cart-notification.css` (`#cart-notification… > .cart-drawer-upsell`) |
| Theme settings (Cart group) | `config/settings_schema.json` → header **Cart drawer upsell** (`cart_upsell_*`) |
| Stylesheet + JS registration | `sections/header.liquid` (when `cart_type == drawer` and `cart_upsell_enable`) |

---

## Theme settings (`config/settings_schema.json`)

All under the **Cart** settings group, header **Cart drawer upsell**:

| Setting ID | Type | Purpose |
|------------|------|---------|
| `cart_upsell_enable` | checkbox | Master toggle; drawer also loads upsell CSS/JS when true. |
| `cart_upsell_heading` | text | Section title (default “You May Also Like”). |
| `cart_upsell_source` | select | `automatic` \| `manual`. |
| `cart_upsell_products` | product_list | Manual: prioritized list (limit 24). |
| `cart_upsell_collection` | collection | Manual: fallback when product list empty. |
| `cart_upsell_products_to_show` | range 1–12 | Max recommendations/manual items (`limit_n`). |

Vendor line on the card respects **`show_vendor_cart_drawer`** (global cart drawer setting elsewhere in schema).

---

## DOM and data contract

### Custom element: `<cart-drawer-upsell>`

- **Class:** `cart-drawer-upsell` (also targets `custom` element default display in CSS).
- **`data-source`:** `automatic` or `manual` (informational for humans; JS uses URL presence).
- **`data-recommendations-url`:** Present only when automatic; full `routes.product_recommendations_url` query including:
  - `section_id=cart-drawer-upsell` (must match `sections/cart-drawer-upsell.liquid` filename)
  - `product_id={{ cart.items.first.product_id }}`
  - `limit={{ limit_n | plus: cart.items.size }}`
  - `intent=related`

### Automatic branch (`data-upsell-viewport`)

- `[data-upsell-loading]` — spinner until fetch completes.
- `[data-upsell-mount]` — hidden until filled; receives Swiper root HTML from JS.

### Manual branch

- `.cart-drawer-upsell__viewport` contains `.swiper.cart-drawer-upsell__swiper` > `.swiper-wrapper` > slides.

### Slides (both sources)

- Wrapper: `<div class="swiper-slide cart-drawer-upsell__slide">` + `{% render 'cart-drawer-upsell-product-card' %}`.

### Recommendations API HTML contract

- Section output must include `[grid-recommendation]`; JS does `querySelector('[grid-recommendation]')` and uses **`innerHTML`** of that node (slide markup only).
- Fragment root classes in section: `cart-drawer-upsell__fragment-root` (optional for styling); attribute **`grid-recommendation`** is required for the parser.

### Counter

- `[data-upsell-counter]` — `aria-live="polite"`; starts `hidden` for automatic until Swiper inits; text `current/total` updated on Swiper `init`, `slideChange`, `slideChangeTransitionEnd`.

---

## JavaScript (`assets/cart-drawer-upsell.js`)

- **`cart-drawer-upsell`** custom element:
  - If **`dataset.recommendationsUrl`** → `loadRecommendations(url)` (fetch, parse, inject into mount, then `initSwiperFromHost`).
  - Else → `initSwiperFromHost()` on next microtask (manual HTML already in DOM).
- **`_buildSliderMountHtml(inner)`** wraps fragment inner HTML in `.swiper.cart-drawer-upsell__swiper` + `.swiper-wrapper`.
- **Swiper options:** `slidesPerView: "auto"`, `spaceBetween: 10`, `resizeObserver: true`, `grabCursor`, `keyboard`, RTL from `document.documentElement[dir]`, etc.
- **Destroy** on element disconnect or before rebuilding Swiper.

**Keep in sync:** `--upsell-slide-gap` on `.cart-drawer-upsell__viewport` in CSS should match `spaceBetween` in JS (both `10px`) so slide width math stays correct.

---

## CSS (`assets/component-cart-drawer-upsell.css`)

- **Viewport** (`cart-drawer-upsell__viewport`): defines `--upsell-slide-gap`, `--upsell-slide-visible-ratio: 1.4` (≈1 full slide + ~40% peek), `container-type: inline-size`.
- **Slides:** `.cart-drawer-upsell__swiper .swiper-slide.cart-drawer-upsell__slide` width uses  
  `calc((100cqi - var(--upsell-slide-gap)) / var(--upsell-slide-visible-ratio))` relative to the swiper container.
- **Cards:** `.cart-drawer-upsell-compact*` — horizontal flex row, theme `rgb(var(--color-background))`, border, shadow, circular action buttons aligned with drawer/UI patterns.
- **RTL / quick-add:** `.cart-drawer-upsell .quick-add` resets grid placement from `quick-add.css` so the button stays in the compact row.

---

## Logic summary (Liquid)

1. **`show_upsell`** false if `cart_upsell_enable` is off.
2. Build **`cart_ids`** string: `,{id},` for each `cart.items` product_id.
3. **`render_wrapper`** true only if upsell enabled **and** `cart.items.size > 0`.
4. Manual capture: loop products or collection; skip if `cart_ids contains needle`; cap with **`manual_shown < limit_n`**; output only **`swiper-slide`** wrappers.
5. If source is manual and captured markup is blank → **`render_wrapper`** false (hide whole block).
6. **`upsell_item_total`** — count of manual candidates (for counter initial state when manual).

---

## Reuse / porting checklist

Use this when moving the feature to another theme or drawer:

1. Copy **snippet**, **product-card snippet**, **section** (API), **JS**, **CSS**; register assets in theme layout/header as needed.
2. Add **settings** block (or section settings) for enable/source/products/collection/limit/heading.
3. Ensure **Swiper** (or equivalent) is available globally; align **`spaceBetween`** with `--upsell-slide-gap`**.
4. Include **`sections/cart-drawer-upsell.liquid`** in the theme (do not add to JSON templates; it is fetched by URL only).
5. Render the main snippet **inside the drawer** where cart object and `routes` are available.
6. Load **`product-form.js`** / **`quick-add.js`** if the card uses `<product-form>` and quick-view.
7. **`component-price.css`** may be required for the `{% render 'price' %}` snippet in the card.
8. Test **automatic** (first cart line drives `product_id`), **manual** list vs collection, **multi-variant** quick-add, empty recommendations (element hidden), **RTL**.

---

## Testing notes

- Automatic: add item with related products in catalog; open drawer; spinner then slider; counter updates while swiping.
- Manual: pick products not in cart; confirm exclusion of cart products and respect `cart_upsell_products_to_show`.
- Resize drawer / window: `resizeObserver` should keep slide widths sane.
- Console: failed fetch logs `Cart drawer upsell:` and hides the custom element.

---

## Related

- Mavon cart drawer shell: `snippets/cart-notification.liquid`, `snippets/cart-notification-children.liquid`.
- Complementary pattern (different UI): `skills/cart/cart-free-shipping-progress-bar.md`.
