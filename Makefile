PROJECT_ROOT ?= $(CURDIR)
PYTHON ?= $(PROJECT_ROOT)/.venv/bin/python
RUN_DIR ?= $(PROJECT_ROOT)/.run
START_TIMEOUT ?= 10
BE_PORT ?= 5000
FE_PORT ?= 5173

-include $(PROJECT_ROOT)/.env
SECRET_KEY ?= local-development-only-secret
DATABASE_URL ?= sqlite:///todos.db
SESSION_COOKIE_SECURE ?= false
VITE_API_PROXY_TARGET ?= http://127.0.0.1:$(BE_PORT)
export SECRET_KEY DATABASE_URL SESSION_COOKIE_SECURE VITE_API_PROXY_TARGET

DEV_PROCESS = $(PYTHON) $(PROJECT_ROOT)/scripts/dev_process.py
MIGRATE_COMMAND ?= $(PROJECT_ROOT)/.venv/bin/flask --app daylist db upgrade -d $(PROJECT_ROOT)/backend/migrations
BE_COMMAND ?= $(PROJECT_ROOT)/.venv/bin/flask --app daylist run --debug --no-reload --host 127.0.0.1 --port $(BE_PORT)
BE_READY ?= http://127.0.0.1:$(BE_PORT)/api/health
FE_COMMAND ?= $(PROJECT_ROOT)/frontend/node_modules/.bin/vite --host 127.0.0.1 --port $(FE_PORT)
FE_READY ?= http://127.0.0.1:$(FE_PORT)/

.PHONY: setup migrate be-test be-lint be-check fe-test fe-lint fe-typecheck fe-build fe-check makefile-test backend-test backend-lint backend-check frontend-test frontend-lint frontend-typecheck frontend-build frontend-check test check be-start be-stop fe-start fe-stop start stop clean dev

setup:
	python3 -m venv .venv
	.venv/bin/python -m pip install --upgrade pip
	.venv/bin/pip install -e './backend[dev]'
	cd frontend && npm install

migrate:
	$(MIGRATE_COMMAND)

be-test:
	.venv/bin/pytest backend

be-lint:
	.venv/bin/ruff check backend scripts tests

be-check: be-lint be-test

fe-test:
	cd frontend && npm test -- --run

fe-lint:
	cd frontend && npm run lint

fe-typecheck:
	cd frontend && npm run typecheck

fe-build:
	cd frontend && npm run build

fe-check: fe-lint fe-typecheck fe-test fe-build

makefile-test:
	$(PROJECT_ROOT)/.venv/bin/pytest $(PROJECT_ROOT)/tests/test_makefile.py

backend-test: be-test
backend-lint: be-lint
backend-check: be-check
frontend-test: fe-test
frontend-lint: fe-lint
frontend-typecheck: fe-typecheck
frontend-build: fe-build
frontend-check: fe-check

test: be-test fe-test makefile-test

check: be-check fe-check makefile-test

be-start:
	@if $(DEV_PROCESS) status --name be --run-dir $(RUN_DIR); then :; else \
		$(MIGRATE_COMMAND) && \
		$(DEV_PROCESS) start --name be --run-dir $(RUN_DIR) --cwd $(PROJECT_ROOT)/backend --ready $(BE_READY) --timeout $(START_TIMEOUT) $(if $(STARTED_MARKER),--started-marker $(STARTED_MARKER)) -- $(BE_COMMAND); \
	fi

be-stop:
	@$(DEV_PROCESS) stop --name be --run-dir $(RUN_DIR)

fe-start:
	@$(DEV_PROCESS) start --name fe --run-dir $(RUN_DIR) --cwd $(PROJECT_ROOT)/frontend --ready $(FE_READY) --timeout $(START_TIMEOUT) $(if $(STARTED_MARKER),--started-marker $(STARTED_MARKER)) -- $(FE_COMMAND)

fe-stop:
	@$(DEV_PROCESS) stop --name fe --run-dir $(RUN_DIR)

start:
	@mkdir -p $(RUN_DIR); \
		marker_base="$(RUN_DIR)/.start.$$$$"; \
		be_marker="$$marker_base.be"; \
		fe_marker="$$marker_base.fe"; \
		if ! $(MAKE) --no-print-directory be-start STARTED_MARKER="$$be_marker"; then \
			rm -f "$$be_marker" "$$fe_marker"; \
			exit 1; \
		fi; \
		if ! $(MAKE) --no-print-directory fe-start STARTED_MARKER="$$fe_marker"; then \
			if [ -f "$$be_marker" ]; then $(MAKE) --no-print-directory be-stop; fi; \
			rm -f "$$be_marker" "$$fe_marker"; \
			exit 1; \
		fi; \
		rm -f "$$be_marker" "$$fe_marker"

stop: fe-stop be-stop

clean: stop
	@project_root="$(abspath $(PROJECT_ROOT))"; \
		run_dir="$(abspath $(RUN_DIR))"; \
		case "$$run_dir" in "$$project_root"/*) ;; *) echo "RUN_DIR must be inside PROJECT_ROOT" >&2; exit 1;; esac; \
		if [ "$$project_root" = / ] || [ ! -f "$$project_root/Makefile" ]; then \
			echo "Refusing to clean invalid PROJECT_ROOT: $$project_root" >&2; \
			exit 1; \
		fi; \
		rm -rf "$$run_dir" \
			"$$project_root/.pytest_cache" \
			"$$project_root/.ruff_cache" \
			"$$project_root/.coverage" \
			"$$project_root/htmlcov" \
			"$$project_root/backend/.pytest_cache" \
			"$$project_root/backend/.ruff_cache" \
			"$$project_root/frontend/dist" \
			"$$project_root/frontend/coverage"; \
		for tree in "$$project_root/backend" "$$project_root/tests" "$$project_root/scripts"; do \
			if [ -d "$$tree" ]; then \
				find "$$tree" -type d -name __pycache__ -prune -exec rm -rf {} +; \
				find "$$tree" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete; \
			fi; \
		done; \
		find "$$project_root/backend" -type d -name '*.egg-info' -prune -exec rm -rf {} +

dev:
	docker compose up --build
