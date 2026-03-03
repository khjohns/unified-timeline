# Frist-review: business logic consistency

Reviewed sections:
- Design: "Fristforlengelse — BH svarer" (lines 1319–1405)
- Design: "TE sender — Frist" (lines 1407–1473)
- Design: "Preklusjonsadvarsel for TE" (lines 1725–1735)
- Domain: subagent output lines 544–1117

---

## 1. BH frist response wizard — "three ports" vs four ports

**INCORRECT** (lines 1403–1405)

The design names three ports: Varsling (datoer), Innsigelser (checkboxer), Vurdering (verdict-knapper + tall).

The actual wizard has four steps: Varsling, Årsakssammenheng/Vilkår (§33.1), Beregning (§33.5), Oppsummering. The design collapses Port 2 (Årsakssammenheng), Port 3 (Beregning), and Port 4 (Oppsummering) into a single "Vurdering" section. Specifically:

- Port 2 is a distinct step with a radio `vilkar_oppfylt` — "Har forholdet hindret fremdriften?" (§33.1). The design does show a `§33.1` checkbox in the Innsigelser list (line 1352–1353), but this is categorically different: in the domain, §33.1 is Port 2 (BH assesses whether the event actually obstructed progress), not a preclusion innsigelse. Putting §33.1 in the Innsigelser group alongside §33.4 and §33.6.1 incorrectly frames it as a notification-deadline objection rather than a causation assessment.
- Port 3 (Beregning) is a separate step with `godkjent_dager` and `ny_sluttdato` inputs. The design merges this into "Vurdering" (verdict buttons + a days input) without a distinct step boundary.
- Port 4 (Oppsummering) with the auto-generated, editable `begrunnelse` and "Regenerer fra valg" button is not mentioned at all in the BH response section.

The three-port framing is an adequate simplification only if the design is treating this as a single-screen panel rather than a wizard. However, the misclassification of §33.1 as an innsigelse is an actual logic error (see finding 8 below).

---

## 2. §33.4, §33.6.1, §33.6.2 — correct distinction?

**PARTIALLY INCORRECT** (lines 1347–1353)

The Innsigelser section shows three checkboxes:

1. "Varslet for sent" — §33.4 (line 1349)
2. "Spesifisert for sent" — §33.6.1 (line 1351)
3. "Fremdrift ikke hindret" — §33.1 (line 1353)

§33.4 and §33.6.1 are correctly named and their consequence asymmetry (preclusion vs reduction) is not contradicted in the design wireframe itself. The design does not state the consequences explicitly, but neither does it say they are equivalent, so no outright error there.

However, §33.6.2 is missing entirely from the Innsigelser list. The domain has a third distinct preclusion path: when TE responded to BH's own forespørsel, BH evaluates `foresporsel_svar_ok` — and a late response here causes full preclusion under §33.6.2 third paragraph. This is a separate innsigelse that the design does not surface.

The absence is partly mitigated by finding 4 below (the forespørsel scenario is handled via a separate context alert, not an innsigelse checkbox), but BH's option to find the forespørsel response late — and the full preclusion consequence of that — is not covered anywhere in the BH response section.

Also: the distinction between §33.4 consequence (full preclusion, claim lost) and §33.6.1 consequence (reduction only — TE gets what BH "had to understand") is nowhere stated or implied in the design. The domain is precise: §33.6.1 does NOT set `erPrekludert`; the claim survives at a reduced quantum. This matters because the days input in Port 3 behaves differently in each case (the "Begrenset godkjenning (§33.6.1)" warning reminding BH to cap days). The design gives no hint of this asymmetry.

---

## 3. TE frist form — varsel types

**OK with one gap** (lines 1451–1473)

The betinget synlighet table (lines 1454–1473) correctly names the three `varsel_type` values and their constraints:

- `varsel` / `spesifisert` available in the `new` scenario — correct.
- `spesifisert` locked in the `spesifisering` scenario — correct.
- `foresporsel` scenario shows `Spesifisert / Begrunnelse utsatt` — correct; this matches the domain rule that `begrunnelse_utsatt` is only available when `harMottattForesporsel === true`.
- `edit` scenario locks the type — correct.

