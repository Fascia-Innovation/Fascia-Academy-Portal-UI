#!/usr/bin/env python3.11
"""
Fascia Academy - Affiliate Settlement Script
=============================================
Runs on the 1st of each month.
Fetches all contacts tagged 'affiliate - intro attended' from the previous month,
groups them by affiliate code, calculates 30% commission on actual paid amount (excl. VAT),
generates a PDF report per affiliate, and emails everything to info@fasciaacademy.com.

Usage:
    python3.11 affiliate_settlement.py              # Runs for previous calendar month
    python3.11 affiliate_settlement.py --month 2026-03  # Specific month (YYYY-MM)
    python3.11 affiliate_settlement.py --test       # Dry run - generates PDFs but does NOT send email

Formula (aligned with dashboard):
    net_excl_vat = paid_incl_vat / 1.25
    commission   = net_excl_vat * 30%

Date filtering: uses CF_COURSE_DATE custom field (the actual course date),
NOT the contact's dateAdded, to correctly attribute bookings to the right month.

Dependencies:
    pip install requests python-dateutil reportlab
"""

import argparse
import os
import smtplib
import requests
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                 Table, TableStyle, HRFlowable)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# --- Configuration ------------------------------------------------------------
GHL_API_KEY    = os.getenv("GHL_API_KEY",    "")
LOCATION_ID    = os.getenv("GHL_LOCATION_ID","krCLgbfFUDCiil9Hy5jV")
VAT_RATE       = 0.25        # 25% Swedish VAT
COMMISSION_PCT = 0.30        # 30% affiliate commission (on excl. VAT)
AFFILIATE_TAG  = "affiliate - intro attended"

# Email - set SMTP credentials via environment variables
SMTP_HOST  = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT  = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER  = os.getenv("SMTP_USER", "info@fasciaacademy.com")
SMTP_PASS  = os.getenv("SMTP_PASS", "")
EMAIL_FROM = "Fascia Academy <info@fasciaacademy.com>"
EMAIL_TO   = "info@fasciaacademy.com"

# --- GHL Custom Field IDs -----------------------------------------------------
CF_AFFILIATE_CODE  = "W8RD1QDdEVrKXMVERpgh"   # Settlement - Affiliate Code
CF_AFFILIATE_NAME  = "fuxw7soQ2NgOnTTnbp92"   # Settlement - Affiliate Name
CF_PAID_AMOUNT_SEK = "aRSQqWmTQKK9J5YXraW4"   # Settlement - Paid Amount SEK
CF_COURSE_DATE     = "a569gpb0949SUuvaCRH0"    # Course Date (actual course date)
CF_COURSE_TYPE     = "PhD7I0yvO71RFQeDRUeq"    # Course Type
CF_COURSE_LEADER   = "9LSVApvUmUTKW1SqSDhv"    # Course Leader

# --- GHL API helpers ----------------------------------------------------------
HEADERS = {
    "Authorization": f"Bearer {GHL_API_KEY}",
    "Content-Type":  "application/json",
    "Version":       "2021-07-28"
}


def get_contacts_with_tag(tag: str) -> list:
    """Fetch all contacts that have the given tag via search API."""
    url = "https://services.leadconnectorhq.com/contacts/search"
    contacts = []
    page = 1
    while True:
        payload = {
            "locationId": LOCATION_ID,
            "filters": [{"field": "tags", "operator": "contains", "value": tag}],
            "pageLimit": 100,
            "page": page
        }
        resp = requests.post(url, headers=HEADERS, json=payload)
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("contacts", [])
        contacts.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return contacts


def get_contact_detail(contact_id: str) -> dict:
    """Fetch full contact record including custom fields."""
    url = f"https://services.leadconnectorhq.com/contacts/{contact_id}"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    return resp.json().get("contact", {})


# --- Data processing ----------------------------------------------------------

def filter_by_course_month(contacts: list, year: int, month: int) -> list:
    """
    Keep only contacts whose CF_COURSE_DATE falls within the given year/month.

    Falls back to dateAdded if CF_COURSE_DATE is not set on the contact,
    but CF_COURSE_DATE is preferred because it reflects the actual course date
    rather than when the contact was created in GHL.
    """
    filtered = []
    for c in contacts:
        cf = {item["id"]: item.get("value", "") for item in c.get("customFields", [])}
        course_date_str = cf.get(CF_COURSE_DATE, "").strip()

        # Prefer CF_COURSE_DATE; fall back to dateAdded
        date_str = course_date_str or c.get("dateAdded", "")
        if not date_str:
            continue

        try:
            # Handle both ISO format and plain YYYY-MM-DD
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            if dt.year == year and dt.month == month:
                filtered.append(c)
        except Exception:
            continue

    return filtered


