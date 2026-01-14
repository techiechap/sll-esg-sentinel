from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
import io

app = FastAPI(title="ESG Sentinel API", version="0.2.2")
print("🚀 ESG Sentinel backend loaded: v0.2.2 (coverage=text pages + parse success)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def safe_extract_pages(pdf: PdfReader) -> tuple[list[str], int]:
    pages = []
    errors = 0
    for page in pdf.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            errors += 1
            pages.append("")
    return pages, errors

def find_evidence(pages: list[str], keywords: list[str], window: int = 80):
    evidence = []
    if not keywords:
        return evidence

    for pi, text in enumerate(pages):
        low = (text or "").lower()
        if not low.strip():
            continue

        for kw in keywords:
            start = 0
            while True:
                idx = low.find(kw, start)
                if idx == -1:
                    break
                left = max(0, idx - window)
                right = min(len(text), idx + len(kw) + window)
                snippet = (text[left:right] or "").replace("\n", " ").strip()
                evidence.append({"keyword": kw, "page": pi + 1, "snippet": snippet})
                start = idx + len(kw)

    return evidence[:25]  # cap for demo

@app.get("/")
def root():
    return {"status": "ok", "service": "esg-sentinel", "endpoints": ["/analyze-loan", "/health", "/docs"]}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze-loan")
async def analyze_loan(file: UploadFile = File(...)):
    content = await file.read()

    try:
        pdf = PdfReader(io.BytesIO(content))
        if getattr(pdf, "is_encrypted", False):
            try:
                pdf.decrypt("")
            except Exception:
                pass
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF or unreadable file: {e}")

    pages, page_errors = safe_extract_pages(pdf)

    # Debug lengths
    sample_lens = [len((t or "").strip()) for t in pages[:5]]
    max_len = max([len((t or "").strip()) for t in pages], default=0)

    full_text = "\n".join(pages)
    text_lower = full_text.lower()

    # Keyword families
    kw_carbon = ["carbon", "emission", "ghg", "scope 1", "scope 2", "decarbon"]
    kw_renew  = ["renewable", "clean energy", "green power"]
    kw_div    = ["diversity", "gender", "inclusion", "board composition"]
    kw_water  = ["water", "scarcity"]

    matched_keywords: list[str] = []
    found_targets: list[str] = []

    if any(k in text_lower for k in kw_carbon):
        found_targets.append("Scope 1 & 2 Greenhouse Gas Emissions Reduction")
        matched_keywords.extend(kw_carbon)

    if any(k in text_lower for k in kw_renew):
        found_targets.append("Renewable Energy Sourcing (%)")
        matched_keywords.extend(kw_renew)

    if any(k in text_lower for k in kw_div):
        found_targets.append("Gender Diversity in Senior Management")
        matched_keywords.extend(kw_div)

    if any(k in text_lower for k in kw_water):
        found_targets.append("Water Scarcity Management")
        matched_keywords.extend(kw_water)

    # ALWAYS compute explainability
    matched_keywords = sorted(set(matched_keywords))
    evidence = find_evidence(pages, matched_keywords)

    # Fallback (demo mode)
    fallback_mode = False
    if not found_targets:
        fallback_mode = True
        found_targets = [
            "Scope 1 & 2 Greenhouse Gas Emissions Reduction",
            "Renewable Energy Sourcing (%)",
            "Gender Diversity in Senior Management",
        ]

    # Metrics
    total_pages = len(pages)
    parse_success_pct = round(((total_pages - page_errors) / total_pages) * 100, 1) if total_pages else 0.0

    MIN_CHARS = 40
    pages_with_text = sum(1 for t in pages if len((t or "").strip()) >= MIN_CHARS)
    coverage_pct = round((pages_with_text / total_pages) * 100, 1) if total_pages else 0.0
    coverage = (pages_with_text / total_pages) if total_pages else 0.0

    # Confidence heuristic (demo)
    families_matched = 0
    families_matched += 1 if any(k in matched_keywords for k in kw_carbon) else 0
    families_matched += 1 if any(k in matched_keywords for k in kw_renew) else 0
    families_matched += 1 if any(k in matched_keywords for k in kw_div) else 0
    families_matched += 1 if any(k in matched_keywords for k in kw_water) else 0

    confidence = min(100, round((coverage * 70) + (families_matched * 10) + (len(found_targets) * 5)))

    # Pricing defaults
    step_bps = 2.5
    notional = 500_000_000
    currency = "USD"

    text_extracted = coverage_pct > 0  # THIS is what UI should use, not pages_failed==0

    return {
        "explainability": {
            "matched_keywords": matched_keywords,
            "evidence": evidence,
        },
        "document_metadata": {
            "source_filename": file.filename,
            "facility_type": "Sustainability-Linked Revolving Credit Facility (demo)",
            "governing_law": "English Law (demo)",
            "lma_standard": "v4.2 ESG Rider (demo)",
        },
        "sustainability_targets": found_targets,
        "ratchet_config": {
            "step_bps": step_bps,
            "verification_frequency": "Annual",
            "max_steps": len(found_targets),
        },
        "pricing_assumptions": {
            "notional": notional,
            "currency": currency,
        },
        "extraction_warnings": {
            "pages_failed": page_errors,
            "text_length": len(full_text or ""),
            "note": "Some PDFs are image-only or use embedded fonts; if coverage is 0%, OCR is required for snippet evidence.",
        },
        "scoring": {
            "confidence": confidence,
            "coverage_pct": coverage_pct,           # text coverage
            "parse_success_pct": parse_success_pct, # non-crash parse success
            "pages_total": total_pages,
            "pages_failed": page_errors,
            "pages_with_text": pages_with_text,
            "targets_detected": len(found_targets),
            "keyword_hits": len(matched_keywords),
            "fallback_mode": fallback_mode,
            "text_extracted": text_extracted,
        },
        "debug": {
            "first5_page_text_lengths": sample_lens,
            "max_page_text_length": max_len,
            "sample_text_len_first_page": len((pages[0] or "")) if pages else 0,
        },
    }
