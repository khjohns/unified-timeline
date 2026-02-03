/**
 * Seed Test Users Script
 *
 * Oppretter testbrukere i Supabase Auth og legger dem til i user_groups
 * med TE (entreprenør) eller BH (byggherre) rolle.
 *
 * Krever:
 * - SUPABASE_URL: Din Supabase prosjekt-URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (IKKE anon key)
 *
 * Kjør med: npm run seed:users
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Konfigurasjon
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Mangler miljøvariabler:')
  console.error('  SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗ mangler')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗ mangler')
  console.error('')
  console.error('Sett miljøvariabler før kjøring:')
  console.error('  export SUPABASE_URL="https://your-project.supabase.co"')
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"')
  process.exit(1)
}

// Supabase admin-klient med service role
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Godkjenningsroller for byggherre
type ApprovalRole = 'PL' | 'SL' | 'AL' | 'DU' | 'AD'

interface TestUser {
  username: string
  password: string
  group: 'entreprenør' | 'byggherre'
  displayName: string
  approvalRole?: ApprovalRole
  department?: string
}

// Testbrukere - 10 TE og 10 BH
const testUsers: TestUser[] = [
  // Entreprenør-brukere (TE)
  {
    username: 'te-prosjektleder',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Erik Prosjektleder',
    department: 'Prosjektledelse',
  },
  {
    username: 'te-anleggsleder',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Anna Anleggsleder',
    department: 'Anlegg',
  },
  {
    username: 'te-kalkyle',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Knut Kalkyle',
    department: 'Kalkulasjon',
  },
  {
    username: 'te-byggeleder',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Berit Byggeleder',
    department: 'Bygg',
  },
  {
    username: 'te-formann',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Fredrik Formann',
    department: 'Produksjon',
  },
  {
    username: 'te-okonomi',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Olga Økonomi',
    department: 'Økonomi',
  },
  {
    username: 'te-kvalitet',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Kristian Kvalitet',
    department: 'Kvalitet',
  },
  {
    username: 'te-hms',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Hilde HMS',
    department: 'HMS',
  },
  {
    username: 'te-innkjop',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Inge Innkjøp',
    department: 'Innkjøp',
  },
  {
    username: 'te-test',
    password: 'TeTest123!',
    group: 'entreprenør',
    displayName: 'Test Entreprenør',
    department: 'Test',
  },

  // Byggherre-brukere (BH) med ulike godkjenningsroller
  {
    username: 'bh-prosjektleder',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Pål Prosjektleder',
    approvalRole: 'PL',
    department: 'Prosjektavdeling',
  },
  {
    username: 'bh-seksjonsleder',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Siri Seksjonsleder',
    approvalRole: 'SL',
    department: 'Seksjon Bygg',
  },
  {
    username: 'bh-avdelingsleder',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Anders Avdelingsleder',
    approvalRole: 'AL',
    department: 'Avdeling Prosjekt',
  },
  {
    username: 'bh-direktor',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Dagny Direktør',
    approvalRole: 'DU',
    department: 'Direktørens kontor',
  },
  {
    username: 'bh-admin',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Admin Bruker',
    approvalRole: 'AD',
    department: 'Administrasjon',
  },
  {
    username: 'bh-kontroller',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Kari Kontroller',
    approvalRole: 'PL',
    department: 'Kontroll',
  },
  {
    username: 'bh-okonomi',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Ole Økonomi',
    approvalRole: 'SL',
    department: 'Økonomiavdeling',
  },
  {
    username: 'bh-juridisk',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Julie Juridisk',
    approvalRole: 'PL',
    department: 'Juridisk avdeling',
  },
  {
    username: 'bh-teknisk',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Terje Teknisk',
    approvalRole: 'PL',
    department: 'Teknisk avdeling',
  },
  {
    username: 'bh-test',
    password: 'BhTest123!',
    group: 'byggherre',
    displayName: 'Test Byggherre',
    approvalRole: 'PL',
    department: 'Test',
  },
]

interface SeedResult {
  success: boolean
  username: string
  email: string
  role: string
  error?: string
}

async function createTestUser(user: TestUser): Promise<SeedResult> {
  const email = `${user.username}@test.local`
  const role = user.group === 'byggherre' ? 'BH' : 'TE'

  try {
    // 1. Sjekk om bruker allerede eksisterer
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existing = existingUsers?.users.find((u) => u.email === email)

    if (existing) {
      // Bruker eksisterer - oppdater user_groups hvis nødvendig
      const { data: existingGroup } = await supabase
        .from('user_groups')
        .select('id')
        .eq('user_id', existing.id)
        .single()

      if (!existingGroup) {
        // Legg til i user_groups
        await supabase.from('user_groups').insert({
          user_id: existing.id,
          group_name: user.group,
          display_name: user.displayName,
          approval_role: user.approvalRole || null,
          department: user.department || null,
        })
      }

      return {
        success: true,
        username: user.username,
        email,
        role,
        error: 'Bruker eksisterte allerede',
      }
    }

    // 2. Opprett auth-bruker med Admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: user.password,
      email_confirm: true, // Hopp over e-postverifisering
      user_metadata: {
        username: user.username,
        display_name: user.displayName,
      },
    })

    if (authError) {
      return {
        success: false,
        username: user.username,
        email,
        role,
        error: `Auth-feil: ${authError.message}`,
      }
    }

    if (!authUser?.user) {
      return {
        success: false,
        username: user.username,
        email,
        role,
        error: 'Ingen bruker returnert fra auth',
      }
    }

    // 3. Legg til i user_groups tabell
    const { error: groupError } = await supabase.from('user_groups').insert({
      user_id: authUser.user.id,
      group_name: user.group,
      display_name: user.displayName,
      approval_role: user.approvalRole || null,
      department: user.department || null,
    })

    if (groupError) {
      // Rydd opp - slett auth-brukeren hvis gruppe-insert feiler
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return {
        success: false,
        username: user.username,
        email,
        role,
        error: `Gruppe-feil: ${groupError.message}`,
      }
    }

    return {
      success: true,
      username: user.username,
      email,
      role,
    }
  } catch (err) {
    return {
      success: false,
      username: user.username,
      email,
      role,
      error: `Uventet feil: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function seedAllUsers(): Promise<void> {
  console.log('='.repeat(60))
  console.log('  Seeder testbrukere til Supabase')
  console.log('='.repeat(60))
  console.log('')

  const results: SeedResult[] = []
  let successCount = 0
  let errorCount = 0

  for (const user of testUsers) {
    const result = await createTestUser(user)
    results.push(result)

    if (result.success) {
      successCount++
      const status = result.error ? '~' : '✓'
      console.log(`  ${status} ${result.username.padEnd(20)} ${result.role}  ${result.email}`)
      if (result.error) {
        console.log(`      (${result.error})`)
      }
    } else {
      errorCount++
      console.log(`  ✗ ${result.username.padEnd(20)} ${result.role}  FEILET`)
      console.log(`      ${result.error}`)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`  Resultat: ${successCount} OK, ${errorCount} feil`)
  console.log('='.repeat(60))
  console.log('')

  if (successCount > 0) {
    console.log('Innloggingsinformasjon:')
    console.log('')
    console.log('  Entreprenør (TE):')
    console.log('    Email:    te-prosjektleder@test.local')
    console.log('    Passord:  TeTest123!')
    console.log('')
    console.log('  Byggherre (BH):')
    console.log('    Email:    bh-prosjektleder@test.local')
    console.log('    Passord:  BhTest123!')
    console.log('')
    console.log('  Mønster: {username}@test.local')
    console.log('')
  }
}

// Kjør scriptet
seedAllUsers()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('Fatal feil:', err)
    process.exit(1)
  })
