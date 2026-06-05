import os
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Cache / data directory base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TELEMETRY_DIR = os.path.join(BASE_DIR, "data", "telemetry")
os.makedirs(TELEMETRY_DIR, exist_ok=True)

def _rotate_log_if_large(log_file: str, max_size_bytes=20 * 1024 * 1024):
    """
    If the log file exceeds the max size (default: 20MB), rename it to *.old to prevent disk bloat.
    """
    if os.path.exists(log_file):
        try:
            if os.path.getsize(log_file) > max_size_bytes:
                old_file = log_file + ".old"
                if os.path.exists(old_file):
                    os.remove(old_file)
                os.rename(log_file, old_file)
                logger.info(f"Rotated telemetry log file: {log_file} -> {old_file}")
        except Exception as e:
            logger.error(f"Failed to rotate telemetry log file: {e}")

def log_prediction_telemetry(prediction_type: str, request_data: dict, response_data: dict):
    """
    Log model prediction request and response telemetry to filesystem for future retraining.
    """
    try:
        log_file = os.path.join(TELEMETRY_DIR, f"{prediction_type}_telemetry.jsonl")
        _rotate_log_if_large(log_file)
        
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request": request_data,
            "response": response_data
        }
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        logger.debug(f"Logged {prediction_type} prediction telemetry")
    except Exception as e:
        logger.error(f"Failed to log {prediction_type} prediction telemetry: {e}")

def log_override_telemetry(override_data: dict):
    """
    Log manual score/metric overrides from users to filesystem for future retraining.
    """
    try:
        log_file = os.path.join(TELEMETRY_DIR, "overrides_telemetry.jsonl")
        _rotate_log_if_large(log_file)
        
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "override": override_data
        }
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        logger.info(f"Logged manual override telemetry for target {override_data.get('target_id')}")
    except Exception as e:
        logger.error(f"Failed to log override telemetry: {e}")
