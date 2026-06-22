#!/bin/bash
# YOLO Inference Service Startup Script
# Usage: ./start_local.sh [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
MODEL_PATH="./best.pt"
PORT=8000
CONF_FLOOR=0.25

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --model)
            MODEL_PATH="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --confidence)
            CONF_FLOOR="$2"
            shift 2
            ;;
        --help)
            echo "YOLO Inference Service Startup Script"
            echo ""
            echo "Usage: ./start_local.sh [options]"
            echo ""
            echo "Options:"
            echo "  --model PATH       Path to YOLO model file (default: ./best.pt)"
            echo "  --port PORT        Port to run service on (default: 8000)"
            echo "  --confidence VAL   Confidence threshold (default: 0.25)"
            echo "  --help            Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  YOLO_MODEL_PATH        Path to model (overrides --model)"
            echo "  CONF_INFERENCE_FLOOR   Confidence threshold (overrides --confidence)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python -m venv venv
fi

# Activate virtual environment
echo -e "${GREEN}Activating virtual environment...${NC}"
source venv/bin/activate

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

# Check if model exists
if [ ! -f "$MODEL_PATH" ]; then
    echo -e "${YELLOW}Warning: Model file not found at $MODEL_PATH${NC}"
    echo -e "${YELLOW}The service will start but inference will fail until model is provided.${NC}"
fi

# Set environment variables
export YOLO_MODEL_PATH="${YOLO_MODEL_PATH:-$MODEL_PATH}"
export CONF_INFERENCE_FLOOR="${CONF_INFERENCE_FLOOR:-$CONF_FLOOR}"
export CUDA_VISIBLE_DEVICES=""

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  YOLO Inference Service${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Model:     ${YOLO_MODEL_PATH}"
echo -e "  Port:      ${PORT}"
echo -e "  Confidence: ${CONF_INFERENCE_FLOOR}"
echo ""
echo -e "${GREEN}Starting server...${NC}"
echo ""

# Start the server
uvicorn app:app --host 0.0.0.0 --port $PORT --reload
