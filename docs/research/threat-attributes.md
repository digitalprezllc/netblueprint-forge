# Threat attributes: what the skill prompts for, and the allowed options

Research note, 2026-10-23. This settles the enumerations behind the threat object in [REQUIREMENTS.md Appendix A](../REQUIREMENTS.md#appendix-a-draft-threat-object). Every list below names its source; where NetBlueprint adds a value of its own it is marked **(NB)**. The lists are copied into the schema enums and into `references/threats.md` / `references/risk-scoring.md`.

## 0. Summary of recommendations

| Attribute | Prompt? | Options come from |
| - | - | - |
| STRIDE category (≥1) | **Mandatory** | Microsoft STRIDE |
| Targets (≥1 zone/node/component/flow) | **Mandatory** | the model |
| Adversary type | **Mandatory** | STIX 2.1 `threat-actor-type-ov` + 4 NB additions |
| Risk method, then its inputs | **Mandatory** | Likelihood × Impact (NIST SP 800-30) or OWASP Risk Rating |
| Title, status | **Mandatory** (status defaults to *Identified*) | NB lifecycle, informed by Microsoft TMT / Threat Dragon |
| Description / attack scenario, boundary crossed, data classification, treatment decision, ≥1 control when mitigated | Recommended | see sections |
| LINDDUN, ATT&CK tactic, adversary motivation / capability / intent / targeting / resources / privileges / access vector, CVSS, CWE / CAPEC / ATT&CK technique, OWASP / NIST / CIS / ISO refs, compliance tags, residual risk, provenance | Optional, skippable | see sections |

Five **severity bands** are canonical, whichever method is used: **Very Low · Low · Moderate · High · Very High** (NIST names). Both methods, and CVSS, map onto them (section 4.4). The band drives the circle colour.

## 1. Classification

### 1.1 STRIDE (mandatory, one or more)

| Value | Violates | Prompt wording |
| - | - | - |
| Spoofing | Authentication | Could someone pretend to be another user, device or service here? |
| Tampering | Integrity | Could data or code be changed in transit or at rest without detection? |
| Repudiation | Non-repudiation | Could someone deny having done something because it isn't logged or attributable? |
| Information Disclosure | Confidentiality | Could data reach someone who shouldn't see it? |
| Denial of Service | Availability | Could this be made unavailable or degraded? |
| Elevation of Privilege | Authorization | Could someone do more than they are allowed to? |

Source: Microsoft SDL STRIDE, as used by the Microsoft Threat Modeling Tool.

### 1.2 LINDDUN (optional, privacy threats)

Current official wording from linddun.org:

| Value | Definition |
| - | - |
| Linking | Associating data items or user actions to learn more about an individual or group |
| Identifying | Learning the identity of an individual, through leaks, deduction, or inference |
| Non-repudiation | Being able to attribute a claim to an individual |
| Detecting | Deducing the involvement of an individual through observation |
| Data Disclosure | Excessively collecting, storing, processing or sharing personal data |
| Unawareness & Unintervenability | Insufficiently informing, involving or empowering individuals in the processing of their personal data |
| Non-compliance | Deviating from security and data management best practices, standards and legislation |

Prompt only when the model has a node or flow carrying personal data (data classification PII/PHI).

### 1.3 Attack phase (optional): MITRE ATT&CK Enterprise tactics, v20

ATT&CK v19 (April 2026) retired *Defense Evasion* and split it; v20 (October 2026) has 15 Enterprise tactics. Store the TA id; accept the legacy name "Defense Evasion" as an alias for Stealth.

| ID | Tactic |
| - | - |
| TA0043 | Reconnaissance |
| TA0042 | Resource Development |
| TA0001 | Initial Access |
| TA0002 | Execution |
| TA0003 | Persistence |
| TA0004 | Privilege Escalation |
| TA0005 | Stealth (formerly Defense Evasion) |
| TA0112 | Defense Impairment (new) |
| TA0006 | Credential Access |
| TA0007 | Discovery |
| TA0008 | Lateral Movement |
| TA0009 | Collection |
| TA0011 | Command and Control |
| TA0010 | Exfiltration |
| TA0040 | Impact |

## 2. Targets and boundaries

- `targets[]`: `{kind: zone | node | component | flow | boundary, ref: <unique name>, marker: true|false}`. At least one.
- `boundary_crossed` (optional): the trust boundary a flow crosses. Options, from the Microsoft TMT boundary stencils plus cloud additions **(NB)**: Internet, Corporate network, Machine, Process, Sandbox, User/Kernel mode, **Cloud tenant (NB)**, **VPC/VNet (NB)**, **Third party (NB)**, **OT/IoT network (NB)**. Written as `<from>-to-<to>` using zone names, e.g. `Internet-to-DMZ`.
- `assets_at_risk[]`: free text.
- `data_classification`: common four-tier scheme **(NB)**: Public, Internal, Confidential, Restricted; plus regulated tags: PII, PHI, PCI, Financial, Credentials/Secrets, Intellectual Property, Mission Critical.

## 3. Adversary profile

### 3.1 Type (mandatory)

STIX 2.1 `threat-actor-type-ov`, with four additions the interview needs:

| Value | Meaning | NIST source class (3.2) |
| - | - | - |
| activist | Ideologically motivated, seeks publicity or disruption | Individual outsider / Group |
| competitor | Rival organisation seeking advantage | Organization: competitor |
| crime-syndicate | Organised crime group | Group: established |
| criminal | Individual acting for financial gain | Individual outsider |
| hacker | Opportunistic or curiosity-driven, varying skill | Individual outsider |
| insider-accidental | Employee or contractor who causes harm without intent | Accidental: user / admin |
| insider-disgruntled | Employee or contractor acting with intent | Individual insider / trusted insider |
| nation-state | State or state-sponsored actor | Nation-state |
| sensationalist | Seeks attention or embarrassment of the target | Individual outsider |
| spy | Espionage, often state-linked | Nation-state / Organization |
| terrorist | Seeks destruction or fear | Group |
| unknown | Not yet characterised | — |
| **malicious-user (NB)** | A legitimate, authenticated user abusing their own access | Individual insider |
| **compromised-credential-holder (NB)** | An outsider operating with stolen or phished credentials of a legitimate account | Individual outsider acting as insider |
| **third-party / supply-chain (NB)** | Vendor, partner or dependency whose compromise reaches the target | Organization: supplier / partner |
| **automated / bot (NB)** | Unattended scanning, credential stuffing, scraping | Individual outsider (group scale) |

### 3.2 Source class (optional): NIST SP 800-30 Rev 1, Table D-2

Lets a model carry non-adversarial threats (outages, mistakes, disasters) alongside attacks.

- **Adversarial:** Individual (Outsider, Insider, Trusted Insider, Privileged Insider); Group (Ad hoc, Established); Organization (Competitor, Supplier, Partner, Customer); Nation-State.
- **Accidental:** User; Privileged User/Administrator.
- **Structural:** IT equipment (storage, processing, communications, display, sensor, controller); Environmental controls (temperature/humidity, power); Software (OS, networking, general-purpose application, mission-specific application).
- **Environmental:** Natural or man-made disaster (fire, flood/tsunami, windstorm/tornado, hurricane, earthquake, bombing, overrun); Unusual natural event; Infrastructure failure/outage (telecommunications, electrical power).

### 3.3 Motivation (optional): STIX 2.1 `attack-motivation-ov`

accidental · coercion · dominance · ideology · notoriety · organizational-gain · personal-gain · personal-satisfaction · revenge · unpredictable

### 3.4 Capability (optional): NIST Table D-3, five levels

| Value | Description (NIST) | STIX sophistication equivalent |
| - | - | - |
| Very High | Very sophisticated expertise, well-resourced, can sustain multiple continuous coordinated attacks | innovator, strategic |
| High | Sophisticated expertise, significant resources, multiple coordinated attacks | expert |
| Moderate | Moderate resources, expertise and opportunities, multiple successful attacks | advanced |
| Low | Limited resources, expertise and opportunities, a successful attack | intermediate |
| Very Low | Very limited resources, expertise and opportunities | none, minimal |

### 3.5 Intent and Targeting (optional): NIST Tables D-4 and D-5, Very Low … Very High

Prompt wording, condensed from NIST:

- **Intent.** Very High: wants to destroy or severely impede a core mission, careless of exposure once the goal is reached. High: wants to undermine critical functions or position itself to, and works hard to stay undetected. Moderate: wants specific critical data or a foothold, keeps a low profile. Low: wants sensitive data or disruption without caring about detection. Very Low: wants to disrupt or deface, without concern for detection.
- **Targeting.** Very High: persistently targets this specific organisation, its key people, suppliers and partners, using reconnaissance and prior attacks. High: persistently targets this organisation and its key functions and people. Moderate: targets high-value organisations and key positions from public information. Low: targets a class of organisations and takes targets of opportunity. Very Low: no specific targeting.

### 3.6 Resources (optional): STIX 2.1 `attack-resource-level-ov`

individual · club · contest · team · organization · government

### 3.7 Position, privileges, access (optional; CVSS v4.0 names)

- `position`: external · internal · trusted-third-party **(NB)**.
- `required_privileges`: None · Low (standard user) · High (administrative). (CVSS v4 PR.)
- `access_vector`: Network · Adjacent · Local · Physical. (CVSS v4 AV.)
- `authentication_required`: true / false.

## 4. Risk scoring

### 4.1 The choice shown to the user

> **How do you want to rate this threat?**
> **A. Likelihood × Impact (quick).** Two questions, each on a five-point scale with plain descriptions, combined with the NIST SP 800-30 risk matrix. Takes a minute. Good for design reviews and early triage; two reviewers can disagree because each answer is a judgement call.
> **B. OWASP Risk Rating (detailed).** Sixteen factors, each scored 0–9 from fixed descriptions: eight for likelihood (who the attacker is, how easy the flaw is to find and exploit, whether it would be noticed) and eight for impact (technical loss of confidentiality/integrity/availability/accountability, and business damage: financial, reputation, compliance, privacy). Takes five to ten minutes. More repeatable and easier to defend to an auditor; slower, and some factors need business input.
> Both give the same five severity bands, so the diagram colours stay consistent whichever you pick. You can change the method on a threat later.

### 4.2 Method A: Likelihood × Impact (NIST SP 800-30 Rev 1)

**Likelihood** (one question; merges NIST Tables G-2 and G-4: "how likely is this to happen *and* cause harm?"):

| Value | Semi-quant. | Description |
| - | - | - |
| Very High | 10 (96–100) | Almost certain to occur and cause harm |
| High | 8 (80–95) | Highly likely |
| Moderate | 5 (21–79) | Somewhat likely |
| Low | 2 (5–20) | Unlikely |
| Very Low | 0 (0–4) | Highly unlikely |

For non-adversarial threats, Table G-3 adds frequencies: Very High > 100/yr · High 10–100/yr · Moderate 1–10/yr · Low once in 1–10 yrs · Very Low < once in 10 yrs.

**Impact** (NIST Table H-3):

| Value | Semi-quant. | Description |
| - | - | - |
| Very High | 10 | Multiple severe or catastrophic effects on operations, assets, individuals, other organisations or the nation |
| High | 8 | Severe or catastrophic: loss of a primary function, major damage or financial loss, loss of life or life-threatening injury |
| Moderate | 5 | Serious: primary functions continue with significantly reduced effectiveness, significant damage or loss, significant harm without loss of life |
| Low | 2 | Limited: noticeably reduced effectiveness, minor damage, loss or harm |
| Very Low | 0 | Negligible |

**Combination** (NIST Table I-2, rows = likelihood, columns = impact):

| Likelihood \ Impact | Very Low | Low | Moderate | High | Very High |
| - | - | - | - | - | - |
| Very High | Very Low | Low | Moderate | High | Very High |
| High | Very Low | Low | Moderate | High | Very High |
| Moderate | Very Low | Low | Moderate | Moderate | High |
| Low | Very Low | Low | Low | Low | Moderate |
| Very Low | Very Low | Very Low | Very Low | Low | Low |

Store `likelihood`, `impact`, the matrix result as `rating`, and `score` = the NIST semi-quantitative value of the rating (0/2/5/8/10) for sorting.

### 4.3 Method B: OWASP Risk Rating Methodology

Each factor is scored with one of its fixed options (value in brackets). **Likelihood** = average of the eight likelihood factors; **Impact** = average of the business factors when known, otherwise the technical factors. 0–<3 Low, 3–<6 Medium, 6–9 High. Overall severity from the OWASP matrix.

**Threat agent factors**
- Skill level: no technical skills (1) · some technical skills (3) · advanced computer user (5) · network and programming skills (6) · security penetration skills (9)
- Motive: low or no reward (1) · possible reward (4) · high reward (9)
- Opportunity: full access or expensive resources required (0) · special access or resources required (4) · some access or resources required (7) · no access or resources required (9)
- Size: developers (2) · system administrators (2) · intranet users (4) · partners (5) · authenticated users (6) · anonymous Internet users (9)

**Vulnerability factors**
- Ease of discovery: practically impossible (1) · difficult (3) · easy (7) · automated tools available (9)
- Ease of exploit: theoretical (1) · difficult (3) · easy (5) · automated tools available (9)
- Awareness: unknown (1) · hidden (4) · obvious (6) · public knowledge (9)
- Intrusion detection: active detection in application (1) · logged and reviewed (3) · logged without review (8) · not logged (9)

**Technical impact factors**
- Loss of confidentiality: minimal non-sensitive data disclosed (2) · minimal critical data disclosed (6) · extensive non-sensitive data disclosed (6) · extensive critical data disclosed (7) · all data disclosed (9)
- Loss of integrity: minimal slightly corrupt data (1) · minimal seriously corrupt data (3) · extensive slightly corrupt data (5) · extensive seriously corrupt data (7) · all data totally corrupt (9)
- Loss of availability: minimal secondary services interrupted (1) · minimal primary services interrupted (5) · extensive secondary services interrupted (5) · extensive primary services interrupted (7) · all services completely lost (9)
- Loss of accountability: fully traceable (1) · possibly traceable (7) · completely anonymous (9)

**Business impact factors**
- Financial damage: less than the cost to fix (1) · minor effect on annual profit (3) · significant effect on annual profit (7) · bankruptcy (9)
- Reputation damage: minimal damage (1) · loss of major accounts (4) · loss of goodwill (5) · brand damage (9)
- Non-compliance: minor violation (2) · clear violation (5) · high profile violation (7)
- Privacy violation: one individual (3) · hundreds of people (5) · thousands of people (7) · millions of people (9)

**Severity matrix** (OWASP):

| Impact \ Likelihood | Low | Medium | High |
| - | - | - | - |
| High | Medium | High | Critical |
| Medium | Low | Medium | High |
| Low | Note | Low | Medium |

Store the 16 factor values, both averages, and the matrix result. Interview tip: the adversary profile (section 3) pre-fills skill level, motive, opportunity and size; the data classification pre-fills the confidentiality and privacy factors. Offer the pre-fill, let the user change it.

### 4.4 Canonical severity bands and the circle colour

| Band | From Method A (NIST) | From Method B (OWASP) | From CVSS v4 qualitative | Circle |
| - | - | - | - | - |
| 1 Very Low | Very Low | Note | None (0.0) | light green ring, number |
| 2 Low | Low | Low | Low (0.1–3.9) | yellow ring |
| 3 Moderate | Moderate | Medium | Medium (4.0–6.9) | orange ring |
| 4 High | High | High | High (7.0–8.9) | red ring |
| 5 Very High | Very High | Critical | Critical (9.0–10.0) | **black fill, bold red number** |

Colour-blind and print safety: the five fills must have monotonically decreasing luminance (light green → yellow → orange → red → black reads correctly in grayscale), each band also gets a distinct ring treatment (thin / dashed / dotted / double / white inner ring), and the number is always present. Final hex values are chosen in the renderer with a contrast check. Display labels are configurable per model (`labels.severity`), the band ids are not.

`rating_override` lets a reviewer force a band; it requires `rating_override_reason`. `residual` repeats likelihood/impact (or the OWASP factors) after controls and yields `residual.rating`; the register sorts on residual when present.

### 4.5 CVSS (optional metadata)

Store `cvss: {version: "3.1" | "4.0", vector, base_score}`. v4.0 base metrics: AV N/A/L/P · AC L/H · AT N/P · PR N/L/H · UI N/P/A · VC, VI, VA H/L/N · SC, SI, SA H/L/N; vector prefix `CVSS:4.0/`. CVSS rates a *vulnerability*, not a design threat, so it never drives the band on its own; it is shown beside the band.

## 5. Standards references (optional, validated by pattern)

| Field | Format / validation | Current list |
| - | - | - |
| `cwe[]` | `CWE-\d+` | MITRE CWE |
| `capec[]` | `CAPEC-\d+` | MITRE CAPEC |
| `mitre_attack[]` | technique `T\d{4}(\.\d{3})?`, tactic `TA\d{4}` | ATT&CK v20 |
| `owasp[]` | `A(0[1-9]|10):2025`, `A(0[1-9]|10):2021`, `API(1|2|…|10):2023`, `LLM(0[1-9]|10):2025` | see below |
| `nist_800_53[]` | `[A-Z]{2}-\d+(\(\d+\))?`, family in AC AT AU CA CM CP IA IR MA MP PE PL PM PS PT RA SA SC SI SR | Rev 5 |
| `cis_controls[]` | `CIS-\d{1,2}(\.\d{1,2})?` (1–18) | v8.1 |
| `iso_27001[]` | `A\.\d\.\d{1,2}` | 2022 Annex A |
| `compliance[]` | free text from a suggested list: PCI DSS 4.0.1, HIPAA, GDPR, CCPA/CPRA, SOX, GLBA, FedRAMP, NIS2, DORA, ISO 27001 | — |

**OWASP Top 10:2025** (released November 2025): A01 Broken Access Control · A02 Security Misconfiguration · A03 Software Supply Chain Failures · A04 Cryptographic Failures · A05 Injection · A06 Insecure Design · A07 Authentication Failures · A08 Software or Data Integrity Failures · A09 Security Logging & Alerting Failures · A10 Mishandling of Exceptional Conditions.

**OWASP API Security Top 10:2023:** API1 Broken Object Level Authorization · API2 Broken Authentication · API3 Broken Object Property Level Authorization · API4 Unrestricted Resource Consumption · API5 Broken Function Level Authorization · API6 Unrestricted Access to Sensitive Business Flows · API7 Server Side Request Forgery · API8 Security Misconfiguration · API9 Improper Inventory Management · API10 Unsafe Consumption of APIs.

**OWASP Top 10 for LLM Applications 2025** (for AI service nodes): LLM01 Prompt Injection · LLM02 Sensitive Information Disclosure · LLM03 Supply Chain · LLM04 Data and Model Poisoning · LLM05 Improper Output Handling · LLM06 Excessive Agency · LLM07 System Prompt Leakage · LLM08 Vector and Embedding Weaknesses · LLM09 Misinformation · LLM10 Unbounded Consumption.

## 6. Treatment and controls

### 6.1 Treatment decision (recommended): ISO/IEC 27005 options

| Value | ISO 27005 name | Prompt |
| - | - | - |
| Mitigate | Modify | Add or change controls to reduce likelihood or impact |
| Accept | Retain | Keep the risk; record who approved it, why, and until when |
| Avoid | Avoid | Remove the activity, flow or component that creates the risk |
| Transfer | Share | Move part of the risk to another party (insurance, contract, managed service) |

`acceptance: {approved_by, date, rationale, review_by}` is required when the decision is Accept.

### 6.2 Controls (one or more; first-class objects)

| Field | Options |
| - | - |
| `type` | Preventive · Detective · Corrective · Deterrent · Recovery · Compensating · Directive |
| `status` | Proposed · Planned · In progress · Implemented · Verified · Not implemented · Retired |
| `effectiveness` | Very Low · Low · Moderate · High · Very High (same scale as the bands; used to suggest residual risk) |
| `verification` | Design review · Code review · Unit/integration test · Penetration test · Audit · Continuous monitoring · Not yet verified |
| `owner`, `due_date`, `ticket`, `nist_800_53[]`, `cis_controls[]` | free / patterned as in section 5 |

Status rules: a threat may be marked *Mitigated* only when at least one control is Implemented or Verified; *Verified* requires a `verification` value other than "Not yet verified".

## 7. Threat status lifecycle (mandatory, defaults to Identified)

Informed by Microsoft TMT (Not Started → Needs Investigation → Mitigated / Not Applicable) and OWASP Threat Dragon (Open / Mitigated / N/A):

Identified (default) → Investigating → Open (confirmed, untreated) → **Mitigated** | **Accepted** | **Transferred** | **Avoided** · plus **Not Applicable** (with reason) and **Retired** (number never reused).

## 8. Provenance (optional)

`discovered_by` (workshop, pen test, code review, incident, automated scan, cloud catalogue card, live research), `created`, `updated`, `references[]` (URLs), and for suggested threats from a cloud card: `suggested: true`, `suggested_from: <card id>`.

## 9. Not adopted, and why

- **Intel Threat Agent Library (TAL):** 22 archetypes with 8 attributes. Richer than STIX but Intel-copyrighted and inconsistently published; STIX + NIST cover the same ground with open vocabularies. Could be added later as an optional `tal_archetype` field.
- **DREAD:** superseded within Microsoft; its factors overlap OWASP RR. Not offered as a third method, to keep the choice simple.
- **Lockheed Martin Cyber Kill Chain:** seven phases; ATT&CK tactics are finer and have IDs. Not offered.
- **PASTA / Trike / OCTAVE:** process frameworks rather than attribute lists; the interview can be run inside any of them.

## Sources

- Microsoft STRIDE and Threat Modeling Tool: https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-getting-started · https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-feature-overview
- LINDDUN threat types: https://linddun.org/threat-types/
- MITRE ATT&CK Enterprise tactics (v20): https://attack.mitre.org/tactics/enterprise/
- NIST SP 800-30 Rev 1, Tables D-2 to D-5, G-2 to G-5, H-3, I-2, I-3: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-30r1.pdf
- STIX 2.1 open vocabularies (OASIS reference implementation): https://raw.githubusercontent.com/oasis-open/cti-python-stix2/master/stix2/v21/vocab.py · spec: https://docs.oasis-open.org/cti/stix/v2.1/os/stix-v2.1-os.html
- OWASP Risk Rating Methodology: https://community.owasp.org/OWASP_Risk_Rating_Methodology
- CVSS v4.0 specification: https://www.first.org/cvss/v4.0/specification-document
- OWASP Top 10:2025: https://owasp.org/Top10/2025/0x00_2025-Introduction/
- OWASP API Security Top 10:2023: https://api-security.owasp.org/editions/2023/en/0x11-t10
- ISO/IEC 27005 treatment options and control types (secondary): https://en.wikipedia.org/wiki/ISO/IEC_27005 · https://destcert.com/resources/types-security-controls/
- OWASP Threat Dragon statuses (secondary, via DefectDojo parser docs): https://docs.defectdojo.com/supported_tools/parsers/file/threat_dragon/
- Intel TAL (background): https://cio-wiki.com/wiki/Threat_Agent_Risk_Assessment_(TARA)
