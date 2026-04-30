# Cart free shipping progress bar (Mavon theme)

Blueprint for the **cart drawer free-shipping progress bar**: how it is built, wired to AJAX cart updates, customized in the theme editor, reused on other surfaces, and **styled as a compact card** in the cart drawer.

---

## Overview

The feature compares `cart.total_price` to a configurable **minimum cart total** (theme setting). It shows:

- A caption: either “amount away from free shipping” or “unlocked” — from **theme text settings** (with `{amount}`) or **locale** fallback
- A horizontal bar whose fill reflects progress (0–100%) using a **merchant-defined gradient** (CSS variables)

Rendering is **server-side Liquid** inside a reusable snippet. The bar stays in sync with the cart **without dedicated bar JavaScript** because the drawer is refreshed from Shopify Cart API responses that include section HTML.

**This document includes:** visibility rules, money math, messaging and gradient logic, DOM/CSS architecture, **modern UI** notes (spacing, card container, motion, RTL), theme settings inventory, AJAX wiring, reuse checklist, and testing notes.

---

## File map

| Role | Path |
|------|------|
| Snippet (markup + math + a11y) | `snippets/cart-free-shipping-bar.liquid` |
| Cart drawer integration point | `snippets/cart-notification-children.liquid` |
| Cart drawer DOM shell | `snippets/cart-notification.liquid` |
| Section file (minimal) | `sections/cart-notification.liquid` |
| Styles (scoped BEM-ish classes) | `assets/component-cart-notification.css` |
| Theme settings (enable, threshold, messages, gradient) | `config/settings_schema.json` → group **Cart** → header **Free Shipping Bar** (all `free_shipping_*` IDs) |
| Copy (EN) | `locales/en.default.json` → `sections.cart.*` |
| Stylesheet load | `sections/header.liquid` (and `sections/main-cart-footer.liquid` where applicable) |
| Cart AJAX: section replacement | `assets/cart-notification.js`, `assets/product-form.js` |

---

## Implementation details

### Visibility rules

The snippet wraps everything in one condition:

1. `settings.free_shipping_bar_enable` is true  
2. `cart != empty`  
3. `settings.free_shipping_threshold` parses to a **positive** number (major currency units, e.g. `75` → $75.00 for two-decimal currencies)

If any check fails, nothing is output.

### Money and progress math (Liquid)

- **Threshold in shop money:** `threshold_major` from `settings.free_shipping_threshold` (coerced with `default: 0 | plus: 0`).
- **Compare in cents:** `threshold_cents = threshold_major * 100`, `current_cents = cart.total_price` (Shopify cart total is in cents).
- **Remainder:** `remainder_cents = max(0, threshold_cents - current_cents)`.
- **Reached:** `current_cents >= threshold_cents`.
- **Bar width:** `progress_percent = min(100, current_cents * 100 / threshold_cents)` (integer division in Liquid).

`cart.total_price` already reflects line-item and cart-level discounts, matching the theme setting’s documented intent.

### Markup, hooks, and accessibility

- Root: `.free-shipping-progress`, modifier `.free-shipping-progress--complete` when the goal is met.
- `data-free-shipping-progress` is available for future JS or tests.
- When incomplete: `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (plain text from the message).
- When complete: `role="status"`.
- Fill width is driven by an inline CSS variable on the fill span: `style="--free-shipping-progress: {{ progress_percent }}%; --free-shipping-gradient-start/end: …"`. The fill uses a **horizontal gradient** between those colors (defaults: `#121212` → `#424242`).

### Messages (locales)

Under `sections.cart` in `locales/en.default.json` (mirror keys in other locale files as needed):

- `free_shipping_away_html` — includes `{{ amount }}` (formatted with `money` filter in Liquid).
- `free_shipping_unlocked` — shown when the threshold is met.

**Theme settings override:** If **Progress message** or **Success message** in the Cart → Free Shipping Bar settings are non-empty, those strings are used instead. Progress copy must include the literal placeholder `{amount}` (curly braces) where the remaining total should appear; the value is inserted with the same `money` formatting as before.

---

## Integration with the cart drawer

1. **Header** includes the drawer when `settings.cart_type == 'drawer'` and the template is not the cart page:

   `sections/header.liquid` → `{% render 'cart-notification', ... %}`

