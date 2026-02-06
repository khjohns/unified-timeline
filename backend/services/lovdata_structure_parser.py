"""
Parser for hierarchical structure in Lovdata XML documents.

Extracts Del, Kapittel, Avsnitt, and Vedlegg structure from
<section class="section"> elements with heading tags.

Patterns supported:
- Del: "Del I", "Del 1", "Første del", "Annen del"
- Kapittel: "Kapittel 1", "Kapittel I", "Kap 1", "Kapitel 1", "Kapittel 8a"
- Avsnitt: "Avsnitt I", "I." (Roman numerals alone)
- Vedlegg: "Vedlegg", "Vedlegg I", "VEDLEGG I", "Vedlegg A"
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)

# Type alias for structure types
StructureType = Literal["del", "kapittel", "avsnitt", "vedlegg"]


@dataclass
class StructureMatch:
    """Result from parsing a structure heading."""

    structure_type: StructureType
    structure_id: str
    title: str
    heading_level: int


@dataclass
class StructureRecord:
    """Database record for a structure element."""

    dok_id: str
    structure_type: StructureType
    structure_id: str
    title: str
    sort_order: int
    parent_id: str | None
    address: str | None
    heading_level: int


# Mapping from Norwegian ordinal words to numbers
ORDINAL_TO_NUMBER: dict[str, str] = {
    "første": "1",
    "annen": "2",
    "andre": "2",
    "tredje": "3",
    "fjerde": "4",
    "femte": "5",
    "sjette": "6",
    "sjuende": "7",
    "syvende": "7",
    "åttende": "8",
    "niende": "9",
    "tiende": "10",
    "ellevte": "11",
    "tolvte": "12",
}

# Regex patterns for structure identification
# Each tuple: (pattern, structure_type, optional_flags)
# Pattern groups: (1) = structure_id, (2) = rest of title (optional)
STRUCTURE_PATTERNS: list[tuple[str, StructureType] | tuple[str, StructureType, int]] = [
    # === Del patterns ===
    # "Del I. Alminnelige bestemmelser", "Del II"
    (r"^Del\s+([IVXLCDM]+)\.?\s*(.*)", "del"),
    # "Del 1. Innledning"
    (r"^Del\s+(\d+)\.?\s*(.*)", "del"),
    # "Første del. Alminnelige bestemmelser"
    (
        r"^(Første|Annen|Andre|Tredje|Fjerde|Femte|Sjette|Sjuende|Syvende|Åttende|Niende|Tiende|Ellevte|Tolvte)\s+del\.?\s*(.*)",
        "del",
        re.IGNORECASE,
    ),
    # === Kapittel patterns ===
    # "Kapittel I", "Kapittel Va", "Kapittel XII"
    (r"^Kapittel\s+([IVXLCDM]+\s*[a-zA-Z]?)\.?\s*(.*)", "kapittel"),
    # "Kapittel 1", "Kapittel 8a", "Kapittel 14", "Kapittel 2 A"
    (r"^Kapittel\s+(\d+\s*[a-zA-Z]?)\.?\s*(.*)", "kapittel"),
    # "Kap 1", "Kap. 2", "Kap 8a", "Kap 2 A"
    (r"^Kap\.?\s+(\d+\s*[a-zA-Z]?)\.?\s*(.*)", "kapittel"),
    # "Kapitel 1" (old spelling)
    (r"^Kapitel\s+(\d+\s*[a-zA-Z]?)\.?\s*(.*)", "kapittel"),
    # "Kapitel I" (old spelling with Roman)
    (r"^Kapitel\s+([IVXLCDM]+\s*[a-zA-Z]?)\.?\s*(.*)", "kapittel"),
    # === Avsnitt patterns ===
    # "Avsnitt I", "Avsnitt II"
    (r"^Avsnitt\s+([IVXLCDM]+)\.?\s*(.*)", "avsnitt"),
    # "I. Alminnelige bestemmelser" (Roman numeral alone)
    (r"^([IVXLCDM]+)\.\s+(.*)", "avsnitt"),
    # === Vedlegg patterns ===
    # "VEDLEGG I", "VEDLEGG Ia", "VEDLEGG"
    (r"^VEDLEGG\s*([IVXLCDM]*[A-Za-z]?)\.?\s*(.*)", "vedlegg"),
    # "Vedlegg I", "Vedlegg A", "Vedlegg"
    (r"^Vedlegg\s*([IVXLCDM]*[A-Za-z]?)\.?\s*(.*)", "vedlegg"),
]


def parse_structure_heading(text: str, heading_level: int) -> StructureMatch | None:
    """
    Parse a heading text and identify its structure type.

    Args:
        text: Heading text (stripped)
        heading_level: HTML heading level (2=h2, 3=h3, etc.)

    Returns:
        StructureMatch if recognized, None otherwise
    """
    text = text.strip()

    for pattern_tuple in STRUCTURE_PATTERNS:
        if len(pattern_tuple) == 3:
            pattern, struct_type, flags = pattern_tuple
        else:
            pattern, struct_type = pattern_tuple
            flags = 0

        match = re.match(pattern, text, flags)
        if match:
            groups = match.groups()

            # Extract structure_id from first group
            structure_id = groups[0].strip()
            # Normalize internal whitespace ("2 A" -> "2 A", not "2  A")
            structure_id = " ".join(structure_id.split())

            # Handle ordinal words (Første -> 1, Annen -> 2, etc.)
            if structure_id.lower() in ORDINAL_TO_NUMBER:
                structure_id = ORDINAL_TO_NUMBER[structure_id.lower()]

            # Empty vedlegg ID is valid
            if struct_type == "vedlegg" and not structure_id:
                structure_id = ""

            return StructureMatch(
                structure_type=struct_type,
                structure_id=structure_id,
                title=text,  # Keep full title
                heading_level=heading_level,
            )

    return None


def extract_structure_hierarchy(
    soup: "BeautifulSoup", dok_id: str
) -> tuple[list[StructureRecord], dict[str, str]]:
    """
    Extract hierarchical structure from a Lovdata document.

    Parses <section class="section"> elements with heading tags (h2-h5)
    and builds a hierarchy based on heading levels.

    Args:
        soup: BeautifulSoup-parsed document
        dok_id: Document ID

    Returns:
        (structure_records, section_to_structure_mapping)
        - structure_records: List of StructureRecord for database insert
        - section_to_structure_mapping: Dict from section address -> structure key
    """
    structures: list[StructureRecord] = []
    section_mapping: dict[str, str] = {}  # address -> structure key
    parent_stack: list[tuple[int, StructureRecord]] = []  # (heading_level, record)
    sort_order = 0

    # Find all section elements with class="section"
    for section_elem in soup.find_all("section", class_="section"):
        # Skip if this is a legalArticle (paragraph, not structure)
        classes = section_elem.get("class", [])
        if isinstance(classes, str):
            classes = classes.split()
        if "legalArticle" in classes:
            continue

        # Find heading as direct child
        header = section_elem.find(["h2", "h3", "h4", "h5", "h6"], recursive=False)
        if not header:
            continue

        header_text = header.get_text(strip=True)
        heading_level = int(header.name[1])  # h2 -> 2, h3 -> 3

        # Parse the heading
        match = parse_structure_heading(header_text, heading_level)
        if not match:
            # Log unknown patterns for analysis (but skip known non-structure)
            _log_unknown_pattern(header_text, dok_id)
            continue

        sort_order += 1

        # Find correct parent based on heading level
        # Pop parents that are at same or deeper level
        while parent_stack and parent_stack[-1][0] >= heading_level:
            parent_stack.pop()

        parent_key = None
        if parent_stack:
            parent = parent_stack[-1][1]
            parent_key = f"{parent.structure_type}:{parent.structure_id}"

        # Create structure record
        # Note: API XML uses 'id' attribute, not 'data-absoluteaddress'
        structure_key = f"{match.structure_type}:{match.structure_id}"
        element_id = section_elem.get("id") or section_elem.get("data-absoluteaddress")
        record = StructureRecord(
            dok_id=dok_id,
            structure_type=match.structure_type,
            structure_id=match.structure_id,
            title=match.title,
            sort_order=sort_order,
            parent_id=parent_key,  # Temporary key, resolved during insert
            address=element_id,
            heading_level=heading_level,
        )

        structures.append(record)
        parent_stack.append((heading_level, record))

        # Map all legalArticle elements in this section to this structure
        # Use 'id' attribute for matching (paragraphs have id starting with section id)
        for article in section_elem.find_all("article", class_="legalArticle"):
            article_id = article.get("id") or article.get("data-absoluteaddress")
            if article_id:
                section_mapping[article_id] = structure_key

    return structures, section_mapping


def _log_unknown_pattern(text: str, dok_id: str) -> None:
    """Log unknown heading patterns for later analysis."""
    # Skip known non-structure headings
    if text.startswith("§") or text.startswith("Artikkel"):
        return

    # Skip very short headings (likely not structure)
    if len(text) < 3:
        return

    # Skip numbered list items
    if re.match(r"^\d+\.\s", text):
        return

    logger.debug("Unknown structure heading in %s: %s", dok_id, text[:80])
