# Paragraf - Budsjett og Finansieringsmodell

> **Dato:** 2026-02-06
> **Status:** Besluttet

## Eksisterende infrastruktur

Paragraf deler infrastruktur med Unified Timeline-prosjektet. Disse kostnadene løper allerede:

| Tjeneste | Plan | Kostnad | Deles med |
|----------|------|---------|-----------|
| Render | Starter | $7/mnd | Unified Timeline backend |
| Supabase | Pro | $25/mnd | Unified Timeline database |

**Merkostnad for Paragraf: $0/mnd** ved lav bruk (delt compute og database).

## Inkrementelle kostnader

Kostnader som kun oppstår pga. Paragraf:

| Post | Kostnad | Trigger |
|------|---------|---------|
| Domene (paragraf.app) | ~$15/år | Ved lansering |
| Gemini embedding (initial) | ~$2 engangskostnad | Allerede gjort |
| Gemini embedding (re-sync) | ~$2 per gang | Ved lovendringer, ~månedlig |
| Gemini embedding (søk) | ~$0.15 per 20 000 søk | Per semantisk søk |
| Supabase storage overage | $0.125/GB over 8GB | Lovdata bruker ~240MB, langt under |
| Supabase egress overage | $0.09/GB over 50GB | Neglisjerbart ved normal bruk |

## Skaleringsscenarier

| Fase | Brukere/mnd | Søk/mnd | Ekstra kostnad | Total merkostnad |
|------|-------------|---------|----------------|------------------|
| **Soft launch** | 1-50 | ~2 000 | $0 | ~$1/mnd (domene) |
| **Vekst** | 50-200 | ~10 000 | $0 | ~$1/mnd |
| **Oppgradering nødvendig** | 200-1000 | ~50 000 | Render Standard +$18 | ~$19/mnd |
| **Seriøs trafikk** | 1000+ | ~200 000 | Render Pro +$78 | ~$79/mnd |

Render er flaskehalsen. Supabase Pro og Gemini free tier holder langt utover 1000 brukere.

## Når trenger Render oppgradering?

| Render-plan | RAM | CPU | Pris | Holder til |
|-------------|-----|-----|------|------------|
| Starter (nå) | 512MB | 0.1 | $7/mnd | ~100 samtidige |
| Standard | 1GB | 0.5 | $25/mnd | ~500 samtidige |
| Pro | 2GB | 1.0 | $85/mnd | ~2000 samtidige |

Merk: Render Starter deles med Unified Timeline. Ved høy Paragraf-trafikk kan det bli nødvendig med egen service.

## Finansieringsmodell

### Beslutning: Gratis + open source + valgfri støtte

| Tilgang | Kvote | Krav |
|---------|-------|------|
| Uten registrering | 200 oppslag/mnd (IP-basert) | Ingen |
| Med API-nøkkel | Ubegrenset | Gratis e-postregistrering |
| Self-host | Ubegrenset | Ingen (MIT-lisens) |

### Begrunnelse

1. **Data er offentlig** — NLOD 2.0, kan ikke ta betalt for data vi ikke eier
2. **Marginalkosten er neglisjerbar** — ~$0.0002 per oppslag
3. **Friksjon dreper adopsjon** — betaling er en barriere for et ukjent verktøy
4. **Open source gir distribusjon** — GitHub-stjerner, MCP-katalog, word of mouth
5. **Eksisterende infra dekker kostnadene** — Render og Supabase betales allerede

### Valgfri støtte

- GitHub Sponsors-lenke på landing page og README
- Ingen aggressive CTAer — bare en diskret lenke

### Når vurdere betaling

Innfør betalt tier **kun hvis**:
- \>500 aktive brukere/mnd
- Merkostnad overstiger $50/mnd
- Da: Pro-tier for heavy API-brukere, behold raus gratis-kvote

## Oppsummering

| Post | Årlig kostnad |
|------|---------------|
| Domene | ~$15 |
| Gemini re-embedding (~12 syncs) | ~$24 |
| Ekstra Render/Supabase | $0 (ved <200 brukere) |
| **Total år 1** | **~$40** |

Paragraf koster i praksis et domene og noen embedding-kjøringer. Resten er allerede betalt.
