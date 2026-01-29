#!/usr/bin/env python3
"""
OpenAPI Specification Generator

Generates openapi.yaml from Pydantic models and route definitions.
Framework-agnostic - works regardless of Flask, Azure Functions, etc.

NOTE: This is the source of truth for API documentation.
      The generated docs/openapi.yaml is the machine-readable spec.
      For human-readable docs, see docs/API.md (manually maintained).

      When adding new endpoints:
      1. Add the route to routes/*.py
      2. Add the path definition to generate_paths() in this file
      3. Run: python scripts/generate_openapi.py
      4. Consider updating docs/API.md for detailed examples

Usage:
    python scripts/generate_openapi.py
    python scripts/generate_openapi.py --output docs/openapi.yaml
"""

import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import yaml

# Import Pydantic models
from models.events import (
    # Enums
    EventType,
    VederlagsMetode,
    FristVarselType,
    SporStatus,
    GrunnlagResponsResultat,
    VederlagBeregningResultat,
    FristBeregningResultat,
    SubsidiaerTrigger,
    # Data models
    GrunnlagData,
    VederlagData,
    FristData,
    GrunnlagResponsData,
    VederlagResponsData,
    FristResponsData,
)

# Import constants for documentation
from constants import (
    get_alle_hovedkategorier,
)


# =============================================================================
# CONFIGURATION
# =============================================================================

API_INFO = {
    "title": "KOE Backend API",
    "description": """
Event Sourcing API for NS 8407 change order claims (Krav om Endringsordre).

## Authentication
- **CSRF Token**: Required for POST/PUT/DELETE via `X-CSRF-Token` header
- **Magic Link**: Required for case operations via `Authorization: Bearer <token>` header

## Event Sourcing
All state changes are recorded as immutable events. State is computed by replaying events.
Optimistic concurrency control via `expected_version` prevents conflicts.
""".strip(),
    "version": "1.0.0",
    "contact": {
        "name": "KOE Development Team"
    }
}

SERVERS = [
    {"url": "http://localhost:8080", "description": "Local development"},
]

TAGS = [
    {"name": "Events", "description": "Event submission and case state management"},
    {"name": "CloudEvents", "description": "CloudEvents v1.0 support - schemas and format negotiation"},
    {"name": "Forsering", "description": "Forsering (acceleration) cases per NS 8407 §33.8"},
    {"name": "Endringsordre", "description": "Endringsordre (change order) cases per NS 8407 §31.3"},
    {"name": "Utility", "description": "Authentication and utility endpoints"},
    {"name": "Webhooks", "description": "Catenda webhook integration"},
]


# =============================================================================
# SCHEMA GENERATION
# =============================================================================

def pydantic_to_openapi_schema(model_class) -> Dict[str, Any]:
    """
    Convert Pydantic model to OpenAPI-compatible schema.

    Pydantic v2 generates JSON Schema draft 2020-12, but OpenAPI 3.0 uses
    a subset. This function adapts the output.
    """
    schema = model_class.model_json_schema(mode='serialization')

    # Remove JSON Schema specific fields not in OpenAPI 3.0
    def clean_schema(obj):
        if isinstance(obj, dict):
            # Remove unsupported keys
            keys_to_remove = ['$defs', '$schema']
            for key in keys_to_remove:
                obj.pop(key, None)

            # Recursively clean nested objects
            for key, value in list(obj.items()):
                obj[key] = clean_schema(value)
        elif isinstance(obj, list):
            return [clean_schema(item) for item in obj]
        return obj

    return clean_schema(schema)


def generate_enum_schema(enum_class, description: str = "") -> Dict[str, Any]:
    """Generate OpenAPI schema for an Enum."""
    return {
        "type": "string",
        "enum": [e.value for e in enum_class],
        "description": description
    }


