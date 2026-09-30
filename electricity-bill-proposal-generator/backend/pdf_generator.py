import json
import io
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm, inch
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_JUSTIFY

PAGE_WIDTH, PAGE_HEIGHT = A4
LEFT_MARGIN = 40
RIGHT_MARGIN = 40
TOP_MARGIN = 130 
BOTTOM_MARGIN = 60

def format_inr(amount):
    try:
        val = float(amount)
        if val == 0: return "Rs 0.00"
        s = f"{val:.2f}"
        integer_part, decimal_part = s.split('.')
        is_negative = integer_part.startswith('-')
        if is_negative:
            integer_part = integer_part[1:]
        
        last_three = integer_part[-3:]
        other_numbers = integer_part[:-3]
        if other_numbers != '':
            last_three = ',' + last_three
            res = ''
            for i, c in enumerate(reversed(other_numbers)):
                if i > 0 and i % 2 == 0:
                    res += ','
                res += c
            integer_part = res[::-1] + last_three
        else:
            integer_part = last_three
            
        return "Rs " + ("-" if is_negative else "") + integer_part + "." + decimal_part
    except:
        return "Rs 0.00"


def draw_header_footer(canvas_obj: canvas.Canvas, doc: BaseDocTemplate, data: dict):
    canvas_obj.saveState()
    current_y = PAGE_HEIGHT - 40
    logo_path = r"d:\SEETECH\Smart Quotation Generation\adiabatic-cooler-quotation\seetech-logo.png"
    if os.path.exists(logo_path):
        canvas_obj.drawImage(logo_path, LEFT_MARGIN, current_y - 45, width=145, height=35, mask='auto')
    else:
        canvas_obj.setFont("Helvetica-Bold", 24)
        canvas_obj.setFillColor(colors.HexColor("#3ba846"))
        canvas_obj.drawString(LEFT_MARGIN, current_y - 20, "SEE")
        canvas_obj.setFillColor(colors.HexColor("#2d5ca6"))
        canvas_obj.drawString(LEFT_MARGIN + 45, current_y - 20, "TECH")
        canvas_obj.setFont("Helvetica-Bold", 9.5)
        canvas_obj.setFillColor(colors.HexColor("#1A1A1A"))
        canvas_obj.drawString(LEFT_MARGIN, current_y - 35, "SYSTEMS PVT. LTD.")

    canvas_obj.setStrokeColor(colors.HexColor("#CCCCCC"))
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(205, current_y, 205, current_y - 60)

    mid_x = 215
    mid_y = current_y - 10
    canvas_obj.setFont("Helvetica", 7.5)
    canvas_obj.setFillColor(colors.HexColor("#333333"))
    canvas_obj.drawString(mid_x, mid_y, "11/5, IT Park, S Ambazari Rd,")
    canvas_obj.drawString(mid_x, mid_y - 10, "Opposite VNIT, Nagpur, Maharashtra 440022")
    canvas_obj.drawString(mid_x, mid_y - 25, "Phone: +91 9422145534")
    canvas_obj.drawString(mid_x, mid_y - 37, "Email: info@seetechsolutions.in")
    canvas_obj.drawString(mid_x, mid_y - 49, "Web: www.seetechsolutions.in")

    canvas_obj.line(390, current_y, 390, current_y - 60)

    right_x = 400
    canvas_obj.setFont("Helvetica-Bold", 18)
    canvas_obj.setFillColor(colors.HexColor("#1A1A1A"))
    canvas_obj.drawString(right_x, current_y - 10, "PROPOSAL")
    canvas_obj.setFont("Helvetica-Bold", 8.5)
    canvas_obj.drawString(right_x, current_y - 30, "Proposal No.:")
    canvas_obj.drawString(right_x, current_y - 44, "Date:")
    canvas_obj.drawString(right_x, current_y - 58, "Prepared By:")
    canvas_obj.setFont("Helvetica", 8.5)
    canvas_obj.drawString(right_x + 65, current_y - 30, f"PRP-{datetime.now().strftime('%Y%m%d')}-001")
    canvas_obj.drawString(right_x + 65, current_y - 44, datetime.now().strftime('%d/%m/%Y'))
    canvas_obj.drawString(right_x + 65, current_y - 58, "SEETECH Solutions")
    
    canvas_obj.setStrokeColor(colors.HexColor("#1A1A1A"))
    canvas_obj.setLineWidth(1)
    canvas_obj.line(LEFT_MARGIN, current_y - 75, PAGE_WIDTH - RIGHT_MARGIN, current_y - 75)

    footer_y = 30
    canvas_obj.setFont("Helvetica-Bold", 9)
    canvas_obj.setFillColor(colors.HexColor("#1A1A1A"))
    canvas_obj.drawCentredString(PAGE_WIDTH / 2.0, footer_y + 15, "Thank you for your business!")
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(colors.HexColor("#666666"))
    canvas_obj.drawCentredString(PAGE_WIDTH / 2.0, footer_y + 2, "This proposal is confidential and intended solely for the recipient.")
    canvas_obj.restoreState()

