#!/usr/bin/env python3.11
"""
Fascia Academy - Course Leader Settlement Script
=================================================
Generates monthly settlement PDFs for each course leader based on
appointments with status "showed" in their GHL calendars.

Usage:
    python3.11 course_leader_settlement.py [--month YYYY-MM] [--test]

    --month   Month to process (e.g. 2026-03). Defaults to previous month.
    --test    Dry run - generates PDFs but does NOT send email.

Formula per participant (aligned with dashboard):
    Revenue (incl. VAT)
    / 1.25 (remove VAT)
    = Net excl. VAT
    - Transaction fee (3.1% of net excl. VAT)
    - FA margin (500 SEK / 50 EUR for Intro; 4000 SEK / 400 EUR for Diplo)
    - Affiliate commission (30% of net excl. VAT, only for Intro courses)
    = Course leader payout

Calendar name -> course type detection:
    "Introduktionskurs"   -> Intro, SEK
    "Introduction Course" -> Intro, EUR
    "Diplomerad"          -> Diplo, SEK
    "Qualified Fascia"    -> Diplo, EUR
    "Certifierad"         -> Cert, SEK  (no FA margin)
    "Certified Fascia"    -> Cert, EUR  (no FA margin)
    "Vidareutbildning"    -> Vidare, SEK (no FA margin)
    "Advanced Training"   -> Vidare, EUR (no FA margin)

Multi-leader shared calendars (e.g. "Fascia Academy Sollentuna") are handled
via the SHARED_CALENDARS dict below - map calendar name fragment to leader name.

Templates (calendar names starting with "Template") are excluded.

Dependencies:
    pip install requests python-dateutil reportlab
"""

import argparse
import os
import smtplib
import requests
from datetime import datetime, date, timezone
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
GHL_API_KEY   = os.getenv("GHL_API_KEY",    "")
LOCATION_ID   = os.getenv("GHL_LOCATION_ID","krCLgbfFUDCiil9Hy5jV")

VAT_RATE           = 0.25    # 25% Swedish VAT
TRANSACTION_FEE    = 0.031   # 3.1% Stripe/Klarna fee (on excl. VAT amount)
AFFILIATE_PCT      = 0.30    # 30% affiliate commission (on excl. VAT amount)

# FA margins per course type and currency
FA_MARGIN = {
    ("intro",  "SEK"): 500.0,
    ("intro",  "EUR"): 50.0,
    ("diplo",  "SEK"): 4000.0,
    ("diplo",  "EUR"): 400.0,
    ("cert",   "SEK"): 0.0,
    ("cert",   "EUR"): 0.0,
    ("vidare", "SEK"): 0.0,
    ("vidare", "EUR"): 0.0,
}

# Shared/multi-leader calendars: map a fragment of the calendar name (lowercase)
# to the course leader's name. Add entries here as needed.
# Example: "fascia academy sollentuna" -> "Ivar Bohlin"
SHARED_CALENDARS = {
    "fascia academy sollentuna": "Ivar Bohlin",
    # "fascia academy goteborg": "Anna Lindgren",
}

# Email config - set via environment variables
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
CF_INVOICE_EMAIL   = "HhbY84XQnDmMbA8ozN8H"   # Invoice Email
CF_INVOICE_COMPANY = "Foge87hqg3ZCWrF7kTAz"   # Invoice Company Name

# --- GHL API helpers ----------------------------------------------------------
HEADERS = {
    "Authorization": f"Bearer {GHL_API_KEY}",
    "Content-Type":  "application/json",
    "Version":       "2021-04-15"
}
HEADERS_V2 = {
    "Authorization": f"Bearer {GHL_API_KEY}",
    "Content-Type":  "application/json",
    "Version":       "2021-07-28"
}


def get_calendars() -> list:
    """Fetch all calendars for the location, excluding templates."""
    url = f"https://services.leadconnectorhq.com/calendars/?locationId={LOCATION_ID}"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    calendars = resp.json().get("calendars", [])
    return [c for c in calendars if not c["name"].startswith("Template")]


def classify_calendar(name: str) -> tuple:
    """
    Returns (course_type, currency) based on calendar name.
    course_type: 'intro' | 'diplo' | 'cert' | 'vidare' | None
    currency: 'SEK' | 'EUR'
    """
    n = name.lower()
    if "introduktionskurs" in n:
        return ("intro", "SEK")
    if "introduction course" in n:
        return ("intro", "EUR")
    if "diplomerad" in n:
        return ("diplo", "SEK")
    if "qualified fascia" in n:
        return ("diplo", "EUR")
    if "certifierad" in n:
        return ("cert", "SEK")
    if "certified fascia" in n:
        return ("cert", "EUR")
    if "vidareutbildning" in n:
        return ("vidare", "SEK")
    if "advanced training" in n:
        return ("vidare", "EUR")
    return (None, None)