2. **Drawer content** lives in `snippets/cart-notification-children.liquid`, inside `.cart_notification_links_inner` / `#cart--drawer--footer`, **above** the subtotal block:

   ```liquid
   {% render 'cart-free-shipping-bar' %}
   ```

3. **Section HTML** used in AJAX responses is produced from `sections/cart-notification.liquid`, which only renders `cart-notification-children`. The element whose `innerHTML` is replaced is `#cart-notification` (see `cart-notification.js`).

So any change to cart lines or totals that triggers a **section re-render** automatically re-runs the snippet with an up-to-date `cart` object.

---

## “Header” / shared logic (single source of truth)

There is **no separate header-only Liquid** for this bar in the current theme: **policy** lives in **global theme settings**:

- `settings.free_shipping_bar_enable`
- `settings.free_shipping_threshold`
- `settings.free_shipping_progress_message` — optional; `{amount}` placeholder; blank falls back to `sections.cart.free_shipping_away_html`
- `settings.free_shipping_success_message` — optional; blank falls back to `sections.cart.free_shipping_unlocked`
- `settings.free_shipping_bar_gradient_start` / `settings.free_shipping_bar_gradient_end` — bar fill gradient (CSS variables on the fill element)

**Reuse pattern for other UI (header announcement, cart page, PDP upsell, etc.):**

- Render the same snippet: `{% render 'cart-free-shipping-bar' %}` anywhere the `cart` object is available and you want identical behavior.
- Or, for a **static** header message, read the same `settings.free_shipping_threshold` and either duplicate the small Liquid math or extract a second snippet later—**keep one threshold in settings** so every surface stays aligned with checkout/shipping rules you communicate to customers.

Locale strings under `sections.cart` keep messaging consistent across surfaces if you reference the same keys.

---

## Dynamic updates (AJAX behavior)

The progress bar does **not** update itself with custom fetch logic. It updates because the theme **replaces the cart-notification section HTML** after cart operations.

**Add to cart** (`assets/product-form.js`):

- Appends `sections` (from `cart.getSectionsToRender()`) and `sections_url` to the cart add request.
- On success, calls `this.cart.renderContents(response)`.

**Change quantity / remove** (`assets/cart-notification.js` → `updateQuantity`):

- POST JSON to `routes.cart_change_url` with `sections: ['cart-notification', 'cart-notification-count']`.
- On success, `renderContents(parsedState)` parses `parsedState.sections['cart-notification']` and swaps `#cart-notification` inner HTML.

**`renderContents`:**

- For each `{ id }` in `getSectionsToRender()`, finds `document.getElementById(section.id)` and sets `innerHTML` from parsed section markup.

Because `cart-notification-children` contains `{% render 'cart-free-shipping-bar' %}`, each successful response rebuilds the bar with correct percentages and copy.

**Implications:**

- Adding this bar to **another section** only updates dynamically if that section’s id is included in the same Cart API `sections` array wherever the theme fetches cart updates (see `cart-items`/main-cart patterns for the cart **page**).
- **PubSub** (`PUB_SUB_EVENTS.cartUpdate`) fires after updates but nothing in this feature subscribes for the bar—it relies on DOM replacement.

---

## Customization

### Merchant controls (Shopify Admin → Theme settings)

Located in **`config/settings_schema.json`** inside the **Cart** settings group (after cart type and drawer options such as continue shopping). A sub-header **Free Shipping Bar** introduces:

| Setting ID | Type | Label in customizer | Purpose |
|------------|------|---------------------|---------|
| `free_shipping_bar_enable` | checkbox | Show progress bar | Turns the bar on/off (default: `false`) |
| `free_shipping_threshold` | number | Free shipping minimum | Minimum cart total in **major currency units** (schema default example: `75`) |
| `free_shipping_progress_message` | text | Progress message | Default e.g. `You're {amount} away from Free Shipping`; use `{amount}` for the remainder |
| `free_shipping_success_message` | text | Success message | Default e.g. unlocked line with emoji; shown at 100% |
| `free_shipping_bar_gradient_start` | color | Progress bar gradient start | Left side of fill gradient |
| `free_shipping_bar_gradient_end` | color | Progress bar gradient end | Right side of fill gradient |

The schema `info` on `free_shipping_threshold` describes two-decimal currencies and that totals are **after discounts**. If progress or success message is cleared in the theme editor, copy falls back to `sections.cart` locale keys.