def generate_schemas() -> Dict[str, Any]:
    """Generate all component schemas from Pydantic models."""
    schemas = {}

    # Enums
    schemas["EventType"] = generate_enum_schema(
        EventType,
        "Type of event in the system"
    )
    schemas["VederlagsMetode"] = {
        "type": "string",
        "enum": [m.value for m in VederlagsMetode],
        "description": """
Compensation method (NS 8407):
- ENHETSPRISER: Unit prices (§34.3)
- REGNINGSARBEID: Cost-plus with estimate (§30.2/§34.4)
- FASTPRIS_TILBUD: Fixed price / Tender (§34.2.1)
""".strip()
    }
    schemas["FristVarselType"] = {
        "type": "string",
        "enum": [t.value for t in FristVarselType],
        "description": """
Warning type for deadline extension:
- noytralt: Preliminary warning (§33.4)
- spesifisert: Specified claim with days (§33.6.1)
- begge: Both preliminary and specified
""".strip()
    }

    # Add hovedkategori with valid values
    schemas["Hovedkategori"] = {
        "type": "string",
        "enum": get_alle_hovedkategorier(),
        "description": """
Main category for grounds (NS 8407 §33.1):
- ENDRING: Changes (§33.1 a)
- SVIKT: Delay/failure by client (§33.1 b)
- ANDRE: Other circumstances (§33.1 c)
- FORCE_MAJEURE: Force majeure (§33.3)
""".strip()
    }

    # Response result enums
    schemas["SporStatus"] = generate_enum_schema(
        SporStatus,
        "Status for each track (spor) in a case"
    )
    schemas["GrunnlagResponsResultat"] = {
        "type": "string",
        "enum": [r.value for r in GrunnlagResponsResultat],
        "description": """
BH's assessment of grounds (ansvar):
- godkjent: BH accepts responsibility
- delvis_godkjent: BH partially accepts
- avslatt: BH rejects responsibility
- frafalt: BH withdraws instruction (§32.3 c, irregular changes only)
""".strip()
    }
    schemas["VederlagBeregningResultat"] = {
        "type": "string",
        "enum": [r.value for r in VederlagBeregningResultat],
        "description": """
BH's assessment of compensation claim:
- godkjent: BH accepts the claim
- delvis_godkjent: BH partially accepts (disagreement on amount/method)
- avslatt: BH rejects the claim
- hold_tilbake: §30.2 withholding (missing estimate only)
""".strip()
    }
    schemas["FristBeregningResultat"] = {
        "type": "string",
        "enum": [r.value for r in FristBeregningResultat],
        "description": """
BH's assessment of deadline extension claim:
- godkjent: BH accepts the claim
- delvis_godkjent: BH partially accepts (disagreement on days)
- avslatt: BH rejects the claim
""".strip()
    }
    schemas["SubsidiaerTrigger"] = {
        "type": "string",
        "enum": [t.value for t in SubsidiaerTrigger],
        "description": """
Reasons for subsidiary assessment (when BH takes principal position but also states
what the result would be if principal position doesn't hold):
- grunnlag_avslatt: BH rejected grounds
- grunnlag_prekludert_32_2: Grounds notice too late (§32.2, ENDRING only)
- forseringsrett_avslatt: TE has no acceleration right (§33.8)
- preklusjon_*: Various late notice triggers (§34.1.2, §34.1.3, §33.4, §33.6)
- ingen_hindring: No actual hindrance (§33.5)
- metode_avslatt: BH rejects proposed method
""".strip()
    }

    # Data models from Pydantic
    schemas["GrunnlagData"] = pydantic_to_openapi_schema(GrunnlagData)
    schemas["VederlagData"] = pydantic_to_openapi_schema(VederlagData)
    schemas["FristData"] = pydantic_to_openapi_schema(FristData)
    schemas["GrunnlagResponsData"] = pydantic_to_openapi_schema(GrunnlagResponsData)
    schemas["VederlagResponsData"] = pydantic_to_openapi_schema(VederlagResponsData)
    schemas["FristResponsData"] = pydantic_to_openapi_schema(FristResponsData)

    # Common schemas
    schemas["Error"] = {
        "type": "object",
        "properties": {
            "success": {"type": "boolean", "example": False},
            "error": {"type": "string", "description": "Error code"},
            "message": {"type": "string", "description": "Human-readable message"},
            "field": {"type": "string", "description": "Field that caused the error"},
            "valid_options": {
                "type": "object",
                "description": "Valid options when validation fails"
            }
        },
        "required": ["success", "error", "message"]
    }

    schemas["VersionConflictError"] = {
        "type": "object",
        "properties": {
            "success": {"type": "boolean", "example": False},
            "error": {"type": "string", "example": "VERSION_CONFLICT"},
            "expected_version": {"type": "integer"},
            "current_version": {"type": "integer"},
            "message": {"type": "string"}
        }
    }

    schemas["ConcurrencyConflictError"] = {
        "type": "object",
        "description": "Returned when optimistic concurrency check fails (409)",
        "properties": {
            "success": {"type": "boolean", "example": False},
            "error": {"type": "string", "example": "CONCURRENCY_CONFLICT"},
            "message": {"type": "string", "example": "Versjonskonflikt: forventet 3, fikk 4"},
            "expected_version": {"type": "integer"},
            "actual_version": {"type": "integer"}
        }
    }

    schemas["CatendaSyncStatus"] = {
        "type": "object",
        "description": "Status for Catenda synchronization (comment + status update)",
        "properties": {
            "catenda_synced": {
                "type": "boolean",
                "description": "Whether the event was successfully synced to Catenda"
            },
            "catenda_comment_posted": {
                "type": "boolean",
                "description": "Whether a comment was posted to the Catenda topic"
            },
            "catenda_status_updated": {
                "type": "boolean",
                "description": "Whether the topic status was updated in Catenda"
            },
            "catenda_skipped_reason": {
                "type": "string",
                "enum": ["no_topic_id", "not_authenticated", "no_client", "sync_not_attempted", "error"],
                "nullable": True,
                "description": "Reason why sync was skipped (if catenda_synced=false)"
            },
            "catenda_error": {
                "type": "string",
                "nullable": True,
                "description": "Error message if sync failed"
            }
        }
    }

    # Request/Response schemas
    schemas["EventSubmission"] = {
        "type": "object",
        "required": ["sak_id", "expected_version", "event"],
        "properties": {
            "sak_id": {
                "type": "string",
                "example": "SAK-20251218-001",
                "description": "Case identifier"
            },
            "expected_version": {
                "type": "integer",
                "minimum": 0,
                "description": "Expected current version (optimistic concurrency)"
            },
            "event": {"$ref": "#/components/schemas/Event"},
            "catenda_topic_id": {
                "type": "string",
                "format": "uuid",
                "description": "Optional Catenda topic GUID for PDF upload"
            },
            "pdf_base64": {
                "type": "string",
                "format": "byte",
                "description": "Optional client-generated PDF (base64)"
            },
            "pdf_filename": {
                "type": "string",
                "description": "Optional PDF filename"
            }
        }
    }

    schemas["Event"] = {
        "type": "object",
        "required": ["event_type", "aktor", "aktor_rolle", "data"],
        "properties": {
            "event_type": {"$ref": "#/components/schemas/EventType"},
            "aktor": {
                "type": "string",
                "description": "Name of person performing the action"
            },
            "aktor_rolle": {
                "type": "string",
                "enum": ["TE", "BH"],
                "description": "Role: TE=Totalentreprenør, BH=Byggherre"
            },
            "data": {
                "type": "object",
                "description": "Event-specific data (GrunnlagData, VederlagData, etc.)"
            }
        }
    }

    schemas["EventSubmissionResponse"] = {
        "type": "object",
        "properties": {
            "success": {"type": "boolean", "example": True},
            "event_id": {"type": "string", "format": "uuid"},
            "new_version": {"type": "integer"},
            "state": {
                "type": "object",
                "description": "Computed case state after event"
            },
            "pdf_uploaded": {"type": "boolean"},
            "pdf_source": {
                "type": "string",
                "enum": ["client", "server"],
                "nullable": True
            }
        }
    }

    schemas["CaseStateResponse"] = {
        "type": "object",
        "properties": {
            "version": {
                "type": "integer",
                "description": "Current version for optimistic concurrency"
            },
            "state": {
                "type": "object",
                "description": "Computed case state"
            }
        }
    }

    schemas["CaseListItem"] = {
        "type": "object",
        "properties": {
            "sak_id": {
                "type": "string",
                "example": "SAK-20251218-001",
                "description": "Case identifier"
            },
            "sakstype": {
                "type": "string",
                "enum": ["standard", "forsering", "endringsordre"],
                "description": "Case type"
            },
            "cached_title": {
                "type": "string",
                "nullable": True,
                "description": "Cached case title"
            },
            "cached_status": {
                "type": "string",
                "nullable": True,
                "description": "Cached overall status"
            },
            "created_at": {
                "type": "string",
                "format": "date-time",
                "nullable": True,
                "description": "Case creation timestamp"
            },
            "created_by": {
                "type": "string",
                "description": "Email of creator"
            },
            "last_event_at": {
                "type": "string",
                "format": "date-time",
                "nullable": True,
                "description": "Timestamp of most recent event"
            }
        }
    }

    schemas["CaseListResponse"] = {
        "type": "object",
        "properties": {
            "cases": {
                "type": "array",
                "items": {"$ref": "#/components/schemas/CaseListItem"},
                "description": "List of case metadata"
            }
        }
    }

    # CloudEvents schemas
    schemas["CloudEvent"] = {
        "type": "object",
        "description": "CloudEvents v1.0 structured content format",
        "required": ["specversion", "id", "source", "type"],
        "properties": {
            "specversion": {
                "type": "string",
                "example": "1.0",
                "description": "CloudEvents specification version"
            },
            "id": {
                "type": "string",
                "format": "uuid",
                "description": "Unique event identifier"
            },
            "source": {
                "type": "string",
                "example": "/projects/P-2025-001/cases/KOE-2025-042",
                "description": "Source URI: /projects/{prosjekt_id}/cases/{sak_id}"
            },
            "type": {
                "type": "string",
                "example": "no.oslo.koe.grunnlag_opprettet",
                "description": "Event type with namespace"
            },
            "time": {
                "type": "string",
                "format": "date-time",
                "description": "Event timestamp in RFC 3339 format"
            },
            "subject": {
                "type": "string",
                "description": "Subject identifier (sak_id)"
            },
            "datacontenttype": {
                "type": "string",
                "example": "application/json",
                "description": "Content type of data attribute"
            },
            "dataschema": {
                "type": "string",
                "format": "uri",
                "description": "URI to JSON Schema for data payload"
            },
            "actor": {
                "type": "string",
                "description": "Extension: Name of person who performed the action"
            },
            "actorrole": {
                "type": "string",
                "enum": ["TE", "BH"],
                "description": "Extension: Role (TE=Totalentreprenor, BH=Byggherre)"
            },
            "referstoid": {
                "type": "string",
                "description": "Extension: Reference to another event ID"
            },
            "data": {
                "type": "object",
                "description": "Event-specific data payload"
            }
        }
    }

    schemas["CloudEventsTimelineResponse"] = {
        "type": "object",
        "description": "Timeline response in CloudEvents format (Accept: application/cloudevents+json)",
        "properties": {
            "version": {
                "type": "integer",
                "description": "Current version for optimistic concurrency"
            },
            "events": {
                "type": "array",
                "items": {"$ref": "#/components/schemas/CloudEvent"},
                "description": "List of events in CloudEvents format"
            }
        }
    }

    return schemas


