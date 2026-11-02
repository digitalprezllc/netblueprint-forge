# Cloud provider icons: what the vendors publish, and how they would fit the renderer

Research note, 2026-11-01. Question: can nodes, components, appliances and zones carry the official Azure, AWS and Google Cloud service icons instead of the 32 built-in line icons, inside a page that stays self-contained? Short answer: yes, without any format conversion (all three vendors publish SVG), with the real work in three places: the terms each vendor attaches, a dependency-free pipeline that bundles icons with the skill and injects only the ones a model uses into its page, and a naming scheme the interview can fill in from the cloud cards. Nothing in this note is implemented; section 5 lists the decisions it needs first.

**Outcome.** Built on 2026-11-01 as decision D38: `scripts/icons.mjs` imports the three packages into `assets/icons/<provider>.json`, `build.mjs` embeds only the symbols a page uses, renderer 1.8.0 draws them with the fallback described in 3.3, `tests/check_icons.mjs` checks the library and every example, and `THIRD-PARTY-NOTICES.md` carries the terms. The decisions in section 5 were taken before the build: all three sets ship in the skill; AWS service and resource icons; Google's 2025 product icons first with the legacy set behind them; vendor icons on by default. Counsel's read of the notices file and the LICENSE term is the one item still open. A follow-on the same day (D39) added product logos fetched one at a time from the Dashboard Icons collection into the model's folder, for products that are not cloud services. The rest of this note is the research as written.

## 1. What the vendors publish (checked 2026-11-01)

| | Microsoft Azure | Amazon Web Services | Google Cloud |
| - | - | - | - |
| Package | `Azure_Public_Service_Icons_V24.zip`, 1.0 MB | `Icon-package_07312026.zip`, 14 MB (SVG and PNG) | 2025 system: `core-products-icons.zip` (0.3 MB) and `category-icons.zip` (0.8 MB); `google-cloud-legacy-icons.zip` (2.3 MB) for the older per-product set |
| Source page | learn.microsoft.com/azure/architecture/icons | aws.amazon.com/architecture/icons | cloud.google.com/icons |
| Icons | 714 SVG, one per service, in category folders | 305 service icons and 419 resource icons, each at four nominal sizes (16, 32, 48, 64), plus 30 group icons and category icons; the package also carries every icon as PNG and a `__MACOSX` shadow copy of everything | 2025: 19 "unique" product icons and 26 category icons; legacy: 216 per-product console icons |
| Geometry | `viewBox 0 0 18 18`, square | nominal size is not the drawing size: the "48" file is `viewBox 0 0 64 64`, the "64" file is 80 × 80; service icons sit on a filled category-coloured square | 2025 sets `0 0 512 512`; legacy `0 0 24 24` |
| Inside the SVG | gradients in `<defs>` with GUID ids (unique per file, a handful repeated across files); no styles, no classes | XML prolog, a `<title>`, groups with ids such as `Rectangle` and `Fill-1` repeated across hundreds of files; no `<defs>`, no styles | `<style>` blocks with `.st0` / `.cls-1` class rules, Illustrator comments, `<title>`; ids such as `Layer_1` repeated |
| File names | `10245-icon-service-Key-Vaults.svg` | `Arch_AWS-Lambda_48.svg`, `Res_Amazon-EC2_Instance_48.svg` | `Cloud_Storage-512-color.svg` (2025), `cloud_sql/cloud_sql.svg` (legacy) |
| Cadence | two or three batches a year; the page lists additions (July 2026 last) | quarterly, end of January, April and July | the 2025 system replaced per-product icons with category icons for most products; the legacy set is frozen |
| Visio | "The icons aren't provided in Visio stencil format … There are no plans to provide these icons as Visio stencils." | PowerPoint toolkit and the asset package; no Visio | SVG and PNG only |

No conversion step is needed for any of them: the SVG files are the stencils. The Visio question answers itself the same way, since none of the vendors ships Visio stencils any more and all three point at their SVG.

