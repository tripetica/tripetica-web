#!/usr/bin/env python3
"""Fail closed if an env file's DATABASE_URL does not match EXPECTED_DATABASE.

Never prints credentials or the full URL.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        values[key.strip()] = value
    return values


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: assert-expected-database /path/to/env-file", file=sys.stderr)
        return 2

    expected = os.environ.get("EXPECTED_DATABASE", "").strip()
    if not expected:
        print("EXPECTED_DATABASE is required", file=sys.stderr)
        return 1

    env_file = Path(sys.argv[1])
    if not env_file.is_file():
        print("production env file is missing", file=sys.stderr)
        return 1

    values = parse_env(env_file)
    database_url = os.environ.get("DATABASE_URL", "").strip() or values.get(
        "DATABASE_URL", ""
    ).strip()
    if not database_url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1

    parsed = urlparse(database_url)
    actual = parsed.path.lstrip("/").split("/", 1)[0]
    if not actual or "/" in actual:
        print("DATABASE_URL must name exactly one database", file=sys.stderr)
        return 1
    if actual != expected:
        print(
            f"Database target mismatch: expected {expected}, received {actual}",
            file=sys.stderr,
        )
        return 1

    print(f"database_guard_ok db={actual}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
