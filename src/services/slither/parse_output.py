# services/slither/parse_output.py
def normalize(slither_json):
    findings = []
    for detector in slither_json.get("results", {}).get("detectors", []):
        findings.append({
            "tool": "slither",
            "check": detector["check"],
            "severity": detector["impact"],
            "description": detector["description"]
        })
    return findings