def build_affiliate_groups(contacts: list) -> dict:
    """
    Group contacts by affiliate code.
    Returns: { affiliate_code: { name, bookings: [...] } }

    Commission formula (aligned with dashboard):
        net_excl_vat = paid_incl_vat / 1.25
        commission   = net_excl_vat * 30%
    """
    groups = {}
    for c in contacts:
        cf = {item["id"]: item.get("value", "") for item in c.get("customFields", [])}
        code = cf.get(CF_AFFILIATE_CODE, "").strip().upper()
        name = cf.get(CF_AFFILIATE_NAME, "").strip()
        if not code:
            continue

        paid_raw = cf.get(CF_PAID_AMOUNT_SEK, 0)
        try:
            paid_incl_vat = float(paid_raw) if paid_raw else 0.0
        except (ValueError, TypeError):
            paid_incl_vat = 0.0

        # Formula aligned with dashboard: divide first, then calculate commission
        net_excl_vat = round(paid_incl_vat / (1 + VAT_RATE), 2)
        commission   = round(net_excl_vat * COMMISSION_PCT, 2)

        booking = {
            "contact_name":  f"{c.get('firstName','').strip()} {c.get('lastName','').strip()}".strip(),
            "contact_email": c.get("email", ""),
            "course_date":   (cf.get(CF_COURSE_DATE, "") or "")[:10],
            "course_type":   cf.get(CF_COURSE_TYPE, "") or "Intro",
            "course_leader": cf.get(CF_COURSE_LEADER, "") or "-",
            "paid_incl_vat": paid_incl_vat,
            "net_excl_vat":  net_excl_vat,
            "commission":    commission,
        }

        if code not in groups:
            groups[code] = {"name": name or code, "bookings": []}
        groups[code]["bookings"].append(booking)

    return groups


# --- PDF generation -----------------------------------------------------------
FA_GREEN  = colors.HexColor("#2E7D32")
FA_LIGHT  = colors.HexColor("#E8F5E9")
FA_GREY   = colors.HexColor("#F5F5F5")
FA_DARK   = colors.HexColor("#212121")


