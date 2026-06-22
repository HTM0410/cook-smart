# YOLO Inference Service for Food Suggest Application
# Handles ingredient detection from uploaded images

import os
# Force CPU before importing torch/ultralytics to avoid CUDA/torchvision NMS compatibility issues
os.environ["CUDA_VISIBLE_DEVICES"] = ""

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import binascii
import tempfile
import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from time import perf_counter
from prometheus_client import Counter, Gauge, Histogram, Info, CONTENT_TYPE_LATEST, generate_latest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("yolo_inference_service")

try:
    from ultralytics import YOLO
except Exception as e:
    # Let the server start with a clear error; backend will fail fast on first request.
    raise RuntimeError(
        "Ultralytics is not installed. Install requirements from src/backend/src/model_detection/yolo_inference_service/requirements.txt"
    ) from e

try:
    from sentence_transformers import SentenceTransformer
except Exception:
    SentenceTransformer = None

# MLOps integration is optional; the inference service uses W&B when MLOPS_ENABLED=true.
MLOPS_ENABLED = os.getenv("MLOPS_ENABLED", "false").lower() in ("1", "true", "yes")
MLOPS_REGISTRY = os.getenv("MLOPS_REGISTRY", "wandb").lower()

# Disable embedding model by default to avoid HuggingFace rate limits
# Set EMBEDDING_ENABLED=true to enable text embedding features
EMBEDDING_ENABLED = os.getenv("EMBEDDING_ENABLED", "false").lower() in ("1", "true", "yes")

if MLOPS_ENABLED:
    import sys
    from pathlib import Path as _P
    for _parent in _P(__file__).resolve().parents:
        if (_parent / "mlops").is_dir():
            if str(_parent) not in sys.path:
                sys.path.insert(0, str(_parent))
            break
    try:
        from mlops.serving.wandb_loader import load_yolo_model_from_registry
    except Exception as exc:
        try:
            from wandb_loader import load_yolo_model_from_registry
        except Exception:
            logger.warning("[yolo_inference_service] W&B loader import failed: %s", exc)
            load_yolo_model_from_registry = None
else:
    load_yolo_model_from_registry = None

SCRIPT_DIR = os.path.dirname(__file__)
MODEL_PATH = os.getenv("YOLO_MODEL_PATH", os.path.join(SCRIPT_DIR, "best59.pt"))

CONF_INFERENCE_FLOOR = float(os.getenv("CONF_INFERENCE_FLOOR", "0.6"))
METRICS_TOKEN = os.getenv("METRICS_TOKEN", "")

