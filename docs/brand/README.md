# Brand files

The NetBlueprint Forge logo and its favicon, and the DigitalPrez mark and its favicon. Copyright (c) 2025-2026 DigitalPrez, LLC; "DigitalPrez" and "NetBlueprint Forge" are trademarks of DigitalPrez, LLC, and these files are not covered by the software licence.

## NetBlueprint Forge (`netblueprint-forge/`)

| File | What |
| - | - |
| `logo.svg`, `logo-dark.svg` | The logo, for light and for dark backgrounds: the mark, the name and the slogan. Transparent background. The README shows it at the top. |
| `logo-mark.svg`, `logo-mark-dark.svg` | The mark alone, for light and for dark backgrounds. |
| `favicon.svg` | The favicon: the quartered shield on the hammer's handle, on the navy sheet, because the whole mark is too detailed for a browser tab. From 0.13.1 the renderer embeds it as a data URI, so every rendered page shows it in the browser tab. |
| `favicon.ico` | 16, 32 and 48 pixel images in one ICO. |
| `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | The same sizes as plain PNG. |
| `apple-touch-icon.png` | 180 pixels with square corners, for a home-screen bookmark: a phone rounds the corners itself and would show transparent ones as black. Rendered from `favicon-square.svg`. |
| `icon-192.png`, `icon-512.png` | For a web manifest or a store listing. |

**The lettering in the two logo files is live text**, set in Bahnschrift (the name) and Segoe UI (the slogan) with fallbacks, and with its width held to the design. Where those fonts are not installed the lettering shows in the nearest fallback. Before the logo is used in print or as final artwork, convert the lettering to outlines in a font licensed for that use. The marks and the favicons hold no text. The PNGs were rendered from the SVGs with Chrome headless at a device scale of 1 on a transparent background, and the ICO packed from the three small PNGs.

## DigitalPrez (this folder)

| File | What |
| - | - |
| `digitalprez-mark.svg` | The mark: fourteen spheres, orange and silver, with radial gradients, rotated so the two clusters sit level. |
| `favicon.svg` | The favicon: the mark with flat fills, which read better than gradients at 16 to 32 pixels; transparent background. For DigitalPrez's own sites; releases 0.12.0 to 0.13.0 embedded it in every rendered page. |
| `favicon.ico` | 16, 32 and 48 pixel PNG images in one ICO, for browsers and sites that ask for `/favicon.ico`. |
| `favicon-16.png`, `favicon-32.png` | The same two sizes as plain PNG. |
| `apple-touch-icon.png` | 180 pixels, for a home-screen bookmark. |
| `icon-512.png` | 512 pixels, for a web manifest or a store listing. |

The PNGs were rendered from `favicon.svg` with Chrome headless at each size on a transparent background, and the ICO packed from the three small PNGs; nothing beyond Chrome and Node was used. To publish on a site, copy `favicon.ico` and `favicon.svg` to its root and reference them with `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` and `<link rel="icon" href="/favicon.ico" sizes="any">`.