### Terms, as published

**Azure** (page and the `Microsoft_Terms_of_Use.pdf` inside the package, identical wording):

> Microsoft permits the use of these icons in architectural diagrams, training materials, or documentation. You can copy, distribute, and display the icons only for the permitted use unless granted explicit permission by Microsoft. Microsoft reserves all other rights.

Do's: "Use the icon to illustrate how products can work together. In diagrams, we recommend including the product name somewhere close to the icon. Use the icons as they would appear within Azure." Don'ts: "Don't crop, flip, or rotate icons. Don't distort or change icon shape in any way. Don't use Microsoft product icons to represent your product or service." The FAQ adds that the full service name should appear near the icon and that an Azure icon may only represent the Microsoft product it was designed for. This is the clearest of the three: copying and distributing for diagrams and documentation is granted in writing.

**AWS** (page, and slides 5, 13 and 15 of the icon deck in the July 2026 toolkit): "We allow customers and partners to use these toolkits and assets to create architecture diagrams. You can also put icons in materials like whitepapers, presentations, data sheets, and posters." Guidelines: "Use icons at their predefined size, color and format in diagrams"; "DON'T: Crop service icons. Flip or rotate icons. Change icon shapes."; "All colors for icons have been accessibility tested and should not be altered." No licence is named and nothing addresses redistribution of the set inside another product. The AWS trademark guidelines do not mention the architecture icons; they prohibit altering AWS logo images and implying endorsement.

**Google Cloud**: the icon page describes the sets as "the Google Cloud product icons you need for your diagrams, technical documentation, and more" and carries no terms of its own; the packages contain no terms file, and the "Product icons overview" PDF has no licence text. Google's general site terms and brand guidelines apply by default. Third-party mirrors state that all rights stay with Google. This is the weakest footing of the three for bundling.

What this means for a product that is itself a diagramming tool: using the icons in the diagrams the skill produces is squarely the permitted use for Azure and AWS, and plainly the intended use for Google. Shipping the icon sets inside the skill is explicitly allowed by Microsoft, not addressed by AWS, and not addressed by Google; draw.io, Structurizr and the Python `diagrams` package all redistribute the three sets on the strength of the same pages, which is common practice but not a licence. Section 4.5 turns this into a notice file and a decision for counsel.

## 2. What the renderer and the model do today

- The schema's `icon` is an enum of 32 names; nodes, components, appliances and zones accept it as an override of the default their `type` implies (`TYPE_ICON`, `COMP_ICON`, `APP_ICON` in the template). `iconG(type)` draws each icon from inline path data as a 24 × 22 group stroked in `currentColor`, placed at a fixed spot: node icon at the left of the box, host icon in the title row, component icon at the left of its 28-px row, appliance icon on the bar, zone icon before the zone title.
- A node's `cloud` block records `provider` (aws, azure, gcp, oci, other), `service`, the catalogue `card` id, exposure and endpoint facts; the 36 cards in `references/cloud/` propose nodes and threats but know nothing about icons.
- Pages are self-contained by rule 7: no external file, font or image. `build.mjs` injects the model JSON into one slot of the template, and the template has a `<defs id="defs">` element the page already draws from.
- The skill ships as a folder of 34 files, 253 KB zipped. claude.ai's skill upload is reported by users to refuse archives with more than about 200 files (an observation on the project's own GitHub, not a documented limit), which rules out shipping icons as one file each.

## 3. Design

### 3.1 Naming an icon in the model

`icon` keeps its 32 built-in names and additionally accepts `provider/id`: `azure/key-vaults`, `aws/lambda`, `gcp/cloud-sql`, pattern `^(aws|azure|gcp)/[a-z0-9][a-z0-9.-]*$`. The id is a slug derived from the vendor's file name with the noise removed (the Azure number prefix, the AWS `Arch_`/`Res_` prefix and `_48` size suffix, the Google `-512-color` suffix), lowercased and hyphenated; an index file (3.2) is the authority, and `scripts/icons.mjs search "key vault"` answers "which id" for a person or the interviewer. Any element that can carry an icon today can carry a vendor icon: a VNet zone can show `azure/virtual-networks`, an Azure Firewall bar `azure/firewalls`, an AWS WAF bar `aws/waf`.

