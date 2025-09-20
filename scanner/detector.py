import torch
import cv2
from util import read_license_plate

# Load YOLOv5 model (pretrained or your fine-tuned weights)
# If you trained your own license plate model, replace "yolov5s.pt" with "runs/train/exp/weights/best.pt"
model = torch.hub.load('ultralytics/yolov5', 'custom', path='weights/license_plate.pt')

def detect_plate(image_path):
    # Load image
    img = cv2.imread(image_path)

    # Run YOLO inference
    results = model(img)

    # Parse detections
    detections = results.xyxy[0].cpu().numpy()  # [x1, y1, x2, y2, conf, cls]

    best_plate = None
    best_score = 0

    for det in detections:
        x1, y1, x2, y2, conf, cls = det
        if conf < 0.5:  # filter weak detections
            continue

        # Crop the plate
        crop = img[int(y1):int(y2), int(x1):int(x2)]

        # Run OCR
        text, ocr_score = read_license_plate(crop)

        if text and ocr_score and ocr_score > best_score:
            best_plate = text
            best_score = ocr_score

    return best_plate, best_score

if __name__ == "__main__":
    test_image = "test_car.jpg"   # replace with a real image path
    plate, score = detect_plate(test_image)
    print("Detected Plate:", plate, "Confidence:", score)
