#!/usr/bin/env python3
"""One-token provider preflight for the task's RewardKit judge.

Confirms the model provider used by the verifier accepts the configured key
before spending a full Oracle/model run. Never prints the key or request body.

Reads the model and endpoint straight from the task when --task is given, so it
works for both judge wirings:

  CodeArena / dimensions   REWARDKIT_MODEL = openai/gpt-5.6-luna (OpenRouter v1)
  staged                   REWARDKIT_MODEL = z-ai/glm-5.3-flashx with
                           ANTHROPIC_BASE_URL = https://openrouter.ai/api

Exit codes: 0 ready, 2 credits/billing failure, 1 other provider failure,
3 key not found.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
import tomllib


def resolve_task_defaults(task: Path | None) -> tuple[str | None, str | None, str]:
    """Return (model, base_url, key_env_name) declared by the task, if any."""
    if not task:
        return None, None, "OPENROUTER_API_KEY"
    task_file = task / "task.toml" if task.is_dir() else task
    if not task_file.is_file():
        return None, None, "OPENROUTER_API_KEY"
    config = tomllib.loads(task_file.read_text(encoding="utf-8"))
    env = config.get("verifier", {}).get("env", {})
    model = env.get("REWARDKIT_MODEL")
    base = env.get("ANTHROPIC_BASE_URL") or None
    key_env = "OPENROUTER_API_KEY"
    for value in env.values():
        match = re.search(r"\$\{(\w+)\}", str(value))
        if match:
            key_env = match.group(1)
            break
    if base and not base.rstrip("/").endswith("/v1"):
        # The judge speaks the Anthropic-compatible path; the probe uses the
        # OpenAI-compatible one, so add the version segment when it is missing.
        base = base.rstrip("/") + "/v1"
    return model, base, key_env


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        values[key.strip()] = value.strip().strip("\"'")
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", type=Path, help="task folder; reads model, endpoint and key name from task.toml")
    parser.add_argument("--env-file", type=Path, help=".env file containing OPENROUTER_API_KEY")
    parser.add_argument("--api-key", help="provider key (prefer env-file; never echo it)")
    parser.add_argument("--model", help="defaults to the task's REWARDKIT_MODEL or openai/gpt-5.6-luna")
    parser.add_argument("--base-url", help="defaults to the task's endpoint or https://openrouter.ai/api/v1")
    args = parser.parse_args()

    task_model, task_base, key_env = resolve_task_defaults(args.task)
    model = args.model or task_model or "openai/gpt-5.6-luna"
    base_url = args.base_url or task_base or "https://openrouter.ai/api/v1"
    env = load_env_file(args.env_file) if args.env_file else {}
    key = args.api_key or os.getenv(key_env) or env.get(key_env)
    if not key:
        print(
            f"PROBE FAILED: {key_env} not found (would probe model={model} via {base_url})",
            file=sys.stderr,
        )
        return 3

    payload = json.dumps({"model": model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1}).encode()
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://codex.openai.com",
            "X-Title": "codearena-task-breaker",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = json.loads(response.read().decode())
            print(f"PROBE OK: model={model} via {base_url}")
            return 0
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            detail = json.loads(error.read().decode()).get("error", {}).get("message", "")
        except Exception:
            detail = error.reason or ""
        print(f"PROBE FAILED: status={error.code} detail={detail[:400]}")
        return 2 if error.code == 402 else 1
    except Exception as error:  # network/timeout/parse
        print(f"PROBE FAILED: {type(error).__name__}: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
