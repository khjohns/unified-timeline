# Vederlag — Business Logic Review

Reviewed sections:
- Design: DESIGN_WORKSPACE_PANELS.md lines 1189–1318 (BH svarer) and 1475–1548 (TE sender)
- Reference: outputfrasubagent.md lines 1119–1698

---

## Finding 1 — BH wizard port structure

**INCORRECT** (design, line 1189)

The design document presents BH's vederlag response as a single scrollable panel, not a wizard. The subagent confirms (outputfrasubagent.md line 1352) that the actual implementation is a 3- or 4-port stepped wizard:

- 4 ports when SVIKT/ANDRE category or særskilte krav are present: Varsling → Beregningsmetode → Beløp → Oppsummering
- 3 ports when only ENDRING with no særskilte krav: Beregningsmetode → Beløp → Oppsummering

The design mockup collapses all of these into one sequential layout with a single "Send svar §34" button at the bottom. This is accurate enough as a visual specification of what each port contains, but the design fails to communicate the stepped/paged nature. It should note that METODE, KRAVLINJER, and RESULTAT each belong to separate ports, not a single scroll. The "Oppsummering" port (Port 4) is entirely absent from the design. The design's RESULTAT section (lines 1249–1255) is a simplified inline summary, not the full summary port which includes a Beløpsoversikt table with Krav/Krevd/Godkjent/Status columns, subsidiær row, and the change-summary block in update mode.

---

## Finding 2 — Per-kravlinje pattern (KRAVLINJER container)

**OK** (design, lines 1220–1247 and 1269–1272)

The design correctly represents the three independent kravlinjer (HOVEDKRAV, RIGG OG DRIFT §34.1.3, PRODUKTIVITET §34.1.3) inside a grouped KRAVLINJER container. Each kravlinje has its own Varsling toggle and Godkjent beløp input. The per-kravlinje independence is confirmed by the subagent (outputfrasubagent.md lines 1558–1563): each krav has its own dato_klar_over and each is independently evaluated in Port 3, including being independently precluded. The design's grouping pattern correctly mirrors this.

One minor gap: the design says each kravlinje shows "Varsling (Ja/Nei)" (line 1270) and "Godkjent beløp" (line 1271) side by side, but it does not explicitly show the three-option RadioGroup for beløpsvurdering (Godkjent fullt ut / Delvis godkjent / Avvist) as distinct from just an amount input. The actual Port 3 has a RadioGroup verdict per krav, with the CurrencyInput only appearing conditionally for "Delvis godkjent" (outputfrasubagent.md lines 1437–1441). This is a simplification in the mockup but the core structure is correct.

---

## Finding 3 — §34.1.2 preclusion limited to SVIKT/ANDRE

**OK** (design, line 1270)

The betinget synlighet block at line 1270 explicitly states:

> Varsling (Ja/Nei) — kun SVIKT/ANDRE, IKKE ENDRING

This correctly mirrors the domain rule confirmed by the subagent (outputfrasubagent.md lines 1366 and 1673–1674):

- Hovedkrav varsling check is only rendered for SVIKT or ANDRE category (§34.1.2).
- ENDRING (§34.1.1) has no preclusion on the main vederlag claim.
- Særskilte krav (rigg/drift, produktivitet) are ALWAYS subject to preclusion regardless of main category (§34.1.3).

The design correctly identifies the category boundary.

---

## Finding 4 — EP-justering §34.3.3

**OK with minor label note** (design, lines 1277–1278 and 1317)

The design correctly states (line 1277):

> Synlig hvis ENHETSPRISER + TE krever_justert_ep

This matches the implementation condition `maSvarePaJustering = metode === 'ENHETSPRISER' AND krever_justert_ep === true` (outputfrasubagent.md line 1601).

However, the design labels the block "EP-justering §34.3.3" (lines 1278 and 1317), while the actual implementation titles it "Justerte enhetspriser (§34.3.2)" with the specific §34.3.3 reference appearing inside the RadioGroup label "Varslet entreprenøren i tide? (§34.3.3)" (outputfrasubagent.md lines 1410 and 1412). The correct primary section reference is §34.3.2 (the general adjusted unit price rule); §34.3.3 governs the timing/notice requirement within it. This is a minor label imprecision in the design, not a domain logic error.

