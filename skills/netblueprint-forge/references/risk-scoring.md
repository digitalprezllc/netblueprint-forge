# Risk scoring

Two methods, one set of bands. The user picks the method per threat; `validate.mjs --fix` computes `risk.rating` and `risk.score` from the inputs (and the OWASP averages and levels), so never type those by hand. The same applies to `risk.residual` and `risk.projected`.

## Three ratings, asked in this order

1. **Current risk** (`risk.residual`): with the controls that exist today (`treatment.current_controls`) taken into account. Ask this first; it is what people mean by "how bad is it" and it drives the circle colour and the register's Current column.
2. **Inherent risk** (`risk`): the same threat with those controls absent. Ask "and without those controls?" straight after; if the user prefers not to assess it, copy the current values and note that in `risk.rationale`.
3. **Projected risk** (`risk.projected`): once the planned controls (`treatment.planned_controls`) are in place. Ask only when there are planned controls.

Likelihood, impact and the resulting band are prompted as words and normalized (`normalize.mjs band "medium"` → `moderate`; "critical", "severe" → `very-high`; "negligible" → `very-low`). Also record `risk.consequence`, one plain sentence on the outcome.

## What to say when asking which method to use

> **How do you want to rate this threat?**
> **A. Likelihood × Impact (quick).** Two questions, each on a five-point scale with plain descriptions, combined with the NIST SP 800-30 risk matrix. Takes a minute. Good for design reviews and early triage; two reviewers can disagree because each answer is a judgement call.
> **B. OWASP Risk Rating (detailed).** Sixteen factors, each scored 0–9 from fixed descriptions: eight for likelihood (who the attacker is, how easy the flaw is to find and exploit, whether it would be noticed) and eight for impact (technical loss of confidentiality/integrity/availability/accountability, and business damage: financial, reputation, compliance, privacy). Takes five to ten minutes. More repeatable and easier to defend to an auditor; slower, and some factors need business input.
> Both give the same five severity bands, so the diagram colours stay consistent whichever you pick. You can change the method on a threat later.

## Method A: `"likelihood-impact"`

Ask **likelihood** ("how likely is this to happen and cause harm?"):

| Value | Meaning |
| - | - |
| `very-high` | Almost certain to occur and cause harm |
| `high` | Highly likely |
| `moderate` | Somewhat likely |
| `low` | Unlikely |
| `very-low` | Highly unlikely |

For non-adversarial threats, frequencies help: very-high more than 100 times a year · high 10–100 · moderate 1–10 · low once in 1–10 years · very-low less than once in 10 years.

Ask **impact**:

| Value | Meaning |
| - | - |
| `very-high` | Multiple severe or catastrophic effects on operations, assets, individuals, other organisations or the public |
| `high` | Severe or catastrophic: loss of a primary function, major damage or financial loss, loss of life or life-threatening injury |
| `moderate` | Serious: primary functions continue with significantly reduced effectiveness, significant damage or loss, significant harm without loss of life |
| `low` | Limited: noticeably reduced effectiveness, minor damage, loss or harm |
| `very-low` | Negligible |

The rating comes from the NIST matrix (rows likelihood, columns impact very-low → very-high):

| Likelihood | VL | L | M | H | VH |
| - | - | - | - | - | - |
| very-high | very-low | low | moderate | high | very-high |
| high | very-low | low | moderate | high | very-high |
| moderate | very-low | low | moderate | moderate | high |
| low | very-low | low | low | low | moderate |
| very-low | very-low | very-low | very-low | low | low |

`score` is the band's semi-quantitative value: very-low 0, low 2, moderate 5, high 8, very-high 10.

## Method B: `"owasp-rr"`

Each factor takes one of its fixed values. Pre-fill from what you already know (adversary type → skill level, motive, size; data classification → confidentiality and privacy) and let the user adjust.

**Likelihood: threat agent**
- `skill_level`: no technical skills 1 · some technical skills 3 · advanced computer user 5 · network and programming skills 6 · security penetration skills 9
- `motive`: low or no reward 1 · possible reward 4 · high reward 9
- `opportunity`: full access or expensive resources required 0 · special access or resources required 4 · some access or resources required 7 · no access or resources required 9
- `size`: developers 2 · system administrators 2 · intranet users 4 · partners 5 · authenticated users 6 · anonymous Internet users 9

**Likelihood: vulnerability**
- `ease_of_discovery`: practically impossible 1 · difficult 3 · easy 7 · automated tools available 9
- `ease_of_exploit`: theoretical 1 · difficult 3 · easy 5 · automated tools available 9
- `awareness`: unknown 1 · hidden 4 · obvious 6 · public knowledge 9
- `intrusion_detection`: active detection in application 1 · logged and reviewed 3 · logged without review 8 · not logged 9

**Impact: technical** (always ask)
- `loss_of_confidentiality`: minimal non-sensitive data 2 · minimal critical data 6 · extensive non-sensitive data 6 · extensive critical data 7 · all data 9
- `loss_of_integrity`: minimal slightly corrupt 1 · minimal seriously corrupt 3 · extensive slightly corrupt 5 · extensive seriously corrupt 7 · all data totally corrupt 9
- `loss_of_availability`: minimal secondary services interrupted 1 · minimal primary services 5 · extensive secondary services 5 · extensive primary services 7 · all services lost 9
- `loss_of_accountability`: fully traceable 1 · possibly traceable 7 · completely anonymous 9

**Impact: business** (ask when the user can answer; then set `impact_basis: "business"`)
- `financial_damage`: less than the cost to fix 1 · minor effect on annual profit 3 · significant effect 7 · bankruptcy 9
- `reputation_damage`: minimal 1 · loss of major accounts 4 · loss of goodwill 5 · brand damage 9
- `non_compliance`: minor violation 2 · clear violation 5 · high-profile violation 7
- `privacy_violation`: one individual 3 · hundreds 5 · thousands 7 · millions 9

Computation (done by the validator): likelihood = average of the eight likelihood factors; impact = average of the business factors when `impact_basis` is business and all four are present, otherwise of the technical factors. 0–<3 low, 3–<6 medium, 6–9 high. Severity from the OWASP matrix (impact rows, likelihood columns):

| Impact | low | medium | high |
| - | - | - | - |
| high | medium | high | critical |
| medium | low | medium | high |
| low | note | low | medium |

Bands: note → `very-low`, low → `low`, medium → `moderate`, high → `high`, critical → `very-high`.

## Residual risk, overrides, CVSS

- `risk.residual` is a second assessment (either method) after the listed controls. The register sorts on it when present and the circle shows it. Give a one-line `rationale` naming the controls.
- `rating_override` with `rating_override_reason` lets a reviewer force a band; the computed `rating` stays as computed.
- `risk.cvss` (`version` 3.1 or 4.0, `vector`, `base_score`) is metadata for a specific vulnerability; it never sets the band.
