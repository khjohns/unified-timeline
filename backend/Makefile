# Backend Makefile
VENV := . venv/bin/activate &&

.PHONY: help openapi test run install lint

help:
	@echo "Available commands:"
	@echo "  make openapi    - Generate OpenAPI specification from Pydantic models"
	@echo "  make test       - Run pytest tests"
	@echo "  make run        - Run the Flask development server"
	@echo "  make install    - Install Python dependencies"
	@echo "  make lint       - Run type checking with mypy"

openapi:
	$(VENV) python scripts/generate_openapi.py

test:
	$(VENV) python -m pytest

test-cov:
	$(VENV) python -m pytest --cov=. --cov-report=term-missing

run:
	$(VENV) python run.py

install:
	pip install -r requirements.txt

lint:
	$(VENV) python -m mypy . --ignore-missing-imports