Also correct: the design notes a "konsekvens-alert ved Nei" (line 1278) which matches the dual-consequence structure in the implementation (warning for late notice → only "måtte forstå" entitlement; warning for rejection → must provide reasoning). The design collapses this to a single Ja/Nei when in fact there are two independent RadioGroups in Port 2, but the conditional visibility rule is correct.

---

## Finding 5 — §30.2 tilbakeholdelse

**OK** (design, lines 1280–1281 and 1316)

The betinget synlighet block correctly states (lines 1280–1281):

> Synlig hvis REGNINGSARBEID uten kostnadsoverslag:
>   Tilbakeholdelse §30.2 (checkbox + estimert grense)

This precisely matches the implementation condition `kanHoldeTilbake = metode === 'REGNINGSARBEID' AND !kostnadsOverslag` (outputfrasubagent.md lines 1568–1570).

One imprecision: the design says "checkbox + estimert grense" (line 1281) while the actual implementation uses a RadioGroup with two options ("Ja - hold tilbake inntil overslag mottas" / "Nei - fortsett behandling"), not a checkbox (outputfrasubagent.md lines 1423–1425). The result state of hold_tilbake is also described correctly by the design as a separate "HOLDT TILBAKE" (amber) result (line 1316), consistent with the implementation's badge variant 'warning' for `hold_tilbake` (outputfrasubagent.md lines 1582 and 1690).

---

## Finding 6 — TE vederlag form fields per beregningsmetode

**MOSTLY OK, one missing field** (design, lines 1475–1542)

The design correctly covers:
- ENHETSPRISER: beløp + justerte EP toggle (line 1533)
- REGNINGSARBEID: kostnadsoverslag + varslet før oppstart toggle (lines 1488–1494, 1534)
- FASTPRIS: beløp (line 1535)

The betinget synlighet notes show the correct per-metode conditional structure.

**MISSING**: The TE form design does not show the `begrunnelse` field (Textarea, required, min 10 chars) which is Section 4 in the actual form (outputfrasubagent.md lines 1321–1322). This is a required field in the implementation and appears after Særskilte krav but before Vedlegg. Since the design's high-level architecture places begrunnelse in the right panel (TipTap editor), this may be intentional, but the TE vederlag form design should acknowledge that begrunnelse is handled via the right panel's editor, not in the midpanel — or clarify this explicitly. Currently the design jumps from SÆRSKILTE KRAV directly to VEDLEGG with no note about begrunnelse.

**MINOR**: The §-reference on "Varslet før oppstart" is labeled §34.2.2 in the design mockup (line 1494). The subagent reports this checkbox as governed by §34.4 in vederlagConstants.ts (outputfrasubagent.md line 2277: "varslet_for_oppstart checkbox (§34.4)"). §34.2.2 does not appear in the subagent's analysis. The correct reference for the obligation to notify before starting regningsarbeid is §34.4 / §30.3.1. This is a wrong §-reference in the design.

---

## Finding 7 — Særskilte krav: dato_klar_over and independent preclusion

**MOSTLY OK, one missing detail** (design, lines 1496–1514 and 1537–1540)

The design correctly shows both rigg/drift and produktivitet with their own beløp and dato fields inside the SÆRSKILTE KRAV container. The per-krav toggle structure (checkbox → reveal beløp + dato) matches the implementation (outputfrasubagent.md lines 1544–1556).

The design shows "Fra dato" as the field label for rigg/drift (line 1502) but does not provide a label for the produktivitet date (lines 1509–1513 show beløp only, no date field). The subagent confirms produktivitet has its own "Dato produktivitetstapet ble erkjent" field (outputfrasubagent.md line 1554), which parallels rigg/drift's "Dato utgiftene ble erkjent." This date is required for independent preclusion checking on the BH side (outputfrasubagent.md line 1558). The design's produktivitet subsection is missing the date input in the mockup wireframe.

The independent preclusion logic (each krav has its own dato_klar_over, live preclusion check at >3 days warning / >7 days danger) is correctly noted in the BH betinget synlighet (lines 1269–1272), though the preclusion thresholds are not explicitly documented in the design.

---

## Finding 8 — Fradrag handling