### Text

**Primary:** edit **Progress message** and **Success message** under Cart → Free Shipping Bar (supports `{amount}` in the progress string).

**Fallback:** translation keys under `sections.cart` when those fields are left blank:

- `free_shipping_away_html`
- `free_shipping_unlocked`

Use Liquid `| t` with `amount:` for the fallback “away” locale string when the progress message setting is blank. For HTML in translations, keep the parent class `rte` on the message node if using links or emphasis.

### Color and visual design

Styles live in **`assets/component-cart-notification.css`** under “Free shipping progress (cart drawer)”.

- **Container:** flex column with consistent gap, full width, padded “card” surface using `rgba(var(--color-foreground), …)` and `var(--border-radius)`-aware corners, subtle border (replaces a bare bottom divider).
- **Complete state:** background and border lean on `rgb(var(--color-button))` so success reads as on-brand without hard-coded greens.
- **Track:** taller pill (~`0.7rem`), inset shadow for depth.
- **Fill:** merchant gradient unchanged; soft outer shadow and `cubic-bezier` width transition; stronger glow when complete.

Current convention matches the rest of Mavon:

- Track: `rgba(var(--color-foreground), 0.1)` plus inset highlight
- Fill: **linear gradient** using theme colors `--free-shipping-gradient-start` / `--free-shipping-gradient-end` (inline on the fill); falls back to `rgb(var(--color-button))` if variables are missing
- Message: foreground with opacity; complete state uses full foreground + `font-weight: 600`
- Motion: `width` transition ~`0.45s` with `cubic-bezier`; disabled under `prefers-reduced-motion: reduce`
- Track uses `direction: ltr` so the bar fills left-to-right even in RTL layouts

To add **further** bar styling beyond the theme gradient pickers, extend `snippets/css-variables.liquid` or target `.free-shipping-progress__fill` in CSS—consistent with theme guidance in `CLAUDE.md`.

---

## Implementation reference (canonical)

Single overview of the **shipped implementation** for anyone extending or debugging the feature.

### Concern → file

| Concern | Location |
|--------|----------|
| Schema: enable, threshold, progress/success copy, gradient colors | `config/settings_schema.json` (**Cart** → **Free Shipping Bar**) |
| Threshold math, `reached`, `%`, messages, gradient hex → CSS vars | `snippets/cart-free-shipping-bar.liquid` |
| Drawer injection order | `snippets/cart-notification-children.liquid` — inside `#cart--drawer--footer`, **above** subtotal |
| Section used in Cart API `sections` rebuild | `sections/cart-notification.liquid` → `cart-notification-children` |
| Presentation (card, track height, shadows, complete state, responsive, `prefers-reduced-motion`) | `assets/component-cart-notification.css` — search `Free shipping progress` |
| Fallback strings (EN) | `locales/en.default.json` → `sections.cart.free_shipping_away_html`, `free_shipping_unlocked` |

### Theme setting IDs (complete list)

In the customizer these sit under **Theme settings → Cart** after the **Free Shipping Bar** header:

| ID | Customizer label (typical) |
|----|----------------------------|
| `free_shipping_bar_enable` | Show progress bar |
| `free_shipping_threshold` | Free shipping minimum |
| `free_shipping_progress_message` | Progress message (`{amount}`) |
| `free_shipping_success_message` | Success message |
| `free_shipping_bar_gradient_start` | Progress bar gradient start |
| `free_shipping_bar_gradient_end` | Progress bar gradient end |

### Message logic (Liquid)

1. `remainder_money = remainder_cents | money`.  
2. **Threshold met:** if `settings.free_shipping_success_message` (stripped) is not blank → use it; else `{{ 'sections.cart.free_shipping_unlocked' | t }}`.  
3. **Below threshold:** if `settings.free_shipping_progress_message` (stripped) is not blank → `replace: '{amount}', remainder_money`; else `{{ 'sections.cart.free_shipping_away_html' | t: amount: remainder_money }}`.  

**Placeholder convention:** theme setting strings use the literal `{amount}`; locale `free_shipping_away_html` uses Shopify translation `{{ amount }}` via the `t` filter.

### Gradient logic (Liquid)

`grad_start` / `grad_end` read from color settings with Liquid `| default: '#121212'` and `'#424242'` when needed. Both are written as inline custom properties on `.free-shipping-progress__fill`.