def extract_leader_name(calendar_name: str) -> str:
    """
    Extract course leader name from calendar name.

    Standard format: "Course Type - Leader Name - City"
    Returns the middle segment (leader name).

    Shared/multi-leader calendars (e.g. "Fascia Academy Sollentuna") are
    matched against SHARED_CALENDARS and return the configured leader name.
    If no match is found, returns the full calendar name as fallback.
    """
    # Check shared calendars first
    lower = calendar_name.lower()
    for fragment, leader in SHARED_CALENDARS.items():
        if fragment in lower:
            return leader

    # Standard "A - Leader Name - City" format
    parts = [p.strip() for p in calendar_name.split(" - ")]
    if len(parts) >= 3:
        return parts[1]
    if len(parts) == 2:
        return parts[1]

    # Fallback: return full calendar name
    return calendar_name


def get_showed_appointments(calendar_id: str, year: int, month: int) -> list:
    """
    Fetch all appointments with status 'showed' for a given calendar
    within the specified month.
    """
    start_dt = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_dt = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_dt = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    start_ms = int(start_dt.timestamp() * 1000)
    end_ms   = int(end_dt.timestamp() * 1000)

    url = (f"https://services.leadconnectorhq.com/calendars/events"
           f"?locationId={LOCATION_ID}&calendarId={calendar_id}"
           f"&startTime={start_ms}&endTime={end_ms}")
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    events = resp.json().get("events", [])
    # GHL uses both "showed" and "show" depending on version
    return [e for e in events if e.get("appointmentStatus") in ("showed", "show")]


def get_contact_detail(contact_id: str) -> dict:
    """Fetch full contact record including custom fields."""
    url = f"https://services.leadconnectorhq.com/contacts/{contact_id}"
    resp = requests.get(url, headers=HEADERS_V2)
    resp.raise_for_status()
    return resp.json().get("contact", {})


def calculate_payout(paid_incl_vat: float, course_type: str, currency: str,
                     has_affiliate: bool) -> dict:
    """
    Calculate the course leader payout for a single participant.

    Formula (aligned with dashboard):
        net_excl_vat     = paid_incl_vat / 1.25
        transaction_fee  = net_excl_vat * 3.1%
        fa_margin        = fixed per course type/currency
        affiliate        = net_excl_vat * 30% (intro only, when applicable)
        payout           = net_excl_vat - transaction_fee - fa_margin - affiliate
    """
    net_excl_vat    = round(paid_incl_vat / (1 + VAT_RATE), 2)
    transaction_fee = round(net_excl_vat * TRANSACTION_FEE, 2)
    fa_margin       = FA_MARGIN.get((course_type, currency), 0.0)

    affiliate_deduction = 0.0
    if has_affiliate and course_type == "intro":
        affiliate_deduction = round(net_excl_vat * AFFILIATE_PCT, 2)

    payout = round(net_excl_vat - transaction_fee - fa_margin - affiliate_deduction, 2)

    return {
        "paid_incl_vat":       paid_incl_vat,
        "net_excl_vat":        net_excl_vat,
        "transaction_fee":     transaction_fee,
        "fa_margin":           fa_margin,
        "affiliate_deduction": affiliate_deduction,
        "payout":              payout,
    }


# --- PDF Generation -----------------------------------------------------------
FA_GREEN   = colors.HexColor("#2E7D32")
FA_LIGHT   = colors.HexColor("#E8F5E9")
FA_DARK    = colors.HexColor("#1B5E20")
WHITE      = colors.white
GREY_TEXT  = colors.HexColor("#555555")
LIGHT_GREY = colors.HexColor("#F5F5F5")


