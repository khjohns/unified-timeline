"""
Catenda API Client
==================

Production-ready Catenda API client for KOE/EO workflow.

This is a modular client built using mixins for different API capabilities:
- BoardsMixin: Topic board management
- CustomFieldsMixin: Custom field management
- TopicsMixin: BCF topic CRUD
- DocumentsMixin: Document/library management
- CommentsMixin: Comments and viewpoints
- BIMMixin: BIM object extraction
- WebhooksMixin: Webhook management
- RelationsMixin: Topic relations
"""

from .base import CatendaClientBase
from .mixins import (
    BIMMixin,
    BoardsMixin,
    CommentsMixin,
    CustomFieldsMixin,
    DocumentsMixin,
    RelationsMixin,
    TopicsMixin,
    WebhooksMixin,
)


class CatendaClient(
    BoardsMixin,
    CustomFieldsMixin,
    TopicsMixin,
    DocumentsMixin,
    CommentsMixin,
    BIMMixin,
    WebhooksMixin,
    RelationsMixin,
    CatendaClientBase,
):
    """
    Full Catenda API client with all capabilities.

    Combines all mixins for a complete API experience:
    - Authentication (OAuth2)
    - Topic boards (BCF projects)
    - Topics (issues/saker)
    - Documents (upload, references)
    - Comments and viewpoints
    - BIM object extraction
    - Webhooks
    - Topic relations

    Example:
        client = CatendaClient(
            client_id="your-client-id",
            access_token="your-access-token"
        )
        client.topic_board_id = "board-id"
        topics = client.list_topics()
    """

    pass
