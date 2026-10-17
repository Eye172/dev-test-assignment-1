"""Build a credential-checked source package from the committed tree, plus the one-page PDF."""
from pathlib import Path
import hashlib
import os
import re
import shutil
import subprocess
import zipfile
import argparse
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output-dir", type=Path, default=ROOT.parent / "submission-2026-10-17")
OUT = parser.parse_args().output_dir.resolve()
OUT.mkdir(parents=True, exist_ok=True)
revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
branch = subprocess.check_output(["git", "branch", "--show-current"], cwd=ROOT, text=True).strip()
archive = OUT / "orbit-gtm-studio-source.zip"
subprocess.run(["git", "archive", "--format=zip", "--prefix=orbit-gtm-studio/", f"--output={archive}", revision], cwd=ROOT, check=True)

secrets = {}
env = ROOT / ".env.local"
if env.exists():
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        name, sep, value = line.partition("=")
        if sep and name.strip() in {"OPENAI_API_KEY", "AI_ACCESS_CODE", "DATABASE_URL"}:
            value = value.strip().strip('"').strip("'")
            if len(value) >= 12:
                secrets[name.strip()] = value.encode()
for name in ("OPENAI_API_KEY", "AI_ACCESS_CODE", "DATABASE_URL"):
    value = os.environ.get(name, "")
    if len(value) >= 12:
        secrets[name] = value.encode()

with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None, "ZIP integrity failed"
    names = z.namelist()
    assert "orbit-gtm-studio/.env.example" in names
    for name in names:
        relative = name.removeprefix("orbit-gtm-studio/")
        assert not any(part in {".data", ".next", "node_modules", ".vercel", ".git"} for part in Path(relative).parts), "Private/build directory in source archive"
        assert not (Path(relative).name.startswith(".env") and relative != ".env.example"), "Private environment file in source archive"
        content = z.read(name)
        for label, value in secrets.items():
            assert value not in content, f"Credential check failed for {label} in {relative}; value omitted"
        assert not re.search(rb"sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}", content), f"Key-shaped content in {relative}"
    pdf_bytes = z.read("orbit-gtm-studio/output/pdf/orbit-gtm-studio-handover.pdf")

for path in (ROOT / ".next/static").rglob("*"):
    if path.is_file():
        content = path.read_bytes()
        for label, value in secrets.items():
            assert value not in content, f"Client bundle credential check failed for {label}; value omitted"

pdf = OUT / "orbit-gtm-studio-handover.pdf"
shutil.copyfile(ROOT / "output/pdf/orbit-gtm-studio-handover.pdf", pdf)
assert pdf_bytes == pdf.read_bytes(), "PDF does not match committed source; commit the final handover first"
reader = PdfReader(pdf)
assert len(reader.pages) == 1, "Handover must be one page"
links = [a.get_object().get("/A", {}).get("/URI") for a in reader.pages[0].get("/Annots", [])]
assert len([x for x in links if x]) >= 3, "Handover links are missing"
(OUT / "SOURCE-REVISION.txt").write_text(revision + "\n", encoding="utf-8")
(OUT / "SUBMISSION.txt").write_text(f"Source snapshot: {branch} at {revision}. See docs/RELEASE-2026-10-17.md for verified deployment state.\n\n" + """Orbit GTM Studio — independent synthetic-data developer assignment

Live: https://orbit-gtm-studio.vercel.app/
Demo: https://orbit-gtm-studio.vercel.app/startups/11111111-1111-4111-8111-111111111111
Source: https://github.com/Eye172/dev-test-assignment-1 (private; the source ZIP is self-contained)

Unzip the source, then read README.md and docs/SUBMISSION.md for setup, final verification and boundaries.
The one-page PDF is the reviewer handover. SHA256SUMS verifies these files; SOURCE-REVISION.txt identifies the committed tree.
No environment secrets, local databases, dependencies or build artifacts are included. Configure your own local environment.
This package is prepared for the owner; it has not been sent to an external evaluator.
""", encoding="utf-8")
files = [archive, pdf, OUT / "SOURCE-REVISION.txt", OUT / "SUBMISSION.txt"]
(OUT / "SHA256SUMS.txt").write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in files), encoding="utf-8")
print({"output": str(OUT), "revision": revision, "source_files": len(names), "pdf_pages": 1, "pdf_links": len(links), "credential_checks": "passed"})
