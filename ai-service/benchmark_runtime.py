"""Run real HTTP runtime checks on an isolated loopback port."""
import argparse
import json
import os
import platform
import socket
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from statistics import median
from time import perf_counter, sleep
from uuid import UUID

import httpx

parser = argparse.ArgumentParser()
parser.add_argument("--model-dir", type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent
payload = json.loads((root / "demo/h2-03.json").read_text(encoding="utf-8"))
payload["candidates"] = [
    dict(payload["candidates"][i % 2], report_id=str(UUID(int=i + 1)))
    for i in range(50)
]
result = {"platform": platform.platform(), "python": platform.python_version(),
          "logical_cpus": os.cpu_count(), "candidates": 50, "runs": []}
for mode, directory in [
    ("baseline", args.model_dir), ("e5", args.model_dir),
    ("e5", args.model_dir), ("e5", args.model_dir / "missing"),
]:
    with socket.socket() as port_socket:
        port_socket.bind(("127.0.0.1", 0))
        port = port_socket.getsockname()[1]
    env = dict(os.environ, VASTFIX_AI_RUNTIME=mode, VASTFIX_EMBEDDING_DIR=str(directory.resolve()))
    start = perf_counter()
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", trust_env=False, timeout=15) as client:
            for attempt in range(120):
                if process.poll() is not None:
                    raise RuntimeError("Server exited")
                try:
                    response = client.get("/ready")
                    break
                except httpx.ConnectError:
                    sleep(0.1)
            else:
                raise RuntimeError("Readiness timeout")
            run = {"mode": mode, "missing_model": not directory.is_dir(),
                   "startup_seconds": round(perf_counter() - start, 3),
                   "ready_status": response.status_code, "health": response.json()}
            expected = 503 if run["missing_model"] else 200
            assert response.status_code == expected
            sample = client.post("/duplicates", json=payload)
            assert sample.status_code == expected
            if expected == 200:
                reference = sample.json()
                def request(_):
                    before = perf_counter()
                    actual = client.post("/duplicates", json=payload)
                    assert actual.status_code == 200
                    assert actual.json() == reference
                    return (perf_counter() - before) * 1000
                warm = [request(i) for i in range(10)]
                with ThreadPoolExecutor(max_workers=4) as pool:
                    concurrent = list(pool.map(request, range(12)))
                run.update(warm_median_ms=round(median(warm), 2), warm_max_ms=round(max(warm), 2),
                           concurrent_max_ms=round(max(concurrent), 2), concurrent_requests=12,
                           deterministic=True, model_version=reference["model_version"])
            result["runs"].append(run)
    finally:
        process.terminate()
        process.wait(timeout=15)
print(json.dumps(result, indent=2))
