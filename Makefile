.PHONY: setup migrate backend-test backend-lint backend-check frontend-test frontend-lint frontend-typecheck frontend-build frontend-check test check dev

setup:
	python3 -m venv .venv
	.venv/bin/python -m pip install --upgrade pip
	.venv/bin/pip install -e './backend[dev]'
	cd frontend && npm install

migrate:
	.venv/bin/flask --app todo_app db upgrade -d backend/migrations

backend-test:
	.venv/bin/pytest backend

backend-lint:
	.venv/bin/ruff check backend

backend-check: backend-lint backend-test

frontend-test:
	cd frontend && npm test -- --run

frontend-lint:
	cd frontend && npm run lint

frontend-typecheck:
	cd frontend && npm run typecheck

frontend-build:
	cd frontend && npm run build

frontend-check: frontend-lint frontend-typecheck frontend-test frontend-build

test: backend-test frontend-test

check: backend-check frontend-check

dev:
	docker compose up --build