HTTP_REQUESTS = Counter(
    "yolo_http_requests_total",
    "Total HTTP requests received by the YOLO service.",
    ["method", "path", "status_code"],
)
HTTP_DURATION = Histogram(
    "yolo_http_request_duration_seconds",
    "YOLO service HTTP request duration in seconds.",
    ["method", "path"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
INFERENCE_DURATION = Histogram(
    "yolo_inference_duration_seconds",
    "Model inference duration in seconds.",
    ["endpoint"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10),
)
DETECTIONS = Counter(
    "yolo_detections_total",
    "Total detected objects by YOLO class.",
    ["class_name"],
)
DETECTION_CONFIDENCE = Histogram(
    "yolo_detection_confidence",
    "Confidence distribution of detected objects.",
    ["class_name"],
    buckets=(0.25, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0),
)
EMPTY_RESULTS = Counter(
    "yolo_empty_results_total",
    "Inference requests that returned no detections.",
    ["endpoint"],
)
MODEL_LOADED = Gauge("yolo_model_loaded", "Whether the YOLO model is loaded.")
MODEL_DETAILS = Info("yolo_model", "Currently loaded YOLO model metadata.")

# Allow loading mapping from external file
MAPPING_FILE_PATH = os.getenv("YOLO_LABEL_MAPPING_PATH", os.path.join(SCRIPT_DIR, "label_mapping.json"))

# Default YOLO label to exact Vietnamese ingredient name mapping from database
# 59 classes từ model đã train (names trong train.yaml)
DEFAULT_YOLO_TO_VIETNAMESE: Dict[str, str] = {
    # Thịt
    "thit_bo": "Thịt bò",
    "thit_ga": "Thịt gà",
    "thit_heo": "Thịt heo",

    # Hải sản
    "ca": "Cá",
    "ca_hoi": "Cá Hồi",
    "tom": "Tôm",
    "muc": "Mực",
    "cua": "Cua",
    "ngao": "Nghêu",
    "hau": "Hàu",
    "bach_tuoc": "Bạch tuộc",

    # Trứng
    "trung_ga": "Trứng gà",
    "trung_cut": "Trứng cút",

    # Rau củ - 20 classes
    "ca_chua": "Cà chua",
    "ca_rot": "Cà rốt",
    "ca_tim": "Cà tím",
    "bap_cai": "Bắp cải",
    "cai_thao": "Cải thảo",
    "rau_cai": "Rau cải",
    "rau_muong": "Rau muống",
    "rau_mong_toi": "Mồng tơi",
    "xa_lach": "Rau Xà Lách",
    "dua_leo": "Dưa leo",
    "hanh_tay": "Hành tây",
    "hanh_tim": "Hành tím",
    "khoai_tay": "Khoai tây",
    "khoai_lang": "Khoai lang",
    "bap_ngo": "Bắp Ngô",
    "bi_ngo": "Bí ngòi",
    "cu_cai": "Củ Cải",
    "muop": "Mướp",
    "su_su": "Su Su",
    "kho_qua": "Khổ qua",

    # Rau thơm & Gia vị - 11 classes
    "bac_ha": "Bạc hà",
    "rau_hung": "Húng Lủi",
    "rau_mui": "Rau mùi",
    "rau_ram": "Rau răm",
    "toi": "Tỏi",
    "gung": "Gừng",
    "ot": "Ớt",
    "ot_chuong": "Ớt chuông",
    "thi_la": "Thì là",
    "chanh": "Chanh",
    "rieng": "Riềng",

    # Nấm - 3 classes
    "nam_bao_ngu": "Nấm bào ngư",
    "nam_huong": "Nấm hương",
    "nam_kim_cham": "Nấm kim châm",

    # Đậu - 1 class
    "dau_hu": "Đậu Hũ",

    # Trái cây - 6 classes
    "cam": "Cam",
    "chuoi": "Chuối",
    "dua-": "Dứa",
    "xoai": "Xoài",
    "tao": "Táo",
    "dua_hau": "Dưa Hấu",
    "thanh_long": "Thanh long",

    # Ngũ cốc & Bánh - 3 classes
    "banh_mi": "Bánh mì",
    "bun": "Bún",
    "gao": "Gạo",

    # Các loại khác - 1 class
    "xuc_xich": "Xúc Xích",
}

# Load mapping from file if exists, otherwise use default
def load_label_mapping() -> Dict[str, str]:
    """Load YOLO label to Vietnamese mapping from external file or use default."""
    if os.path.exists(MAPPING_FILE_PATH):
        try:
            with open(MAPPING_FILE_PATH, 'r', encoding='utf-8') as f:
                loaded_mapping = json.load(f)
                logger.info("[yolo_inference_service] Loaded %d labels from %s", len(loaded_mapping), MAPPING_FILE_PATH)
                return loaded_mapping
        except Exception as e:
            logger.warning("[yolo_inference_service] Failed to load mapping from %s: %s, using default", MAPPING_FILE_PATH, e)
    
    # Also check for legacy mapping file in parent directory
    legacy_path = os.path.join(SCRIPT_DIR, "..", "..", "..", "Data", "output", "ingredient_label_mapping.json")
    if os.path.exists(legacy_path):
        try:
            with open(legacy_path, 'r', encoding='utf-8') as f:
                loaded_mapping = json.load(f)
                logger.info("[yolo_inference_service] Loaded %d labels from legacy mapping", len(loaded_mapping))
                return loaded_mapping
        except Exception as e:
            logger.warning("[yolo_inference_service] Failed to load legacy mapping: %s", e)
    
    logger.info("[yolo_inference_service] Using default label mapping with %d labels", len(DEFAULT_YOLO_TO_VIETNAMESE))
    return DEFAULT_YOLO_TO_VIETNAMESE

YOLO_TO_VIETNAMESE = load_label_mapping()

app = FastAPI(title="Ingredient YOLO Inference Service")


@app.middleware("http")
async def prometheus_http_metrics(request: Request, call_next):
    started_at = perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        path = request.url.path
        HTTP_REQUESTS.labels(request.method, path, str(status_code)).inc()
        HTTP_DURATION.labels(request.method, path).observe(perf_counter() - started_at)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
embed_model = None
embedding_load_error: Optional[str] = None
model_metadata: Dict[str, Any] = {}
model_class_names: List[str] = []
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))


