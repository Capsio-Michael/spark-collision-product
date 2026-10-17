"""Freeze the shared M1–M4 synthetic mock as browser-readable ES module data.

Run from any directory: python -X utf8 frontend/scripts/generate-demo.py.
This does not call an AI model or modify a service database.
"""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from engine.analysis import build_analysis

records = []
for number, role in enumerate(("客服负责人", "销售负责人", "运营负责人", "项目负责人"), 1):
    source = ROOT / f"examples/pricing-boundary/M{number}.md"
    content = source.read_text(encoding="utf-8")
    identifier = f"rec_0{number}"
    records.append({
        "id": identifier, "meeting_id": f"M{number}",
        "title": content.splitlines()[0].removeprefix("# "),
        "source_type": "interview" if number < 3 else "meeting",
        "source_name": source.name, "source_date": None,
        "material_basis": "synthetic", "authorization_note": None,
        "created_at": "2026-10-17T11:00:00+08:00",
        "covered_in_current_version": True, "content": content,
        "participants": [{"id": f"person_0{number}", "label": role}],
        "segments": [{"id": f"{identifier}_seg_{index}", "paragraph_index": index, "text": paragraph}
                     for index, paragraph in enumerate(content.strip().split("\n\n"), 1)],
    })

project = {"id": "prj_demo", "name": "报价授权边界调研", "created_at": "2026-10-17T11:00:00+08:00", "current_version": 3, "record_count": 4}
snapshots, versions, previous = {}, [], None
for version, count in ((1, 2), (2, 3), (3, 4)):
    result = build_analysis(project, records[:count], previous, version)
    details = result.pop("details")
    overview = {
        **result, "project": project, "snapshot_version": version,
        "active_job_id": None, "source_record_ids": [record["id"] for record in records[:count]],
        "unanalyzed_record_ids": [], "pending_confirmation_count": 0, "engine_mode": "mock",
    }
    snapshots[str(version)] = {"overview": overview, "details": details}
    versions.insert(0, {
        "version": version, "parent_version": version - 1,
        "created_at": f"2026-10-17T11:{version * 10:02d}:00+08:00", "cause": "analysis",
        "job_id": f"synthetic_job_{version}", "correction_id": None,
        "source_record_ids": overview["source_record_ids"], "outcome": result["outcome"],
        "summary": result["summary"], "changes": result["changes"], "actor_label": None, "correction_reason": None,
    })
    previous = overview

payload = {"records": records, "snapshots": snapshots, "versions": versions}
target = ROOT / "frontend/src/fixtures/pricing-data.js"
target.write_text("// Generated from examples/pricing-boundary/M1–M4.md and the deterministic mock.\n"
                  "// Synthetic demonstration only; no real customer or AI run. Regenerate with scripts/generate-demo.py.\n"
                  "export const pricingData = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
print(target)
