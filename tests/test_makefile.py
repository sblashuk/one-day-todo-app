import json
import os
import shutil
import subprocess
import sys
import textwrap
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def run_make(*targets: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["make", "--no-print-directory", "-n", *targets],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.fixture
def make_project(tmp_path: Path) -> Path:
    shutil.copy2(PROJECT_ROOT / "Makefile", tmp_path / "Makefile")
    scripts = PROJECT_ROOT / "scripts"
    if scripts.exists():
        shutil.copytree(scripts, tmp_path / "scripts")
    (tmp_path / "backend").mkdir()
    (tmp_path / "frontend" / "node_modules" / ".bin").mkdir(parents=True)
    (tmp_path / "stub_process.py").write_text(
        textwrap.dedent(
            """
            import argparse
            from pathlib import Path
            import time

            parser = argparse.ArgumentParser()
            parser.add_argument("--ready", required=True)
            args = parser.parse_args()

            Path(args.ready).write_text("ready")
            while True:
                time.sleep(1)
            """
        ).strip()
        + "\n"
    )
    (tmp_path / "fail_process.py").write_text("raise SystemExit(2)\n")
    (tmp_path / "capture_env_process.py").write_text(
        textwrap.dedent(
            """
            import argparse
            import os
            from pathlib import Path
            import time

            parser = argparse.ArgumentParser()
            parser.add_argument("--ready", required=True)
            args = parser.parse_args()
            values = (
                os.environ.get("SECRET_KEY", "<missing>"),
                os.environ.get("DATABASE_URL", "<missing>"),
                os.environ.get("SESSION_COOKIE_SECURE", "<missing>"),
                os.environ.get("VITE_API_PROXY_TARGET", "<missing>"),
            )
            Path(args.ready).write_text("|".join(values))
            while True:
                time.sleep(1)
            """
        ).strip()
        + "\n"
    )
    return tmp_path


def process_is_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


def run_project_make(
    project: Path, *targets: str, variables: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    command = ["make", "--no-print-directory"]
    command.extend(f"{name}={value}" for name, value in (variables or {}).items())
    command.extend(targets)
    return subprocess.run(
        command,
        cwd=project,
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )


def test_short_check_targets_and_compatibility_aliases_are_available():
    targets = (
        "be-test",
        "be-lint",
        "be-check",
        "fe-test",
        "fe-lint",
        "fe-typecheck",
        "fe-build",
        "fe-check",
        "backend-test",
        "backend-lint",
        "backend-check",
        "frontend-test",
        "frontend-lint",
        "frontend-typecheck",
        "frontend-build",
        "frontend-check",
    )

    for target in targets:
        result = run_make(target)
        assert result.returncode == 0, result.stderr


def test_aggregate_verification_includes_makefile_lifecycle_tests():
    makefile_test = run_make("makefile-test")
    assert makefile_test.returncode == 0, makefile_test.stderr
    assert "tests/test_makefile.py" in makefile_test.stdout

    for target in ("test", "check"):
        result = run_make(target)
        assert result.returncode == 0, result.stderr
        assert "tests/test_makefile.py" in result.stdout


def test_backend_can_start_idempotently_and_stop(make_project: Path):
    ready_file = make_project / "be.ready"
    variables = {
        "PYTHON": sys.executable,
        "BE_COMMAND": f"{sys.executable} {make_project / 'stub_process.py'} --ready {ready_file}",
        "BE_READY": ready_file.as_uri(),
        "START_TIMEOUT": "3",
        "MIGRATE_COMMAND": ":",
    }

    started = run_project_make(make_project, "be-start", variables=variables)
    try:
        assert started.returncode == 0, started.stderr
        assert (make_project / ".run" / "be.pid").is_file()
        assert (make_project / ".run" / "be.log").is_file()
        pid = int((make_project / ".run" / "be.pid").read_text())
        assert process_is_running(pid)
        assert ready_file.read_text() == "ready"

        repeated = run_project_make(make_project, "be-start", variables=variables)
        assert repeated.returncode == 0, repeated.stderr
        assert "already running" in repeated.stdout
    finally:
        stopped = run_project_make(make_project, "be-stop", variables=variables)

    assert stopped.returncode == 0, stopped.stderr
    assert not (make_project / ".run" / "be.pid").exists()
    time.sleep(0.1)
    assert not process_is_running(pid)


def test_backend_start_exports_safe_local_defaults(make_project: Path):
    ready_file = make_project / "environment.ready"
    variables = {
        "PYTHON": sys.executable,
        "BE_COMMAND": (
            f"{sys.executable} {make_project / 'capture_env_process.py'} --ready {ready_file}"
        ),
        "BE_READY": ready_file.as_uri(),
        "START_TIMEOUT": "3",
        "MIGRATE_COMMAND": ":",
    }

    result = run_project_make(make_project, "be-start", variables=variables)
    try:
        assert result.returncode == 0, result.stderr
        assert ready_file.read_text() == (
            "local-development-only-secret|sqlite:///todos.db|false|http://127.0.0.1:5000"
        )
    finally:
        run_project_make(make_project, "be-stop", variables=variables)


def test_frontend_can_start_idempotently_and_stop(make_project: Path):
    ready_file = make_project / "fe.ready"
    variables = {
        "PYTHON": sys.executable,
        "FE_COMMAND": f"{sys.executable} {make_project / 'stub_process.py'} --ready {ready_file}",
        "FE_READY": ready_file.as_uri(),
        "START_TIMEOUT": "3",
    }

    started = run_project_make(make_project, "fe-start", variables=variables)
    try:
        assert started.returncode == 0, started.stderr
        pid = int((make_project / ".run" / "fe.pid").read_text())
        assert process_is_running(pid)
        assert ready_file.read_text() == "ready"

        repeated = run_project_make(make_project, "fe-start", variables=variables)
        assert repeated.returncode == 0, repeated.stderr
        assert "already running" in repeated.stdout
    finally:
        stopped = run_project_make(make_project, "fe-stop", variables=variables)

    assert stopped.returncode == 0, stopped.stderr
    assert not (make_project / ".run" / "fe.pid").exists()
    time.sleep(0.1)
    assert not process_is_running(pid)


def test_combined_start_and_stop_manage_both_processes(make_project: Path):
    be_ready = make_project / "be.ready"
    fe_ready = make_project / "fe.ready"
    variables = {
        "PYTHON": sys.executable,
        "BE_COMMAND": f"{sys.executable} {make_project / 'stub_process.py'} --ready {be_ready}",
        "BE_READY": be_ready.as_uri(),
        "FE_COMMAND": f"{sys.executable} {make_project / 'stub_process.py'} --ready {fe_ready}",
        "FE_READY": fe_ready.as_uri(),
        "START_TIMEOUT": "3",
        "MIGRATE_COMMAND": ":",
    }

    started = run_project_make(make_project, "start", variables=variables)
    try:
        assert started.returncode == 0, started.stderr
        be_pid = int((make_project / ".run" / "be.pid").read_text())
        fe_pid = int((make_project / ".run" / "fe.pid").read_text())
        assert process_is_running(be_pid)
        assert process_is_running(fe_pid)
    finally:
        stopped = run_project_make(make_project, "stop", variables=variables)

    assert stopped.returncode == 0, stopped.stderr
    time.sleep(0.1)
    assert not process_is_running(be_pid)
    assert not process_is_running(fe_pid)


@pytest.mark.parametrize("backend_preexisting", [False, True])
def test_combined_start_rolls_back_only_new_processes(
    make_project: Path, backend_preexisting: bool
):
    be_ready = make_project / "be.ready"
    missing_ready = make_project / "never.ready"
    variables = {
        "PYTHON": sys.executable,
        "BE_COMMAND": f"{sys.executable} {make_project / 'stub_process.py'} --ready {be_ready}",
        "BE_READY": be_ready.as_uri(),
        "FE_COMMAND": f"{sys.executable} {make_project / 'fail_process.py'}",
        "FE_READY": missing_ready.as_uri(),
        "START_TIMEOUT": "0.3",
        "MIGRATE_COMMAND": ":",
    }

    if backend_preexisting:
        result = run_project_make(make_project, "be-start", variables=variables)
        assert result.returncode == 0, result.stderr

    result = run_project_make(make_project, "start", variables=variables)
    assert result.returncode != 0
    assert not (make_project / ".run" / "fe.pid").exists()
    assert (make_project / ".run" / "be.pid").exists() is backend_preexisting

    run_project_make(make_project, "stop", variables=variables)


def test_start_replaces_stale_state_without_signalling_that_pid(make_project: Path):
    run_dir = make_project / ".run"
    run_dir.mkdir()
    (run_dir / "be.pid").write_text(f"{os.getpid()}\n")
    (run_dir / "be.json").write_text(json.dumps({"pid": os.getpid()}) + "\n")
    ready_file = make_project / "be.ready"
    variables = {
        "PYTHON": sys.executable,
        "BE_COMMAND": f"{sys.executable} {make_project / 'stub_process.py'} --ready {ready_file}",
        "BE_READY": ready_file.as_uri(),
        "START_TIMEOUT": "3",
        "MIGRATE_COMMAND": ":",
    }

    result = run_project_make(make_project, "be-start", variables=variables)
    try:
        assert result.returncode == 0, result.stderr
        assert int((run_dir / "be.pid").read_text()) != os.getpid()
    finally:
        run_project_make(make_project, "be-stop", variables=variables)


def test_clean_stops_processes_and_preserves_dependencies_and_data(make_project: Path):
    be_ready = make_project / "be.ready"
    fe_ready = make_project / "fe.ready"
    variables = {
        "PYTHON": sys.executable,
        "BE_COMMAND": f"{sys.executable} {make_project / 'stub_process.py'} --ready {be_ready}",
        "BE_READY": be_ready.as_uri(),
        "FE_COMMAND": f"{sys.executable} {make_project / 'stub_process.py'} --ready {fe_ready}",
        "FE_READY": fe_ready.as_uri(),
        "START_TIMEOUT": "3",
        "MIGRATE_COMMAND": ":",
    }
    started = run_project_make(make_project, "start", variables=variables)
    assert started.returncode == 0, started.stderr
    pids = [
        int((make_project / ".run" / "be.pid").read_text()),
        int((make_project / ".run" / "fe.pid").read_text()),
    ]

    removed_paths = (
        "backend/pkg/__pycache__/module.pyc",
        "backend/.pytest_cache/cache",
        "backend/.ruff_cache/cache",
        "backend/daylist_api.egg-info/metadata",
        ".pytest_cache/cache",
        ".ruff_cache/cache",
        ".coverage",
        "htmlcov/index.html",
        "frontend/dist/index.html",
        "frontend/coverage/index.html",
    )
    preserved_paths = (
        ".venv/keep",
        "frontend/node_modules/keep",
        "backend/instance/todos.db",
    )
    for relative_path in (*removed_paths, *preserved_paths):
        path = make_project / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("keep only when specified")

    result = run_project_make(make_project, "clean", variables=variables)
    assert result.returncode == 0, result.stderr
    assert not (make_project / ".run").exists()
    assert all(not (make_project / path).exists() for path in removed_paths)
    assert all((make_project / path).exists() for path in preserved_paths)
    time.sleep(0.1)
    assert all(not process_is_running(pid) for pid in pids)
