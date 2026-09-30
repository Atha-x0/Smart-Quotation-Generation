import re

text = """
contract 40% of Con. Feeder Voltage . .
Demand (KVA ; 58.00 Demand(KVA) : 23.20 KY): 11 LIS Indicator +
Billed Demand (KVA) Q @ Rs. | 424 ivheeling Charge @ 01.17 00.00
Biled PF. 0.000 LF. | OD TariffEC 00.00
[Current 28-02-2025 | ____33553.300|_90243.800, == 7.800) a0811.400|__—«13.090)_—=—«22.8 20)
[Total Consumption [0.000] o.00g) _——~—0.000) G00] 0.000) 0.000)
"""

cd_match = re.search(r"Contract[\s\S]{0,80}?Demand(?:\s*\(KVA\s*[:;]?\s*)?([0-9,]+(?:\.[0-9]+)?)", text, re.IGNORECASE)
print("CD:", cd_match.group(1) if cd_match else None)

pf_match = re.search(r"B[il]+ed\s*P\.?F\.?\s*([0-9,]+(?:\.[0-9]+)?)", text, re.IGNORECASE)
print("PF:", pf_match.group(1) if pf_match else None)

# Fix for 22.8 20) -> 22.820
amd_match = re.search(r"Current\s+\d{2}-\d{2}-\d{4}.*?([0-9]+\.[0-9]+)[^\n0-9]*([0-9]+(?:\.[0-9\s]+)?)", text, re.IGNORECASE)
if amd_match:
    val = amd_match.group(2).replace(" ", "")
    print("AMD:", val)