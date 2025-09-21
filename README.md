# License Plate Scanner (LPR) — Submodule

> Lightweight, production-ready computer vision model for scanning vehicle licence plates (matricules) at parking entrances.  
> Built with OpenCV, trained on 20,000+ images, served via Flask for real-time camera input and DB integration.


## Overview

This component is an automatic licence-plate recognition (LPR) module intended to run at parking entry points. A camera captures frames, frames are processed by a CV pipeline (OpenCV + deep learning), the recognized plate text is returned to the parking backend (Flask API) and stored in the database for logging, billing, or access control.

The system will give attention to accuracy in difficult lighting, partial occlusion, and different plate formats.

---

## Key features

- Real-time plate detection and OCR from camera stream.
- Trained on 20,000+ annotated images (diverse conditions).
- Fast inference (edge-capable): CPU + optional GPU acceleration.
- Flask API for easy integration with existing parking backend.
- Optionally logs every recognition to a relational DB (Postgres/MySQL).
- Contains utilities for debugging, visualization, and batch inference.

---


## Dataset

- **Size:** 20,000+ labeled images.
- **Annotations:** Bounding boxes for plates + plate text (UTF-8).
- **Structure (recommended):**

- **Notes:** Keep a split for `train/val/test` and retain a hold-out set for final evaluation.

---

## Model & architecture

- **Detector:** Lightweight object detector (e.g., YOLOv5-nano / YOLOv8n / MobileNet SSD) trained to detect plate regions.
- **Recognizer:** CNN + CTC sequence model or CRNN for plate OCR.
- **Export format:** Saved checkpoints (`.pt`) and optionally ONNX for accelerated inference.
- **Files:**
- `models/plate_detector.pt`
- `models/plate_recognizer.pt` (or `plate_recognizer.onnx`)

---

## Preprocessing pipeline

1. Capture frame from camera (BGR).
2. Resize and normalize.
3. Run plate detector → output bounding boxes.
4. For each bounding box: crop, deskew if necessary, convert to grayscale.
5. Resize crop to recognizer input shape (e.g., 100×32).
6. Recognize characters via CRNN + CTC decode.
7. Postprocess (remove noise, apply confidence threshold).
8. Return plate string + confidence.

---

## Training summary

- **Frameworks:** PyTorch (recommended) or TensorFlow.
- **Augmentations:** brightness/contrast, blur, motion blur, random occlusion, rotation, perspective warp.
- **Losses:** detection (BCE / IoU), recognition (CTC loss).
- **Best practices:** early stopping on val loss, mixed precision, class-balanced sampling for rare plate styles.

---

## Inference & integration

### Camera input
- The camera (RTSP/USB) is read by OpenCV:
```py
import cv2
cap = cv2.VideoCapture("rtsp://<camera-url>")  # or 0 for local camera
ret, frame = cap.read()



not fixed yet
