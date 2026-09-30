import os
import sys

from parsers.pdf_parser import parse_msedcl_ht_bill, detect_bill_format, parse_generic_bill

with open("extracted_tmp8hf58saa.pdf.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

fmt = detect_bill_format(text)
print("Detected format:", fmt)

if fmt == "MSEDCL_HT":
    bill = parse_msedcl_ht_bill(text, "test.pdf")
else:
    bill = parse_generic_bill(text, "test.pdf")

print("Total Bill Amount:", bill.get("totalBillAmount"))
print("Actual Demand KVA:", bill.get("actualDemandKVA"))
print("kVAh:", bill.get("kVAh"))
print("Power Factor:", bill.get("powerFactor"))
import json
print(json.dumps(bill, indent=2))
