import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.model_files import verify_model


@pytest.mark.parametrize("mode", ["baseline", "e5"])
def test_readiness_and_missing_model(monkeypatch, tmp_path, mode):
    monkeypatch.setenv("VASTFIX_AI_RUNTIME", mode)
    monkeypatch.setenv("VASTFIX_EMBEDDING_DIR", str(tmp_path))
    payload = json.loads((Path(__file__).parents[1] / "demo/h2-03.json").read_text(encoding="utf-8"))
    with TestClient(app) as client:
        expected = 200 if mode == "baseline" else 503
        assert client.get("/health").status_code == expected
        assert client.get("/ready").status_code == expected
        assert client.post("/duplicates", json=payload).status_code == expected
        assert client.get("/health").json()["model_version"] == (
            "baseline-v1" if mode == "baseline" else "multilingual-e5-small-q8-v1"
        )


def test_wrong_checksum(monkeypatch, tmp_path):
    import app.model_files as files

    model = tmp_path / "model"
    model.write_bytes(b"wrong")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"files": {"model": {"bytes": 5, "sha256": "0" * 64}}}))
    monkeypatch.setattr(files, "MANIFEST", manifest)
    with pytest.raises(ValueError, match="CHECKSUM"):
        verify_model(tmp_path)


def test_baseline_concurrent_requests(monkeypatch):
    monkeypatch.setenv("VASTFIX_AI_RUNTIME", "baseline")
    payload = json.loads((Path(__file__).parents[1] / "demo/h2-03.json").read_text(encoding="utf-8"))
    with TestClient(app) as client:
        expected = client.post("/duplicates", json=payload).json()
        with ThreadPoolExecutor(max_workers=4) as pool:
            outputs = list(pool.map(lambda _: client.post("/duplicates", json=payload).json(), range(12)))
        assert all(result == expected for result in outputs)