class InferRequest(BaseModel):
    imageBase64: str
    mimeType: Optional[str] = None
    filename: Optional[str] = None


class DetectIngredientsRequest(BaseModel):
    imageBase64: str
    mimeType: Optional[str] = None
    minConfidence: Optional[float] = None


class EmbedRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = None


def map_yolo_label_to_vietnamese(label: str) -> str:
    """Map YOLO snake_case label to Vietnamese ingredient name."""
    if label in YOLO_TO_VIETNAMESE:
        return YOLO_TO_VIETNAMESE[label]
    return label


@app.on_event("startup")
def load_model() -> None:
    global model, embed_model, embedding_load_error, model_metadata, model_class_names
    if MLOPS_ENABLED and load_yolo_model_from_registry is not None:
        try:
            model, model_metadata = load_yolo_model_from_registry()
            logger.info("[yolo_inference_service] Loaded YOLO from %s registry", MLOPS_REGISTRY.upper())
        except Exception as exc:
            logger.warning("[yolo_inference_service] %s load failed, falling back", MLOPS_REGISTRY.upper())
            model_metadata = {"source": "local-fallback", "error": str(exc)}
            if os.path.isfile(MODEL_PATH):
                try:
                    model = YOLO(MODEL_PATH)
                    model_metadata = {"source": "local-fallback", "device": "cpu"}
                except Exception as e:
                    logger.error("Cannot load YOLO: %s", e)
                    model = None
            else:
                model = None
    elif not os.path.isfile(MODEL_PATH):
        logger.warning("Model not found at %s", MODEL_PATH)
        model = None
        MODEL_LOADED.set(0)
        return
    else:
        try:
            model = YOLO(MODEL_PATH, task="detect")
            model_metadata = {"source": "local", "weights_path": MODEL_PATH, "device": "cpu"}
            logger.info("[yolo_inference_service] YOLO model loaded from %s", MODEL_PATH)
            
            # Extract class names from model
            if hasattr(model, 'names') and model.names:
                model_class_names = [str(v) for k, v in sorted(model.names.items())]
                logger.info("[yolo_inference_service] Model has %d classes", len(model_class_names))
        except Exception as e:
            logger.error("Cannot load YOLO: %s", e)
            model = None
            model_metadata = {"source": "error", "error": str(e)}

    if model is not None and hasattr(model, "names") and model.names:
        model_class_names = [str(value) for _, value in sorted(model.names.items())]

    MODEL_LOADED.set(1 if model is not None else 0)
    MODEL_DETAILS.info({
        "source": str(model_metadata.get("source", "unknown")),
        "artifact_version": str(model_metadata.get("artifact_version", "none")),
        "class_count": str(len(model_class_names)),
    })

    if EMBEDDING_ENABLED and SentenceTransformer is None:
        embed_model = None
        embedding_load_error = "sentence-transformers not installed"
    elif EMBEDDING_ENABLED:
        try:
            embed_model = SentenceTransformer(EMBEDDING_MODEL)
            embedding_load_error = None
        except Exception as e:
            embed_model = None
            embedding_load_error = str(e)
    else:
        embed_model = None
        embedding_load_error = "disabled by configuration"


