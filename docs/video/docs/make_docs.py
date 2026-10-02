"""Builds sample trade documents (commercial invoice + bill of lading) as PDFs, watermarked SAMPLE."""
import json, sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

INK, LEAF, MUTED = HexColor('#10231a'), HexColor('#1f6b47'), HexColor('#5f6b64')

def watermark(c):
    c.saveState(); c.setFillColor(HexColor('#c0392b')); c.setFillAlpha(0.10)
    c.setFont('Helvetica-Bold', 110); c.translate(300, 420); c.rotate(35); c.drawCentredString(0, 0, 'SAMPLE'); c.restoreState()
    c.setFont('Helvetica-Oblique', 8); c.setFillColor(MUTED)
    c.drawString(40, 28, 'Fictional sample document for the EarnX testnet demo. Not a real company, shipment or invoice.')

def header(c, title, s):
    c.setFillColor(INK); c.setFont('Helvetica-Bold', 20); c.drawString(40, 790, title)
    c.setFont('Helvetica', 9); c.setFillColor(MUTED); c.drawString(40, 774, f"No. {s['number']}   ·   Date: {s['date']}")
    c.setStrokeColor(LEAF); c.setLineWidth(2); c.line(40, 764, 555, 764)

def block(c, x, y, label, lines):
    c.setFont('Helvetica-Bold', 8); c.setFillColor(MUTED); c.drawString(x, y, label.upper())
    c.setFont('Helvetica', 10); c.setFillColor(INK)
    for i, l in enumerate(lines): c.drawString(x, y - 14 - i * 13, l)

def invoice(s, path):
    c = canvas.Canvas(path, pagesize=A4); watermark(c); header(c, 'COMMERCIAL INVOICE', s)
    block(c, 40, 740, 'Exporter', [s['exporter'], s['origin_city'] + ', ' + s['origin']])
    block(c, 310, 740, 'Buyer', [(lambda b: b[:1].upper() + b[1:])(s['buyer'].replace('Sample buyer: ', '')), s['dest_city'] + ', ' + s['destination']])
    block(c, 40, 670, 'Terms', [f"Incoterms: {s['incoterms']}", f"Payment: net {s['days']} days", f"Currency: USD (settled in {s['token']})"])
    block(c, 310, 670, 'Shipment', [f"Port of loading: {s['port']}", f"Destination: {s['dest_city']}", f"HS code: {s['hs']}"])
    y = 590
    c.setFillColor(HexColor('#e4efe5')); c.rect(40, y - 4, 515, 20, fill=1, stroke=0)
    c.setFillColor(INK); c.setFont('Helvetica-Bold', 9)
    for x, h in [(48, 'DESCRIPTION'), (300, 'QUANTITY'), (390, 'UNIT PRICE'), (480, 'AMOUNT')]: c.drawString(x, y + 2, h)
    c.setFont('Helvetica', 10)
    c.drawString(48, y - 22, s['commodity']); c.drawString(300, y - 22, f"{s['qty']:g} t")
    c.drawString(390, y - 22, f"${s['price']:,.2f}/t"); c.drawString(480, y - 22, f"${s['qty'] * s['price']:,.2f}")
    c.line(40, y - 36, 555, y - 36); c.setFont('Helvetica-Bold', 12)
    c.drawRightString(555, y - 58, f"TOTAL  ${s['qty'] * s['price']:,.2f}")
    c.setFont('Helvetica', 9); c.setFillColor(MUTED)
    c.drawString(40, 470, 'Documents attached: bill of lading, certificate of origin, phytosanitary certificate, quality certificate.')
    c.showPage(); c.save()

def bill(s, path):
    c = canvas.Canvas(path, pagesize=A4); watermark(c); header(c, 'BILL OF LADING', {**s, 'number': 'BL-' + s['number']})
    block(c, 40, 740, 'Shipper', [s['exporter'], s['origin_city'] + ', ' + s['origin']])
    block(c, 310, 740, 'Consignee', [(lambda b: b[:1].upper() + b[1:])(s['buyer'].replace('Sample buyer: ', '')), s['dest_city'] + ', ' + s['destination']])
    block(c, 40, 670, 'Vessel / transport', [s['vessel'], f"Port of loading: {s['port']}", f"Port of discharge: {s['dest_port']}"])
    block(c, 310, 670, 'Cargo', [s['commodity'], f"Net weight: {s['qty'] * 1000:,.0f} kg", s['packing']])
    c.setFont('Helvetica', 9); c.setFillColor(MUTED)
    c.drawString(40, 560, 'Shipped on board in apparent good order and condition. Freight payable as per Incoterms.')
    c.showPage(); c.save()

for s in json.load(open(sys.argv[1])):
    invoice(s, f"{sys.argv[2]}/{s['key']}-invoice.pdf"); bill(s, f"{sys.argv[2]}/{s['key']}-bol.pdf")
    print('built', s['key'])
