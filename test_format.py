import sys
sys.path.append(r'd:\SEETECH\Smart Quotation Generation\electricity-bill-proposal-generator\backend')
from parsers.pdf_parser import detect_bill_format
with open('d:/SEETECH/Smart Quotation Generation/electricity-bill-proposal-generator/backend/current_bill_dump.txt', 'r', encoding='utf-8') as f:
    print(detect_bill_format(f.read()))