# =============================================================================
# PATH DEFINITIONS
# =============================================================================

def generate_paths() -> Dict[str, Any]:
    """Generate OpenAPI paths from route definitions."""
    paths = {}

    # Utility endpoints
    paths["/api/csrf-token"] = {
        "get": {
            "tags": ["Utility"],
            "summary": "Get CSRF token",
            "description": "Retrieve a CSRF token for state-changing requests",
            "operationId": "getCsrfToken",
            "responses": {
                "200": {
                    "description": "CSRF token generated",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "csrfToken": {"type": "string"},
                                    "expiresIn": {"type": "integer", "example": 3600}
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/magic-link/verify"] = {
        "get": {
            "tags": ["Utility"],
            "summary": "Verify magic link token",
            "operationId": "verifyMagicLink",
            "parameters": [
                {
                    "name": "token",
                    "in": "query",
                    "required": True,
                    "schema": {"type": "string"}
                }
            ],
            "responses": {
                "200": {
                    "description": "Token is valid",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean"},
                                    "sakId": {"type": "string"}
                                }
                            }
                        }
                    }
                },
                "403": {
                    "description": "Invalid or expired token",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    }
                }
            }
        }
    }

    paths["/api/health"] = {
        "get": {
            "tags": ["Utility"],
            "summary": "Health check",
            "operationId": "healthCheck",
            "responses": {
                "200": {
                    "description": "Service is healthy",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "status": {"type": "string", "example": "healthy"},
                                    "service": {"type": "string", "example": "koe-backend"}
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/metadata/by-topic/{topic_id}"] = {
        "get": {
            "tags": ["Utility"],
            "summary": "Get case metadata by Catenda topic ID",
            "description": "Retrieve case metadata based on Catenda topic ID. Used by test scripts to verify webhook processing.",
            "operationId": "getMetadataByTopic",
            "parameters": [
                {
                    "name": "topic_id",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string", "format": "uuid"},
                    "description": "Catenda topic GUID"
                }
            ],
            "responses": {
                "200": {
                    "description": "Case metadata found",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "sak_id": {"type": "string", "example": "SAK-20251218-001"},
                                    "catenda_topic_id": {"type": "string", "format": "uuid"},
                                    "cached_title": {"type": "string", "nullable": True},
                                    "cached_status": {"type": "string", "nullable": True},
                                    "created_at": {"type": "string", "format": "date-time", "nullable": True}
                                }
                            }
                        }
                    }
                },
                "404": {
                    "description": "No case found for topic",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "error": {"type": "string", "example": "No case found for topic"},
                                    "topic_id": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/validate-user"] = {
        "post": {
            "tags": ["Utility"],
            "summary": "Validate user in Catenda project",
            "description": "Validates if an email belongs to a user in the Catenda project. Used to verify users before allowing them to sign forms.",
            "operationId": "validateUser",
            "security": [{"csrfToken": []}],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["email", "sakId"],
                            "properties": {
                                "email": {"type": "string", "format": "email", "description": "User email to validate"},
                                "sakId": {"type": "string", "description": "Case ID to check project membership against"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "User found in project",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean", "example": True},
                                    "name": {"type": "string", "description": "User's full name"},
                                    "email": {"type": "string", "format": "email"},
                                    "company": {"type": "string", "description": "User's company"}
                                }
                            }
                        }
                    }
                },
                "400": {
                    "description": "Missing required parameters",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    }
                },
                "404": {
                    "description": "User not found in project or case not found",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean", "example": False},
                                    "error": {"type": "string", "example": "Brukeren er ikke medlem i dette Catenda-prosjektet."}
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    # Events API
    paths["/api/events"] = {
        "post": {
            "tags": ["Events"],
            "summary": "Submit event",
            "description": """
Submit a single event to a case with optimistic concurrency control.

**Business Rules:**
- Grunnlag must be submitted before vederlag/frist claims
- Version must match current state version
""".strip(),
            "operationId": "submitEvent",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/EventSubmission"},
                        "examples": {
                            "grunnlag": {
                                "summary": "Submit grunnlag",
                                "value": {
                                    "sak_id": "SAK-20251218-001",
                                    "expected_version": 1,
                                    "event": {
                                        "event_type": "grunnlag_opprettet",
                                        "aktor": "Ola Nordmann",
                                        "aktor_rolle": "TE",
                                        "data": {
                                            "tittel": "Forsinket tegningsunderlag uke 45",
                                            "hovedkategori": "ENDRING",
                                            "underkategori": "IRREG",
                                            "beskrivelse": "Mottok pålegg om endring",
                                            "dato_oppdaget": "2025-12-18"
                                        }
                                    }
                                }
                            },
                            "vederlag": {
                                "summary": "Submit vederlag",
                                "value": {
                                    "sak_id": "SAK-20251218-001",
                                    "expected_version": 2,
                                    "event": {
                                        "event_type": "vederlag_krav_sendt",
                                        "aktor": "Ola Nordmann",
                                        "aktor_rolle": "TE",
                                        "data": {
                                            "metode": "ENHETSPRISER",
                                            "belop_direkte": 150000.0,
                                            "begrunnelse": "Tillegg for endring"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "responses": {
                "201": {
                    "description": "Event submitted successfully",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/EventSubmissionResponse"}
                        }
                    }
                },
                "400": {
                    "description": "Validation error or business rule violation",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"},
                            "examples": {
                                "validation": {
                                    "summary": "Validation error with valid options",
                                    "value": {
                                        "success": False,
                                        "error": "VALIDATION_ERROR",
                                        "message": "Ugyldig underkategori 'INSTRUKS' for hovedkategori 'ENDRING'",
                                        "field": "underkategori",
                                        "valid_options": {
                                            "hovedkategori": "ENDRING",
                                            "underkategorier": ["EO", "IRREG", "SVAR_VARSEL", "LOV_GJENSTAND", "LOV_PROSESS", "GEBYR", "SAMORD"]
                                        }
                                    }
                                },
                                "business_rule": {
                                    "summary": "Business rule violation",
                                    "value": {
                                        "success": False,
                                        "error": "BUSINESS_RULE_VIOLATION",
                                        "rule": "GRUNNLAG_REQUIRED",
                                        "message": "Grunnlag må være sendt før du kan sende krav"
                                    }
                                }
                            }
                        }
                    }
                },
                "401": {
                    "description": "Missing or invalid authentication",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    }
                },
                "409": {
                    "description": "Version conflict",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/VersionConflictError"}
                        }
                    }
                }
            }
        }
    }

    paths["/api/events/batch"] = {
        "post": {
            "tags": ["Events"],
            "summary": "Submit batch of events",
            "description": "Submit multiple events atomically (all-or-nothing)",
            "operationId": "submitEventBatch",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["sak_id", "expected_version", "events"],
                            "properties": {
                                "sak_id": {"type": "string"},
                                "expected_version": {"type": "integer"},
                                "events": {
                                    "type": "array",
                                    "items": {"$ref": "#/components/schemas/Event"}
                                }
                            }
                        }
                    }
                }
            },
            "responses": {
                "201": {"description": "All events submitted"},
                "400": {"description": "Validation error"},
                "409": {"description": "Version conflict"}
            }
        }
    }

    # Case list endpoint
    paths["/api/cases"] = {
        "get": {
            "tags": ["Events"],
            "summary": "List all cases",
            "description": """
List all cases with metadata from the sak_metadata table.

Supports filtering by case type (sakstype).
Results are sorted by last_event_at descending (most recent first).
""".strip(),
            "operationId": "listCases",
            "security": [{"magicLink": []}],
            "parameters": [
                {
                    "name": "sakstype",
                    "in": "query",
                    "required": False,
                    "schema": {
                        "type": "string",
                        "enum": ["standard", "forsering", "endringsordre"]
                    },
                    "description": "Filter by case type"
                }
            ],
            "responses": {
                "200": {
                    "description": "List of cases",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/CaseListResponse"}
                        }
                    }
                }
            }
        }
    }

    # Case state endpoints
    paths["/api/cases/{sak_id}/state"] = {
        "get": {
            "tags": ["Events"],
            "summary": "Get case state",
            "description": "Get computed state for a case",
            "operationId": "getCaseState",
            "security": [{"magicLink": []}],
            "parameters": [
                {
                    "name": "sak_id",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"},
                    "example": "SAK-20251218-001"
                }
            ],
            "responses": {
                "200": {
                    "description": "Case state",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/CaseStateResponse"}
                        }
                    }
                },
                "404": {"description": "Case not found"}
            }
        }
    }

    paths["/api/cases/{sak_id}/timeline"] = {
        "get": {
            "tags": ["Events"],
            "summary": "Get case timeline",
            "description": "Get full event timeline for UI display",
            "operationId": "getCaseTimeline",
            "security": [{"magicLink": []}],
            "parameters": [
                {
                    "name": "sak_id",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"}
                }
            ],
            "responses": {
                "200": {"description": "Event timeline"},
                "404": {"description": "Case not found"}
            }
        }
    }

    paths["/api/cases/{sak_id}/historikk"] = {
        "get": {
            "tags": ["Events"],
            "summary": "Get case history",
            "description": "Get revision history for vederlag and frist tracks",
            "operationId": "getCaseHistory",
            "security": [{"magicLink": []}],
            "parameters": [
                {
                    "name": "sak_id",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"}
                }
            ],
            "responses": {
                "200": {"description": "Revision history"},
                "404": {"description": "Case not found"}
            }
        }
    }

    # Webhook
    paths["/webhook/catenda/{secret_path}"] = {
        "post": {
            "tags": ["Webhooks"],
            "summary": "Catenda webhook",
            "description": """
Receives webhook events from Catenda.

**Note:** Topics created via API may not trigger webhooks from Catenda.
""".strip(),
            "operationId": "catendaWebhook",
            "parameters": [
                {
                    "name": "secret_path",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"},
                    "description": "Secret path for webhook authentication"
                }
            ],
            "requestBody": {
                "content": {
                    "application/json": {
                        "schema": {"type": "object"}
                    }
                }
            },
            "responses": {
                "200": {"description": "Webhook processed"},
                "401": {"description": "Invalid secret path"}
            }
        }
    }

    # =========================================================================
    # FORSERING API (§33.8)
    # =========================================================================

    paths["/api/forsering/opprett"] = {
        "post": {
            "tags": ["Forsering"],
            "summary": "Create forsering case",
            "description": """
Create a new forsering (acceleration) case based on rejected deadline extensions.

Per NS 8407 §33.8: When BH rejects a justified deadline extension claim,
TE can treat it as an order to accelerate if the cost is within 30% of
the liquidated damages that would have accrued.
""".strip(),
            "operationId": "createForsering",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["avslatte_sak_ids", "estimert_kostnad", "dagmulktsats", "begrunnelse"],
                            "properties": {
                                "avslatte_sak_ids": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "IDs of rejected deadline extension cases"
                                },
                                "estimert_kostnad": {"type": "number", "description": "Estimated acceleration cost"},
                                "dagmulktsats": {"type": "number", "description": "Liquidated damages rate per day"},
                                "begrunnelse": {"type": "string", "description": "Justification"},
                                "avslatte_dager": {"type": "integer", "description": "Total rejected days (auto-calculated if omitted)"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "201": {"description": "Forsering case created"},
                "400": {"description": "Validation error (e.g., cost exceeds 30% limit)"}
            }
        }
    }

    paths["/api/forsering/kandidater"] = {
        "get": {
            "tags": ["Forsering"],
            "summary": "Get candidate KOE cases for forsering",
            "description": """
Get KOE cases that can be used for a forsering claim.

A KOE is a candidate if:
- It has sakstype='standard' (not forsering/endringsordre)
- The deadline claim was rejected by BH (bh_resultat='avslatt')

**Note:** No authentication required for this endpoint.
""".strip(),
            "operationId": "getForseringKandidater",
            "responses": {
                "200": {
                    "description": "List of candidate cases",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean"},
                                    "kandidat_saker": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "sak_id": {"type": "string"},
                                                "tittel": {"type": "string"},
                                                "avslatte_dager": {"type": "integer"},
                                                "catenda_topic_id": {"type": "string"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/forsering/{sak_id}/kontekst"] = {
        "get": {
            "tags": ["Forsering"],
            "summary": "Get forsering context",
            "description": "Get complete context including related cases, states, and events",
            "operationId": "getForseringKontekst",
            "security": [{"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "responses": {
                "200": {"description": "Forsering context with related cases"}
            }
        }
    }

    paths["/api/forsering/valider"] = {
        "post": {
            "tags": ["Forsering"],
            "summary": "Validate 30% rule",
            "description": "Check if estimated cost is within the 30% limit (dagmulkt + 30%)",
            "operationId": "validateForsering",
            "security": [{"magicLink": []}],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["estimert_kostnad", "avslatte_dager", "dagmulktsats"],
                            "properties": {
                                "estimert_kostnad": {"type": "number"},
                                "avslatte_dager": {"type": "integer"},
                                "dagmulktsats": {"type": "number"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "Validation result",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean"},
                                    "er_gyldig": {"type": "boolean"},
                                    "maks_kostnad": {"type": "number"},
                                    "prosent_av_maks": {"type": "number"}
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/forsering/{sak_id}/relaterte"] = {
        "get": {
            "tags": ["Forsering"],
            "summary": "Get related cases for forsering",
            "description": "Get all KOE cases related to a forsering case (rejected frist claims)",
            "operationId": "getForseringRelaterte",
            "security": [{"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "responses": {
                "200": {
                    "description": "List of related cases",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean"},
                                    "sak_id": {"type": "string"},
                                    "relaterte_saker": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "relatert_sak_id": {"type": "string"},
                                                "relatert_sak_tittel": {"type": "string"},
                                                "bimsync_issue_board_ref": {"type": "string"},
                                                "bimsync_issue_number": {"type": "integer"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/forsering/{sak_id}/relatert"] = {
        "post": {
            "tags": ["Forsering"],
            "summary": "Add related case to forsering",
            "description": "Add a KOE case as related to the forsering",
            "operationId": "addForseringRelatert",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["koe_sak_id"],
                            "properties": {
                                "koe_sak_id": {"type": "string", "description": "ID of KOE case to add"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "200": {"description": "KOE added to forsering"}
            }
        }
    }

    paths["/api/forsering/{sak_id}/relatert/{koe_sak_id}"] = {
        "delete": {
            "tags": ["Forsering"],
            "summary": "Remove related case from forsering",
            "operationId": "removeForseringRelatert",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}},
                {"name": "koe_sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "responses": {
                "200": {"description": "KOE removed from forsering"}
            }
        }
    }

    paths["/api/forsering/{sak_id}/bh-respons"] = {
        "post": {
            "tags": ["Forsering"],
            "summary": "Register BH response to forsering",
            "description": "BH accepts or rejects the forsering claim",
            "operationId": "bhResponsForsering",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["aksepterer", "begrunnelse"],
                            "properties": {
                                "aksepterer": {"type": "boolean", "description": "Whether BH accepts the forsering"},
                                "godkjent_kostnad": {"type": "number", "description": "Approved cost (may be lower than estimated)"},
                                "begrunnelse": {"type": "string", "description": "Justification for decision"},
                                "expected_version": {"type": "integer", "description": "Expected version for optimistic concurrency"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "BH response registered",
                    "content": {
                        "application/json": {
                            "schema": {
                                "allOf": [
                                    {
                                        "type": "object",
                                        "properties": {
                                            "success": {"type": "boolean"},
                                            "message": {"type": "string"},
                                            "state": {"type": "object"},
                                            "version": {"type": "integer"}
                                        }
                                    },
                                    {"$ref": "#/components/schemas/CatendaSyncStatus"}
                                ]
                            }
                        }
                    }
                },
                "409": {
                    "description": "Concurrency conflict - version mismatch",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/ConcurrencyConflictError"}
                        }
                    }
                }
            }
        }
    }

    paths["/api/forsering/{sak_id}/stopp"] = {
        "post": {
            "tags": ["Forsering"],
            "summary": "Stop active forsering",
            "description": "Stop an ongoing forsering and record incurred costs",
            "operationId": "stoppForsering",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["begrunnelse"],
                            "properties": {
                                "begrunnelse": {"type": "string", "description": "Reason for stopping"},
                                "paalopte_kostnader": {"type": "number", "description": "Incurred costs at time of stop"},
                                "expected_version": {"type": "integer", "description": "Expected version for optimistic concurrency"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "Forsering stopped",
                    "content": {
                        "application/json": {
                            "schema": {
                                "allOf": [
                                    {
                                        "type": "object",
                                        "properties": {
                                            "success": {"type": "boolean"},
                                            "message": {"type": "string"},
                                            "dato_stoppet": {"type": "string", "format": "date"},
                                            "state": {"type": "object"},
                                            "version": {"type": "integer"}
                                        }
                                    },
                                    {"$ref": "#/components/schemas/CatendaSyncStatus"}
                                ]
                            }
                        }
                    }
                },
                "409": {
                    "description": "Concurrency conflict - version mismatch",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/ConcurrencyConflictError"}
                        }
                    }
                }
            }
        }
    }

    paths["/api/forsering/{sak_id}/kostnader"] = {
        "put": {
            "tags": ["Forsering"],
            "summary": "Update incurred costs",
            "description": "Update the incurred costs for an active forsering",
            "operationId": "oppdaterForseringKostnader",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["paalopte_kostnader"],
                            "properties": {
                                "paalopte_kostnader": {"type": "number", "description": "Current incurred costs"},
                                "kommentar": {"type": "string", "description": "Optional comment on update"},
                                "expected_version": {"type": "integer", "description": "Expected version for optimistic concurrency"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "Costs updated",
                    "content": {
                        "application/json": {
                            "schema": {
                                "allOf": [
                                    {
                                        "type": "object",
                                        "properties": {
                                            "success": {"type": "boolean"},
                                            "message": {"type": "string"},
                                            "state": {"type": "object"},
                                            "version": {"type": "integer"}
                                        }
                                    },
                                    {"$ref": "#/components/schemas/CatendaSyncStatus"}
                                ]
                            }
                        }
                    }
                },
                "409": {
                    "description": "Concurrency conflict - version mismatch",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/ConcurrencyConflictError"}
                        }
                    }
                }
            }
        }
    }

    paths["/api/forsering/by-relatert/{sak_id}"] = {
        "get": {
            "tags": ["Forsering"],
            "summary": "Find forsering cases referencing a KOE",
            "description": "Find all forsering cases that reference a given KOE case. Used for back-links.",
            "operationId": "findForseringerForSak",
            "security": [{"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}, "description": "KOE case ID to search for"}
            ],
            "responses": {
                "200": {
                    "description": "List of forsering cases referencing this KOE",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean"},
                                    "forseringer": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "forsering_sak_id": {"type": "string"},
                                                "tittel": {"type": "string"},
                                                "status": {"type": "string"},
                                                "estimert_kostnad": {"type": "number"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    # =========================================================================
    # ENDRINGSORDRE API (§31.3)
    # =========================================================================

    paths["/api/endringsordre/opprett"] = {
        "post": {
            "tags": ["Endringsordre"],
            "summary": "Create endringsordre case",
            "description": """
Create a new endringsordre (change order) case.

Per NS 8407 §31.3: An endringsordre is the formal document confirming
a contract change. It can aggregate multiple KOE cases.
""".strip(),
            "operationId": "createEndringsordre",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["eo_nummer", "beskrivelse"],
                            "properties": {
                                "eo_nummer": {"type": "string", "example": "EO-001"},
                                "beskrivelse": {"type": "string"},
                                "koe_sak_ids": {"type": "array", "items": {"type": "string"}},
                                "konsekvenser": {
                                    "type": "object",
                                    "properties": {
                                        "sha": {"type": "boolean"},
                                        "kvalitet": {"type": "boolean"},
                                        "fremdrift": {"type": "boolean"},
                                        "pris": {"type": "boolean"},
                                        "annet": {"type": "boolean"}
                                    }
                                },
                                "kompensasjon_belop": {"type": "number"},
                                "frist_dager": {"type": "integer"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "201": {"description": "Endringsordre created"},
                "400": {"description": "Validation error"}
            }
        }
    }

    paths["/api/endringsordre/kandidater"] = {
        "get": {
            "tags": ["Endringsordre"],
            "summary": "Get candidate KOE cases for endringsordre",
            "description": """
Get KOE cases that can be added to an endringsordre.

**Note:** No authentication required for this endpoint.
""".strip(),
            "operationId": "getEOKandidater",
            "responses": {
                "200": {
                    "description": "List of candidate cases",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean"},
                                    "kandidat_saker": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "sak_id": {"type": "string"},
                                                "tittel": {"type": "string"},
                                                "overordnet_status": {"type": "string"},
                                                "sum_godkjent": {"type": "number"},
                                                "godkjent_dager": {"type": "integer"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/endringsordre/{sak_id}/kontekst"] = {
        "get": {
            "tags": ["Endringsordre"],
            "summary": "Get endringsordre context",
            "description": "Get complete context including related KOE cases, states, and events",
            "operationId": "getEOKontekst",
            "security": [{"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "responses": {
                "200": {"description": "Endringsordre context with related cases"}
            }
        }
    }

    paths["/api/endringsordre/{sak_id}/koe"] = {
        "post": {
            "tags": ["Endringsordre"],
            "summary": "Add KOE to endringsordre",
            "operationId": "addKOEToEO",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["koe_sak_id"],
                            "properties": {
                                "koe_sak_id": {"type": "string"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "200": {"description": "KOE added successfully"}
            }
        }
    }

    paths["/api/endringsordre/{sak_id}/koe/{koe_sak_id}"] = {
        "delete": {
            "tags": ["Endringsordre"],
            "summary": "Remove KOE from endringsordre",
            "operationId": "removeKOEFromEO",
            "security": [{"csrfToken": []}, {"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}},
                {"name": "koe_sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "responses": {
                "200": {"description": "KOE removed successfully"}
            }
        }
    }

    paths["/api/endringsordre/{sak_id}/relaterte"] = {
        "get": {
            "tags": ["Endringsordre"],
            "summary": "Get related KOE cases for endringsordre",
            "description": "Get all KOE cases included in an endringsordre",
            "operationId": "getEORelaterte",
            "security": [{"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}}
            ],
            "responses": {
                "200": {
                    "description": "List of related KOE cases",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean"},
                                    "sak_id": {"type": "string"},
                                    "relaterte_saker": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "relatert_sak_id": {"type": "string"},
                                                "relatert_sak_tittel": {"type": "string"},
                                                "bimsync_issue_board_ref": {"type": "string"},
                                                "bimsync_issue_number": {"type": "integer"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/endringsordre/by-relatert/{sak_id}"] = {
        "get": {
            "tags": ["Endringsordre"],
            "summary": "Find endringsordre cases referencing a KOE",
            "description": "Find all endringsordre cases that include a given KOE case. Used for back-links.",
            "operationId": "findEOerForKOE",
            "security": [{"magicLink": []}],
            "parameters": [
                {"name": "sak_id", "in": "path", "required": True, "schema": {"type": "string"}, "description": "KOE case ID to search for"}
            ],
            "responses": {
                "200": {
                    "description": "List of endringsordre cases including this KOE",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "success": {"type": "boolean"},
                                    "endringsordrer": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "eo_sak_id": {"type": "string"},
                                                "eo_nummer": {"type": "string"},
                                                "dato_utstedt": {"type": "string", "format": "date"},
                                                "status": {"type": "string"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    # =========================================================================
    # CLOUDEVENTS API
    # =========================================================================

    paths["/api/cloudevents/schemas"] = {
        "get": {
            "tags": ["CloudEvents"],
            "summary": "List all event data schemas",
            "description": """
List all available event types with their CloudEvents type names
and links to their JSON schemas.

This endpoint helps clients discover available event types and
their data schemas for validation.
""".strip(),
            "operationId": "listCloudEventSchemas",
            "responses": {
                "200": {
                    "description": "List of event schemas",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "namespace": {
                                        "type": "string",
                                        "example": "no.oslo.koe"
                                    },
                                    "specversion": {
                                        "type": "string",
                                        "example": "1.0"
                                    },
                                    "event_types": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "event_type": {"type": "string"},
                                                "cloudevents_type": {"type": "string"},
                                                "schema_url": {"type": "string"},
                                                "has_data_schema": {"type": "boolean"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/cloudevents/schemas/{event_type}"] = {
        "get": {
            "tags": ["CloudEvents"],
            "summary": "Get JSON Schema for event type",
            "description": """
Get the JSON Schema that describes the `data` attribute for events
of the specified type. Use with CloudEvents `dataschema` attribute.
""".strip(),
            "operationId": "getEventSchema",
            "parameters": [
                {
                    "name": "event_type",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"},
                    "example": "grunnlag_opprettet"
                }
            ],
            "responses": {
                "200": {
                    "description": "JSON Schema for event data",
                    "content": {
                        "application/schema+json": {
                            "schema": {
                                "type": "object",
                                "description": "JSON Schema (draft-07)"
                            }
                        }
                    }
                },
                "404": {
                    "description": "Unknown event type or no schema available",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    }
                }
            }
        }
    }

    paths["/api/cloudevents/envelope-schema"] = {
        "get": {
            "tags": ["CloudEvents"],
            "summary": "Get CloudEvents envelope schema",
            "description": """
Get the JSON Schema for the CloudEvents envelope structure,
including all standard and extension attributes used by this API.
""".strip(),
            "operationId": "getCloudEventEnvelopeSchema",
            "parameters": [
                {
                    "name": "format",
                    "in": "query",
                    "schema": {
                        "type": "string",
                        "enum": ["jsonschema", "openapi"],
                        "default": "jsonschema"
                    },
                    "description": "Output format"
                }
            ],
            "responses": {
                "200": {
                    "description": "CloudEvents envelope schema",
                    "content": {
                        "application/schema+json": {
                            "schema": {
                                "type": "object"
                            }
                        }
                    }
                }
            }
        }
    }

    paths["/api/cloudevents/all-schemas"] = {
        "get": {
            "tags": ["CloudEvents"],
            "summary": "Get all schemas in one response",
            "description": "Get envelope schema and all data schemas. Useful for caching.",
            "operationId": "getAllCloudEventSchemas",
            "responses": {
                "200": {
                    "description": "All schemas",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "namespace": {"type": "string"},
                                    "specversion": {"type": "string"},
                                    "envelope": {"type": "object"},
                                    "data_schemas": {
                                        "type": "object",
                                        "additionalProperties": {"type": "object"}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return paths


# =============================================================================
# MAIN GENERATOR
# =============================================================================

def generate_openapi_spec() -> Dict[str, Any]:
    """Generate complete OpenAPI specification."""
    spec = {
        "openapi": "3.0.3",
        "info": API_INFO,
        "servers": SERVERS,
        "tags": TAGS,
        "paths": generate_paths(),
        "components": {
            "securitySchemes": {
                "csrfToken": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-CSRF-Token"
                },
                "magicLink": {
                    "type": "http",
                    "scheme": "bearer"
                }
            },
            "schemas": generate_schemas()
        }
    }

    return spec


def main():
    parser = argparse.ArgumentParser(
        description="Generate OpenAPI specification from Pydantic models"
    )
    parser.add_argument(
        "--output", "-o",
        default="docs/openapi.yaml",
        help="Output file path (default: docs/openapi.yaml)"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["yaml", "json"],
        default="yaml",
        help="Output format (default: yaml)"
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Print to stdout instead of file"
    )

    args = parser.parse_args()

    # Generate spec
    print("Generating OpenAPI specification...")
    spec = generate_openapi_spec()

    # Format output
    if args.format == "json":
        output = json.dumps(spec, indent=2, ensure_ascii=False)
    else:
        output = yaml.dump(spec, allow_unicode=True, sort_keys=False, default_flow_style=False)

    # Write output
    if args.stdout:
        print(output)
    else:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output, encoding="utf-8")
        print(f"OpenAPI spec written to: {output_path}")
        print(f"  Schemas: {len(spec['components']['schemas'])}")
        print(f"  Paths: {len(spec['paths'])}")


if __name__ == "__main__":
    main()
