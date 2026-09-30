import sys
from parsers.pdf_parser import extract_pdf_text
try:
    text = extract_pdf_text(sys.argv[1])
    with open('pdf_text_dump.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Done")
except Exception as e:
    print(f"Error: {e}")