def generate_pdf(affiliate_code: str, affiliate_name: str, bookings: list,
                 period_label: str, output_path: str) -> float:
    """Generate a PDF settlement report for one affiliate. Returns total commission."""

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Normal"],
                                  fontSize=18, textColor=FA_GREEN,
                                  fontName="Helvetica-Bold", spaceAfter=2)
    sub_style   = ParagraphStyle("sub", parent=styles["Normal"],
                                  fontSize=10, textColor=colors.grey,
                                  fontName="Helvetica", spaceAfter=6)
    label_style = ParagraphStyle("label", parent=styles["Normal"],
                                  fontSize=10, textColor=FA_DARK,
                                  fontName="Helvetica", leading=16)
    note_style  = ParagraphStyle("note", parent=styles["Normal"],
                                  fontSize=9, textColor=colors.grey,
                                  fontName="Helvetica-Oblique")
    total_style = ParagraphStyle("total", parent=styles["Normal"],
                                  fontSize=13, textColor=FA_GREEN,
                                  fontName="Helvetica-Bold")

    story = []

    # Header
    story.append(Paragraph("Fascia Academy", title_style))
    story.append(Paragraph("Affiliate Settlement Report | Fascia Innovation AB", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=FA_GREEN, spaceAfter=10))

    # Info block
    info_data = [
        ["Affiliate:", affiliate_name],
        ["Code:", affiliate_code],
        ["Period:", period_label],
        ["Courses attended:", str(len(bookings))],
    ]
    info_table = Table(info_data, colWidths=[40*mm, 120*mm])
    info_table.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",      (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 10),
        ("TEXTCOLOR",     (0, 0), (0, -1), FA_DARK),
        ("TEXTCOLOR",     (1, 0), (1, -1), colors.HexColor("#444444")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 10*mm))

    # Invoice instructions
    story.append(Paragraph("<b>Invoice Instructions</b>", label_style))
    story.append(Spacer(1, 2*mm))
    instr_data = [
        ["Invoice to:",    "Fascia Innovation AB"],
        ["Email:",         "info@fasciaacademy.com"],
        ["Reference:",     "Fascia Academy Affiliate"],
        ["Payment terms:", "20 days net"],
        ["Commission:",    "30% of paid amount excl. 25% VAT (intro courses only)"],
    ]
    instr_table = Table(instr_data, colWidths=[40*mm, 120*mm])
    instr_table.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",      (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("TEXTCOLOR",     (0, 0), (-1, -1), colors.HexColor("#444444")),
        ("BACKGROUND",    (0, 0), (-1, -1), FA_GREY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ]))
    story.append(instr_table)
    story.append(Spacer(1, 10*mm))

    # Bookings table
    story.append(Paragraph("<b>Attendance Details</b>", label_style))
    story.append(Spacer(1, 2*mm))

    table_data = [["Participant", "Course Date", "Course Type", "Paid incl. VAT (SEK)", "Net excl. VAT (SEK)", "Commission 30% (SEK)"]]
    total_commission = 0.0
    for b in bookings:
        table_data.append([
            b["contact_name"][:30],
            b["course_date"] or "-",
            b["course_type"][:20],
            f"{b['paid_incl_vat']:,.0f}",
            f"{b['net_excl_vat']:,.0f}",
            f"{b['commission']:,.0f}",
        ])
        total_commission += b["commission"]

    # Total row
    table_data.append(["", "", "TOTAL", "", "", f"{total_commission:,.0f}"])

    col_w = [45*mm, 25*mm, 35*mm, 28*mm, 28*mm, 28*mm]
    bookings_table = Table(table_data, colWidths=col_w, repeatRows=1)
    bookings_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND",    (0, 0),  (-1, 0),  FA_GREEN),
        ("TEXTCOLOR",     (0, 0),  (-1, 0),  colors.white),
        ("FONTNAME",      (0, 0),  (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0),  (-1, 0),  8.5),
        ("ALIGN",         (0, 0),  (-1, 0),  "CENTER"),
        # Data rows
        ("FONTNAME",      (0, 1),  (-1, -2), "Helvetica"),
        ("FONTSIZE",      (0, 1),  (-1, -2), 9),
        ("ROWBACKGROUNDS",(0, 1),  (-1, -2), [colors.white, FA_GREY]),
        ("ALIGN",         (3, 1),  (-1, -2), "RIGHT"),
        # Total row
        ("BACKGROUND",    (0, -1), (-1, -1), FA_LIGHT),
        ("FONTNAME",      (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, -1), (-1, -1), 10),
        ("TEXTCOLOR",     (0, -1), (-1, -1), FA_GREEN),
        ("ALIGN",         (2, -1), (2, -1),  "RIGHT"),
        ("ALIGN",         (5, -1), (5, -1),  "RIGHT"),
        # Grid
        ("GRID",          (0, 0),  (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("BOTTOMPADDING", (0, 0),  (-1, -1), 5),
        ("TOPPADDING",    (0, 0),  (-1, -1), 5),
        ("LEFTPADDING",   (0, 0),  (-1, -1), 5),
    ]))
    story.append(bookings_table)
    story.append(Spacer(1, 8*mm))

    # Summary
    story.append(Paragraph(f"Total to invoice: <b>{total_commission:,.0f} SEK</b> (excl. VAT)", total_style))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Commission is paid out after the course has been completed, as part of the monthly settlement.",
        note_style
    ))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "<b>Calculation methodology:</b> Net excl. VAT = Paid incl. VAT / 1.25. "
        "Commission = Net excl. VAT x 30%.",
        note_style
    ))
    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        f"Generated automatically by Fascia Academy Affiliate Settlement System on "
        f"{datetime.now().strftime('%Y-%m-%d')}",
        note_style
    ))

    doc.build(story)
    return total_commission