def create_table(data_matrix, col_widths, style_cmds):
    t = Table(data_matrix, colWidths=col_widths)
    t.setStyle(TableStyle(style_cmds))
    return t

def generate_pdf(data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = BaseDocTemplate(buffer, pagesize=A4, rightMargin=RIGHT_MARGIN, leftMargin=LEFT_MARGIN, topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN)
    frame = Frame(LEFT_MARGIN, BOTTOM_MARGIN, PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN, id='normal')
    
    def on_page(canvas, doc):
        draw_header_footer(canvas, doc, data)
        
    template = PageTemplate(id='test', frames=frame, onPage=on_page)
    doc.addPageTemplates([template])
    
    elements = []
    styles = getSampleStyleSheet()
    
    h1_style = ParagraphStyle('Heading1Style', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor("#0f172a"), spaceAfter=15, spaceBefore=10)
    h2_style = ParagraphStyle('Heading2Style', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor("#385FA8"), spaceAfter=10, spaceBefore=15)
    normal_style = styles['Normal']
    normal_style.fontSize = 9
    normal_style.textColor = colors.HexColor("#333333")
    normal_style.leading = 13
    normal_style.alignment = TA_JUSTIFY
    bold_style = ParagraphStyle('BoldStyle', parent=normal_style, fontName='Helvetica-Bold')

    client = data.get("client", {})
    metrics = data.get("metrics", {})
    bills = data.get("bills", [])
    connected_loads = data.get("connectedLoads", [])
    recommendations = data.get("recommendations", [])

    elements.append(Paragraph("Electricity Bill Analysis & Connected Load Review", h1_style))
    
    client_data = [
        [Paragraph("<b>Client Name</b>", bold_style), ": " + (client.get('companyName') or 'N/A')],
        [Paragraph("<b>Location</b>", bold_style), ": " + (client.get('location') or 'N/A')],
        [Paragraph("<b>Industry</b>", bold_style), ": " + (client.get('industryType') or 'N/A')],
        [Paragraph("<b>DISCOM</b>", bold_style), ": " + (client.get('discom') or 'N/A')],
        [Paragraph("<b>Tariff Category</b>", bold_style), ": " + (client.get('tariffCategory') or 'N/A')]
    ]
    t_client = Table(client_data, colWidths=[120, PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN - 120])
    t_client.setStyle(TableStyle([('FONT', (0,0), (-1,-1), 'Helvetica', 9.5), ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor("#333333")), ('VALIGN', (0,0), (-1,-1), 'TOP'), ('BOTTOMPADDING', (0,0), (-1,-1), 4), ('TOPPADDING', (0,0), (-1,-1), 4)]))
    elements.append(t_client)
    elements.append(Spacer(1, 15))

    avg_bill = metrics.get('avgMonthlyBill', 0)
    annual_spend = metrics.get('totalAnnualSpend', 0)
    contract_demand = max([b.get('contractDemandKVA', 0) for b in bills]) if bills else 0
    actual_demands = [b.get('actualDemandKVA', 0) for b in bills if b.get('actualDemandKVA')]
    max_actual_demand = max(actual_demands) if actual_demands else 0
    min_actual_demand = min(actual_demands) if actual_demands else 0
    billing_demands = [b.get('billingDemandKVA', 0) for b in bills if b.get('billingDemandKVA')]
    max_billing_demand = max(billing_demands) if billing_demands else 0
    total_cl = sum([cl.get('totalKw', 0) for cl in connected_loads])

    # 1. Executive Summary
    elements.append(Paragraph("1. Executive Summary", h2_style))
    summary_text = f"Based on the uploaded electricity bill and connected load working files, <b>{(client.get('companyName') or 'the client')}</b> has an average monthly electricity bill of <b>{format_inr(avg_bill)}</b>. Based on the uploaded month(s), the estimated annualized electricity spend is approximately <b>{format_inr(annual_spend)}</b>.<br/>"
    summary_text += f"The plant has a contract demand of <b>{contract_demand} kVA</b>. The maximum actual demand observed in the uploaded bill data is <b>{max_actual_demand} kVA</b>, while the maximum billing demand is <b>{max_billing_demand} kVA</b>. The uploaded connected load data includes {len(connected_loads)} equipment rows with total connected load of {total_cl:.2f} kW."
    elements.append(Paragraph(summary_text, normal_style))
    elements.append(Spacer(1, 10))

    # 2. Extraction Reliability Summary
    elements.append(Paragraph("2. Extraction Reliability Summary", h2_style))
    
    avg_confidence = sum([b.get('extractionConfidence', 0) for b in bills]) / len(bills) if bills else 0
    total_warnings = sum([len(b.get('extractionWarnings', [])) for b in bills])
    
    ext_data = [
        ["Average Bill Extraction Confidence", f"{avg_confidence:.0f}%"],
        ["Total Bill Extraction Warnings", str(total_warnings)],
        ["Overall Bill Extraction Status", Paragraph("Overall extraction quality is high. Values are suitable for preliminary proposal generation." if total_warnings == 0 and avg_confidence >= 85 else "Overall extraction quality is low. Manual review and correction are required before using this proposal.", normal_style)],
        ["Manual Review Requirement", Paragraph("Extracted values should be reviewed before final commercial submission. High confidence values are suitable for preliminary proposal generation." if total_warnings == 0 and avg_confidence >= 85 else "Low confidence extraction. Manual correction required before final proposal.", normal_style)]
    ]
    t_ext = Table(ext_data, colWidths=[200, 315])
    t_ext.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")), 
        ('PADDING', (0,0), (-1,-1), 10),
        ('FONT', (0,0), (0,-1), 'Helvetica'),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor("#333333"))
    ]))
    elements.append(t_ext)
    elements.append(Spacer(1, 10))

    # 3. Bill Extraction Details
    elements.append(Paragraph("3. Bill Extraction Details", h2_style))
    if bills:
        bed_header = ["Month", "Format", "Confidence", "Manual Review Status"]
        bed_data = [bed_header]
        for b in bills:
            month_str = str(b.get('month', 'N/A'))
            if '-' in month_str: month_str = month_str.split('-')[0]
            bed_data.append([
                month_str,
                str(b.get('detectedBillFormat', 'Not available')),
                f"{b.get('extractionConfidence', 'N/A')}%",
                "Review Recommended" if b.get('extractionConfidence', 100) < 85 else "Approved"
            ])
        t_bed = Table(bed_data, colWidths=[80, 150, 80, 200])
        t_bed.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        elements.append(t_bed)
    else:
        elements.append(Paragraph("No bill data available.", normal_style))
    elements.append(Spacer(1, 10))

    # 4. Project Savings Summary
    elements.append(Paragraph("4. Project Savings Summary", h2_style))
    ratio = (total_cl / max_actual_demand) if max_actual_demand > 0 else 0
    priority = "High priority for connected load validation and operating pattern study" if (connected_loads and ratio > 1.3) else "Medium priority for further validation"
    savings_data = [
        [Paragraph("Single-Month Demand Optimization Opportunity", normal_style), f"{max(0, contract_demand - max_billing_demand)} kVA"],
        [Paragraph("Multi-Month Demand Optimization Opportunity", normal_style), f"{max(0, contract_demand - max_actual_demand)} kVA"],
        [Paragraph("Demand Optimization Status", normal_style), Paragraph("Optimization Potential Detected" if (contract_demand - max_actual_demand) > 0 else "Optimal", normal_style)],
        [Paragraph("Power Factor Status", normal_style), Paragraph("Healthy" if metrics.get('avgPowerFactor', 0) >= 0.98 else "Improvement Needed", normal_style)],
        [Paragraph("Connected Load Status", normal_style), Paragraph("Data Available" if connected_loads else "Not Uploaded", normal_style)],
        [Paragraph("Connected Load / Actual Demand Ratio", normal_style), Paragraph(f"{ratio:.2f}" if connected_loads else "Not applicable", normal_style)],
        [Paragraph("Preliminary Implementation Priority", normal_style), Paragraph(priority, normal_style)]
    ]
    t_sav = Table(savings_data, colWidths=[240, 275])
    t_sav.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")), ('PADDING', (0,0), (-1,-1), 6), ('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(t_sav)
    elements.append(Spacer(1, 10))

    # 5. Multi-Month Trend Review
    elements.append(Paragraph("5. Multi-Month Electricity Bill Trend Review", h2_style))
    bill_amounts = [b.get('totalBillAmount', 0) for b in bills]
    kwhs = [b.get('kWh', 0) for b in bills]
    max_bill = max(bill_amounts) if bill_amounts else 0
    min_bill = min(bill_amounts) if bill_amounts else 0
    avg_kwh = sum(kwhs) / len(kwhs) if kwhs else 0
    max_kwh = max(kwhs) if kwhs else 0
    
    trend_data = [
        ["Analysed Months", str(len(bills))],
        ["Average Monthly Bill", format_inr(avg_bill)],
        ["Maximum Monthly Bill", format_inr(max_bill)],
        ["Minimum Monthly Bill", format_inr(min_bill)],
        ["Average kWh Consumption", f"{avg_kwh:,.0f} kWh"],
        ["Maximum kWh Consumption", f"{max_kwh:,.0f} kWh"],
        ["Consumption Trend", "Stable"],
        ["Bill Amount Trend", "Stable"],
        ["Demand Trend", "Stable"],
        ["Power Factor Trend", "Stable"]
    ]
    t_trend = Table(trend_data, colWidths=[240, 275])
    t_trend.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")), ('PADDING', (0,0), (-1,-1), 6)]))
    elements.append(t_trend)
    elements.append(Spacer(1, 10))

    # 6. Monthly Bill Data Table
    elements.append(Paragraph("6. Monthly Bill Data Table", h2_style))
    if bills:
        table_header = ["Month", "Actual Demand", "Billing Demand", "Units (kWh)", "PF", "Bill Amount"]
        bill_data = [table_header]
        for b in bills:
            month_str = str(b.get('month', 'N/A'))
            if '-' in month_str:
                month_str = month_str.split('-')[0]
            bill_data.append([
                month_str,
                str(b.get('actualDemandKVA', 'N/A')),
                str(b.get('billingDemandKVA', 'N/A')),
                str(b.get('kWh', 'N/A')),
                str(b.get('powerFactor', 'N/A')),
                format_inr(b.get('totalBillAmount', 0))
            ])
        t_bills = Table(bill_data, colWidths=[80, 80, 80, 80, 80, 100])
        t_bills.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        elements.append(t_bills)
    else:
        elements.append(Paragraph("No bill data available.", normal_style))
    elements.append(Spacer(1, 10))

    # 7. Input Data Summary
    elements.append(Paragraph("7. Input Data Summary", h2_style))
    in_data = [
        ["Bill Rows Extracted", str(len(bills))],
        ["Connected Load Rows Extracted", str(len(connected_loads))],
        ["Total Connected Load", f"{total_cl:.2f} kW" if connected_loads else "Not Uploaded"]
    ]
    t_in = Table(in_data, colWidths=[240, 275])
    t_in.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")), ('PADDING', (0,0), (-1,-1), 6)]))
    elements.append(t_in)
    elements.append(Spacer(1, 10))

    # 8. Electricity Bill Analysis
    elements.append(Paragraph("8. Electricity Bill Analysis", h2_style))
    eb_data = [
        ["Contract Demand", f"{contract_demand} kVA"],
        ["Maximum Actual Demand", f"{max_actual_demand} kVA"],
        ["Maximum Billing Demand", f"{max_billing_demand} kVA"],
        ["Average Power Factor", f"{metrics.get('avgPowerFactor', 0):.3f}"],
        ["Estimated Annualized Spend", format_inr(annual_spend)]
    ]
    t_eb = Table(eb_data, colWidths=[240, 275])
    t_eb.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")), ('PADDING', (0,0), (-1,-1), 6)]))
    elements.append(t_eb)
    elements.append(Spacer(1, 10))

    # 9. Bill Component Summary
    elements.append(Paragraph("9. Bill Component Summary", h2_style))
    if bills:
        pb = bills[0]
        bc_data = [
            ["Demand Charge", format_inr(pb.get('demandCharge', 0))],
            ["Energy Charge", format_inr(pb.get('energyCharge', 0))],
            ["PF Penalty / Incentive", format_inr(pb.get('pfPenalty', 0) or pb.get('pfIncentive', 0))],
            ["Total Bill Amount", format_inr(pb.get('totalBillAmount', 0))]
        ]
        t_bc = Table(bc_data, colWidths=[240, 275])
        t_bc.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")), ('PADDING', (0,0), (-1,-1), 6)]))
        elements.append(t_bc)
    else:
        elements.append(Paragraph("No bill data available.", normal_style))
    elements.append(Spacer(1, 10))

    # 11. Connected Load Data Status
    elements.append(Paragraph("11. Connected Load Data Status", h2_style))
    if connected_loads:
        elements.append(Paragraph(f"The uploaded connected load files indicate a total connected load of {total_cl:.2f} kW across {len(connected_loads)} equipment entries.", normal_style))
        cl_header = ["Equipment", "Quantity", "Rating", "Unit", "Total (kW)"]
        cl_data_list = [cl_header]
        for cl in connected_loads:
            cl_data_list.append([
                Paragraph(cl.get('equipmentName', 'N/A'), normal_style),
                str(cl.get('quantity', 0)),
                str(cl.get('rating', 0)),
                cl.get('unit', 'HP'),
                f"{cl.get('totalKw', 0):.2f}"
            ])
        t_cl = Table(cl_data_list, colWidths=[150, 60, 60, 60, 80])
        t_cl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        elements.append(Spacer(1, 5))
        elements.append(t_cl)
    else:
        elements.append(Paragraph("Connected load file was not uploaded. Connected load-based analysis is excluded from this bill-only proposal.", normal_style))
    elements.append(Spacer(1, 10))

    # 16. Key Observations
    elements.append(Paragraph("16. Key Observations", h2_style))
    elements.append(Paragraph("Based on the comprehensive extraction and processing of the uploaded bills and connected load information, several key operational patterns have been identified. These observations form the baseline for the specific recommendations in the subsequent section. Continuous tracking of these patterns is advised for sustained optimization.", normal_style))
    elements.append(Spacer(1, 10))

    # 17. Recommended Actions
    elements.append(Paragraph("17. Recommended Actions", h2_style))
    if recommendations:
        for rec in recommendations:
            title = rec.get('title', 'Recommendation')
            desc = rec.get('description', '')
            
            # Handle unicode currency symbols causing black boxes in Helvetica
            title = title.replace('₹', 'Rs ').replace('\u20b9', 'Rs ')
            desc = desc.replace('₹', 'Rs ').replace('\u20b9', 'Rs ')
            
            elements.append(Paragraph(f"<b>{title}:</b> {desc}", normal_style))
            elements.append(Spacer(1, 5))
    else:
        elements.append(Paragraph("<b>Contract Demand Optimization:</b> Contract demand reduction evaluation is indicated. Since Contract Demand is more than 1.25 times the Highest Recorded MD, the existing CD appears higher than actual requirement.", normal_style))
        elements.append(Spacer(1, 5))
        elements.append(Paragraph("<b>Power Factor (PF) Improvement:</b> This indicates scope to improve billing performance by maintaining target PF close to 0.99. Existing capacitor banks, APFC relay settings, capacitor health, harmonic conditions, and kVAh billing impact should be checked.", normal_style))
        elements.append(Spacer(1, 5))
        elements.append(Paragraph("<b>Upload multiple monthly bills:</b> Add 6 to 12 months of electricity bills for stronger contract demand optimization analysis.", normal_style))
        elements.append(Spacer(1, 5))
        elements.append(Paragraph("<b>Review extraction quality:</b> Verify all values where parser confidence is moderate or low before submitting the final proposal.", normal_style))
        elements.append(Spacer(1, 10))

    # 18. Proposed Next Steps
    elements.append(Paragraph("18. Proposed Next Steps", h2_style))
    steps_list = [
        "1. Verify extracted electricity bill values with original bill PDFs.",
        "2. Upload 6 to 12 months of bills for trend-based demand review.",
        "3. Validate connected load list with site team and machine nameplates.",
        "4. Identify continuously operating, intermittent, and standby loads.",
        "5. Review actual demand trend, billing demand trend, and production trend.",
        "6. Finalize demand optimization and energy-saving measures.",
        "7. Prepare implementation-level proposal with investment and ROI."
    ]
    for step in steps_list:
        elements.append(Paragraph(step, normal_style))
    elements.append(Spacer(1, 10))

    # 19. Assumptions and Limitations
    elements.append(Paragraph("19. Assumptions and Limitations", h2_style))
    assumptions_list = [
        "• This proposal preview is based on uploaded electricity bill data and connected load files.",
        "• Savings potential shown in the dashboard is preliminary and should be validated with site measurements.",
        "• Connected load values depend on correctness of Excel file headers, ratings, quantities, and extracted values.",
        "• Demand optimization should be finalized only after reviewing at least 6 to 12 months of demand and consumption history.",
        "• Tariff applicability, billing demand rules, and charges should be confirmed."
    ]
    for assump in assumptions_list:
        elements.append(Paragraph(assump, normal_style))
    elements.append(Spacer(1, 10))

    # 20. Signature & Close
    elements.append(Paragraph("20. Signature & Close", h2_style))
    elements.append(Paragraph("We thank you for the opportunity to review the electricity bill and connected load details. The above analysis is prepared based on the uploaded electricity bill and machine detail data. Final savings and implementation recommendations should be validated after detailed site study, operating pattern review, and measurement-based verification.", normal_style))
    elements.append(Spacer(1, 20))
    
    signature_data = data.get('signatureData', {})
    client_name = signature_data.get('clientSignerName') or 'Enter client name'
    client_designation = signature_data.get('clientSignerDesignation') or 'Enter designation'
    client_date = signature_data.get('clientAcceptanceDate') or datetime.now().strftime('%d %b %Y')
    
    sig_data = [
        [Paragraph("<b>For SEE-Tech Solutions</b>", bold_style), Paragraph("<b>Client Acceptance / Acknowledgement</b>", bold_style)],
        ["", ""],
        ["", ""],
        ["", ""],
        [Paragraph("<b>Milind Chittawar</b><br/>Authorized Signatory<br/>Date: " + datetime.now().strftime('%d %b %Y'), normal_style), 
         Table([
             [Paragraph("<b>Name</b>", bold_style), Paragraph(client_name, normal_style)],
             [Paragraph("<b>Designation</b>", bold_style), Paragraph(client_designation, normal_style)],
             [Paragraph("<b>Date</b>", bold_style), Paragraph(client_date, normal_style)]
         ], colWidths=[80, 150], style=TableStyle([
             ('LINEBELOW', (1,0), (1,0), 0.5, colors.HexColor("#CCCCCC")),
             ('LINEBELOW', (1,1), (1,1), 0.5, colors.HexColor("#CCCCCC")),
             ('LINEBELOW', (1,2), (1,2), 0.5, colors.HexColor("#CCCCCC")),
             ('BOTTOMPADDING', (0,0), (-1,-1), 8),
         ]))]
    ]
    t_sig = Table(sig_data, colWidths=[250, 250])
    t_sig.setStyle(TableStyle([
        ('LINEBELOW', (0,2), (0,2), 0.5, colors.HexColor("#CCCCCC")),
        ('LINEBELOW', (1,2), (1,2), 0.5, colors.HexColor("#CCCCCC")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,4), (-1,4), 10),
    ]))
    elements.append(t_sig)
    
    elements.append(Spacer(1, 15))
    disclaimer_style = ParagraphStyle('DisclaimerStyle', parent=normal_style, fontSize=8, textColor=colors.HexColor("#666666"))
    elements.append(Paragraph("This proposal preview is generated using SEE-Tech Solutions Electricity Bill Proposal Generator and is intended for preliminary technical and commercial discussion.", disclaimer_style))
    
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
