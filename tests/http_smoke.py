"""Run against a fresh local mock service: python3 tests/http_smoke.py."""
import json
from pathlib import Path
import urllib.request
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8000/api/v1"


def call(path, body=None):
    headers = {"Content-Type": "application/json"}
    if body is not None:
        headers["Idempotency-Key"] = str(uuid4())
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(body, ensure_ascii=False).encode() if body is not None else None,
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = response.read().decode()
        return response.status, payload if "/export?" in path else json.loads(payload)["data"]


def main():
    assert call("/health")[1]["engine_mode"] == "mock"
    project = call("/projects", {"name": "报价授权边界调研"})[1]
    for batch in ([1, 2], [3], [4]):
        records = [{
            "client_record_id": f"demo-M{number}", "title": f"M{number} 合成讨论",
            "source_type": "meeting", "source_date": "2026-10-17",
            "source_name": f"M{number}.md", "material_basis": "synthetic",
            "authorization_note": None, "participants": [{"id": f"person_{number}", "label": f"角色 {number}"}],
            "meeting_id": f"M{number}",
            "content": (ROOT / f"examples/pricing-boundary/M{number}.md").read_text(),
        } for number in batch]
        ids = [item["id"] for item in call(f"/projects/{project['id']}/records", {"records": records})[1]["items"]]
        job = call(f"/projects/{project['id']}/analyses", {"record_ids": ids, "expected_version": project["current_version"]})[1]
        project["current_version"] = job["result_version"]
        overview = call(f"/projects/{project['id']}/overview?version={job['result_version']}")[1]
        Path(f"/tmp/spark-overview-v{job['result_version']}.json").write_text(json.dumps(overview, ensure_ascii=False))
        print(f"v{job['result_version']}: {overview['outcome']}; score {overview['insights'][0]['importance']['score']}/5; meetings {overview['insights'][0]['meeting_coverage']['distinct_meeting_count']}")
    markdown = call(f"/projects/{project['id']}/export?format=markdown&version=3")[1]
    assert "这不代表已经批准上线" in markdown
    print("Markdown export:", len(markdown), "characters")


if __name__ == "__main__":
    main()
