"""Optional delivery artifact: python scripts/build-handover.py (requires reportlab)."""
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "orbit-gtm-studio-handover.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
PAGE_W, PAGE_H = 595.28, 841.89
INK, MUTED, GREEN = map(colors.HexColor, ["#171E1A", "#58635C", "#087747"])
pdf = canvas.Canvas(str(OUT), pagesize=(PAGE_W, PAGE_H))
pdf.setTitle("Orbit GTM Studio - Engineering Handover")
pdf.setAuthor("Eye172")
pdf.setFillColor(colors.HexColor("#FAFBF7"))
pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
pdf.setStrokeColor(INK)
pdf.setLineWidth(1.7)
pdf.arc(42, 780, 64, 802, 35, 300)
pdf.setFillColor(GREEN)
pdf.circle(62, 800, 2.8, fill=1, stroke=0)
pdf.setFillColor(INK)
pdf.setFont("Helvetica-Bold", 10)
pdf.drawString(76, 787, "ORBIT GTM STUDIO")
pdf.setFillColor(MUTED)
pdf.setFont("Helvetica", 8)
pdf.drawRightString(552, 787, "ENGINEERING HANDOVER / 16 OCT 2026")
pdf.setFillColor(INK)
pdf.setFont("Helvetica-Bold", 27)
pdf.drawString(42, 738, "From decisions to experiments.")
pdf.setFillColor(MUTED)
pdf.setFont("Helvetica", 10)
pdf.drawString(42, 717, "A persistent founder workspace with a transparent 30-day action plan.")

body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.1, leading=13, textColor=INK, alignment=TA_LEFT)
label = ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=GREEN, spaceAfter=5)
y = 681

def section(title, text):
    global y
    heading = Paragraph(title, label)
    _, h = heading.wrap(510, 100)
    heading.drawOn(pdf, 42, y - h)
    y -= h + 6
    paragraph = Paragraph(text, body)
    _, h = paragraph.wrap(510, 600)
    paragraph.drawOn(pdf, 42, y - h)
    y -= h + 19

section("01 / OPEN THE WORKSPACE", '<link href="https://orbit-gtm-studio.vercel.app" color="#087747">orbit-gtm-studio.vercel.app</link> - public synthetic demo; no login.<br/><link href="https://orbit-gtm-studio.vercel.app/startups/11111111-1111-4111-8111-111111111111" color="#087747">Open the prefilled Fieldnote profile</link> or create a separate working copy from the welcome page.<br/>Source: <link href="https://github.com/Eye172/dev-test-assignment-1" color="#087747">github.com/Eye172/dev-test-assignment-1</link> (private; reviewer access is required).')
section("02 / PRODUCT FLOW", "Create a profile; save ICP, value proposition, channels, pricing and three assumptions independently; inspect decisions, gaps and next actions; generate and track the roadmap. Completed sections mean required inputs are filled. They do not mean the business is validated. Personal context, custom fields, appearance and movable dashboard plates adapt the workspace.")
section("03 / ARCHITECTURE AND DATA", "Next.js App Router, React and strict TypeScript. Shared Zod schemas, completion rules and deterministic roadmap logic live in src/lib/domain. Server route handlers call a transactional Store over PostgreSQL. Profiles, five JSONB sections, tasks, revisions and retained history persist in the database. PGlite runs the same SQL locally. Database credentials stay on the server.")
section("04 / RULES AND RECOVERY", "Saved and missing inputs produce 8-10 current roadmap suggestions. Stable rule keys preserve completed work, founder edits and custom tasks; superseded tasks remain in history. Revision checks prevent silent concurrent overwrites. Unsaved changes have separate per-tab recovery and still require Save/Done. JSON export provides a portable workspace backup.")
section("05 / RUN AND OPERATE", "Use Node.js 24: npm ci; copy .env.example to .env.local; npm run db:migrate; npm run db:seed; npm run dev. Production uses Vercel and dedicated Neon PostgreSQL in Frankfurt. Required: DATABASE_URL, DEMO_MODE=true, TRUST_PROXY=true. /api/health reports ready/postgres/demo. Docker Compose is supplied for a standalone PostgreSQL deployment. See README and docs/DEPLOYMENT.md.")
section("06 / REVIEW AND INTEGRATION BOUNDARY", "Run npm run verify and npm run test:e2e. Coverage includes SQL durability, HTTP conflicts, desktop/phone journeys, customization, draft safety and failed-request recovery. Authentication is deliberately omitted: anyone with a link can edit synthetic demo data. Commercial integration requires tenant authorization and agreed APIs; no private Black Orbit systems or paid AI services are dependencies.")

assert y > 83, f"Content would collide with footer: y={y}"
pdf.setStrokeColor(colors.HexColor("#D8DFD5"))
pdf.line(42, 67, 552, 67)
pdf.setFillColor(MUTED)
pdf.setFont("Helvetica", 8)
pdf.drawString(42, 49, "REVIEW CANDIDATE - final frontend composition/motion acceptance remains open.")
pdf.drawRightString(552, 32, "1 / 1")
pdf.save()
print(OUT)
