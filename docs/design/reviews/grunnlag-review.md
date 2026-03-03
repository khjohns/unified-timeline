# Review: Grunnlag — Business Logic Consistency

Source: `.interface-design/DESIGN_WORKSPACE_PANELS.md` lines 1129–1187
Domain reference: `outputfrasubagent.md` lines 67–542
Date: 2026-03-03

---

## 1. BH resultat options (godkjent / avslått / frafalt)

**OK** — The wireframe (line 1151–1153) shows Godkjent, Avslått, Frafalt as the three verdict buttons, matching the domain's `BH_GRUNNLAGSVAR_OPTIONS`.

**INCORRECT** — The `frafalt` button is shown unconditionally in the wireframe (line 1151–1153), but the conditional visibility section (line 1174) also lists it as "Alltid synlig". The domain is explicit that `frafalt` must only appear when `erPaalegg` is true — i.e., `ENDRING AND (underkategori === 'IRREG' OR underkategori === 'VALGRETT')`. It must NOT be shown for EO, SVAR_VARSEL, LOV_GJENSTAND, LOV_PROSESS, GEBYR, SAMORD, SVIKT, ANDRE, or FORCE_MAJEURE. The design omits this visibility constraint entirely in the "Betinget synlighet" block and contradicts it by listing Frafalt under "Alltid synlig".

---

## 2. Varsling §32.2 — conditional visibility (ENDRING vs non-ENDRING)

**INCORRECT** — The "Betinget synlighet" section (line 1169) reads:

```
Synlig hvis ENDRING:
  - Varsling §32.2 (Ja/Nei)
  - Preklusjonsadvarsel (hvis Nei)
```

This is too broad. The domain condition is `ENDRING AND underkategori !== 'EO'` (i.e., EO is excluded because formal endringsordrer have no varsling obligation under §32.2). The design does not mention the EO exclusion here. A BH responding to an EO grunnlag should not see the §32.2 varsling field at all.

---

## 3. Passivitetsrisiko (§32.3) — threshold and severity bands

**INCORRECT** — Line 1187 reads:

```
Passivitets-advarsel (ENDRING, >10d): 7-14d amber, >14d rød.
```

Two problems:

a. **Trigger condition is too broad.** The domain condition is `ENDRING AND underkategori !== 'EO' AND dagerSidenVarsel > 10`. The design writes "ENDRING, >10d" without the EO exclusion. EO grunnlag should never trigger a passivitetsrisiko alert.

b. **Severity bands are inconsistent with the threshold.** The design states a `>10d` trigger but then shows a 7–14d amber band, implying the alert starts at 7 days. The domain sets the trigger at `> 10 days` (from `erPreklusjonKritisk()` with `regelType = 'IRREGULAER'`). There is no 7-day amber band in the domain logic — the domain utility (`sjekkBHPassivitet`) uses `> 5 days` for `varsel` status and `> 10 days` for `kritisk` status. The design's "7-14d amber / >14d rød" band structure is not consistent with either domain source. If two-tier severity is intended, the thresholds should be `>5d amber, >10d rød` per the utility function, not 7 and 14.

---

## 4. Snuoperasjon (avslått → godkjent conversion)

**MISSING — partial.** The design acknowledges the snuoperasjon alert at line 1181 and line 1186 ("Subsidiære svar blir prinsipale") and the trigger condition at line 1180 ("avslått → godkjent"). However, the domain specifies an additional precondition: `harSubsidiaereSvar` must be true. The conversion alert is only meaningful (and only shown in the domain) when there are actual subsidiary vederlag/frist answers to promote. The design's description of the trigger as simply "avslått → godkjent" without the `harSubsidiaereSvar` condition is incomplete. An implementation following the design as written could show the snuoperasjon alert on a bare reversal where no subsidiary answers exist.

---

## 5. Force Majeure specifics (no vederlag, only frist)

**MISSING — from BH grunnlag section.** The domain shows that when `FORCE_MAJEURE` is selected, a dedicated `KontraktsregelInline` for §33.3 is shown at the top of the Vurdering tab, and specific conditional alerts appear depending on resultat:

- `resultat = godkjent AND FORCE_MAJEURE` → success alert "Force Majeure — kun fristforlengelse (§33.3)" confirming no vederlagsjustering is granted.
- `resultat = avslatt AND FORCE_MAJEURE` → warning alert about the consequence, distinct from the general avslått warning.

The design's BH grunnlag section (lines 1129–1187) makes no mention of Force Majeure behaviour at all. The wireframe shows "Irregulær endring" as the only example, the conditional visibility block has no FM-specific branch, and "Spesifikt" at line 1184 does not distinguish FM godkjent from standard godkjent. The FM vederlag-deaktivert note at line 1709–1721 addresses the vederlag panel, not the grunnlag response step.

The domain rule that Force Majeure grants **only fristforlengelse, not vederlag** (§33.3) is a critical constraint that must be signalled to BH at the grunnlag response stage — not only at the vederlag stage.

---

## 6. TE grunnlag submission fields

The section heading ("Ansvarsgrunnlag — BH svarer") and the task instructions scope this section to BH's response form. The TE submission fields are covered under the separate "TE sender — alle kravtyper" section (line 1407) and the brief note at line 1549 ("TE varsler via Forhandlingsbordet"). The design does **not** include a dedicated "Ansvarsgrunnlag — TE sender" detail section, so the following domain fields have no design specification:

