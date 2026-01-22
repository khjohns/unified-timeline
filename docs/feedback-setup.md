# Feedback-system oppsett

Denne guiden forklarer hvordan du setter opp tilbakemeldingssystemet med e-postvarsling i Supabase.

## Oversikt

Systemet består av:
1. **FeedbackButton** - React-komponent i header for å sende tilbakemeldinger
2. **feedback-tabell** - Supabase-tabell som lagrer tilbakemeldinger
3. **Edge Function** - Deno-funksjon som sender e-postvarsling
4. **Database Webhook** - Trigger som kaller Edge Function ved ny feedback

## Steg 1: Kjør database-migrasjoner

```bash
# Via Supabase CLI
supabase db push

# Eller kjør SQL manuelt i Supabase Dashboard → SQL Editor
# Kjør innholdet i: supabase/migrations/20260122_create_feedback_table.sql
```

## Steg 2: Deploy Edge Function

```bash
# Installer Supabase CLI hvis du ikke har det
npm install -g supabase

# Logg inn
supabase login

# Link prosjektet (finn project-ref i Supabase Dashboard)
supabase link --project-ref <your-project-ref>

# Deploy Edge Function
supabase functions deploy send-feedback-notification
```

## Steg 3: Sett opp miljøvariabler for Edge Function

I Supabase Dashboard → Edge Functions → send-feedback-notification → Settings:

| Variabel | Beskrivelse | Eksempel |
|----------|-------------|----------|
| `SMTP_HOST` | SMTP-server hostname | `smtp.sendgrid.net` |
| `SMTP_PORT` | SMTP-port | `587` |
| `SMTP_USER` | SMTP-brukernavn | `apikey` |
| `SMTP_PASS` | SMTP-passord/API-nøkkel | `SG.xxx...` |
| `NOTIFICATION_EMAIL` | E-post som mottar varsler | `team@example.com` |
| `SMTP_FROM` | Avsender-e-post | `noreply@unified-timeline.no` |

### Anbefalte SMTP-leverandører

- **SendGrid** - Gratis tier med 100 e-post/dag
- **Resend** - Utviklervennlig, god gratis tier
- **Mailgun** - Pålitelig, god dokumentasjon
- **Amazon SES** - Billig ved stort volum

## Steg 4: Sett opp Database Webhook

I Supabase Dashboard:

1. Gå til **Database** → **Webhooks**
2. Klikk **Create a new webhook**
3. Fyll inn:
   - **Name**: `feedback-notification`
   - **Table**: `feedback`
   - **Events**: ✅ INSERT
   - **Type**: Supabase Edge Functions
   - **Edge Function**: `send-feedback-notification`
4. Klikk **Create webhook**

## Steg 5: Test systemet

1. Åpne applikasjonen
2. Klikk på snakkeboble-ikonet i header
3. Fyll inn og send tilbakemelding
4. Sjekk at:
   - Raden vises i `feedback`-tabellen i Supabase
   - E-postvarsling mottas

## Feilsøking

### Feedback lagres ikke
- Sjekk at Supabase er konfigurert i frontend (`.env`)
- Verifiser at tabellen er opprettet
- Sjekk browser console for feilmeldinger

### E-post sendes ikke
- Sjekk Edge Function logs i Supabase Dashboard
- Verifiser at alle miljøvariabler er satt
- Test SMTP-innstillingene med en SMTP-testtjeneste

### Webhook triggrer ikke
- Sjekk at webhook er aktiv i Dashboard
- Se etter feil i Database → Webhooks → Logs

## Administrasjon av tilbakemeldinger

Tilbakemeldinger kan administreres via Supabase Dashboard → Table Editor → feedback:

- **status**: `new` → `read` → `resolved` / `archived`
- Bruk filtre for å se ubehandlede (`status = 'new'`)
- Eksporter til CSV for rapportering

## Alternativ: Resend API

Hvis du foretrekker Resend fremfor tradisjonell SMTP, kan Edge Function endres:

```typescript
// Erstatt SMTPClient med Resend
import { Resend } from 'https://esm.sh/resend@1.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

await resend.emails.send({
  from: 'Unified Timeline <noreply@unified-timeline.no>',
  to: [notificationEmail],
  subject: subject,
  html: htmlContent,
});
```
