"""
Base repository interface for data access.

This abstract base class defines the interface that all repositories must implement.
This allows us to swap between CSV (prototype) and Dataverse (production) without
changing business logic in services.
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List


class BaseRepository(ABC):
    """
    Abstract base class for data repositories.

    Defines the interface that all repositories must implement.
    This enables the Repository Pattern for clean separation between
    business logic and data access.
    """

    @abstractmethod
    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """
        Get case by ID.

        Args:
            case_id: Unique case identifier (GUID)

        Returns:
            Case data dictionary if found, None otherwise
        """
        pass

    @abstractmethod
    def update_case(self, case_id: str, data: Dict[str, Any]) -> None:
        """
        Update case data.

        Args:
            case_id: Unique case identifier (GUID)
            data: Complete case data to store

        Raises:
            ValueError: If case not found
        """
        pass

    @abstractmethod
    def create_case(self, case_data: Dict[str, Any]) -> str:
        """
        Create new case.

        Args:
            case_data: Initial case data

        Returns:
            Created case_id (GUID)
        """
        pass

    @abstractmethod
    def list_cases(self, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List cases, optionally filtered by project.

        Args:
            project_id: Optional project filter (GUID)

        Returns:
            List of case data dictionaries
        """
        pass

    @abstractmethod
    def delete_case(self, case_id: str) -> None:
        """
        Delete case by ID.

        Args:
            case_id: Unique case identifier (GUID)

        Raises:
            ValueError: If case not found
        """
        pass

    @abstractmethod
    def case_exists(self, case_id: str) -> bool:
        """
        Check if case exists.

        Args:
            case_id: Unique case identifier (GUID)

        Returns:
            True if case exists, False otherwise
        """
        pass

    @abstractmethod
    def get_cases_by_catenda_topic(self, topic_id: str) -> List[Dict[str, Any]]:
        """
        Get cases linked to a Catenda topic.

        Args:
            topic_id: Catenda topic GUID

        Returns:
            List of case data dictionaries
        """
        pass
