# Brand files

The DigitalPrez mark and its favicon. Copyright (c) 2025-2026 DigitalPrez, LLC; "DigitalPrez" and "NetBlueprint Forge" are trademarks of DigitalPrez, LLC, and these files are not covered by the software licence.

| File | What |
| - | - |
| `digitalprez-mark.svg` | The mark: fourteen spheres, orange and silver, with radial gradients, rotated so the two clusters sit level. |
| `favicon.svg` | The favicon: the mark with flat fills, which read better than gradients at 16 to 32 pixels; transparent background. The renderer embeds it as a data URI, so every rendered page shows it in the browser tab. |
| `favicon.ico` | 16, 32 and 48 pixel PNG images in one ICO, for browsers and sites that ask for `/favicon.ico`. |
| `favicon-16.png`, `favicon-32.png` | The same two sizes as plain PNG. |
| `apple-touch-icon.png` | 180 pixels, for a home-screen bookmark. |
| `icon-512.png` | 512 pixels, for a web manifest or a store listing. |

The PNGs were rendered from `favicon.svg` with Chrome headless at each size on a transparent background, and the ICO packed from the three small PNGs; nothing beyond Chrome and Node was used. To publish on a site, copy `favicon.ico` and `favicon.svg` to its root and reference them with `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` and `<link rel="icon" href="/favicon.ico" sizes="any">`.