The scenario context alerts (lines 1468–1469) are correct: spesifisering shows the original notice date, foresporsel shows BH's deadline.

The one gap: the design's wireframe (lines 1414–1448) shows only "Varsel" and "Spesifisert" tabs; it does not illustrate the "Begrunnelse utsatt" variant at all. A reader looking only at the wireframe (not the betinget synlighet table) would not know this third option exists. This is a documentation gap rather than a logic error, since the table does cover it.

The domain also specifies that when `varsel_type === 'spesifisert'` and `!har_tidligere_varslet`, the spesifisert claim doubles as the §33.4 notice (the submitted payload reuses the date as `frist_varsel`). The design does not mention this dual-function behaviour. This is not a visual concern — it affects how BH evaluates the subsequent §33.4 timing in Port 1.

---

## 4. Forespørsel lifecycle

**PARTIALLY OK, PARTIALLY MISSING** (lines 1399–1400, 1458–1469)

What the design covers:

- BH side (line 1399–1400): "Synlig hvis BH har sendt forespørsel: Kontekstalert: «Du etterlyste spesifisering innen [frist].»" — this correctly represents that BH sees a reminder of their own forespørsel when revisiting the claim.
- TE side (lines 1458, 1469): the `foresporsel` scenario correctly unlocks "Begrunnelse utsatt" and shows a context alert about BH's deadline.

What is missing:

- The initial act: BH sending a forespørsel is not shown anywhere in the BH response section. The domain specifies that when `varselType === 'varsel'` and `frist_varsel_ok === true`, Port 1 shows a `send_foresporsel` radio and a `frist_for_spesifisering` DatePicker. None of this appears in the design's BH response wireframe or betinget synlighet table.
- The begrunnelse_utsatt path: when TE replies with `begrunnelse_utsatt`, BH receives a simplified single-screen modal (no wizard steps, just "Bekreft mottak" and an optional comment). This simplified flow is not represented.
- The §33.6.2 fourth paragraph protection: when TE responded to BH's forespørsel with a timely `spesifisert`, BH cannot invoke §33.6.1 (reduction). The design does not show or imply that the §33.6.1 innsigelse checkbox is suppressed in this case.

---

## 5. Subsidiært standpunkt logic

**PARTIALLY CORRECT** (lines 1367–1377, 1396–1397)

The design correctly shows:

- A "Subsidiært standpunkt" section with its own days input (line 1370–1372).
- Conditional visibility: "Synlig hvis minst én innsigelse" (line 1396–1397).
- Both prinsipalt and subsidiært results in the summary (lines 1376–1377).

What is missing or imprecise:

- The domain triggers subsidiært in Port 2 and Port 3 via badges (not a separate section). A "Subsidiært" badge appears on the section title when `erPrekludert` is true. The design's approach — a separate freestanding "SUBSIDIÆRT STANDPUNKT" block with its own days input — does not map cleanly to the wizard's inline badge + conditional label approach. The domain's subsidiary days field is the same `godkjent_dager` input, relabelled "Maksimalt antall kalenderdager" when subsidiary. The design shows it as a separate sibling input. This could confuse implementors.
- The domain's `ny_sluttdato` DatePicker is hidden when the assessment is subsidiary. The design does not mention this constraint.
- The condition for subsidiært visibility is stated as "minst én innsigelse" in the design. The domain is more precise: subsidiært is triggered by `erPrekludert || erGrunnlagSubsidiaer` (i.e., also when the grunnlag itself was assessed subsidiarily under §32.2, even with no frist-preclusion innsigelse). The "minst én innsigelse" framing is narrower and would miss the §32.2 trigger.

---

## 6. §33.8 forsering warning on frist rejection

**MISSING from BH response section** (lines 1319–1405)

The domain specifies that a §33.8 forsering warning is shown in Port 3 (Beregning) when `prinsipaltResultat === 'avslatt'` or when the claim is `delvis_godkjent` with rejected days > 0. This warning is also included in the auto-generated begrunnelse (Port 4).

