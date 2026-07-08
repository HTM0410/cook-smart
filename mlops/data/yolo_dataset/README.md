# CookSmart Ingredients Dataset

Dataset for YOLO ingredient detection.

## Structure
The production MLOps pipeline uses the full Roboflow-style split under
`V59_fullset/`:

```text
V59_fullset/
  train/images
  train/labels
  valid/images
  valid/labels
  test/images
  test/labels
  data.yaml
```

`train` is used for fitting, `valid` is used by Ultralytics during training
and early stopping, and `test` is the held-out release evaluation split.

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
