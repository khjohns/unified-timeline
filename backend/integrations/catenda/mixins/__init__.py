"""
Catenda Client Mixins
=====================

Modular mixins for Catenda API client functionality.
"""

from .bim import BIMMixin
from .boards import BoardsMixin
from .comments import CommentsMixin
from .custom_fields import CustomFieldsMixin
from .documents import DocumentsMixin
from .relations import RelationsMixin
from .topics import TopicsMixin
from .webhooks import WebhooksMixin

__all__ = [
    "BoardsMixin",
    "CustomFieldsMixin",
    "TopicsMixin",
    "DocumentsMixin",
    "CommentsMixin",
    "BIMMixin",
    "WebhooksMixin",
    "RelationsMixin",
]
