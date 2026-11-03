from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from scipy.spatial.distance import cosine
import time
import asyncio
import random
import math
import os
from typing import Optional, List
import uvicorn

app = FastAPI(title="Neural Engine ML Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Token vocabulary for streaming generation ───────────────────────────────

VOCAB = [
    "neural", "latent", "manifold", "diffusion", "embedding", "transformer",
    "attention", "gradient", "softmax", "sigmoid", "residual", "normalization",
    "synthesis", "aesthetic", "temporal", "semantic", "spatial", "cognitive",
    "dimensional", "projection", "activation", "backpropagation", "convergence",
    "emergence", "self-organization", "entropy", "information", "complexity",
    "topology", "morphology", "eigenvalue", "singular", "decomposition",
]

# ─── Pydantic request / response models ──────────────────────────────────────

class EmbedRequest(BaseModel):
    text: str
    dim: int = 512


class EmbedResponse(BaseModel):
    embedding: List[float]
    model: str
    tokens: int
    latency_ms: float


class UMAPRequest(BaseModel):
    embeddings: List[List[float]]
    n_components: int = 3


class UMAPResponse(BaseModel):
    coords: List[List[float]]


class SimilarityRequest(BaseModel):
    query: str
    candidates: List[str]


class SimilarityResponse(BaseModel):
    scores: List[float]
    ranked: List[int]


class HealthResponse(BaseModel):
    status: str
    backend: str
    cpu_count: int
    memory_gb: float


# ─── Core ML functions ────────────────────────────────────────────────────────

def generate_embedding(text: str, dim: int = 512) -> np.ndarray:
    """
    Deterministic synthetic embedding seeded from text hash.
    Amplifies semantically-relevant dimension slices based on keyword matching.
    """
    seed = hash(text) % (2 ** 31)
    rng = np.random.RandomState(seed)

    raw = rng.randn(dim)

    keywords = {
        "vision": (0, 64),
        "image": (0, 64),
        "visual": (0, 64),
        "text": (64, 128),
        "language": (64, 128),
        "token": (64, 128),
        "time": (128, 192),
        "temporal": (128, 192),
        "sequence": (128, 192),
        "space": (192, 256),
        "geometry": (192, 256),
        "3d": (192, 256),
        "neural": (256, 320),
        "network": (256, 320),
        "layer": (256, 320),
        "generate": (320, 384),
        "create": (320, 384),
        "synthesis": (320, 384),
        "learn": (384, 448),
        "train": (384, 448),
        "gradient": (384, 448),
        "art": (448, 512),
        "style": (448, 512),
        "aesthetic": (448, 512),
    }

    # Clip to actual dim
    for word in text.lower().split():
        if word in keywords:
            start, end = keywords[word]
            start = min(start, dim)
            end = min(end, dim)
            if start < end:
                raw[start:end] *= 2.5

    norm = np.linalg.norm(raw)
    return raw / norm if norm > 0 else raw


def synthetic_umap(embeddings: np.ndarray, n_components: int = 3) -> np.ndarray:
    """
    SVD-based PCA projection used as a fast UMAP substitute.
    Output coordinates are normalized to [-3, 3].
    """
    if len(embeddings) == 1:
        return np.zeros((1, n_components))

    matrix = np.array(embeddings)
    centered = matrix - matrix.mean(axis=0)

    try:
        U, S, Vt = np.linalg.svd(centered, full_matrices=False)
        n_components = min(n_components, U.shape[1], len(S))
        coords = U[:, :n_components] * S[:n_components]
        for i in range(coords.shape[1]):
            col_min = coords[:, i].min()
            col_max = coords[:, i].max()
            col_range = col_max - col_min
            if col_range > 0:
                coords[:, i] = (coords[:, i] - col_min) / col_range * 6 - 3
        return coords
    except Exception:
        return np.random.randn(len(embeddings), n_components)


# ─── REST Endpoints ───────────────────────────────────────────────────────────

@app.get("/ml/health", response_model=HealthResponse)
async def health():
    try:
        import psutil
        memory_gb = psutil.virtual_memory().total / (1024 ** 3)
    except ImportError:
        memory_gb = 0.0

    return HealthResponse(
        status="ok",
        backend="synthetic",
        cpu_count=os.cpu_count() or 1,
        memory_gb=round(memory_gb, 2),
    )


@app.post("/ml/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    t0 = time.perf_counter()
    vec = generate_embedding(req.text, req.dim)
    latency_ms = (time.perf_counter() - t0) * 1000
    tokens = max(1, len(req.text.split()))
    return EmbedResponse(
        embedding=vec.tolist(),
        model="synthetic-v1",
        tokens=tokens,
        latency_ms=round(latency_ms, 3),
    )


@app.post("/ml/umap", response_model=UMAPResponse)
async def umap_project(req: UMAPRequest):
    if not req.embeddings:
        return UMAPResponse(coords=[])
    matrix = np.array(req.embeddings, dtype=np.float64)
    coords = synthetic_umap(matrix, req.n_components)
    return UMAPResponse(coords=coords.tolist())


@app.post("/ml/similarity", response_model=SimilarityResponse)
async def similarity(req: SimilarityRequest):
    if not req.candidates:
        return SimilarityResponse(scores=[], ranked=[])

    query_vec = generate_embedding(req.query)
    scores: List[float] = []
    for candidate in req.candidates:
        cand_vec = generate_embedding(candidate)
        # cosine distance → similarity
        try:
            dist = cosine(query_vec, cand_vec)
            sim = float(1.0 - dist)
        except Exception:
            sim = 0.0
        scores.append(round(max(0.0, min(1.0, sim)), 6))

    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    return SimilarityResponse(scores=scores, ranked=ranked)


# ─── WebSocket streaming endpoint ────────────────────────────────────────────

@app.websocket("/ml/ws/stream")
async def stream_tokens(websocket: WebSocket):
    await websocket.accept()
    try:
        raw = await websocket.receive_text()
        import json
        data = json.loads(raw)
        prompt: str = data.get("prompt", "")
        max_tokens: int = int(data.get("max_tokens", 50))

        t_start = time.perf_counter()
        rng = random.Random(hash(prompt) % (2 ** 31))

        for step in range(1, max_tokens + 1):
            token = rng.choice(VOCAB)
            logprob = round(-rng.uniform(0.05, 1.8), 4)

            await websocket.send_text(json.dumps({
                "token": token,
                "logprob": logprob,
                "step": step,
                "done": False,
            }))

            # Variable delay: 150–300 ms to mimic real inference cadence
            delay = rng.uniform(0.15, 0.30)
            await asyncio.sleep(delay)

        elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)
        await websocket.send_text(json.dumps({
            "token": "",
            "done": True,
            "total_tokens": max_tokens,
            "elapsed_ms": elapsed_ms,
        }))

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        import json
        try:
            await websocket.send_text(json.dumps({"error": str(exc), "done": True}))
        except Exception:
            pass


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