@app.get("/health")
def health() -> Dict[str, Any]:
    """Basic health check endpoint."""
    return {
        "ok": True,
        "model_loaded": model is not None,
        "embedding_model_loaded": embed_model is not None,
        "model_path": MODEL_PATH,
        "embedding_model": EMBEDDING_MODEL,
        "embedding_load_error": embedding_load_error,
        "mlops_enabled": MLOPS_ENABLED,
        "model_metadata": model_metadata,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/metrics", include_in_schema=False)
def metrics(request: Request) -> Response:
    if METRICS_TOKEN and request.headers.get("authorization") != f"Bearer {METRICS_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid metrics token")
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health/detailed")
def health_detailed() -> Dict[str, Any]:
    """Detailed health check with model information."""
    return {
        "ok": True,
        "model_loaded": model is not None,
        "embedding_model_loaded": embed_model is not None,
        "model_path": MODEL_PATH,
        "model_metadata": model_metadata,
        "class_count": len(model_class_names) if model else 0,
        "class_names": model_class_names if model else [],
        "confidence_threshold": CONF_INFERENCE_FLOOR,
        "embedding_model": EMBEDDING_MODEL,
        "embedding_load_error": embedding_load_error,
        "mlops_enabled": MLOPS_ENABLED,
        "mapping_labels_count": len(YOLO_TO_VIETNAMESE),
        "mapping_source": MAPPING_FILE_PATH if os.path.exists(MAPPING_FILE_PATH) else "default",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/labels")
def get_labels() -> Dict[str, Any]:
    """Get all supported YOLO labels and their Vietnamese mappings."""
    return {
        "labels": [
            {"yolo_label": k, "vietnamese_name": v}
            for k, v in sorted(YOLO_TO_VIETNAMESE.items())
        ],
        "total_count": len(YOLO_TO_VIETNAMESE),
    }


@app.post("/infer")
def infer(req: InferRequest) -> Dict[str, Any]:
    """Original inference endpoint for backward compatibility."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not req.imageBase64:
        raise HTTPException(status_code=400, detail="imageBase64 is required")

    try:
        img_bytes = base64.b64decode(req.imageBase64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {e}")

    if not img_bytes:
        raise HTTPException(status_code=400, detail="Decoded image is empty")

    suffix = ".jpg"
    if req.mimeType:
        if req.mimeType.endswith("png"):
            suffix = ".png"
        elif req.mimeType.endswith("jpeg") or req.mimeType.endswith("jpg"):
            suffix = ".jpg"

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(img_bytes)
            tmp.flush()
            tmp_path = tmp.name

        with INFERENCE_DURATION.labels("infer").time():
            results = model.predict(source=tmp_path, conf=CONF_INFERENCE_FLOOR, verbose=False, device="cpu")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    if not results:
        EMPTY_RESULTS.labels("infer").inc()
        return {"labels": []}

    r0 = results[0]
    if r0.boxes is None or r0.boxes.cls is None or len(r0.boxes.cls) == 0:
        EMPTY_RESULTS.labels("infer").inc()
        return {"labels": []}

    label_to_max_conf: Dict[str, float] = {}
    names = getattr(model, "names", {}) or {}

    for cls_id, conf in zip(r0.boxes.cls, r0.boxes.conf):
        cls_idx = int(cls_id)
        yolo_label = names.get(cls_idx, str(cls_idx))
        c = float(conf)
        DETECTIONS.labels(yolo_label).inc()
        DETECTION_CONFIDENCE.labels(yolo_label).observe(c)
        if yolo_label not in label_to_max_conf or c > label_to_max_conf[yolo_label]:
            label_to_max_conf[yolo_label] = c

    # Convert YOLO labels to Vietnamese names
    labels = []
    for yolo_label, conf in sorted(label_to_max_conf.items(), key=lambda x: x[1], reverse=True):
        vietnamese_name = map_yolo_label_to_vietnamese(yolo_label)
        labels.append({
            "label": vietnamese_name,
            "yolo_label": yolo_label,
            "confidence": round(conf, 4)
        })
    
    return {"labels": labels}


@app.post("/detect-ingredients")
def detect_ingredients(req: DetectIngredientsRequest) -> Dict[str, Any]:
    """
    Enhanced ingredient detection endpoint with structured response.
    Returns detected ingredients with confidence scores and Vietnamese names.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not req.imageBase64:
        raise HTTPException(status_code=400, detail="imageBase64 is required")

    # Use custom confidence if provided, otherwise use default
    conf_floor = req.minConfidence if req.minConfidence is not None else CONF_INFERENCE_FLOOR

    try:
        img_bytes = base64.b64decode(req.imageBase64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {e}")

    if not img_bytes:
        raise HTTPException(status_code=400, detail="Decoded image is empty")

    suffix = ".jpg"
    if req.mimeType:
        if req.mimeType.endswith("png"):
            suffix = ".png"
        elif req.mimeType.endswith("jpeg") or req.mimeType.endswith("jpg"):
            suffix = ".jpg"

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(img_bytes)
            tmp.flush()
            tmp_path = tmp.name

        with INFERENCE_DURATION.labels("detect_ingredients").time():
            results = model.predict(source=tmp_path, conf=conf_floor, verbose=False, device="cpu")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    if not results:
        EMPTY_RESULTS.labels("detect_ingredients").inc()
        return {
            "success": True,
            "detected": False,
            "ingredients": [],
            "count": 0,
            "timestamp": datetime.now().isoformat(),
        }

    r0 = results[0]
    if r0.boxes is None or r0.boxes.cls is None or len(r0.boxes.cls) == 0:
        EMPTY_RESULTS.labels("detect_ingredients").inc()
        return {
            "success": True,
            "detected": False,
            "ingredients": [],
            "count": 0,
            "timestamp": datetime.now().isoformat(),
        }

    # Aggregate detections by label, keeping max confidence
    label_to_max_conf: Dict[str, float] = {}
    label_to_bboxes: Dict[str, List] = {}
    names = getattr(model, "names", {}) or {}

    for cls_id, conf, box in zip(r0.boxes.cls, r0.boxes.conf, r0.boxes.xyxy):
        cls_idx = int(cls_id)
        yolo_label = names.get(cls_idx, str(cls_idx))
        c = float(conf)
        DETECTIONS.labels(yolo_label).inc()
        DETECTION_CONFIDENCE.labels(yolo_label).observe(c)
        
        if yolo_label not in label_to_max_conf or c > label_to_max_conf[yolo_label]:
            label_to_max_conf[yolo_label] = c
            label_to_bboxes[yolo_label] = [float(x) for x in box.tolist()] if hasattr(box, 'tolist') else [float(x) for x in box]

    # Convert to structured response
    ingredients = []
    for yolo_label, conf in sorted(label_to_max_conf.items(), key=lambda x: x[1], reverse=True):
        vietnamese_name = map_yolo_label_to_vietnamese(yolo_label)
        ingredients.append({
            "yolo_label": yolo_label,
            "name": vietnamese_name,
            "confidence": round(conf, 4),
            "bbox": label_to_bboxes.get(yolo_label, []),
        })
    
    return {
        "success": True,
        "detected": len(ingredients) > 0,
        "ingredients": ingredients,
        "count": len(ingredients),
        "confidence_threshold": conf_floor,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/embed")
def embed_endpoint(req: EmbedRequest) -> Dict[str, Any]:
    """Generate text embeddings using sentence transformers."""
    global embed_model, embedding_load_error
    if embed_model is None and SentenceTransformer is not None:
        try:
            embed_model = SentenceTransformer(EMBEDDING_MODEL)
            embedding_load_error = None
        except Exception as e:
            embedding_load_error = str(e)

    if embed_model is None:
        raise HTTPException(status_code=503, detail="Embedding model not loaded")

    texts = [str(t).strip() for t in (req.texts or []) if str(t).strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="texts must be non-empty")

    vectors = embed_model.encode(
        texts, batch_size=EMBEDDING_BATCH_SIZE,
        normalize_embeddings=True, convert_to_numpy=True,
    )
    return {
        "vectors": vectors.tolist(),
        "model": req.model or EMBEDDING_MODEL,
        "dim": int(vectors.shape[1]),
        "normalized": True,
    }


@app.get("/")
def root() -> Dict[str, Any]:
    """Root endpoint with service information."""
    return {
        "service": "YOLO Ingredient Detection Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "health_detailed": "/health/detailed",
            "labels": "/labels",
            "infer": "/infer",
            "detect_ingredients": "/detect-ingredients",
            "embed": "/embed",
        },
        "model_loaded": model is not None,
        "embedding_available": embed_model is not None,
    }