**MISSING — TE submission fields not designed:**

- `kategori` (Hovedkategori RadioGroup: ENDRING / SVIKT / ANDRE / FORCE_MAJEURE)
- `hjemmel` / underkategori dropdown (with grouped options per kategori, hidden for FORCE_MAJEURE)
- `tittel` (text input, 3–100 chars)
- `beskrivelse` (textarea, min 10 chars)
- `dato_oppdaget` (DatePicker with elapsed-days inline display)
- `varsling` section (VarselSeksjon: varsel_sendes_na checkbox, dato_varsel_sendt, varsel_metode) — hidden in Update mode
- Update mode: "Nåværende ansvarsgrunnlag" summary block + kategoriendring warning
- Inline preklusjonsadvarsel between dato_oppdaget and dato_varsel_sendt (warning at 3d, danger at 14d)

The only reference to TE's grunnlag in the whole design document is the one-sentence note "TE varsler via Forhandlingsbordet. Spordetaljvisningen viser read-only varsel." (line 1549), which defers without specifying.

If the design document is intended to cover both parties' views for each kravtype, a "Ansvarsgrunnlag — TE sender" section is missing in its entirety.

---

## 7. BH response — begrunnelse field

**MISSING.** The domain splits the BH response into two tabs: "Vurdering" (verdict + varsling) and "Begrunnelse" (RichTextEditor). The design wireframe (lines 1131–1163) shows the begrunnelse text inline in the high-panel editor (right panel) at line 1148 ("Byggherren anser varselet mottatt i tide, men avslår") — this appears to be the begrunnelse editor placed in the right panel. This is consistent with the overall dual-panel pattern described elsewhere in the document. However:

**OK** — The design document's general right-panel editor spec (lines 906–913, 935–984) covers the editor component. The dynamic placeholder table at lines 1741–1749 includes grunnlag-specific placeholders (godkjent, avslått, frafalt). These are consistent with the domain.

**MISSING** — The domain specifies that when `erGrunnlagPrekludert` is true, the begrunnelse placeholder changes to specifically request both the preklusjonsinnsigelse AND the subsidiary vurdering in one field. The design's dynamic placeholder table (line 1741–1749) has no entry for the preklusjon-specific combined begrunnelse case.

---

## 8. Subsidiær vurdering alert when prekludert

**MISSING.** The domain shows that when `grunnlag_varslet_i_tide = false` (BH invokes §32.2 preclusion), two distinct alerts appear:

1. "Preklusjon påberopt (§32.2)" danger alert — the preclusionary claim itself.
2. "Subsidiær vurdering" warning alert — reminding BH that the Vurdering section now applies subsidiarily.

The design at line 1171 only mentions "Preklusjonsadvarsel (hvis Nei)" under the ENDRING-conditional block. The subsidiary vurdering warning is not mentioned.

---

## 9. Varslet i tide — info alert (positive case)

**MISSING.** The domain shows that when `erEndringMed32_2 AND grunnlag_varslet_i_tide = true` (the default), an info alert "Varslet i tide" is shown confirming §34.1.1 applies for vederlag (no vederlagspreklusjon). The design has no equivalent positive-confirmation alert — it only mentions the negative case (Nei → preklusjonsadvarsel).

---

## 10. Footer — wrong §-reference

**INCORRECT** — The footer at line 1162 reads:

```
▓ Send svar §25 ▓
```

§25 is not the correct reference for BH's grunnlag response. The domain uses "Send svar" for the create mode submit button, referencing §33 (the general change chapter). §25 is the deadline for BH to respond to TE's claims. The §-reference in the footer button should be verified against the domain — the correct citation for a grunnlag response is not §25.

---

## Summary table

| # | Finding | Status | Design lines | Domain reference |
|---|---------|--------|-------------|-----------------|
| 1 | Frafalt shown unconditionally, should be IRREG/VALGRETT only | INCORRECT | 1151–1153, 1174 | outputfrasubagent.md 322–328 |
| 2 | §32.2 varsling condition missing EO exclusion | INCORRECT | 1169–1171 | outputfrasubagent.md 281, 409–410 |
| 3a | Passivitetsrisiko condition missing EO exclusion | INCORRECT | 1187 | outputfrasubagent.md 274, 427 |
| 3b | Severity bands (7-14d / >14d) inconsistent with domain (>5d / >10d) | INCORRECT | 1187 | outputfrasubagent.md 477–478 |
| 4 | Snuoperasjon missing harSubsidiaereSvar precondition | MISSING | 1180–1181 | outputfrasubagent.md 261–263 |
| 5 | Force Majeure BH-grunnlag response (§33.3, only frist) not specified | MISSING | 1129–1187 | outputfrasubagent.md 269–272, 341–349 |
| 6 | TE grunnlag submission form fields not designed | MISSING | — | outputfrasubagent.md 90–243 |
| 7 | Preklusjon-specific begrunnelse placeholder missing from dynamic table | MISSING | 1741–1749 | outputfrasubagent.md 364–366 |
| 8 | Subsidiær vurdering warning (when prekludert) not mentioned | MISSING | 1169–1171 | outputfrasubagent.md 306–310 |
| 9 | Positive "Varslet i tide" info alert not mentioned | MISSING | 1169–1171 | outputfrasubagent.md 300–304 |
| 10 | Footer §-ref "§25" is wrong for grunnlag response | INCORRECT | 1162 | outputfrasubagent.md 372–379 |
