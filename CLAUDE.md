# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Mavon v12.0.0** — A production Shopify 2.0 theme by Gloryio. No build process exists; this is pure Liquid/CSS/JS deployed directly via Shopify CLI. Theme docs at https://gloryio.com/docs/mavon/

## Development Commands

```bash
# Push theme to Shopify store (requires Shopify CLI installed)
shopify theme push

# Pull latest theme from store
shopify theme pull

# Start local development server with hot-reload
shopify theme dev

# Check theme for errors
shopify theme check
```

## Architecture

### File Roles

| Path | Role |
|------|------|
| `layout/theme.liquid` | Root HTML shell — fonts, global scripts, section groups |
| `config/settings_schema.json` | Shopify admin UI controls (colors, fonts, layout) |
| `config/settings_data.json` | Live setting values including 5 color presets |
| `snippets/css-variables.liquid` | Generates CSS custom properties from `settings.*` values — the single source for all theme colors/fonts |
| `assets/constants.js` | PubSub event constants: `cartUpdate`, `variantChange`, `quantityUpdate`, etc. |
| `assets/pubsub.js` | Lightweight publish/subscribe for cross-component state |
| `assets/global.js` | `HTMLUpdateUtility` (view transitions), `SectionId` parser, debounce timer (300ms) |
| `assets/custom.js` | Store-specific overrides |

### Theming System

All visual customization flows through CSS custom properties. `snippets/css-variables.liquid` reads `settings.*` values and emits scoped classes:

```css
.color-background-1 { --color-background: ...; --color-foreground: ...; }
.color-inverse       { --color-background: ...; --color-foreground: ...; }
/* accent-1, accent-2, background-2 */
```

Five named presets ship in `settings_data.json`: Mavon, Dewy, Nimble, Brilliant, Buoyant. Each preset is a set of color + typography overrides — not separate template files.

### Component Model

- **Sections** (`sections/`) — top-level page regions, each with its own `{% schema %}` block
- **Snippets** (`snippets/`) — rendered via `{% render 'snippet-name', param: value %}`, no schema
- **Blocks** (`blocks/`) — Shopify 2.0 app blocks and section blocks; sections iterate `section.blocks` with `case block.type`
- **Templates** (`templates/`) — JSON files wiring sections to routes (product, collection, blog, etc.)

### JavaScript Pattern

Components communicate via PubSub events defined in `constants.js`. Dynamic HTML updates use `HTMLUpdateUtility` in `global.js`, which re-injects `<script>` tags after DOM swaps and supports View Transitions API when available.

### RTL Support

`layout/theme.liquid` detects RTL locales (Hebrew, Arabic) by matching `request.locale.iso_code` and conditionally loads `assets/base-rtl.css` in place of `assets/base.css`.

### Locales

54 locale files under `locales/`. `en.default.json` is auto-generated — edit via Shopify admin or `shopify theme pull`. Schema variants (`*.schema.json`) translate admin UI labels.

## Key Conventions

- CSS custom properties (`--color-*`, `--font-*`) are the authoritative theming interface — avoid hardcoding colors or fonts in section/snippet files.
- Section schemas live at the bottom of each `.liquid` file in `{% schema %}...{% endschema %}` tags.
- Swiper.js (`assets/swiper-bundle.min.js`) handles all sliders — reference it before initializing any carousel.
- Debounce constant is 300ms (`ON_CHANGE_DEBOUNCE_TIMER` from `global.js`).