Two automatic sources so models rarely need the field by hand: every cloud card gains an `icon:` line, and when a node has `cloud.card` (or `cloud.provider` + `cloud.service` the normalizer can resolve) and no `icon`, the build uses the card's icon. A `settings.icons.vendor` switch (default on) lets a model keep the line-art look.

### 3.2 Carrying the icons with the skill

One JSON file per provider under `assets/icons/`: `azure.json`, `aws.json`, `gcp.json`, each holding the package name, version or date and URL it came from, the vendor's terms verbatim, and `icons: { id: { title, category, viewBox, body } }` where `body` is the normalized inner SVG. Three files instead of a thousand, which keeps the skill under the upload cap and keeps the repository readable. Sizes, measured on the packages above: Azure 714 icons about 1.7 MB raw; AWS service and group icons at one size about 0.6 MB (resource icons would add 0.5 MB); Google legacy plus 2025 sets about 0.4 MB. Roughly 3 MB raw, about 1 MB inside the zip: the skill archive would grow from 0.25 MB to about 1.3 MB. A curated subset (the 36 cards plus the hundred most common services) would be under 0.4 MB if that matters more than completeness.

`scripts/icons.mjs` builds those files and nothing else needs the vendor packages:

- `import <provider> <package.zip>` reads the vendor archive (Node has no zip reader, but `zlib.inflateRawSync` plus a central-directory parser is about sixty lines, the mirror image of what `platforms/package.mjs` already writes), picks one size per icon for AWS, and normalizes each SVG: drop the XML prolog, comments, `<title>` and the `width`/`height` attributes; keep the `viewBox`; prefix every `id`, every `url(#…)` and `href="#…"` reference and every CSS class with the icon's slug, so a hundred icons can sit in one document without the `Rectangle`, `Layer_1`, `.st0` collisions the packages are full of; keep Google's `<style>` rules but scoped by the renamed classes. Nothing changes colour, shape or proportion, which is what every vendor forbids.
- `list [provider]` and `search <text>` for people and for the interviewer.
- `check <model.json>` reports icons the model names that the index does not have.

### 3.3 Putting them on the page

`build.mjs` collects the distinct vendor icons a model references (explicitly, and through cards), and injects for each a `<symbol id="vi-azure-key-vaults" viewBox="0 0 18 18">…</symbol>` into the template's `<defs>` through a second slot beside the model slot. A page carries only what it uses, 2 to 5 KB per distinct icon; the hub-spoke example would grow by about 40 KB.

In the renderer, `iconG` gains one branch: a name containing `/` whose symbol is present draws `<use href="#vi-…">` scaled into the existing 24 × 22 slot (22 × 22 for a square icon, centred), inside a group without the `currentColor` stroke styling the line icons use; a name whose symbol is missing falls back to the type's built-in icon, so an unknown or unshipped icon never breaks a page, and the validator says so. Nothing moves: box metrics, ports and routing are untouched, so the layout check and its baseline stay valid. The Attributes card shows the icon id; the legend gains one line when a page uses vendor icons, naming the vendors and saying the icons are theirs, which Azure and AWS do not require and Google would appreciate. AWS service icons carry their coloured square, which at 22 px reads as a badge beside the label, consistent with how AWS draws them.

A later, optional style is the classic cloud-diagram look: icon above a short label, no box (`settings.icons.style: "stencil"`). That changes box sizes and port geometry and would need its own layout rules and baseline; it is not part of the first delivery.

### 3.4 Validation and tests

