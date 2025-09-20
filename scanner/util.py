import string
import easyocr

# Initialize the OCR reader
reader = easyocr.Reader(['en'], gpu=False)

dict_char_to_int = {'O': '0', 'I': '1', 'J': '3', 'A': '4', 'G': '6', 'S': '5'}
dict_int_to_char = {'0': 'O', '1': 'I', '3': 'J', '4': 'A', '6': 'G', '5': 'S'}

def license_complies_format(text):
    """Check if the license plate text has valid format (7 chars)."""
    if len(text) != 7:
        return False
    if (text[0] in string.ascii_uppercase or text[0] in dict_int_to_char) and \
       (text[1] in string.ascii_uppercase or text[1] in dict_int_to_char) and \
       (text[2] in string.digits or text[2] in dict_char_to_int) and \
       (text[3] in string.digits or text[3] in dict_char_to_int) and \
       (text[4] in string.ascii_uppercase or text[4] in dict_int_to_char) and \
       (text[5] in string.ascii_uppercase or text[5] in dict_int_to_char) and \
       (text[6] in string.ascii_uppercase or text[6] in dict_int_to_char):
        return True
    return False

def format_license(text):
    """Map ambiguous characters to correct ones."""
    mapping = {0: dict_int_to_char, 1: dict_int_to_char, 4: dict_int_to_char,
               5: dict_int_to_char, 6: dict_int_to_char, 2: dict_char_to_int, 3: dict_char_to_int}
    license_plate_ = ''
    for j in range(7):
        if text[j] in mapping[j]:
            license_plate_ += mapping[j][text[j]]
        else:
            license_plate_ += text[j]
    return license_plate_

def read_license_plate(license_plate_crop):
    """Extract license text from cropped image."""
    detections = reader.readtext(license_plate_crop)
    for _, text, score in detections:
        text = text.upper().replace(' ', '')
        if license_complies_format(text):
            return format_license(text), score
    return None, None