### DOM structure (BEM)

```html
<!-- Liquid adds free-shipping-progress--complete on the root when the goal is met -->
<div class="free-shipping-progress" data-free-shipping-progress>
  <p class="free-shipping-progress__message caption-large rte">…</p>
  <div class="free-shipping-progress__track" aria-hidden="true">
    <span
      class="free-shipping-progress__fill"
      style="--free-shipping-progress: N%; --free-shipping-gradient-start: …; --free-shipping-gradient-end: …;"
    ></span>
  </div>
</div>
```

- Spacing between message and track: **flex + `gap`** on `.free-shipping-progress` (no `mb-*` utility on the paragraph).  
- Incomplete: `role="progressbar"` + `aria-valuenow` / `aria-valuetext` (valuetext uses `strip_html`). Complete: `role="status"`.

### CSS custom properties (runtime)

| Property | Element | Purpose |
|----------|---------|---------|
| `--free-shipping-progress` | `.free-shipping-progress__fill` | Bar fill width (`%`) |
| `--free-shipping-gradient-start` | fill | Gradient start (hex from settings) |
| `--free-shipping-gradient-end` | fill | Gradient end (hex from settings) |

Track uses `direction: ltr` so fill direction stays left-to-right in RTL layouts. Fill `linear-gradient(90deg, …)` falls back to `rgb(var(--color-button))` if variables are absent.

### Modern UI behavior (CSS summary)

- **Shell:** full-width flex column; padded **card** surface from `rgba(var(--color-foreground), …)`; border; `border-radius: min(1.2rem, var(--border-radius, 1rem))`.  
- **Typography:** `caption-large` + `rte`; message line-height and slight negative letter-spacing on `.free-shipping-progress__message`.  
- **Track:** ~`0.7rem` height, pill radius, inset shadow.  
- **Fill:** gradient + light outer shadow; width animates ~`0.45s` `cubic-bezier(0.33, 1, 0.68, 1)`; **no** animation if `prefers-reduced-motion: reduce`.  
- **Complete:** `.free-shipping-progress--complete` shifts background/border toward `rgb(var(--color-button))`; message `font-weight: 600`; stronger fill shadow.  
- **Small screens:** `max-width: 749px` reduces padding, gap, and bottom margin slightly.

---

## Code structure reference

### Snippet entry and guard

```liquid
{%- liquid
  assign threshold_major = settings.free_shipping_threshold | default: 0 | plus: 0
-%}
{%- if settings.free_shipping_bar_enable and cart != empty and threshold_major > 0 -%}
  ...
{%- endif -%}
```

### Drawer include (location)

Inside `snippets/cart-notification-children.liquid`, before totals:

```liquid
{% render 'cart-free-shipping-bar' %}
```

### Section replacement targets (JS)

From `assets/cart-notification.js`:

```js
getSectionsToRender() {
  return [
    { id: "cart-notification" },
    { id: "cart-notification-count" },
  ];
}
```

---

## Reuse checklist (other pages / sections)

1. **Snippet:** `{% render 'cart-free-shipping-bar' %}` in any template where `cart` is defined (drawer, cart page, optional inline mini summary if you add one).
2. **CSS:** Ensure `component-cart-notification.css` is loaded on that layout, or move bar rules to a shared asset if the drawer stylesheet is not loaded.
3. **AJAX:** If the surface must live-update, add its section ID to every Cart API request that already passes `sections` / `sections_url`, mirroring `product-form.js` / `cart-notification.js`.
4. **Locales:** Add or translate `sections.cart.free_shipping_*` in each locale file you ship.
5. **Consistency:** Keep `free_shipping_threshold` as the only monetary rule in theme settings unless you intentionally split B2B/region logic (would need metafields or markets-aware rules later).

---

## Testing notes

- Enable the checkbox and set a threshold above and below typical cart totals; add/remove items and change quantities to confirm section HTML refresh updates the bar.
- Verify **RTL** storefronts still show sensible bar direction (`direction: ltr` on track).
- With **discounts**, confirm totals match Shopify’s discounted subtotal expectation for your shipping offer.

---

*Theme: **Mavon v12** • Shipping bar: reusable snippet, Cart-level theme settings (copy + gradient), locale fallback, card-style drawer UI, and Shopify cart section HTML refresh for updates.*
