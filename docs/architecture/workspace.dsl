/*
 * C4 Architecture Model - KOE System (Krav om Endringsordre)
 *
 * Structurizr DSL for Context and Container diagrams
 *
 * Usage:
 *   - View online: https://structurizr.com/dsl (paste this file)
 *   - CLI: structurizr-cli export -workspace workspace.dsl -format plantuml
 *   - VS Code: Install "Structurizr" extension for preview
 *
 * Created: 2025-12-20
 */

workspace "KOE System" "Digital samhandlingsplattform for endringsmeldinger i byggeprosjekter (NS 8407)" {

    model {
        # ===========================================================================
        # ACTORS (People)
        # ===========================================================================

        te = person "Totalentreprenør (TE)" "Sender krav om endring, dokumenterer grunnlag, vederlag og frist" "User"
        bh = person "Byggherre (BH)" "Vurderer og godkjenner/avslår krav via Port-modellen" "User"

        # ===========================================================================
        # EXTERNAL SYSTEMS
        # ===========================================================================

        catenda = softwareSystem "Catenda" "Prosjekthotell for BIM-samhandling. Håndterer topics, dokumenter og webhooks." "External System"

        # ===========================================================================
        # KOE SYSTEM (Software System)
        # ===========================================================================

        koeSystem = softwareSystem "KOE System" "Håndterer krav om endringsordre (KOE), forsering og endringsordrer etter NS 8407. Event Sourcing-arkitektur." {

            # -----------------------------------------------------------------------
            # CONTAINERS
            # -----------------------------------------------------------------------

            frontend = container "Frontend" "Single Page Application for KOE-skjemaer. Tre-spor modell (Grunnlag, Vederlag, Frist), tidslinje og PDF-generering." "React 19, TypeScript, Vite, Tailwind CSS" "Web Browser"

            backend = container "Backend API" "REST API med Event Sourcing og CQRS. Forretningsregler, state-projeksjon og Catenda-integrasjon." "Python 3.10+, Flask 3, Pydantic v2" "API"

            eventStore = container "Event Store" "Append-only log for alle events. Optimistisk låsing med versjonsnummer." "JSON-filer (dev) / Dataverse (prod)" "Database"

            # -----------------------------------------------------------------------
            # CONTAINER RELATIONSHIPS
            # -----------------------------------------------------------------------

            frontend -> backend "REST API (JSON)" "HTTPS"
            frontend -> backend "CloudEvents format" "Accept: application/cloudevents+json"

            backend -> eventStore "Append events, Read events" "File I/O / Dataverse API"
            backend -> catenda "Topics, Comments, Documents" "REST API (OAuth 2.0)"

            catenda -> backend "Webhooks (topic.created, etc.)" "HTTPS POST"
        }

        # ===========================================================================
        # SYSTEM RELATIONSHIPS
        # ===========================================================================

        te -> koeSystem "Registrerer krav, sender grunnlag/vederlag/frist"
        bh -> koeSystem "Vurderer krav, gir respons via Port-modellen"

        te -> catenda "Oppretter topic (varsel om endring)"
        bh -> catenda "Ser dokumenter og kommentarer"

        koeSystem -> catenda "Synkroniserer saker, laster opp PDF"
        catenda -> koeSystem "Sender webhooks ved nye topics"
    }

    views {
        # ===========================================================================
        # CONTEXT DIAGRAM (Level 1)
        # ===========================================================================

        systemContext koeSystem "SystemContext" "Oversikt over KOE-systemet og eksterne aktører" {
            include *
            autoLayout
        }

        # ===========================================================================
        # CONTAINER DIAGRAM (Level 2)
        # ===========================================================================

        container koeSystem "Containers" "Hovedkomponenter i KOE-systemet" {
            include *
            autoLayout
        }

        # ===========================================================================
        # STYLES
        # ===========================================================================

        styles {
            element "Software System" {
                background #1168bd
                color #ffffff
                shape RoundedBox
            }
            element "External System" {
                background #999999
                color #ffffff
                shape RoundedBox
            }
            element "Person" {
                background #08427b
                color #ffffff
                shape Person
            }
            element "User" {
                background #08427b
                color #ffffff
                shape Person
            }
            element "Container" {
                background #438dd5
                color #ffffff
                shape RoundedBox
            }
            element "Web Browser" {
                shape WebBrowser
            }
            element "Database" {
                shape Cylinder
            }
            element "API" {
                shape Hexagon
            }
            relationship "Relationship" {
                dashed false
            }
        }
    }

}
