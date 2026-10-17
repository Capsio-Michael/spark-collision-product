import tempfile
import unittest
from pathlib import Path

from engine.server import App, ApiError


ROOT = Path(__file__).resolve().parents[1]
NAMES = ["客服", "销售", "运营", "项目"]


def item(number):
    return {
        "client_record_id": f"demo-M{number}",
        "title": f"M{number} {NAMES[number-1]}讨论（合成）",
        "source_type": "meeting",
        "source_date": "2026-10-17",
        "source_name": f"M{number}.md",
        "material_basis": "synthetic",
        "authorization_note": None,
        "participants": [{"id": f"p{number}", "label": f"{NAMES[number-1]}负责人"}],
        "content": (ROOT / f"examples/pricing-boundary/M{number}.md").read_text(),
        "meeting_id": f"M{number}",
    }


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / "spark.db"
        self.app = App(self.db)
        _, project, _ = self.app.call("POST", "/projects", body={"name": "报价授权边界调研"}, key="create")
        self.pid = project["id"]
        self.base = f"/projects/{self.pid}"

    def tearDown(self):
        self.app.store.db.close()
        self.temp.cleanup()

    def call(self, method, suffix, **kwargs):
        return self.app.call(method, self.base + suffix, **kwargs)[1]

    def import_items(self, numbers):
        result = self.call("POST", "/records", body={"records": [item(n) for n in numbers]}, key=f"import-{numbers}")
        return [r["id"] for r in result["items"]]

    def analyze(self, ids, version):
        return self.call("POST", "/analyses", body={"record_ids": ids, "expected_version": version}, key=f"analyze-{version}")

    def test_three_versions_quotes_score_and_history(self):
        first = self.import_items([1, 2])
        job1 = self.analyze(first, 0)
        self.assertEqual(job1["status"], "succeeded")
        v1 = self.call("GET", "/overview", query={"version": ["1"]})
        main1 = v1["insights"][0]
        self.assertEqual(main1["importance"]["score"], 4)
        self.assertEqual(main1["convergence_status"], "conditions_unresolved")
        cross_quote = next(ev for ev in v1["evidence"] if ev["quote"] == "跨区报价需要销售确认，不能直接发送给客户。")
        cross_annotation = next(item for item in main1["annotations"] if item["evidence_id"] == cross_quote["id"])
        self.assertEqual(cross_annotation["condition"], "跨区报价")
        self.assertEqual(v1["outcome"], "updated")
        third = self.import_items([3])
        self.analyze(third, 1)
        v2 = self.call("GET", "/overview", query={"version": ["2"]})
        main2 = v2["insights"][0]
        self.assertEqual(main2["importance"]["score"], 5)
        self.assertEqual(main2["convergence_status"], "conditional_convergence")
        self.assertEqual(main2["last_change"]["type"], "qualified")
        self.assertNotEqual(main1["judgment"]["id"], main2["judgment"]["id"])
        fourth = self.import_items([4])
        self.analyze(fourth, 2)
        v3 = self.call("GET", "/overview", query={"version": ["3"]})
        self.assertEqual(v3["outcome"], "no_new_insight")
        self.assertEqual(v3["insights"][0]["importance"]["score"], 5)
        self.assertEqual(v3["insights"][0]["meeting_coverage"]["distinct_meeting_count"], 4)
        self.assertEqual(v3["insights"][0]["judgment"]["id"], main2["judgment"]["id"])
        self.assertEqual(v1["insights"][0]["judgment"]["text"], self.call("GET", "/overview", query={"version": ["1"]})["insights"][0]["judgment"]["text"])
        detail = self.call("GET", "/insights/ins_quote_boundary", query={"version": ["3"]})
        self.assertEqual(detail["snapshot_version"], 3)
        for evidence in detail["evidence"]:
            record = self.call("GET", "/records/" + evidence["record_id"])
            segment = next(s for s in record["segments"] if s["id"] == evidence["segment_id"])
            self.assertIn(evidence["quote"], segment["text"])
        self.assertEqual(len(self.call("GET", "/versions")["items"]), 3)
        markdown = self.call("GET", "/export", query={"format": ["markdown"], "version": ["3"]})
        self.assertIn("M4", markdown)
        self.assertIn("这不代表已经批准上线", markdown)
        self.assertIn("重要性：5/5", markdown)
        old_markdown = self.call("GET", "/export", query={"format": ["markdown"], "version": ["1"]})
        self.assertNotIn("M3", old_markdown)
        self.assertNotIn("M4", old_markdown)

    def test_persistence_idempotency_and_no_fabricated_insight(self):
        raw = item(1)
        raw["content"] = "一次讨论只确认了参会时间，没有业务判断。"
        body = {"records": [raw]}
        one = self.call("POST", "/records", body=body, key="same-request")
        two = self.call("POST", "/records", body=body, key="same-request")
        self.assertEqual(one, two)
        self.assertEqual(len(self.call("GET", "/records")["items"]), 1)
        self.analyze([one["items"][0]["id"]], 0)
        overview = self.call("GET", "/overview")
        self.assertEqual(overview["outcome"], "insufficient_evidence")
        self.assertEqual(overview["insights"], [])
        self.assertEqual(overview["evidence"], [])
        self.app.store.db.close()
        self.app = App(self.db)
        self.assertEqual(self.call("GET", "/overview")["snapshot_version"], 1)
        with self.assertRaises(ApiError) as error:
            self.call("POST", "/records", body={"records": [item(2)]}, key="same-request")
        self.assertEqual(error.exception.code, "IDEMPOTENCY_CONFLICT")

    def test_batch_validation_is_atomic(self):
        bad = item(2)
        bad["content"] = " "
        with self.assertRaises(ApiError) as error:
            self.call("POST", "/records", body={"records": [item(1), bad]}, key="bad-batch")
        self.assertEqual(error.exception.status, 422)
        self.assertEqual(self.call("GET", "/records")["items"], [])

    def test_mock_does_not_analyze_authorized_material(self):
        raw = item(1)
        raw["material_basis"] = "authorized"
        raw["authorization_note"] = "测试授权说明"
        record = self.call("POST", "/records", body={"records": [raw]}, key="authorized")["items"][0]
        self.analyze([record["id"]], 0)
        overview = self.call("GET", "/overview")
        self.assertEqual(overview["outcome"], "insufficient_evidence")
        self.assertEqual(overview["insights"], [])

    def test_same_meeting_second_record_is_rejected(self):
        self.import_items([1])
        second = item(2)
        second["meeting_id"] = "M1"
        with self.assertRaises(ApiError) as error:
            self.call("POST", "/records", body={"records": [second]}, key="same-meeting")
        self.assertEqual(error.exception.code, "MEETING_GROUPING_UNSUPPORTED")
        self.assertEqual(len(self.call("GET", "/records")["items"]), 1)


if __name__ == "__main__":
    unittest.main()
