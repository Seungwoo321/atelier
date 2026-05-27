"""ACP (Agent Client Protocol) provider — out-of-process LLM access.

Connects to a long-running ACP agent (e.g. claude-code-acp, gemini, codex)
launched as a subprocess and speaking JSON-RPC over stdio.
"""

from __future__ import annotations

import asyncio
import json
import os
import shlex
import uuid

from atelier.llm.provider import LLMResponse


class ACPProvider:
    name = "acp"

    def __init__(self, endpoint: str | None = None) -> None:
        # endpoint format: "stdio://<command and args>" or just the command line.
        self.endpoint = endpoint or os.environ.get("ATELIER_ACP_ENDPOINT")
        self._proc: asyncio.subprocess.Process | None = None
        self._lock = asyncio.Lock()

    async def _spawn(self) -> asyncio.subprocess.Process:
        if self._proc and self._proc.returncode is None:
            return self._proc
        if not self.endpoint:
            raise RuntimeError(
                "ATELIER_ACP_ENDPOINT not set. "
                "Set it to the ACP agent command, e.g. 'npx @zed-industries/claude-code-acp'."
            )
        cmdline = self.endpoint
        if cmdline.startswith("stdio://"):
            cmdline = cmdline[len("stdio://"):]
        argv = shlex.split(cmdline)
        self._proc = await asyncio.create_subprocess_exec(
            *argv,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        return self._proc

    async def _rpc(self, method: str, params: dict) -> dict:
        proc = await self._spawn()
        req_id = str(uuid.uuid4())
        payload = json.dumps(
            {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
        ) + "\n"
        assert proc.stdin and proc.stdout
        proc.stdin.write(payload.encode("utf-8"))
        await proc.stdin.drain()
        while True:
            line = await proc.stdout.readline()
            if not line:
                raise RuntimeError("ACP agent closed connection")
            try:
                msg = json.loads(line.decode("utf-8"))
            except json.JSONDecodeError:
                continue
            if msg.get("id") == req_id:
                if "error" in msg:
                    raise RuntimeError(f"ACP error: {msg['error']}")
                return msg.get("result", {})

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        model: str,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        async with self._lock:
            await self._rpc("initialize", {"protocolVersion": 1})
            session = await self._rpc(
                "session/new", {"mcpServers": [], "cwd": os.getcwd()}
            )
            session_id = session.get("sessionId", "default")
            result = await self._rpc(
                "session/prompt",
                {
                    "sessionId": session_id,
                    "prompt": [
                        {"type": "text", "text": f"[system]\n{system}\n\n[user]\n{prompt}"}
                    ],
                },
            )
        text = ""
        for chunk in result.get("messages", []) or []:
            for blk in chunk.get("content", []) or []:
                if blk.get("type") == "text":
                    text += blk.get("text", "")
        usage = result.get("usage", {}) or {}
        return LLMResponse(
            text=text,
            model=model,
            input_tokens=int(usage.get("input_tokens", 0)),
            output_tokens=int(usage.get("output_tokens", 0)),
        )

    async def healthcheck(self) -> bool:
        return bool(self.endpoint)

    async def close(self) -> None:
        if self._proc and self._proc.returncode is None:
            self._proc.terminate()
            try:
                await asyncio.wait_for(self._proc.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                self._proc.kill()
