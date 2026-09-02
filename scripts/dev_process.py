"""Manage a named local development process behind the Make interface."""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


def state_paths(run_dir: Path, name: str) -> tuple[Path, Path, Path, Path]:
    return (
        run_dir / f"{name}.pid",
        run_dir / f"{name}.json",
        run_dir / f"{name}.log",
        run_dir / f"{name}.lock",
    )


def process_is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def lock_is_held(lock_path: Path) -> bool:
    try:
        lock_file = lock_path.open("a")
    except OSError:
        return False
    try:
        fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        return True
    fcntl.flock(lock_file, fcntl.LOCK_UN)
    lock_file.close()
    return False


def read_owned_process(run_dir: Path, name: str) -> int | None:
    pid_path, metadata_path, _, lock_path = state_paths(run_dir, name)
    try:
        pid = int(pid_path.read_text().strip())
        metadata = json.loads(metadata_path.read_text())
    except (FileNotFoundError, ValueError, json.JSONDecodeError, OSError):
        return None

    if metadata.get("pid") != pid:
        return None
    if not process_is_alive(pid) or not lock_is_held(lock_path):
        return None
    return pid


def clear_state(run_dir: Path, name: str) -> None:
    pid_path, metadata_path, _, lock_path = state_paths(run_dir, name)
    pid_path.unlink(missing_ok=True)
    metadata_path.unlink(missing_ok=True)
    if not lock_is_held(lock_path):
        lock_path.unlink(missing_ok=True)


def status(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir)
    pid = read_owned_process(run_dir, args.name)
    if pid is None:
        clear_state(run_dir, args.name)
        return 1
    print(f"{args.name} already running (pid {pid})")
    return 0


def wait_until_ready(url: str, pid: int, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not process_is_alive(pid):
            return False
        try:
            with urllib.request.urlopen(url, timeout=0.5) as response:
                status_code = getattr(response, "status", None) or 200
                if status_code < 400:
                    return True
        except (OSError, ValueError):
            pass
        time.sleep(0.1)
    return False


def signal_process_group(pid: int, sig: signal.Signals) -> None:
    try:
        os.killpg(pid, sig)
    except ProcessLookupError:
        pass
    except PermissionError:
        try:
            os.kill(pid, sig)
        except ProcessLookupError:
            pass


def stop_owned_process(run_dir: Path, name: str, pid: int) -> None:
    if read_owned_process(run_dir, name) is None:
        clear_state(run_dir, name)
        return
    signal_process_group(pid, signal.SIGTERM)
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and read_owned_process(run_dir, name) is not None:
        time.sleep(0.05)
    if read_owned_process(run_dir, name) is not None:
        signal_process_group(pid, signal.SIGKILL)
    clear_state(run_dir, name)


def show_log_tail(log_path: Path) -> None:
    try:
        lines = log_path.read_text(errors="replace").splitlines()
    except OSError:
        return
    for line in lines[-20:]:
        print(line, file=sys.stderr)


def start(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)
    existing = read_owned_process(run_dir, args.name)
    if existing is not None:
        print(f"{args.name} already running (pid {existing})")
        return 0
    clear_state(run_dir, args.name)

    pid_path, metadata_path, log_path, lock_path = state_paths(run_dir, args.name)
    command = args.command
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        print(f"No command configured for {args.name}", file=sys.stderr)
        return 2

    lock_file = lock_path.open("a")
    fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    try:
        with log_path.open("a") as log_file:
            process = subprocess.Popen(
                command,
                cwd=args.cwd,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                start_new_session=True,
                pass_fds=(lock_file.fileno(),),
            )
    except OSError as error:
        fcntl.flock(lock_file, fcntl.LOCK_UN)
        lock_file.close()
        lock_path.unlink(missing_ok=True)
        print(f"Could not start {args.name}: {error}", file=sys.stderr)
        return 1
    lock_file.close()

    pid_path.write_text(f"{process.pid}\n")
    metadata_path.write_text(
        json.dumps({"pid": process.pid, "command": command}) + "\n"
    )

    if not wait_until_ready(args.ready, process.pid, args.timeout):
        print(f"{args.name} did not become ready; see {log_path}", file=sys.stderr)
        stop_owned_process(run_dir, args.name, process.pid)
        show_log_tail(log_path)
        return 1

    if args.started_marker:
        Path(args.started_marker).touch()
    print(f"{args.name} started (pid {process.pid}); log: {log_path}")
    return 0


def stop(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir)
    pid = read_owned_process(run_dir, args.name)
    if pid is None:
        clear_state(run_dir, args.name)
        print(f"{args.name} is not running")
        return 0
    try:
        stop_owned_process(run_dir, args.name, pid)
    except PermissionError:
        print(f"Cannot stop {args.name}: permission denied", file=sys.stderr)
        return 1
    print(f"{args.name} stopped")
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    subparsers = result.add_subparsers(dest="action", required=True)

    for action in ("status", "stop"):
        child = subparsers.add_parser(action)
        child.add_argument("--name", required=True)
        child.add_argument("--run-dir", required=True)

    child = subparsers.add_parser("start")
    child.add_argument("--name", required=True)
    child.add_argument("--run-dir", required=True)
    child.add_argument("--cwd", required=True)
    child.add_argument("--ready", required=True)
    child.add_argument("--timeout", type=float, default=10)
    child.add_argument("--started-marker")
    child.add_argument("command", nargs=argparse.REMAINDER)
    return result


def main() -> int:
    args = parser().parse_args()
    return {"start": start, "stop": stop, "status": status}[args.action](args)


if __name__ == "__main__":
    raise SystemExit(main())
