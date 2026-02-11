"""
Project Context Middleware

Reads X-Project-ID header from requests and sets g.project_id.
Provides get_project_id() for use in repositories and services.
"""

import logging

from flask import Flask, g, request

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_ID = "oslobygg"


def init_project_context(app: Flask) -> None:
    """Register before_request handler that sets g.project_id from header."""

    @app.before_request
    def set_project_id():
        project_id = request.headers.get("X-Project-ID", DEFAULT_PROJECT_ID)
        g.project_id = project_id


def get_project_id() -> str:
    """
    Get current project ID from Flask request context.

    Returns the X-Project-ID header value, or 'oslobygg' as default.
    Safe to call outside request context (returns default).
    """
    try:
        return getattr(g, "project_id", DEFAULT_PROJECT_ID)
    except RuntimeError:
        # Outside Flask request context
        return DEFAULT_PROJECT_ID
