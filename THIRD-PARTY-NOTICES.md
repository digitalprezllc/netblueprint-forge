# Third-party notices

NetBlueprint Forge ships, in `skills/netblueprint-forge/assets/icons/`, an index of the architecture icons that Microsoft, Amazon Web Services and Google publish for use in diagrams and documentation. The icons are the property of their owners. DigitalPrez, LLC does not license them and claims no rights in them: the NetBlueprint Forge license (PolyForm Noncommercial 1.0.0 with additional terms) covers the renderer, the scripts and the documentation, not these icons, which are used under the terms below. A page generated with the skill carries only the icons its model uses, drawn exactly as the vendor drew them: to scale, never recoloured, cropped, flipped, rotated or reshaped, with the product name beside the icon, and only on the product the icon was designed for.

The index files were built by `scripts/icons.mjs import` from the packages named below, retrieved on 2026-11-01. Each file records its package names, the retrieval date and the terms, and `node scripts/icons.mjs stats` prints them.

The skill can also fetch, one at a time and only when asked, product logos from the Dashboard Icons collection into the user's own model folder. Those files are not shipped; the section on the collection below states its terms.

## Microsoft Azure architecture icons, and Microsoft Entra architecture icons

- Source: https://learn.microsoft.com/azure/architecture/icons/ (package `Azure_Public_Service_Icons_V24.zip`) and https://learn.microsoft.com/entra/architecture/architecture-icons (package `Microsoft Entra architecture icons - Oct 2023.zip`). Both carry the same terms of use, reproduced in the packages as `Microsoft_Terms_of_Use.pdf` and `Microsoft Terms of Use.docx`.
- Terms, as published by Microsoft: "Microsoft permits the use of these icons in architectural diagrams, training materials, or documentation. You can copy, distribute, and display the icons only for the permitted use unless granted explicit permission by Microsoft. Microsoft reserves all other rights."
- Guidelines, as published: use the icons to illustrate how products can work together; include the product name near the icon; use the icons as they appear within Azure. Do not crop, flip or rotate icons; do not distort or change their shape; do not use Microsoft product icons to represent your own product or service; do not use them in marketing communications.
- Provider id in the model: `azure` (for example `azure/key-vaults`, `azure/microsoft-entra-id`).

## AWS Architecture Icons

- Source: https://aws.amazon.com/architecture/icons/ (package `Icon-package_07312026.zip`; the usage guidelines are in the AWS Architecture Icons deck of the PowerPoint toolkit from the same page).
- Terms, as published by AWS: "We allow customers and partners to use these toolkits and assets to create architecture diagrams. You can also put icons in materials like whitepapers, presentations, data sheets, and posters."
- Guidelines, as published in the deck: "Use icons at their predefined size, color and format in diagrams"; do not crop service icons, flip or rotate icons, or change icon shapes; "All colors for icons have been accessibility tested and should not be altered"; check for the latest release, since packages are released quarterly.
- Provider id in the model: `aws` (for example `aws/lambda`, `aws/simple-storage-service`, alias `aws/s3`).

## Google Cloud product icons

- Source: https://cloud.google.com/icons (packages `core-products-icons.zip` and `category-icons.zip` of the 2025 icon system, and `google-cloud-legacy-icons.zip` for the per-product icons that preceded it).
- Terms: Google publishes the library as "the Google Cloud product icons you need for your diagrams, technical documentation, and more". The library page and the packages carry no separate licence text; Google's site terms and brand guidelines apply. The icons are used unmodified, to represent the Google Cloud products they were designed for.
- Provider id in the model: `gcp` (for example `gcp/cloud-sql`, `gcp/category-networking`).

## Dashboard Icons (product logos, fetched on request)

- Source: https://dashboardicons.com/, the homarr-labs collection on GitHub (https://github.com/homarr-labs/dashboard-icons), served from jsDelivr. The skill ships none of its files: `node scripts/icons.mjs fetch dashboard/<name> --model <model.json>` downloads one logo at the user's request into `icons.json` beside the user's model, where it stays with that model, with the URL it came from and the date.
- Terms: the collection is published under the Apache License 2.0, with this disclaimer in its README: "All product names, trademarks, and registered trademarks are the property of their respective owners. Icons are used for identification purposes only and do not imply endorsement." Each logo remains the trademark of the product's owner, whose brand guidelines govern its use; the skill places a logo only where a model names the product it depicts.
- Provider id in the model: `dashboard` (for example `dashboard/fortinet`, `dashboard/check-point`).

## What the renderer guarantees

- An icon is drawn with `<use>` from a `<symbol>` that holds the vendor's own markup; the importer removes only the XML prolog, comments, titles and the root element's width and height, and prefixes ids and class names so icons can share a page. Colours, paths and proportions are untouched.
- Icons are scaled uniformly into the slot beside the element's label and never cropped, flipped, rotated or distorted; an out-of-scope element dims its icon without altering it.
- The service name appears beside every icon, because it is the element's label; a cloud card attaches its icon only to the product the card describes.
- The legend of a page that uses vendor icons names the vendors and states that the icons belong to them.
- A fetched logo is checked before it is stored: an SVG that carries a script, an event handler, a foreign object or an external reference is refused.
