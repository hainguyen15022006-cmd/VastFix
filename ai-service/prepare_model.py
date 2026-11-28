"""Download the pinned public model and verify both files before use."""
import argparse
import json
import os
from pathlib import Path
from urllib.request import urlretrieve

from app.model_files import MANIFEST, verify_model

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=Path)
args = parser.parse_args()
args.directory.mkdir(parents=True, exist_ok=True)
manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
base = f"https://huggingface.co/{manifest['repository']}/resolve/{manifest['revision']}"
for name in manifest["files"]:
    remote = "onnx/" + name if name.endswith(".onnx") else name
    temporary = args.directory / (name + ".download")
    try:
        urlretrieve(f"{base}/{remote}", temporary)
        expected = manifest["files"][name]
        import hashlib

        with temporary.open("rb") as stream:
            checksum = hashlib.file_digest(stream, "sha256").hexdigest()
        if temporary.stat().st_size != expected["bytes"] or checksum != expected["sha256"]:
            raise ValueError(f"Download checksum mismatch: {name}")
        os.replace(temporary, args.directory / name)
    finally:
        temporary.unlink(missing_ok=True)
verify_model(args.directory)
print("Model files verified")
