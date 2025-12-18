#!/usr/bin/env python3
"""
OpenAPI Specification Generator

Generates openapi.yaml from Pydantic models and route definitions.
Framework-agnostic - works regardless of Flask, Azure Functions, etc.

Usage:
    python scripts/generate_openapi.py
    python scripts/generate_openapi.py --output docs/openapi.yaml
"""

import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import yaml

# Import Pydantic models
from models.events import (
    # Enums
    EventType,
    VederlagsMetode,
    FristVarselType,
    # Data models
    GrunnlagData,
    VederlagData,
    FristData,
    GrunnlagResponsData,
    VederlagResponsData,
    FristResponsData,
    # Event models
    SakEvent,
    GrunnlagEvent,
    VederlagEvent,
    FristEvent,
    ResponsEvent,
    SakOpprettetEvent,
)

# Import constants for documentation
from constants import (
    get_alle_hovedkategorier,
    get_underkategorier_for_hovedkategori,
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
- noytralt: Neutral/preliminary (§33.4)
- spesifisert: Specified with days (§33.6.1)
- begge: Both neutral and specified
- force_majeure: Force majeure extension (§33.3)
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
