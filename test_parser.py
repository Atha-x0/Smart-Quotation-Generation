import sys
import os

sys.path.append(r"d:\SEETECH\Smart Quotation Generation\electricity-bill-proposal-generator\backend")

from parsers.pdf_parser import parse_msedcl_ht_bill

with open("d:/SEETECH/Smart Quotation Generation/electricity-bill-proposal-generator/backend/current_bill_dump.txt", "r", encoding="utf-8") as f:
    text = f.read()

bill = parse_msedcl_ht_bill(text, "dump.pdf")

print("CONTRACT DEMAND:", bill.get("contractDemandKVA"))
print("ACTUAL DEMAND:", bill.get("actualDemandKVA"))
print("BILLING DEMAND:", bill.get("billingDemandKVA"))
print("POWER FACTOR:", bill.get("powerFactor"))
print("KWH:", bill.get("kWh"))
print("KVAH:", bill.get("kVAh"))
print("WARNINGS:", bill.get("extractionWarnings"))