def generate_pdf(leader_name: str, currency: str, courses: list,
                 period_label: str, output_path: str) -> float:
    """
    Generate a settlement PDF for a course leader.
    courses: list of dicts with keys:
        calendar_name, course_type, course_date, participants (list of participant dicts)
    Returns total payout.
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm
    )
    styles = getSampleStyleSheet()
    story  = []

    # Header
    header_data = [[
        Paragraph("<font color='white'><b>FASCIA ACADEMY</b></font>",
                  ParagraphStyle("h", fontSize=16, textColor=WHITE, fontName="Helvetica-Bold")),
        Paragraph(f"<font color='white'>Course Leader Settlement<br/>{period_label}</font>",
                  ParagraphStyle("hr", fontSize=11, textColor=WHITE, alignment=TA_RIGHT))
    ]]
    header_tbl = Table(header_data, colWidths=[95*mm, 75*mm])
    header_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), FA_GREEN),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",(0,0), (-1,-1), 6*mm),
        ("RIGHTPADDING",(0,0),(-1,-1), 6*mm),
        ("TOPPADDING", (0,0), (-1,-1), 4*mm),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4*mm),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 6*mm))

    # Recipient info
    story.append(Paragraph(
        f"<b>Course Leader:</b> {leader_name}",
        ParagraphStyle("info", fontSize=11, textColor=FA_DARK)
    ))
    story.append(Paragraph(
        f"<b>Settlement period:</b> {period_label} &nbsp;&nbsp; <b>Currency:</b> {currency}",
        ParagraphStyle("info2", fontSize=10, textColor=GREY_TEXT)
    ))
    story.append(Spacer(1, 5*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=FA_GREEN))
    story.append(Spacer(1, 4*mm))

    grand_total        = 0.0
    grand_participants = 0

    for course in courses:
        cal_name    = course["calendar_name"]
        course_type = course["course_type"]
        course_date = course["course_date"]
        participants = course["participants"]
        if not participants:
            continue

        # Course header
        story.append(Paragraph(
            f"<b>{cal_name}</b>",
            ParagraphStyle("ch", fontSize=10, textColor=FA_DARK, fontName="Helvetica-Bold")
        ))
        if course_date:
            story.append(Paragraph(
                f"Course date: {course_date}",
                ParagraphStyle("cd", fontSize=9, textColor=GREY_TEXT)
            ))
        story.append(Spacer(1, 2*mm))

        # Participant table
        sym = "EUR" if currency == "EUR" else "SEK"
        col_headers = [
            "Participant",
            f"Paid incl. VAT ({sym})",
            f"Net excl. VAT ({sym})",
            f"Txn fee ({sym})",
            f"FA margin ({sym})",
            f"Affiliate ({sym})",
            f"Payout ({sym})",
        ]
        table_data = [col_headers]

        name_style  = ParagraphStyle("pname", fontSize=8, leading=11)
        course_total = 0.0

        for p in participants:
            calc = p["calc"]
            aff  = f"-{calc['affiliate_deduction']:,.2f}" if calc["affiliate_deduction"] else "-"

            if p.get("affiliate_code") and calc["paid_incl_vat"] > 0:
                name_cell = Paragraph(
                    f"{p['name']}<br/>"
                    f"<font size='6.5' color='#888888'>Code: {p['affiliate_code']}</font>",
                    name_style
                )
            else:
                name_cell = p["name"]

            row = [
                name_cell,
                f"{calc['paid_incl_vat']:,.2f}",
                f"{calc['net_excl_vat']:,.2f}",
                f"-{calc['transaction_fee']:,.2f}",
                f"-{calc['fa_margin']:,.2f}" if calc["fa_margin"] else "-",
                aff,
                f"{calc['payout']:,.2f}",
            ]
            table_data.append(row)
            course_total += calc["payout"]

        # Subtotal row
        table_data.append(["Subtotal", "", "", "", "", "", f"{course_total:,.2f}"])

        col_widths = [40*mm, 22*mm, 22*mm, 18*mm, 18*mm, 18*mm, 18*mm]
        ptbl = Table(table_data, colWidths=col_widths)
        ptbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),  (-1,0),  FA_GREEN),
            ("TEXTCOLOR",     (0,0),  (-1,0),  WHITE),
            ("FONTNAME",      (0,0),  (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0),  (-1,-1), 7.5),
            ("ALIGN",         (1,0),  (-1,-1), "RIGHT"),
            ("ALIGN",         (0,0),  (0,-1),  "LEFT"),
            ("ROWBACKGROUNDS",(0,1),  (-1,-2), [WHITE, LIGHT_GREY]),
            ("BACKGROUND",    (0,-1), (-1,-1), FA_LIGHT),
            ("FONTNAME",      (0,-1), (-1,-1), "Helvetica-Bold"),
            ("GRID",          (0,0),  (-1,-1), 0.3, colors.HexColor("#CCCCCC")),
            ("TOPPADDING",    (0,0),  (-1,-1), 2),
            ("BOTTOMPADDING", (0,0),  (-1,-1), 2),
            ("LEFTPADDING",   (0,0),  (-1,-1), 3),
            ("RIGHTPADDING",  (0,0),  (-1,-1), 3),
        ]))
        story.append(ptbl)
        story.append(Spacer(1, 4*mm))

        grand_total        += course_total
        grand_participants += len(participants)

    # Summary box
    story.append(HRFlowable(width="100%", thickness=1, color=FA_GREEN))
    story.append(Spacer(1, 3*mm))

    sym = "EUR" if currency == "EUR" else "SEK"
    summary_data = [
        ["Total participants attended", str(grand_participants)],
        [f"Total payout ({sym})", f"{grand_total:,.2f}"],
    ]
    stbl = Table(summary_data, colWidths=[120*mm, 50*mm])
    stbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), FA_LIGHT),
        ("FONTNAME",      (0,0), (-1,-1), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 10),
        ("ALIGN",         (1,0), (1,-1),  "RIGHT"),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 4),
        ("RIGHTPADDING",  (0,0), (-1,-1), 4),
        ("LINEABOVE",     (0,-1),(-1,-1), 1, FA_GREEN),
    ]))
    story.append(stbl)
    story.append(Spacer(1, 5*mm))

    # Calculation note
    note_style = ParagraphStyle("note", fontSize=7.5, textColor=GREY_TEXT,
                                leading=11, leftIndent=2*mm)
    story.append(Paragraph(
        "<b>Calculation methodology:</b> "
        "Net excl. VAT = Paid incl. VAT / 1.25. "
        "Transaction fee = 3.1% of net excl. VAT (Stripe/Klarna). "
        "FA margin: 500 SEK / 50 EUR (Intro), 4 000 SEK / 400 EUR (Diplo). "
        "Affiliate commission = 30% of net excl. VAT (Intro only, when applicable). "
        "Course leader payout = Net excl. VAT - Transaction fee - FA margin - Affiliate commission.",
        note_style
    ))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Please issue an invoice to Fascia Academy for the total payout amount above. "
        "Payment terms: 20 days.",
        note_style
    ))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} | "
        f"Fascia Academy - info@fasciaacademy.com",
        ParagraphStyle("footer", fontSize=7, textColor=colors.HexColor("#AAAAAA"),
                       alignment=TA_CENTER)
    ))

    doc.build(story)
    return grand_total


# --- Email --------------------------------------------------------------------
def send_summary_email(period_label: str, summaries: list, pdf_paths: list):
    """
    Send summary email to info@fasciaacademy.com with all PDFs attached.
    summaries: list of (leader_name, currency, n_participants, total_payout)
    """
    msg = MIMEMultipart()
    msg["From"]    = EMAIL_FROM
    msg["To"]      = EMAIL_TO
    leader_names   = ", ".join(name for name, _, _, _ in summaries)
    msg["Subject"] = f"Course Leader Settlement - {period_label} - {leader_names} - Please Review & Forward"

    rows = ""
    for name, currency, n, total in summaries:
        sym = "EUR" if currency == "EUR" else "SEK"
        rows += (f"<tr><td style='padding:6px'>{name}</td>"
                 f"<td style='padding:6px;text-align:center'>{currency}</td>"
                 f"<td style='padding:6px;text-align:center'>{n}</td>"
                 f"<td style='padding:6px;text-align:right'>{total:,.2f} {sym}</td></tr>")

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;max-width:650px">
    <h2 style="color:#2E7D32">Course Leader Settlement - {period_label}</h2>
    <p>Hi,</p>
    <p>The monthly course leader settlement for <strong>{period_label}</strong> is ready for your review.</p>
    <p>Please check the attached PDF reports and forward each one to the respective course leader.</p>
    <h3>Summary</h3>
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
      <tr style="background:#2E7D32;color:white">
        <th style="padding:8px;text-align:left">Course Leader</th>
        <th style="padding:8px;text-align:center">Currency</th>
        <th style="padding:8px;text-align:center">Participants</th>
        <th style="padding:8px;text-align:right">Total Payout</th>
      </tr>
      {rows}
    </table>
    <p style="margin-top:20px;font-size:12px;color:#888">
      This email was generated automatically by the Fascia Academy Course Leader Settlement System.<br>
      Formula: Net excl. VAT - 3.1% transaction fee - FA margin - affiliate commission (30% intro only).
    </p>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))

    for path in pdf_paths:
        with open(path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition",
                        f"attachment; filename={os.path.basename(path)}")
        msg.attach(part)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(EMAIL_FROM, EMAIL_TO, msg.as_string())
    print(f"Email sent to {EMAIL_TO}")


# --- Main ---------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Fascia Academy Course Leader Settlement")
    parser.add_argument("--month",
        help="Month to process (YYYY-MM). Defaults to previous month.")
    parser.add_argument("--test", action="store_true",
        help="Dry run - generate PDFs but do NOT send email.")
    args = parser.parse_args()

    if args.month:
        year, month = map(int, args.month.split("-"))
    else:
        prev = date.today().replace(day=1) - relativedelta(months=1)
        year, month = prev.year, prev.month

    period_label = datetime(year, month, 1).strftime("%B %Y")
    print(f"\n=== Fascia Academy Course Leader Settlement - {period_label} ===\n")

    if not GHL_API_KEY:
        print("ERROR: GHL_API_KEY environment variable is not set.")
        return

    # 1. Fetch all calendars
    print("Fetching calendars...")
    calendars = get_calendars()
    print(f"  Found {len(calendars)} active calendars (excl. templates)")

    # 2. For each calendar, get showed appointments, group by (leader_name, currency)
    leader_data = {}  # key: (leader_name, currency) -> list of course dicts

    for cal in calendars:
        cal_name = cal["name"]
        course_type, currency = classify_calendar(cal_name)
        if course_type is None:
            continue  # skip unrecognised calendars

        leader_name = extract_leader_name(cal_name)
        showed = get_showed_appointments(cal["id"], year, month)

        if not showed:
            continue

        print(f"  {cal_name}: {len(showed)} showed appointment(s) -> {leader_name}")

        # Determine course date from the first appointment's startTime
        first_start = showed[0].get("startTime", "")
        course_date = first_start[:10] if first_start else ""

        # Fetch participant details
        participants = []
        seen_contacts = set()
        for appt in showed:
            contact_id = appt.get("contactId")
            if not contact_id or contact_id in seen_contacts:
                continue
            seen_contacts.add(contact_id)

            try:
                contact = get_contact_detail(contact_id)
            except Exception as e:
                print(f"    Warning: could not fetch contact {contact_id}: {e}")
                continue

            cf = {item["id"]: item.get("value", "")
                  for item in contact.get("customFields", [])}

            # Get paid amount
            paid_raw = cf.get(CF_PAID_AMOUNT_SEK, 0)
            try:
                paid_incl_vat = float(paid_raw) if paid_raw else 0.0
            except (ValueError, TypeError):
                paid_incl_vat = 0.0

            # Check for affiliate code
            affiliate_code = cf.get(CF_AFFILIATE_CODE, "").strip()
            has_affiliate  = bool(affiliate_code)

            calc = calculate_payout(paid_incl_vat, course_type, currency, has_affiliate)

            first = contact.get("firstName", "").strip()
            last  = contact.get("lastName", "").strip()
            name  = f"{first} {last}".strip() or contact_id

            participants.append({
                "name":           name,
                "email":          contact.get("email", ""),
                "affiliate_code": affiliate_code,
                "calc":           calc,
            })

        if not participants:
            continue

        key = (leader_name, currency)
        if key not in leader_data:
            leader_data[key] = []

        leader_data[key].append({
            "calendar_name": cal_name,
            "course_type":   course_type,
            "course_date":   course_date,
            "participants":  participants,
        })

    if not leader_data:
        print("\nNo showed appointments found for this month. Nothing to generate.")
        return

    # 3. Generate PDFs
    os.makedirs("settlements", exist_ok=True)
    summaries  = []
    pdf_paths  = []

    for (leader_name, currency), courses in sorted(leader_data.items()):
        safe_name = leader_name.replace(" ", "_").replace("/", "-")
        filename  = f"settlements/{safe_name}_{year}-{month:02d}.pdf"

        total_payout = generate_pdf(leader_name, currency, courses, period_label, filename)
        n_participants = sum(len(c["participants"]) for c in courses)

        print(f"\n  {leader_name} ({currency}): {n_participants} participants, "
              f"total payout = {total_payout:,.2f} {currency}")
        print(f"  PDF: {filename}")

        summaries.append((leader_name, currency, n_participants, total_payout))
        pdf_paths.append(filename)

    # 4. Send email (unless --test)
    if args.test:
        print(f"\n[TEST MODE] PDFs generated in ./settlements/ - email NOT sent.")
    else:
        print(f"\nSending summary email to {EMAIL_TO}...")
        send_summary_email(period_label, summaries, pdf_paths)

    print("\nDone.")


if __name__ == "__main__":
    main()