- Schema: `icon` becomes `anyOf` the enum and the pattern; the validator warns on an unknown vendor id and on an icon whose provider differs from the node's `cloud.provider`.
- `tests/check_icons.mjs`: every card's icon exists in the index; every example's icons exist; a built page holds exactly one symbol per distinct icon, all ids unique, no unscoped `<style>`; the examples' page size grows by less than 150 KB.
- The layout check is unaffected; the README pictures are re-captured because the examples will look different.

### 3.5 Notices and licensing

- `THIRD-PARTY-NOTICES.md` at the repository root and inside the skill folder (so the zip carries it): per vendor, the package name, date and URL, the terms quoted above, and the practices that satisfy them, which the renderer enforces by construction: icons are drawn to scale only, never recoloured, cropped, flipped or rotated; the service name is always beside the icon, because it is the node's label; an icon is only ever attached to the vendor's own product, because the card mapping is the source.
- One sentence in the LICENSE additional terms: third-party icons are not licensed by DigitalPrez, remain the property of their owners and are used under their terms. The output exception already lets anyone open and share a generated page; the vendors' terms allow exactly that use of the icons.
- Risk ranking for shipping the sets inside the skill: Azure, explicitly allowed; AWS, permitted use but no redistribution language; Google, no terms at all. The conservative shape is to ship Azure in the skill and make AWS and Google importer-only (a user runs `icons.mjs import` on the package they downloaded, accepting the vendor's page themselves); the convenient shape ships all three with the notices, as the other diagramming tools do. Counsel's call, and the commercial-licence angle is worth a sentence to them: licensees pay DigitalPrez for the skill, not for the icons.

### 3.6 Effort

| Phase | Work | Size |
| - | - | - |
| 1 | `icons.mjs` import/list/search/check, the three index files, build injection, the `iconG` branch and fallback, schema and validator changes, card icon lines, the notices file, tests, docs (icons.md, render.md, cloud/README, model reference), examples rebuilt with vendor icons, pictures re-captured | about a day |
| 2 | normalizer vocabulary for icon ids, legend attribution line, zone and appliance icons in the examples, importer documentation for users who want the full packages | half a day |
| 3 | stencil-style nodes | one to two days, optional |

## 4. What stays out

- Converting Visio stencils (`.vssx`): nothing to convert, the vendors ship SVG and have stopped shipping Visio.
- Recolouring icons for themes or dark mode: forbidden by Azure and AWS; the page is light and stays so.
- PNG variants: unnecessary, SVG scales and embeds.
- Non-cloud stencils (network vendors): Cisco and others license their icon sets differently and are a separate question.

## 5. Decisions needed before building

Answered on 2026-11-01, before the build: 1, ship all three; 2, service and resource icons; 3, both sets, product first; 4, on by default; 5, open.

1. **Ship the icon sets in the skill, or import on demand?** Shipping all three adds about 1 MB to the zip and three files to the folder; importer-only keeps the skill as it is and moves the vendor terms to the user. A middle path ships Azure and imports the rest.
2. **Which AWS icons:** service icons only (305), or also the resource icons (419, things like an EC2 instance or an S3 bucket as opposed to the service).
3. **Which Google set:** the legacy per-product icons (216, what people recognise), the 2025 system (19 products plus 26 categories, what Google now wants), or both with product first and category as fallback.
4. **Default behaviour:** vendor icons on every cloud node automatically, or only where a model asks.
5. **Counsel's read** of the notices file and the one-sentence LICENSE addition before anything ships.

## Sources

- Azure architecture icons page and the terms and FAQ PDFs inside `Azure_Public_Service_Icons_V24.zip`: https://learn.microsoft.com/azure/architecture/icons/
- AWS Architecture Icons page and the July 2026 asset package and PowerPoint toolkit: https://aws.amazon.com/architecture/icons/
- AWS trademark guidelines: https://aws.amazon.com/trademark-guidelines/
- Google Cloud icon library, with the 2025 core, category and legacy packages: https://cloud.google.com/icons
- claude.ai skill upload file-count observation: https://github.com/mvanhorn/last30days-skill/pull/242
