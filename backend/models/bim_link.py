"""
BIM Link models — Pydantic v2 models for BIM-to-case linking.
"""

from datetime import UTC, datetime

from typing import Any

from pydantic import BaseModel, Field


class BimLink(BaseModel):
    """A link between a KOE case and a BIM model/object."""

    id: int | None = None
    sak_id: str
    fag: str  # ARK, RIB, VVS, LARK, etc.
    model_id: str | None = None
    model_name: str | None = None
    object_id: int | None = None
    object_global_id: str | None = None
    object_name: str | None = None
    object_ifc_type: str | None = None
    properties: dict[str, Any] | None = None  # IFC property sets, quantities, materials
    linked_by: str
    linked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    kommentar: str | None = None


class BimLinkCreate(BaseModel):
    """Request body for creating a BIM link."""

    fag: str = Field(..., min_length=1, description="Discipline: ARK, RIB, VVS, etc.")
    model_id: str | None = None
    model_name: str | None = None
    object_id: int | None = None
    object_global_id: str | None = None
    object_name: str | None = None
    object_ifc_type: str | None = None
    kommentar: str | None = None


class CatendaModelCache(BaseModel):
    """Cached Catenda model info."""

    id: int | None = None
    prosjekt_id: str
    catenda_project_id: str
    model_id: str
    model_name: str
    fag: str | None = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
