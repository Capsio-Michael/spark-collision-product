import io
import json
import tempfile
import unittest
from pathlib import Path

from engine.agent_analysis import AnalysisError, validate_analysis
from engine.kimi import KimiProvider, ProviderError
from engine.server import App, ApiError
from tests.test_service import item


class StubProvider:
    model = "stub-model"

    def __init__(self, responses=()):
        self.responses = list(responses)
        self.calls = []

    def complete(self, messages):
        self.calls.append(messages)
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    def stream(self, messages):
        self.calls.append(messages)
        yield "你好，"
        yield "我在这里"


class KimiAgentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / "spark.db"
        self.provider = StubProvider()
        self.app = App(self.db, chat_provider=self.provider)
        _, project, _ = self.app.call("POST", "/projects", body={"name": "合成演示"}, key="create")
        self.pid = project["id"]
        self.base = f"/projects/{self.pid}"

    def tearDown(self):
        self.app.store.db.close()
        self.temp.cleanup()

    def imported(self):
        return self.app.call("POST", self.base + "/records", body={"records": [item(1)]}, key="import")[1]["items"][0]

    def test_stream_keeps_history_and_rejects_client_system_role(self):
        chunks = list(self.app.stream_chat({"messages": [{"role": "user", "content": "你好"}, {"role": "assistant", "content": "你好"}, {"role": "user", "content": "记得刚才吗"}]}))
        self.assertEqual(chunks, ["你好，", "我在这里"])
        self.assertEqual([m["role"] for m in self.provider.calls[0]], ["system", "user", "assistant", "user"])
        with self.assertRaises(ApiError):
            self.app.stream_chat({"messages": [{"role": "system", "content": "越权"}]})
        self.assertEqual(self.app.call("GET", "/health")[1]["engine_mode"], "mock")
        self.assertEqual(self.app.call("GET", "/health")[1]["chat_provider"], "kimi")

    def test_analysis_verifies_quote_and_computes_counts_before_saving(self):
        record = self.imported()
        full = self.app.call("GET", self.base + "/records/" + record["id"])[1]
        segment = full["segments"][1]
        response = {"summary": "报价确认边界待核实", "outcome": "updated", "changes": [{"title": "报价确认边界", "type": "new", "reason": "提出人工确认", "judgment": "报价需要人工确认，适用条件仍待核实", "evidence": [{"record_id": full["id"], "segment_id": segment["id"], "quote": "报价需要人工确认"}]}]}
        self.provider.responses = [json.dumps(response, ensure_ascii=False)]
        first = self.app.call("POST", self.base + "/agent-analysis", body={"record_id": record["id"], "allow_external_processing": False}, key="analyze")[1]
        second = self.app.call("POST", self.base + "/agent-analysis", body={"record_id": record["id"], "allow_external_processing": False}, key="analyze")[1]
        self.assertEqual(first, second)
        self.assertEqual(len(self.provider.calls), 1)
        self.assertEqual(first["result"]["counts"], {"new": 1, "supplemented": 0, "revised": 0})
        self.assertEqual(first["result"]["changes"][0]["evidence"][0]["meeting_id"], "M1")
        self.assertEqual(len(self.app.call("GET", self.base + "/agent-analyses")[1]["items"]), 1)
        self.assertEqual(self.app.call("GET", self.base + "/overview")[1]["snapshot_version"], 0)

    def test_invalid_json_or_fabricated_quote_does_not_write(self):
        record = self.imported()
        full = self.app.call("GET", self.base + "/records/" + record["id"])[1]
        self.provider.responses = ["not json", json.dumps({"summary": "错误引文", "outcome": "updated", "changes": [{"title": "报价确认边界", "type": "new", "reason": "不实", "judgment": "不存在", "evidence": [{"record_id": full["id"], "segment_id": full["segments"][1]["id"], "quote": "原文不存在这句话"}]}]}, ensure_ascii=False)]
        for key in ("bad-json", "bad-quote"):
            with self.assertRaises(ApiError) as caught:
                self.app.call("POST", self.base + "/agent-analysis", body={"record_id": record["id"], "allow_external_processing": False}, key=key)
            self.assertEqual(caught.exception.code, "MODEL_RESULT_INVALID")
        self.assertEqual(self.app.call("GET", self.base + "/agent-analyses")[1]["items"], [])

    def test_second_meeting_qualifies_existing_point_without_relabeling_it_new(self):
        first = self.imported()
        old = self.app.call("GET", self.base + "/records/" + first["id"])[1]
        first_result = {"summary": "报价确认待核实", "outcome": "updated", "changes": [{"title": "报价确认边界", "type": "new", "reason": "首次提及", "judgment": "报价需要人工确认", "evidence": [{"record_id": old["id"], "segment_id": old["segments"][1]["id"], "quote": "报价需要人工确认"}]}]}
        second = self.app.call("POST", self.base + "/records", body={"records": [item(3)]}, key="import-m3")[1]["items"][0]
        new = self.app.call("GET", self.base + "/records/" + second["id"])[1]
        matching = next(segment for segment in new["segments"] if "目录价" in segment["text"])
        qualified = {"summary": "目录价条件补充", "outcome": "updated", "changes": [{"title": "报价确认边界", "type": "qualified", "reason": "出现条件差异", "judgment": "需要区分报价条件", "evidence": [{"record_id": new["id"], "segment_id": matching["id"], "quote": "无折扣的目录价"}]}]}
        self.provider.responses = [json.dumps(first_result, ensure_ascii=False), json.dumps(qualified, ensure_ascii=False)]
        self.app.call("POST", self.base + "/agent-analysis", body={"record_id": first["id"], "allow_external_processing": False}, key="first")
        result = self.app.call("POST", self.base + "/agent-analysis", body={"record_id": second["id"], "allow_external_processing": False}, key="second")[1]
        self.assertEqual(result["result"]["counts"], {"new": 0, "supplemented": 1, "revised": 0})
        self.assertEqual(json.loads(self.provider.calls[1][-1]["content"])["previous_verified_results"][0]["changes"][0]["title"], "报价确认边界")

    def test_provider_failure_and_empty_outcome(self):
        record = self.imported()
        self.provider.responses = [ProviderError("UPSTREAM_NETWORK_ERROR", "Kimi 请求超时或网络暂时不可用。"), json.dumps({"summary": "没有足够信息", "outcome": "insufficient_evidence", "changes": []}, ensure_ascii=False)]
        with self.assertRaises(ApiError) as caught:
            self.app.call("POST", self.base + "/agent-analysis", body={"record_id": record["id"], "allow_external_processing": False}, key="timeout")
        self.assertEqual(caught.exception.code, "UPSTREAM_NETWORK_ERROR")
        result = self.app.call("POST", self.base + "/agent-analysis", body={"record_id": record["id"], "allow_external_processing": False}, key="empty")[1]
        self.assertEqual(result["result"]["counts"], {"new": 0, "supplemented": 0, "revised": 0})

    def test_authorized_material_requires_explicit_external_processing_flag(self):
        raw = item(1)
        raw["material_basis"] = "authorized"
        raw["authorization_note"] = "获准用于本机整理"
        record = self.app.call("POST", self.base + "/records", body={"records": [raw]}, key="authorized")[1]["items"][0]
        with self.assertRaises(ApiError) as denied:
            self.app.call("POST", self.base + "/agent-analysis", body={"record_id": record["id"], "allow_external_processing": False}, key="denied")
        self.assertEqual(denied.exception.code, "EXTERNAL_PROCESSING_NOT_APPROVED")
        self.assertEqual(self.provider.calls, [])
        self.provider.responses = [json.dumps({"summary": "材料不足", "outcome": "insufficient_evidence", "changes": []}, ensure_ascii=False)]
        allowed = self.app.call("POST", self.base + "/agent-analysis", body={"record_id": record["id"], "allow_external_processing": True}, key="allowed")[1]
        self.assertEqual(allowed["result"]["outcome"], "insufficient_evidence")

    def test_provider_sse_chunks_empty_and_regional_config(self):
        def opener(_request, timeout):
            self.assertEqual(timeout, 30)
            return io.BytesIO(b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n')
        provider = KimiProvider(api_key="stub", base_url="https://api.moonshot.cn/v1", model="test-model", opener=opener)
        self.assertEqual(list(provider.stream([{"role": "user", "content": "hi"}])), ["hello", " world"])
        with self.assertRaises(ValueError):
            KimiProvider(api_key="stub", base_url="https://example.com/v1", model="test-model")
        with self.assertRaises(ProviderError) as caught:
            empty = KimiProvider(api_key="stub", base_url="https://api.moonshot.ai/v1", model="test-model", opener=lambda *_args, **_kwargs: io.BytesIO(b"data: [DONE]\n\n"))
            list(empty.stream([{"role": "user", "content": "hi"}]))
        self.assertEqual(caught.exception.code, "UPSTREAM_EMPTY_RESULT")
        timed = KimiProvider(api_key="stub", base_url="https://api.moonshot.cn/v1", model="test-model", opener=lambda *_args, **_kwargs: (_ for _ in ()).throw(TimeoutError()))
        with self.assertRaises(ProviderError) as timeout:
            timed.complete([{"role": "user", "content": "hi"}])
        self.assertEqual(timeout.exception.code, "UPSTREAM_NETWORK_ERROR")

    def test_no_provider_is_explicitly_unavailable(self):
        offline = App(Path(self.temp.name) / "offline.db")
        try:
            self.assertEqual(offline.call("GET", "/health")[1]["chat_provider"], "none")
            with self.assertRaises(ApiError) as caught:
                offline.stream_chat({"messages": [{"role": "user", "content": "你好"}]})
            self.assertEqual(caught.exception.code, "PROVIDER_NOT_CONFIGURED")
        finally:
            offline.store.db.close()


if __name__ == "__main__":
    unittest.main()
