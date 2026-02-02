# Backend Makefile
VENV := . venv/bin/activate &&

.PHONY: help openapi test run install lint format check

help:
	@echo "Available commands:"
	@echo "  make openapi    - Generate OpenAPI specification from Pydantic models"
	@echo "  make test       - Run pytest tests"
	@echo "  make run        - Run the Flask development server"
	@echo "  make install    - Install Python dependencies"
	@echo "  make lint       - Run ruff linter"
	@echo "  make format     - Format code with ruff"
	@echo "  make check      - Run all checks (lint + type check)"

openapi:
	$(VENV) python scripts/generate_openapi.py

test:
	$(VENV) python -m pytest

test-cov:
	$(VENV) python -m pytest --cov=. --cov-report=term-missing

run:
	$(VENV) python run.py

install:
	pip install -r requirements.txt -r requirements-dev.txt

# Linting with ruff (fast, replaces flake8)
lint:
	$(VENV) python -m ruff check .

# Format code with ruff (replaces black + isort)
format:
	$(VENV) python -m ruff format .
	$(VENV) python -m ruff check --fix .

# Run all checks
check: lint
	$(VENV) python -m mypy . --ignore-missing-imports
