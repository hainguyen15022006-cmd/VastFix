import hashlib
import json
from pathlib import Path

MANIFEST = Path(__file__).resolve().parents[1] / "model-manifest.json"


def verify_model(directory: Path) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for name, expected in manifest["files"].items():
        path = directory / name
        if not path.is_file() or path.stat().st_size != expected["bytes"]:
            raise ValueError("MODEL_FILE_MISSING_OR_WRONG_SIZE")
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != expected["sha256"]:
            raise ValueError("MODEL_CHECKSUM_MISMATCH")
