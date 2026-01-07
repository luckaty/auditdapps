# services/slither/run_slither.py
import json
import subprocess
import sys

def run_slither(target):
    result = subprocess.run(
        ["slither", target, "--json", "-"],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

if __name__ == "__main__":
    target = sys.argv[1]
    print(json.dumps(run_slither(target)))
