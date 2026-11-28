from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer
from threading import Lock

from .model_files import verify_model


class E5Scorer:
    version = "multilingual-e5-small-q8-v1"
    reason_threshold = 0.80

    def __init__(self, model_dir: Path):
        verify_model(model_dir)
        self.lock = Lock()
        self.tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=512)
        self.tokenizer.enable_padding(pad_id=self.tokenizer.token_to_id("<pad>"), pad_token="<pad>")
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        self.session = ort.InferenceSession(
            str(model_dir / "model_quantized.onnx"), sess_options=options, providers=["CPUExecutionProvider"]
        )
        self.input_names = {value.name for value in self.session.get_inputs()}

    def encode(self, texts: list[str], prefix: str) -> np.ndarray:
        parts = []
        for start in range(0, len(texts), 8):
            batch = self.tokenizer.encode_batch([prefix + text for text in texts[start:start + 8]])
            mask = np.asarray([item.attention_mask for item in batch], dtype=np.int64)
            inputs = {
                "input_ids": np.asarray([item.ids for item in batch], dtype=np.int64),
                "attention_mask": mask,
            }
            if "token_type_ids" in self.input_names:
                inputs["token_type_ids"] = np.asarray([item.type_ids for item in batch], dtype=np.int64)
            (hidden, *_) = self.session.run(None, inputs)
            pooled = (hidden * mask[:, :, None]).sum(axis=1) / mask.sum(axis=1)[:, None]
            parts.append(pooled / np.maximum(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12))
        return np.concatenate(parts)

    def similarities(self, query: str, candidates: list[str]) -> list[float]:
        # Tokenizer padding/truncation state is shared by requests.
        with self.lock:
            query_vector = self.encode([query], "query: ")[0]
            vectors = self.encode(candidates, "passage: ")
        return np.clip(vectors @ query_vector, 0, 1).tolist()
