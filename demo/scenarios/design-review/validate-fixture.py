"""Validate the synthetic content fixture without depending on app runtime code."""
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / "insights-annotations.fixture.json").read_text())
assert data["fixture_type"] == "editorial_content_fixture_not_api_response"
meetings = {}
for meeting in data["source_meetings"]:
    content = (ROOT / meeting["file"]).read_text()
    paragraphs = dict(re.findall(r"(?m)^([PQ]\d{3}) (.+)$", content))
    assert len(paragraphs) == meeting["turn_count"]
    assert list(paragraphs) == [f"{meeting['paragraph_prefix']}{n:03d}" for n in range(1, meeting["turn_count"] + 1)]
    chinese = len(re.findall(r"[\u4e00-\u9fff]", content))
    assert (4000 <= chinese <= 6000) if meeting["meeting_id"] == "M1" else (1200 <= chinese <= 2000)
    meetings[meeting["meeting_id"]] = paragraphs
    print(f"{meeting['meeting_id']}: {len(paragraphs)} turns, {chinese} Han characters")

allowed_content = {"事实陈述", "观点", "案例", "条件"}
allowed_relations = {"追问", "回应", "质疑", "补充", "反例", "澄清", "修正", "明确认同", "条件认同"}
known = set()
for annotation in data["annotations"]:
    claim_id = annotation["claim_id"]
    assert claim_id not in known, claim_id
    line = meetings[annotation["meeting_id"]][annotation["paragraph_id"]]
    assert annotation["quote"] in line, (claim_id, "quote missing", annotation["quote"])
    assert annotation["content_type"] in allowed_content, claim_id
    relation = annotation["relation"]
    if relation:
        assert relation["type"] in allowed_relations, claim_id
        assert relation["target_claim_id"] in known, (claim_id, "unknown or future target")
    known.add(claim_id)

for insight in data["insights"]:
    for stage_name in ("v1_after_M1", "v2_after_M2"):
        stage = insight.get(stage_name, {})
        for field in ("forming_claim_ids", "new_claim_ids"):
            for claim_id in stage.get(field, []):
                assert claim_id in known, (insight["id"], claim_id)
    for claim_id in insight.get("claim_ids", []):
        assert claim_id in known, (insight["id"], claim_id)

print(f"Validated {len(data['annotations'])} exact quotes, relation endpoints, and insight references")
