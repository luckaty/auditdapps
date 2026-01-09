from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
import tempfile
import subprocess
import json

app = FastAPI(title="AuditDapps Static Analysis Service")

# ✅ CORS (PowerShell ignores CORS, browsers enforce it)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    source_code: str = Field(..., min_length=1)
    filename: str = "Contract.sol"


def _map_severity(sev: str) -> str:
    s = (sev or "").strip().lower()
    if s in ["informational", "info"]:
        return "Info"
    if s == "low":
        return "Low"
    if s == "medium":
        return "Medium"
    if s == "high":
        return "High"
    if s == "critical":
        return "Critical"
    return "Info"


TITLE_OVERRIDES = {
    "reentrancy-eth": "Reentrancy via external call",
    "reentrancy-no-eth": "Reentrancy risk",
    "low-level-calls": "Low-level call usage",
    "solc-version": "Solidity version warning",
}


def _title_from_detector(detector: str) -> str:
    d = (detector or "").strip()
    if not d:
        return "Unknown"
    return TITLE_OVERRIDES.get(d, d.replace("-", " ").replace("_", " ").strip().title())


@app.get("/health")
def health():
    return {"status": "ok", "tool": "slither"}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    source = (req.source_code or "").strip()
    if not source:
        raise HTTPException(status_code=400, detail="source_code is required")

    # Safety limit
    if len(source) > 200_000:
        raise HTTPException(status_code=413, detail="source_code too large")

    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            target = tmp_path / req.filename
            target.write_text(source, encoding="utf-8")

            cmd = [
                "slither",
                str(target),
                "--json",
                "-",  # JSON to stdout
                "--exclude-dependencies",
            ]

            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
            )

            out = (proc.stdout or "").strip()
            if not out:
                raise HTTPException(
                    status_code=500,
                    detail=f"Slither failed: {proc.stderr.strip() or 'no output'}",
                )

            try:
                report = json.loads(out)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=500,
                    detail=f"Slither returned non-JSON output: {out[:500]}",
                )

            detectors = []
            if isinstance(report, dict):
                detectors = report.get("results", {}).get("detectors", []) or []

            findings = []
            for d in detectors:
                check = d.get("check", "UnknownDetector")
                impact = d.get("impact", "Unknown")
                confidence = d.get("confidence", "Unknown")
                description = (d.get("description", "") or "").strip()

                # Best-effort "where"
                elements = d.get("elements", []) or []
                where_bits = []
                for el in elements[:3]:
                    name = el.get("name")
                    source_map = el.get("source_mapping", {}) or {}
                    filename = (
                        source_map.get("filename_short")
                        or source_map.get("filename_relative")
                        or source_map.get("filename")
                    )
                    lines = source_map.get("lines") or []
                    if filename and lines:
                        where_bits.append(f"{name or 'element'} @ {filename}:{lines[0]}")
                    elif filename:
                        where_bits.append(f"{name or 'element'} @ {filename}")
                    elif name:
                        where_bits.append(str(name))

                where = "; ".join(where_bits) if where_bits else None

                findings.append(
                    {
                        "tool": "slither",
                        "detector": str(check),
                        "severity": _map_severity(str(impact)),
                        "confidence": str(confidence),
                        "title": _title_from_detector(str(check)),
                        "description": description,
                        "where": where,
                    }
                )

            # ✅ Treat "JSON parsed" as success, even if exit_code is non-zero
            return {
                "tool": "slither",
                "count": len(findings),
                "findings": findings,
                "raw": {
                    "success": True,
                    "exit_code": proc.returncode,
                    "note": "Slither may exit non-zero even when JSON output is valid.",
                },
            }

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Slither timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
