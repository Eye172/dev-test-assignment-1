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
pdf.drawRightString(552, 787, "V4 REVIEW CANDIDATE / 17 OCT 2026")
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
section("02 / FOUNDER FLOW", "Start free-form or guided; read text from PDF, DOCX, PPTX or notes with visible extraction limits; confirm the profile. Save ICP, value, up to three channels, pricing and exactly three market assumptions independently. Completion is saved sections / 5, never commercial validation. Observatory, Ledger and Flow share saved data in English, Russian and Kazakh. Display preferences, a four-week board and keyboard commands adapt the workspace.")
section("03 / AI AND EVIDENCE", "Optional owner-gated OpenAI specialists interpret, research, strategize, price, plan and critique. Case-specific comparisons include direct/indirect alternatives and the current workflow, captured passages and coverage gaps. Versioned hypotheses and decisions retain counterarguments, observations and reopening conditions. An independent critic checks evidence and one bounded correction round; proposals require review before application.")
section("04 / PLANS, DATA AND RECOVERY", "Next.js, React, strict TypeScript, Zod and transactional PostgreSQL; PGlite runs the same SQL locally. Rule generation retains 8-10 current suggestions. AI plan previews reconcile old suggestions and human work against time, currency budgets and dependencies. One active plan; completed work and revisions remain historical. Idempotent creation/launch, editor recovery and private AI exports preserve work after failures.")
section("05 / RUN AND OPERATE", "Node.js 24: npm ci; copy .env.example to .env.local; npm run db:migrate; npm run db:seed; npm run dev. Production: Vercel + Neon PostgreSQL, Frankfurt. Required: DATABASE_URL, DEMO_MODE=true, TRUST_PROXY=true. Optional paid AI: OPENAI_API_KEY and AI_ACCESS_CODE, server-side only. Shared daily/run budgets, usage receipts and checkpoints bound work. See README and docs/AI-BACKEND.md.")
section("06 / VERIFY AND INTEGRATE", "Run npm run verify and npm run test:e2e. Domain/SQL, real HTTP, desktop/phone, accessibility, attachment extraction, consent and recovery checks are separate from explicitly paid live AI evaluation. See docs/ACCEPTANCE.md for evidence and limits. Anyone with a demo link can edit its synthetic profile/strategy; AI material/history is owner-gated. Commercial use requires tenant authorization. Docker is supplied; physical-device certification and private Black Orbit integration are outside this prototype.")

assert y > 83, f"Content would collide with footer: y={y}"
pdf.setStrokeColor(colors.HexColor("#D8DFD5"))
pdf.line(42, 67, 552, 67)
pdf.setFillColor(MUTED)
pdf.setFont("Helvetica", 8)
pdf.drawString(42, 49, "V4 CANDIDATE - live links serve the earlier release pending owner approval.")
pdf.drawRightString(552, 32, "1 / 1")
pdf.save()
print(OUT)
