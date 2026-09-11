#!/usr/bin/env python3
"""Run RewardKit with codex pointed at OpenRouter and MCP tools pre-approved.

Two things RewardKit's Codex backend does not do for us, and both are fatal:

  1. It builds a FRESH temporary CODEX_HOME per judge session and writes a
     config.toml into it containing only `[mcp_servers.*]` stanzas. Any
     provider block baked into the image's /root/.codex/config.toml is
     therefore never read, and codex falls back to the default OpenAI
     provider.
  2. On its own, a registered MCP server carries no approval mode, so codex
     asks for approval before every Playwright call. `codex exec` is
     non-interactive with an approval policy of "never", so the call is
     denied and the judge reports the browser as unavailable.
  3. codex does not forward its own environment to a stdio MCP server, so the
     PLAYWRIGHT_BROWSERS_PATH set by the image never reaches Playwright and it
     looks in its default cache, where nothing is installed.
  4. codex gives a server ten seconds to start before dropping it and running
     the session with no browser tools registered, which the judge then scores
     as an application that cannot be evaluated.

Patching `_write_mcp_config` to emit the model, the OpenRouter provider block,
`default_tools_approval_mode = "approve"`, an explicit environment and workable
timeouts alongside the MCP stanzas fixes all four. Lives outside /tests so
RewardKit's discovery never imports it.
"""
import json
import os
import sys
from pathlib import Path

from rewardkit import agents
from rewardkit.runner import run

MODEL = os.environ.get("REWARDKIT_MODEL", "openai/gpt-5.6-luna")

# Where the verifier image installs the browsers, and the variables a stdio MCP
# server needs in order to find node, its own package and that directory.
_BROWSERS_PATH = "/opt/playwright-browsers"
_FORWARDED_ENV = (
    "PATH", "HOME", "NODE_PATH", "PLAYWRIGHT_BROWSERS_PATH",
    "XDG_CACHE_HOME", "LANG", "TMPDIR",
)


def _write_mcp_config(codex_home, servers) -> None:
    codex_home = Path(codex_home)
    lines = [
        f'model = {json.dumps(MODEL)}',
        'model_provider = "openrouter"',
        'approval_policy = "never"',
        'sandbox_mode = "danger-full-access"',
        "",
        "[model_providers.openrouter]",
        'name = "OpenRouter"',
        'base_url = "https://openrouter.ai/api/v1"',
        'env_key = "OPENROUTER_API_KEY"',
        'wire_api = "responses"',
        "",
    ]
    for server in servers or ():
        transport = getattr(server, "transport", "stdio")
        if transport == "sse":
            raise ValueError(f"codex cannot use an 'sse' MCP server ({server.name})")
        lines.append(f"[mcp_servers.{json.dumps(server.name)}]")
        if transport == "stdio":
            lines.append(f"command = {json.dumps(os.path.expandvars(server.command or ''))}")
            lines.append(f"args = {json.dumps([os.path.expandvars(a) for a in server.args])}")
            # codex does not pass its own environment through to a stdio MCP
            # server, so the browser location baked into the image never reached
            # Playwright and it looked in its default cache instead, reporting
            # the browser as not installed and failing every criterion the
            # session owned.
            env = {name: os.environ[name] for name in _FORWARDED_ENV if name in os.environ}
            env.setdefault("PLAYWRIGHT_BROWSERS_PATH", _BROWSERS_PATH)
            lines.append("env = { " + ", ".join(
                f"{json.dumps(k)} = {json.dumps(v)}" for k, v in sorted(env.items())) + " }")
        else:
            lines.append(f"url = {json.dumps(os.path.expandvars(server.url or ''))}")
        if getattr(server, "allowed_tools", None):
            lines.append(f"enabled_tools = {json.dumps(list(server.allowed_tools))}")
        # Without this, every Playwright tool call is refused as unapproved.
        lines.append('default_tools_approval_mode = "approve"')
        # codex allows a server 10 seconds to start and 60 for a tool call, then
        # drops it and carries on with no browser tools registered at all. A
        # judge session that lost the race reported the browser as unavailable
        # and scored every criterion it owned zero. Launching node, Chromium and
        # a fresh profile comfortably exceeds ten seconds on a loaded box, and a
        # snapshot of a dense page can exceed a minute.
        lines.append("startup_timeout_sec = 120")
        lines.append("tool_timeout_sec = 180")
        lines.append("")
    codex_home.mkdir(parents=True, exist_ok=True)
    (codex_home / "config.toml").write_text("\n".join(lines), encoding="utf-8")


def _resolve_browser() -> str:
    """The executable @playwright/mcp will launch, or "" if there is none.

    A missing browser is an infrastructure failure, not a bad submission, and it
    is worth failing loudly over: the judge otherwise reports every criterion as
    unevaluable and RewardKit records that as a zero-scoring application.
    """
    root = Path(os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or _BROWSERS_PATH)
    if not root.is_dir():
        return ""
    for pattern in ("*/chrome-linux64/chrome", "*/chrome-linux/chrome"):
        for candidate in sorted(root.glob(pattern)):
            if os.access(candidate, os.X_OK):
                return str(candidate)
    return ""


def main() -> int:
    tests_dir, output = sys.argv[1], sys.argv[2]
    browser = _resolve_browser()
    if not browser:
        print("no Playwright browser executable found; refusing to grade a "
              "submission the judge cannot open in a browser", file=sys.stderr)
        return 1
    print(f"browser for the judge: {browser}")
    if not hasattr(agents, "CodexBackend"):
        print("WARNING: rewardkit has no CodexBackend; running unpatched", file=sys.stderr)
    else:
        agents.CodexBackend._write_mcp_config = staticmethod(_write_mcp_config)
        print("codex config patched: openrouter provider + MCP tools pre-approved")
    # One agent at a time. Running two codex sessions concurrently has each of
    # them launch its own Chromium, and a session that loses that race reports
    # the browser as unavailable and fails every criterion it owns. Sequential
    # judging fits the budget comfortably and removes the contention.
    scores = run(tests_dir, workspace="/app", output=output, max_concurrent_agent=1)
    for name, score in scores.items():
        print(f"{name}: {score}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
