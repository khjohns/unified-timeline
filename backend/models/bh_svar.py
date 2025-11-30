"""
BH Svar (Client Response) domain model.

Represents the client's (byggherre/BH) response to a KOE claim.
"""
from pydantic import BaseModel, Field
from typing import Optional
from generated_constants import BH_SVAR_STATUS


class BHVederlagSvar(BaseModel):
    """Client's response regarding compensation claims"""
    varsel_for_sent: bool = Field(default=False, description="Notification was too late")
    varsel_for_sent_begrunnelse: str = Field(default="", description="Justification if too late")
    bh_svar_vederlag: str = Field(default="", description="Client response code for compensation")
    bh_vederlag_metode: str = Field(default="", description="Client approved method code")
    bh_godkjent_vederlag_belop: str = Field(default="", description="Client approved amount")
    bh_begrunnelse_vederlag: str = Field(default="", description="Client justification")


class BHFristSvar(BaseModel):
    """Client's response regarding deadline extension claims"""
    varsel_for_sent: bool = Field(default=False, description="Notification was too late")
    varsel_for_sent_begrunnelse: str = Field(default="", description="Justification if too late")
    bh_svar_frist: str = Field(default="", description="Client response code for deadline")
    bh_godkjent_frist_dager: str = Field(default="", description="Client approved days")
    bh_frist_for_spesifisering: str = Field(default="", description="Deadline for specification")
    bh_begrunnelse_frist: str = Field(default="", description="Client justification")


class BHSvarSign(BaseModel):
    """Signature/metadata for client response"""
    dato_svar_bh: str = Field(default="", description="Date of client response (YYYY-MM-DD)")
    for_byggherre: str = Field(default="", description="Signed by (client representative)")


class BHSvarRevisjon(BaseModel):
    """
    BH Svar Revisjon (Client Response Revision) domain model.

    Represents the client's (byggherre) response to a KOE claim.
    Each KOE revision gets a corresponding BH response revision.
    """
    vederlag: BHVederlagSvar = Field(default_factory=BHVederlagSvar, description="Compensation response")
    frist: BHFristSvar = Field(default_factory=BHFristSvar, description="Deadline response")
    mote_dato: str = Field(default="", description="Meeting date (YYYY-MM-DD)")
    mote_referat: str = Field(default="", description="Meeting minutes/notes")
    sign: BHSvarSign = Field(default_factory=BHSvarSign, description="Signature metadata")
    status: str = Field(default=BH_SVAR_STATUS['UTKAST'], description="Status code for this response")

    @classmethod
    def create_initial_response(cls) -> 'BHSvarRevisjon':
        """
        Create initial empty BH response.

        This is created automatically when a KOE is submitted,
        providing a template for the client to fill in their response.

        Returns:
            Initial BHSvarRevisjon with UTKAST status
        """
        return cls(
            vederlag=BHVederlagSvar(),
            frist=BHFristSvar(),
            mote_dato="",
            mote_referat="",
            sign=BHSvarSign(),
            status=BH_SVAR_STATUS['UTKAST']
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
                "vederlag": {
                    "varsel_for_sent": False,
                    "varsel_for_sent_begrunnelse": "",
                    "bh_svar_vederlag": "100000000",
                    "bh_vederlag_metode": "100000001",
                    "bh_godkjent_vederlag_belop": "120000",
                    "bh_begrunnelse_vederlag": "Godkjent med kontraktens enhetspriser"
                },
                "frist": {
                    "varsel_for_sent": False,
                    "varsel_for_sent_begrunnelse": "",
                    "bh_svar_frist": "100000000",
                    "bh_godkjent_frist_dager": "10",
                    "bh_frist_for_spesifisering": "",
                    "bh_begrunnelse_frist": "Godkjent 10 dager"
                },
                "mote_dato": "2025-12-05",
                "mote_referat": "Møte gjennomført. Enighet om kompensasjon.",
                "sign": {
                    "dato_svar_bh": "2025-12-10",
                    "for_byggherre": "Jane Doe"
                },
                "status": "100000004"
            }]
        }
    }