**OK for ENHETSPRISER; MISSING for REGNINGSARBEID** (design, lines 1533)

For ENHETSPRISER, the design notes "beløp + justerte EP toggle" (line 1533) and the betinget synlighet implies allowNegative. The subagent confirms (outputfrasubagent.md lines 1301–1302) that the ENHETSPRISER field has `allowNegative: true` with helpText "Negativt beløp angir fradrag. Ved fradrag brukes enhetsprisene tilsvarende (§34.3)." This is consistent with the design's treatment.

For REGNINGSARBEID, the design shows no fradrag-related note at all. The subagent confirms there is an Alert in the TE form for REGNINGSARBEID: "Ved fradrag reduseres vederlaget med besparelsen, inkludert tilsvarende reduksjon av fortjenesten (§34.4)." (outputfrasubagent.md lines 1628–1629). While fradrag for REGNINGSARBEID has no separate input field (it is implicit in the ongoing billing process), the design should note this conditional Alert exists for REGNINGSARBEID, as it is a domain-relevant disclosure to TE.

---

## Finding 9 — er_estimat handling

**OK** (design, no mention)

The design correctly does not include an `er_estimat` field or toggle in either the TE or BH vederlag forms. The subagent confirms (outputfrasubagent.md lines 1639–1649) that `er_estimat` is set in endringsordre context (OpprettEndringsordre, UtstEndringsordreModal), not in vederlag forms. In vederlag, the concept is implicitly handled through `kostnads_overslag` labeled "Estimert totalkostnad" for REGNINGSARBEID. The design's REGNINGSARBEID section shows `Kostnadsoverslag` (line 1488) which is the correct treatment.

---

## Finding 10 — BH svarplikt warning (>5 days)

**MISSING** (design, lines 1189–1318)

The design does not mention the BH svarplikt warning. The subagent confirms (outputfrasubagent.md lines 1361–1362) that at the top of the BH response modal, always visible, there is:

> If bhSvarpliktAdvarsel (more than 5 days since dato_krav_mottatt): Alert (danger) "Svarplikt" with day count.

This is also confirmed in the preclusion threshold table (outputfrasubagent.md line 1669):

> BH svarplikt warning (RespondVederlag) | > 5 days since krav mottatt | danger

The design's kravhode section (lines 1194–1202) and betinget synlighet block (lines 1259–1282) make no reference to this warning. The svarplikt alert is domain-significant — it signals that BH is at risk of passive acceptance under §30.3.2. It must appear as a conditional element in the design spec.

---

## Summary table

| # | Topic | Status | Design lines | Notes |
|---|-------|--------|-------------|-------|
| 1 | BH wizard port structure (3 or 4 ports) | INCORRECT | 1189–1257 | Design shows single-scroll; Oppsummering port entirely missing |
| 2 | Per-kravlinje pattern (3 independent krav) | OK | 1220–1247, 1269–1272 | RadioGroup verdict simplified to Ja/Nei but structure is correct |
| 3 | §34.1.2 preclusion limited to SVIKT/ANDRE | OK | 1270 | Explicitly stated and correct |
| 4 | EP-justering §34.3.3 (ENHETSPRISER + krever_justert_ep) | OK | 1277–1278, 1317 | Minor: primary §-ref should be §34.3.2, not §34.3.3 |
| 5 | §30.2 tilbakeholdelse (REGNINGSARBEID, no overslag) | OK | 1280–1281, 1316 | Minor: checkbox vs. RadioGroup implementation detail |
| 6 | TE form fields per beregningsmetode | MOSTLY OK | 1475–1542 | MISSING: begrunnelse field; INCORRECT: §34.2.2 should be §34.4 |
| 7 | Særskilte krav dato_klar_over + independent preclusion | MOSTLY OK | 1496–1514 | MISSING: produktivitet date field absent from wireframe |
| 8 | Fradrag handling | MOSTLY OK | 1533 | MISSING: REGNINGSARBEID fradrag Alert not documented |
| 9 | er_estimat (auto-set in EO context, not in vederlag) | OK | (absent) | Correctly omitted |
| 10 | BH svarplikt warning (>5 days) | MISSING | 1259–1282 | No mention anywhere in BH response spec |
