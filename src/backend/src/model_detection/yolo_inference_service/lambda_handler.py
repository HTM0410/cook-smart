from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("yolo_lambda_handler")

# Web-adapter se invoke `handler(event, context)` cho moi request.
# FastAPI khong can handler rieng (web-adapter goi truc tiep vao ASGI app),
# nhung Lambda runtime can mot symbol ten "handler" de CMD co the resolve.
#
# Tra ve mot response 200 mac dinh; web-adapter se forward HTTP request
# sang uvicorn dang chay o port 8000.


def handler(event: Any, context: Any) -> dict[str, Any]:
    logger.info("YOLO inference handler invoked event=%s", type(event).__name__)
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": '{"service":"yolo-inference","status":"ok"}',
    }


async def async_handler(event: Any, context: Any) -> dict[str, Any]:
    return handler(event, context)
