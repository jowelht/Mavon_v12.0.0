# Text formatting guidelines (Shopify themes)

Guidelines for **merchant-facing headings, labels, and UI copy** in this theme so strings stay consistent with **Shopify’s recommended text style** and pass theme review expectations.

Use this doc when adding or editing theme settings (`settings_schema.json`), section/block titles, accessibility labels, and default locale strings.

---

## Core rule: Shopify-friendly casing

Theme copy should read like **natural sentence-style text**, not billboard or book-title casing.

Shopify advises avoiding **Title Case** for routine UI labels where it feels like Every Word Is Capitalized. Prefer **sentence case** (capital first word only; proper nouns and brand terms as exceptions).

---

## Examples

| Avoid (Title Case) | Prefer (sentence case) |
|--------------------|-------------------------|
| Free Shipping Bar | Free shipping bar |
| Product Recommendations | Product recommendations |

Bad vs good:

- ❌ **Free Shipping Bar**
- ✅ **Free shipping bar**

---

## Where this applies

Apply sentence-style formatting consistently in:

- **Theme editor** section headers, setting labels, info text, and default values shown to merchants  
- **Block and setting** definitions in Liquid schema  
- **`locales/*.json`** default English strings merchants see unless overridden  
- **Visible storefront** headings when the theme supplies default copy (merchants often keep defaults)

Treat **proper nouns** (store name, “Shop Pay,” “Klarna”) and **SKU-style codes** normally—do not lowercase those.

---

## Quick checklist (reuse for new features)

1. Prefer **sentence case** for headings and labels unless Shopify documentation for a specific control prescribes otherwise.  
2. Compare new strings against this doc’s examples before merging.  
3. When renaming existing settings or sections for compliance, mirror the same wording in **`settings_schema.json`**, **`locales`**, and any internal docs that quote the merchant-visible name.

---

## Related work

When implementing cart or drawer features, cross-check wording with dedicated feature specs (for example [`cart/cart-free-shipping-progress-bar.md`](cart/cart-free-shipping-progress-bar.md)) and align labels with these guidelines.
