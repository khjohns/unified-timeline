"""
KOE Revisjon (KOE revision) domain model.

Represents a revision of a KOE (change order request) from the contractor.
"""
from pydantic import BaseModel, Field
from typing import Optional
from constants import KOE_STATUS


class VederlagKrav(BaseModel):
    """Vederlag (compensation) claims within a KOE revision"""
    krav_vederlag: bool = Field(default=False, description="Claim for compensation")
    krav_produktivitetstap: bool = Field(default=False, description="Claim for productivity loss")
    saerskilt_varsel_rigg_drift: bool = Field(default=False, description="Special notice for rigging/operations")
    krav_vederlag_metode: str = Field(default="", description="Compensation method code")
    krav_vederlag_belop: str = Field(default="", description="Compensation amount")
    krav_vederlag_begrunnelse: str = Field(default="", description="Compensation justification")


class FristKrav(BaseModel):
    """Frist (deadline) extension claims within a KOE revision"""
    krav_fristforlengelse: bool = Field(default=False, description="Claim for deadline extension")
    krav_frist_type: str = Field(default="", description="Deadline type (kalenderdager/arbeidsdager)")
    krav_frist_antall_dager: str = Field(default="", description="Number of days extension")
    forsinkelse_kritisk_linje: bool = Field(default=False, description="Delay on critical path")
    krav_frist_begrunnelse: str = Field(default="", description="Deadline extension justification")


class KoeRevisjon(BaseModel):
    """
    KOE Revisjon (KOE revision) domain model.

    Represents a revision of a change order request from the contractor.
    Multiple revisions can exist if the client rejects or partially accepts.
    """
    koe_revisjonsnr: str = Field(..., description="Revision number (0, 1, 2, ...)")
    dato_krav_sendt: str = Field(default="", description="Date claim was sent (YYYY-MM-DD)")
    for_entreprenor: str = Field(default="", description="Signed by (contractor representative)")
    status: str = Field(default=KOE_STATUS['UTKAST'], description="Status code for this revision")
    vederlag: VederlagKrav = Field(default_factory=VederlagKrav, description="Compensation claims")
    frist: FristKrav = Field(default_factory=FristKrav, description="Deadline extension claims")

    @classmethod
    def create_initial_revision(cls) -> 'KoeRevisjon':
        """
        Create initial empty KOE revision (revision 0).

        This is created automatically when a varsel is submitted,
        providing a template for the contractor to fill in their claims.

        Returns:
            Initial KoeRevisjon with revision number 0
        """
        return cls(
            koe_revisjonsnr="0",
            dato_krav_sendt="",
            for_entreprenor="",
            status=KOE_STATUS['UTKAST'],
            vederlag=VederlagKrav(),
            frist=FristKrav()
        )

    def to_dict(self) -> dict:
        """
        Convert to dictionary for JSON storage.

        Returns:
            Dictionary representation
        """
        return self.model_dump(exclude_none=False)

    # Pydantic v2 configuration
    model_config = {
        "json_schema_extra": {
            "examples": [{
                "koe_revisjonsnr": "0",
                "dato_krav_sendt": "2025-11-27",
                "for_entreprenor": "John Doe",
                "status": "100000001",
                "vederlag": {
                    "krav_vederlag": True,
                    "krav_produktivitetstap": False,
                    "saerskilt_varsel_rigg_drift": False,
                    "krav_vederlag_metode": "100000000",
                    "krav_vederlag_belop": "150000",
                    "krav_vederlag_begrunnelse": "Ekstra materialkostnader"
                },
                "frist": {
                    "krav_fristforlengelse": True,
                    "krav_frist_type": "kalenderdager",
                    "krav_frist_antall_dager": "14",
                    "forsinkelse_kritisk_linje": True,
                    "krav_frist_begrunnelse": "Venter på leveranse"
                }
            }]
        }
    }
