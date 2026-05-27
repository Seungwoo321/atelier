"""E2B sandbox wrapper.

If E2B_API_KEY is set, opens a real E2B cloud sandbox. Otherwise executes
the snippet locally with a 5s timeout — fine for dry-run gates.
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass


@dataclass
class SandboxResult:
    stdout: str
    stderr: str
    exit_code: int


class Sandbox:
    def __init__(self) -> None:
        self.has_e2b = bool(os.environ.get("E2B_API_KEY"))

    async def run_python(self, code: str, timeout: float = 5.0) -> SandboxResult:
        if self.has_e2b:
            try:
                from e2b_code_interpreter import Sandbox as E2BSandbox

                with E2BSandbox() as sb:
                    exec_res = sb.run_code(code)
                    return SandboxResult(
                        stdout="\n".join(exec_res.logs.stdout),
                        stderr="\n".join(exec_res.logs.stderr),
                        exit_code=0 if not exec_res.error else 1,
                    )
            except Exception as e:
                return SandboxResult("", f"e2b failure: {e}", 1)
        proc = await asyncio.create_subprocess_exec(
            "python3", "-c", code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            return SandboxResult("", "timeout", 124)
        return SandboxResult(
            stdout.decode("utf-8", errors="replace"),
            stderr.decode("utf-8", errors="replace"),
            proc.returncode or 0,
        )