# --- Email sending ------------------------------------------------------------
def send_summary_email(period_label: str, affiliate_summaries: list, pdf_paths: list):
    """Send summary email to info@fasciaacademy.com with all PDF reports attached."""
    msg = MIMEMultipart()
    msg["From"]    = EMAIL_FROM
    msg["To"]      = EMAIL_TO
    names          = ", ".join(name for _, name, _, _ in affiliate_summaries)
    msg["Subject"] = f"Affiliate Settlement - {period_label} - {names} - Please Review & Forward"

    rows        = ""
    grand_total = 0.0
    for code, name, n, total in affiliate_summaries:
        rows += (f"<tr><td style='padding:6px'>{name}</td>"
                 f"<td style='padding:6px'>{code}</td>"
                 f"<td style='padding:6px;text-align:center'>{n}</td>"
                 f"<td style='padding:6px;text-align:right'>{total:,.0f} SEK</td></tr>")
        grand_total += total

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px">
    <h2 style="color:#2E7D32">Affiliate Settlement - {period_label}</h2>
    <p>Hi,</p>
    <p>The monthly affiliate settlement for <strong>{period_label}</strong> is ready for your review.</p>
    <p>Please check the attached PDF reports and forward each one to the respective affiliate.</p>

    <h3>Summary</h3>
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
      <tr style="background:#2E7D32;color:white">
        <th style="padding:8px;text-align:left">Affiliate</th>
        <th style="padding:8px;text-align:left">Code</th>
        <th style="padding:8px;text-align:center">Bookings</th>
        <th style="padding:8px;text-align:right">Commission (SEK)</th>
      </tr>
      {rows}
      <tr style="background:#E8F5E9;font-weight:bold">
        <td colspan="3" style="padding:8px">Grand Total</td>
        <td style="padding:8px;text-align:right">{grand_total:,.0f} SEK</td>
      </tr>
    </table>

    <p style="margin-top:20px;font-size:12px;color:#888">
      This email was generated automatically by the Fascia Academy Affiliate Settlement System.<br>
      Commission = 30% of paid amount excl. 25% VAT, for intro course bookings only.
    </p>
    </body></html>
    """

    msg.attach(MIMEText(html, "html"))

    for path in pdf_paths:
        with open(path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={os.path.basename(path)}")
        msg.attach(part)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(EMAIL_FROM, EMAIL_TO, msg.as_string())

    print(f"Email sent to {EMAIL_TO}")


# --- Main ---------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Fascia Academy Affiliate Settlement")
    parser.add_argument("--month", help="Month to process (YYYY-MM). Defaults to previous month.")
    parser.add_argument("--test",  action="store_true",
                        help="Dry run - generate PDFs but do NOT send email.")
    args = parser.parse_args()

    if args.month:
        year, month = map(int, args.month.split("-"))
    else:
        prev = date.today().replace(day=1) - relativedelta(months=1)
        year, month = prev.year, prev.month

    period_label = datetime(year, month, 1).strftime("%B %Y")
    print(f"\n=== Fascia Academy Affiliate Settlement - {period_label} ===\n")

    if not GHL_API_KEY:
        print("ERROR: GHL_API_KEY environment variable is not set.")
        return

    print(f"Fetching contacts with tag '{AFFILIATE_TAG}'...")
    all_contacts = get_contacts_with_tag(AFFILIATE_TAG)
    print(f"  Total contacts with tag: {len(all_contacts)}")

    # Filter by course date (CF_COURSE_DATE), not dateAdded
    contacts = filter_by_course_month(all_contacts, year, month)
    print(f"  Contacts with course in {period_label}: {len(contacts)}")

    if not contacts:
        print("\nNo affiliate bookings found for this month. Nothing to generate.")
        return

    # Group by affiliate code and calculate commissions
    groups = build_affiliate_groups(contacts)
    print(f"  Affiliate codes found: {', '.join(groups.keys())}")

    # Generate PDFs
    os.makedirs("settlements", exist_ok=True)
    summaries = []
    pdf_paths = []

    for code, data in sorted(groups.items()):
        aff_name = data["name"]
        bookings = data["bookings"]
        safe_code = code.replace(" ", "_")
        filename  = f"settlements/affiliate_{safe_code}_{year}-{month:02d}.pdf"

        total = generate_pdf(code, aff_name, bookings, period_label, filename)
        print(f"\n  {aff_name} ({code}): {len(bookings)} bookings, "
              f"total commission = {total:,.0f} SEK")
        print(f"  PDF: {filename}")

        summaries.append((code, aff_name, len(bookings), total))
        pdf_paths.append(filename)

    # Send email (unless --test)
    if args.test:
        print(f"\n[TEST MODE] PDFs generated in ./settlements/ - email NOT sent.")
    else:
        print(f"\nSending summary email to {EMAIL_TO}...")
        send_summary_email(period_label, summaries, pdf_paths)

    print("\nDone.")


if __name__ == "__main__":
    main()
