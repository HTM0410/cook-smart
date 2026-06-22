# CookSmart Ingredients Dataset

Dataset for YOLOv8 ingredient detection.

## Structure
dataset/
  images/
    train/     Training images
    val/       Validation images
  labels/
    train/     YOLO format labels (.txt)
    val/

## Classes
The canonical schema contains 59 concrete ingredient classes. The ordered
class list is stored in `data.yaml` and must remain compatible with the
application label mapping and production model.

## Usage
```python
from ultralytics import YOLO
model = YOLO('yolov8n.pt')
model.train(data='/kaggle/working/food_suggest/mlops/artifacts/prepared/data.yaml', epochs=50)
```