The design's BH frist response section (lines 1319–1405) makes no mention of a §33.8 warning anywhere. The design does have a separate top-level section on "Forsering (§33.8)" (lines 1553 onward), which covers the TE-side forsering varsel and BH's evaluation of it, but the inline warning that surfaces during the frist rejection decision is absent from the BH response wireframe.

This is a meaningful omission: the §33.8 warning is contextual and time-sensitive — it should appear at the moment BH decides to reject or partially reject, not only after TE subsequently sends a separate forsering notice.

---

## 7. Preklusjonsadvarsel thresholds

**OK** (lines 1725–1735)

The design table is correct:

| Days | Level | Matches domain |
|------|-------|----------------|
| 0–7 | Ingen | Correct (domain: `dagerSidenGrunnlag <= 7` → no alert) |
| 7–14 | Amber (warning) | Correct (domain: `> 7` → warning) |
| >14 | Rød (danger) | Correct (domain: `> 14` → danger) |

The design says thresholds are computed from `dato_oppdaget` (line 1727), which matches the domain's primary source. The domain also uses `dato_varslet` as a fallback when `dato_oppdaget` is unavailable; this fallback is not mentioned in the design but is an implementation detail rather than a logic inconsistency.

One minor note: the domain surfaces the preklusjonsadvarsel inside the §33.4 SectionContainer (inside the form), and also as an inline info row in the kravtype section. The design places it in "kravhodet" (the claim header). These are not contradictory — both are visible at the top of the form — but they are different locations.

---

## 8. vilkår_oppfylt (§33.1 hindrance assessment)

**INCORRECT** (lines 1352–1353)

The design places "Fremdrift ikke hindret — §33.1" as a checkbox inside the "INNSIGELSER" group alongside §33.4 and §33.6.1. This is a category error.

In the domain, §33.1 hindrance is Port 2 — a separate step titled "Årsakssammenheng" — with a `vilkar_oppfylt` radio ("Har forholdet hindret fremdriften?"). It is not a preclusion innsigelse. Preclusion innsigelser (§33.4, §33.6.1) are about whether TE met procedural notification deadlines. §33.1 is a substantive causation question: did the event actually obstruct the critical path?

The two groups have different legal consequences:

- A §33.4 or §33.6.1 innsigelse can extinguish the right before the merits are reached.
- A §33.1 "nei" means BH rejects the claim on the merits (the hindrance condition is not met), but preclusion has not been applied; the claim was considered on substance.

Placing §33.1 as a checkbox alongside the preclusion innsigelser implies they are of the same type. An implementor reading only the design would likely render all three as equivalent checkboxes, losing the wizard-step separation that drives the subsidiary logic (Port 2 and Port 3 carry "Subsidiært" badges precisely because they are evaluated after — and conditional on — Port 1's preclusion assessment).

---

## Summary

| # | Topic | Status |
|---|-------|--------|
| 1 | Three ports vs four ports | INCORRECT — §33.1 misclassified; Port 4 (Oppsummering/begrunnelse) absent |
| 2 | §33.4 / §33.6.1 / §33.6.2 distinction | PARTIALLY INCORRECT — §33.6.2 innsigelse missing; §33.6.1 consequence (reduction, not preclusion) unstated |
| 3 | TE frist form — varsel types | OK — minor gap on begrunnelse_utsatt wireframe and dual-notice behaviour |
| 4 | Forespørsel lifecycle | PARTIALLY MISSING — BH sending forespørsel (send_foresporsel + frist_for_spesifisering) not shown; begrunnelse_utsatt BH flow absent; §33.6.2 fourth paragraph protection absent |
| 5 | Subsidiært standpunkt | PARTIALLY CORRECT — separate section acceptable, but condition ("minst én innsigelse") is too narrow; misses §32.2 grunnlag trigger |
| 6 | §33.8 forsering warning at rejection | MISSING — not shown in BH response section |
| 7 | Preklusjonsadvarsel thresholds (7d/14d) | OK |
| 8 | vilkår_oppfylt §33.1 as innsigelse | INCORRECT — causation assessment placed in preclusion-innsigelse group |
