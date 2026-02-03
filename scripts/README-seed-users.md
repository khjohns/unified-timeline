# Seed Test Users

Script for å opprette testbrukere i Supabase med TE (entreprenør) og BH (byggherre) roller.

## Forutsetninger

1. Supabase-prosjekt er satt opp
2. Migration `003_user_groups_table.sql` er kjørt i Supabase SQL Editor
3. Du har tilgang til Service Role Key (finnes i Supabase Dashboard > Settings > API)

## Kjøring

```bash
# Sett miljøvariabler
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Kjør scriptet
npm run seed:users
```

## Testbrukere

### Entreprenør (TE) - 10 brukere

| Brukernavn | Email | Passord | Avdeling |
|------------|-------|---------|----------|
| te-prosjektleder | te-prosjektleder@test.local | TeTest123! | Prosjektledelse |
| te-anleggsleder | te-anleggsleder@test.local | TeTest123! | Anlegg |
| te-kalkyle | te-kalkyle@test.local | TeTest123! | Kalkulasjon |
| te-byggeleder | te-byggeleder@test.local | TeTest123! | Bygg |
| te-formann | te-formann@test.local | TeTest123! | Produksjon |
| te-okonomi | te-okonomi@test.local | TeTest123! | Økonomi |
| te-kvalitet | te-kvalitet@test.local | TeTest123! | Kvalitet |
| te-hms | te-hms@test.local | TeTest123! | HMS |
| te-innkjop | te-innkjop@test.local | TeTest123! | Innkjøp |
| te-test | te-test@test.local | TeTest123! | Test |

### Byggherre (BH) - 10 brukere

| Brukernavn | Email | Passord | Godkjenningsrolle | Avdeling |
|------------|-------|---------|-------------------|----------|
| bh-prosjektleder | bh-prosjektleder@test.local | BhTest123! | PL | Prosjektavdeling |
| bh-seksjonsleder | bh-seksjonsleder@test.local | BhTest123! | SL | Seksjon Bygg |
| bh-avdelingsleder | bh-avdelingsleder@test.local | BhTest123! | AL | Avdeling Prosjekt |
| bh-direktor | bh-direktor@test.local | BhTest123! | DU | Direktørens kontor |
| bh-admin | bh-admin@test.local | BhTest123! | AD | Administrasjon |
| bh-kontroller | bh-kontroller@test.local | BhTest123! | PL | Kontroll |
| bh-okonomi | bh-okonomi@test.local | BhTest123! | SL | Økonomiavdeling |
| bh-juridisk | bh-juridisk@test.local | BhTest123! | PL | Juridisk avdeling |
| bh-teknisk | bh-teknisk@test.local | BhTest123! | PL | Teknisk avdeling |
| bh-test | bh-test@test.local | BhTest123! | PL | Test |

## Godkjenningsroller (BH)

| Rolle | Beskrivelse |
|-------|-------------|
| PL | Prosjektleder |
| SL | Seksjonsleder |
| AL | Avdelingsleder |
| DU | Direktør/Utbyggingsdirektør |
| AD | Administrator |

## Feilsøking

**"Mangler miljøvariabler"**
- Sjekk at du har satt både `SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY`

**"Auth-feil: User already registered"**
- Brukeren eksisterer allerede i Supabase Auth
- Scriptet vil forsøke å legge til i user_groups hvis mangler

**"Gruppe-feil: violates foreign key constraint"**
- Migration `003_user_groups_table.sql` er ikke kjørt
- Kjør migreringen i Supabase SQL Editor først

## Service Role Key

Service Role Key har full admin-tilgang til Supabase. Hold den hemmelig:
- Aldri commit til Git
- Bruk kun server-side (aldri i frontend)
- Roter nøkkelen hvis den lekkes
