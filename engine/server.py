"""Local v0.1 HTTP API with explicit mock and optional Kimi agent endpoints."""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import sqlite3
from threading import RLock
from urllib.parse import parse_qs, unquote, urlsplit
from uuid import uuid4

from .analysis import DIMENSIONS, build_analysis
from .agent_analysis import AnalysisError, messages_for, validate_analysis
from .kimi import KimiProvider, ProviderError
from .knowledge import knowledge_detail, knowledge_items

SHANGHAI = timezone(timedelta(hours=8))
ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5201", "http://127.0.0.1:5201"}
SOURCE_TYPES = {"interview", "meeting", "chat", "research", "other"}


def now():
    return datetime.now(SHANGHAI).isoformat(timespec="seconds")


def uid(prefix):
    return f"{prefix}_{uuid4().hex[:16]}"


class ApiError(Exception):
    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message
        self.details = details or {}

    def payload(self):
        return {"code": self.code, "message": self.message, "retryable": False, "details": self.details}


def check(test, path, message="字段无效"):
    if not test:
        raise ApiError(422, "VALIDATION_ERROR", message, {"field": path})


def text_field(value, path, limit, *, nullable=False):
    if nullable and value is None:
        return None
    check(isinstance(value, str) and 0 < len(value.strip()) <= limit, path)
    return value.strip()


def validate_date(value, path):
    if value is None:
        return None
    check(isinstance(value, str) and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)), path)
    try:
        date.fromisoformat(value)
    except ValueError:
        check(False, path)
    return value


def empty_state():
    return {"project": None, "records": [], "jobs": [], "snapshots": [], "versions": [], "agent_analyses": []}


class Store:
    def __init__(self, db_path):
        self.path = Path(db_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = RLock()
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS requests (scope TEXT NOT NULL, key TEXT NOT NULL, body_hash TEXT NOT NULL, status INTEGER NOT NULL, response TEXT NOT NULL, PRIMARY KEY(scope,key))")
        self.db.execute("INSERT OR IGNORE INTO state(id,payload) VALUES(1,?)", (json.dumps(empty_state()),))
        self.db.commit()

    def read(self):
        with self.lock:
            state = json.loads(self.db.execute("SELECT payload FROM state WHERE id=1").fetchone()[0])
            state.setdefault("agent_analyses", [])
            return state

    def mutate(self, scope, key, body, action):
        check(isinstance(key, str) and 0 < len(key) <= 200, "Idempotency-Key", "需要 Idempotency-Key 请求头")
        digest = sha256(json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
        with self.lock:
            saved = self.db.execute("SELECT body_hash,status,response FROM requests WHERE scope=? AND key=?", (scope, key)).fetchone()
            if saved:
                if saved[0] != digest:
                    raise ApiError(409, "IDEMPOTENCY_CONFLICT", "同一请求标识对应不同内容")
                return saved[1], json.loads(saved[2]), True
            state = self.read()
            status, response = action(state)
            with self.db:
                self.db.execute("UPDATE state SET payload=? WHERE id=1", (json.dumps(state, ensure_ascii=False),))
                self.db.execute("INSERT INTO requests VALUES(?,?,?,?,?)", (scope, key, digest, status, json.dumps(response, ensure_ascii=False)))
            return status, response, False


def project_in(state, project_id):
    project = state["project"]
    if not project or project["id"] != project_id:
        raise ApiError(404, "PROJECT_NOT_FOUND", "项目不存在")
    return project


def snapshot_in(state, version):
    project = state["project"]
    if version is None:
        version = project["current_version"]
    if not isinstance(version, int) or version < 0 or version > project["current_version"]:
        raise ApiError(404, "VERSION_NOT_FOUND", "快照版本不存在")
    if version == 0:
        return None
    return state["snapshots"][version - 1]


def source_ids(state):
    return state["snapshots"][-1]["source_record_ids"] if state["snapshots"] else []


def record_summary(record, covered):
    fields = ("id", "title", "source_type", "source_date", "source_name", "material_basis", "authorization_note", "created_at", "meeting_id")
    return {**{field: record[field] for field in fields}, "covered_in_current_version": record["id"] in covered}


def validate_record(raw, index, existing):
    path = f"records[{index}]"
    check(isinstance(raw, dict), path)
    client_id = text_field(raw.get("client_record_id"), f"{path}.client_record_id", 200)
    title = text_field(raw.get("title"), f"{path}.title", 120)
    check(raw.get("source_type") in SOURCE_TYPES, f"{path}.source_type")
    source_name = text_field(raw.get("source_name"), f"{path}.source_name", 255, nullable=True)
    check(raw.get("material_basis") in ("synthetic", "authorized"), f"{path}.material_basis")
    note = text_field(raw.get("authorization_note"), f"{path}.authorization_note", 1000, nullable=True)
    if raw["material_basis"] == "authorized":
        check(note is not None, f"{path}.authorization_note", "获准材料需要授权说明")
    participants = raw.get("participants")
    check(isinstance(participants, list) and len(participants) <= 20, f"{path}.participants")
    people = []
    for p_index, person in enumerate(participants):
        check(isinstance(person, dict), f"{path}.participants[{p_index}]")
        person_id = text_field(person.get("id"), f"{path}.participants[{p_index}].id", 120)
        label = text_field(person.get("label"), f"{path}.participants[{p_index}].label", 80)
        check(person_id not in {item["id"] for item in people}, f"{path}.participants[{p_index}].id")
        people.append({"id": person_id, "label": label})
    content = raw.get("content")
    check(isinstance(content, str) and bool(content.strip()), f"{path}.content")
    if len(content) > 20000:
        raise ApiError(422, "TEXT_TOO_LONG", "材料超过 20,000 字", {"field": f"{path}.content"})
    meeting_id = raw.get("meeting_id")
    if meeting_id is not None:
        meeting_id = text_field(meeting_id, f"{path}.meeting_id", 120)
    for old in existing:
        for person in people:
            for other in old["participants"]:
                if person["id"] == other["id"] and person["label"] != other["label"]:
                    raise ApiError(409, "PARTICIPANT_CONFLICT", "同一参与者标识对应不同称谓")
    return {
        "client_record_id": client_id, "title": title, "source_type": raw["source_type"],
        "source_date": validate_date(raw.get("source_date"), f"{path}.source_date"),
        "source_name": source_name, "material_basis": raw["material_basis"],
        "authorization_note": note, "participants": people, "content": content,
        "meeting_id": meeting_id,
    }


def segments(content, record_id):
    parts = [part.strip() for part in re.split(r"\n\s*\n", content) if part.strip()]
    return [{"id": f"seg_{record_id}_{n}", "paragraph_index": n, "text": part} for n, part in enumerate(parts, 1)]


def make_overview(state, version):
    project = deepcopy(state["project"])
    snap = snapshot_in(state, version)
    covered = source_ids(state)
    if not snap:
        return {
            "project": project, "snapshot_version": 0, "active_job_id": None,
            "source_record_ids": [], "unanalyzed_record_ids": [r["id"] for r in state["records"] if r["id"] not in covered],
            "summary": "", "insights": [],
            "dimensions": [{"key": key, "status": "insufficient_evidence", "findings": [], "gaps": ["尚未分析材料。"]} for key in DIMENSIONS],
            "evidence": [], "changes": [], "outcome": None, "pending_confirmation_count": 0, "engine_mode": "mock",
        }
    result = deepcopy(snap["result"])
    return {
        "project": project, "snapshot_version": snap["version"], "active_job_id": None,
        "source_record_ids": snap["source_record_ids"],
        "unanalyzed_record_ids": [r["id"] for r in state["records"] if r["id"] not in covered],
        **{key: result[key] for key in ("summary", "insights", "dimensions", "evidence", "changes", "outcome")},
        "pending_confirmation_count": sum(i["dispute_status"] == "open" for i in result["insights"]),
        "engine_mode": "mock",
    }


def export_markdown(state, snap):
    result = snap["result"]
    record_map = {r["id"]: r for r in state["records"]}
    lines = [f"# 智慧火花碰撞｜{state['project']['name']}｜版本 {snap['version']}", "", "模拟引擎结果；本服务只对冻结合成案例提供演示分析，不代表真实客户事实、通用 AI 能力或上线批准。", "", f"导出时间：{now()}", f"快照时间：{snap['created_at']}", f"结果：{result['outcome']}", "", "## 材料范围", ""]
    for rid in snap["source_record_ids"]:
        record = record_map[rid]
        lines.append(f"- {record['meeting_id']}｜{record['title']}｜{record['source_date'] or '日期未知'}｜{record['source_name'] or '无文件名'}")
    lines += ["", "## 简报", "", result["summary"], "", "## 六维分析与缺口", ""]
    for dimension in result["dimensions"]:
        lines.append(f"### {dimension['key']}")
        lines += [f"- {finding['title']}：{finding['body']['text']}" for finding in dimension["findings"]]
        lines += [f"- 缺口：{gap}" for gap in dimension["gaps"]]
        lines.append("")
    lines += ["## 智慧点、场次与引文", ""]
    for insight in result["insights"]:
        detail = result["details"][insight["id"]]
        j = insight["judgment"]
        lines += [f"### {insight['title']}", "", f"判断（{j['epistemic_type']}，{j['review_status']}）：{j['text']}", f"条件：{'；'.join(j['conditions'])}", f"重要性：{insight['importance']['score']}/{insight['importance']['max_score']}（演示规则 {insight['importance']['rule_version']}）", f"跨会议：{insight['meeting_coverage']['distinct_meeting_count']}/{insight['meeting_coverage']['total_meeting_count']} 场；趋同：{insight['convergence_status']}", ""]
        for evidence in detail["evidence"]:
            record = record_map[evidence["record_id"]]
            paragraph = next(s["paragraph_index"] for s in record["segments"] if s["id"] == evidence["segment_id"])
            lines.append(f"- [{record['meeting_id']} · {record['title']} · 第 {paragraph} 段] “{evidence['quote']}”")
        lines += ["", "验证建议："]
        lines += [f"- {item['question']}（{item['status']}，非行动批准）" for item in detail["validations"]]
        lines.append("")
    lines += ["## 截至此版本的判断历史", ""]
    for version in state["versions"]:
        if version["version"] <= snap["version"]:
            lines.append(f"- v{version['version']}｜{version['outcome']}｜{version['summary']}")
    lines += ["", "## 未解决冲突", "", "- 无" if not any(i["dispute_status"] == "open" for i in result["insights"]) else "- 存在待确认候选判断", ""]
    return "\n".join(lines)


class App:
    def __init__(self, db_path, chat_provider=None):
        self.store = Store(db_path)
        self.chat_provider = chat_provider

    def stream_chat(self, body):
        if not self.chat_provider:
            raise ApiError(503, "PROVIDER_NOT_CONFIGURED", "本机尚未配置 Kimi 对话服务")
        check(isinstance(body, dict) and set(body) == {"messages"} and isinstance(body["messages"], list), "messages")
        raw = body["messages"]
        check(1 <= len(raw) <= 12, "messages", "最多传入最近 12 条对话")
        messages = []
        for index, item in enumerate(raw):
            check(isinstance(item, dict) and set(item) == {"role", "content"} and item["role"] in ("user", "assistant") and isinstance(item["content"], str) and 0 < len(item["content"].strip()) <= 2000, f"messages[{index}]")
            messages.append({"role": item["role"], "content": item["content"].strip()})
        check(messages[-1]["role"] == "user" and sum(len(item["content"]) for item in messages) <= 12000, "messages", "最后一条须为用户消息且总长度不得超过 12,000 字")
        system = {"role": "system", "content": "你是智慧火花碰撞的 Sparky。自然回应用户，帮助厘清想法。不要声称已分析材料、生成证据、执行外部任务或批准行动；只有明确的分析结果接口才能报告火花。简洁回答，承认不确定性。"}
        return self.chat_provider.stream([system, *messages])

    def call(self, method, path, query=None, body=None, key=None):
        query = query or {}
        state = self.store.read()
        if method == "GET" and path == "/health":
            return 200, {"status": "ok", "api_version": "0.1", "engine_mode": "mock", "model_configured": bool(self.chat_provider), "chat_provider": "kimi" if self.chat_provider else "none", "agent_analysis_mode": "kimi" if self.chat_provider else "unavailable"}, {}
        if method == "GET" and path == "/projects":
            return 200, {"items": [state["project"]] if state["project"] else []}, {}
        if method == "POST" and path == "/projects":
            def create(state):
                check(isinstance(body, dict), "body")
                name = text_field(body.get("name"), "name", 80)
                if state["project"]:
                    raise ApiError(409, "PROJECT_LIMIT_REACHED", "本版最多一个项目", {"existing_project_id": state["project"]["id"]})
                state["project"] = {"id": uid("prj"), "name": name, "created_at": now(), "current_version": 0, "record_count": 0}
                return 201, state["project"]
            status, result, _ = self.store.mutate(path, key, body, create)
            return status, result, {}
        match = re.fullmatch(r"/projects/([^/]+)(?:/(.*))?", path)
        if not match:
            raise ApiError(404, "NOT_FOUND", "接口不存在")
        project_id, tail = match.groups()
        project_in(state, project_id)
        if method == "GET" and tail == "records":
            covered = source_ids(state)
            return 200, {"items": [record_summary(r, covered) for r in state["records"]]}, {}
        if method == "GET" and tail == "agent-analyses":
            return 200, {"items": deepcopy(state["agent_analyses"])}, {}
        if method == "GET" and tail == "knowledge-items":
            try:
                items = knowledge_items(state)
            except ValueError:
                raise ApiError(500, "EVIDENCE_MISMATCH", "已保存结果的引文无法对应原文，停止展示洞察库") from None
            return 200, {"items": items}, {}
        knowledge_match = re.fullmatch(r"knowledge-items/([^/]+)", tail or "")
        if method == "GET" and knowledge_match:
            try:
                detail = knowledge_detail(state, knowledge_match[1])
            except ValueError:
                raise ApiError(500, "EVIDENCE_MISMATCH", "已保存结果的引文无法对应原文，停止展示详情") from None
            if detail is None:
                raise ApiError(404, "KNOWLEDGE_ITEM_NOT_FOUND", "这条洞察不在当前结果范围")
            return 200, detail, {}
        if method == "POST" and tail == "agent-analysis":
            if not self.chat_provider:
                raise ApiError(503, "PROVIDER_NOT_CONFIGURED", "本机尚未配置 Kimi 分析服务")
            check(isinstance(body, dict) and set(body) == {"record_id", "allow_external_processing"} and isinstance(body["record_id"], str) and isinstance(body["allow_external_processing"], bool), "record_id")
            def analyze_with_kimi(state):
                project_in(state, project_id)
                added_id = body["record_id"]
                record = next((item for item in state["records"] if item["id"] == added_id), None)
                if not record:
                    raise ApiError(404, "RECORD_NOT_FOUND", "分析材料不存在")
                if record["material_basis"] == "authorized" and not body["allow_external_processing"]:
                    raise ApiError(422, "EXTERNAL_PROCESSING_NOT_APPROVED", "已获授权材料须明确确认可发送给 Kimi 分析")
                if any(item["record_id"] == added_id for item in state["agent_analyses"]):
                    raise ApiError(409, "RECORD_ALREADY_ANALYZED", "这份材料已有 Kimi 分析结果")
                prior = state["agent_analyses"]
                scope_ids = [item["record_id"] for item in prior] + [added_id]
                scope = [item for item in state["records"] if item["id"] in scope_ids]
                if sum(len(item["content"]) for item in scope) > 16000:
                    raise ApiError(413, "ANALYSIS_CONTEXT_LIMIT", "本轮上下文超过 16,000 字，请缩短演示材料")
                try:
                    raw = self.chat_provider.complete(messages_for(scope, added_id, prior))
                    result = validate_analysis(raw, scope, added_id, prior)
                except AnalysisError as error:
                    raise ApiError(502, "MODEL_RESULT_INVALID", str(error)) from None
                except ProviderError as error:
                    raise ApiError(502, error.code, error.message) from None
                item = {"id": uid("agent"), "record_id": added_id, "version": len(prior) + 1, "created_at": now(), "provider": "kimi", "model": self.chat_provider.model, "result": result}
                state["agent_analyses"].append(item)
                return 201, item
            status, result, _ = self.store.mutate(f"{path}", key, body, analyze_with_kimi)
            return status, result, {}
        if method == "POST" and tail == "records":
            def import_records(state):
                project_in(state, project_id)
                check(isinstance(body, dict) and isinstance(body.get("records"), list) and 1 <= len(body["records"]) <= 5, "records")
                staged = []
                response = []
                known = {r["client_record_id"]: r for r in state["records"]}
                for index, raw in enumerate(body["records"]):
                    item = validate_record(raw, index, state["records"] + staged)
                    old = known.get(item["client_record_id"])
                    if old:
                        comparable = {k: old[k] for k in item}
                        if item["meeting_id"] is None:
                            item["meeting_id"] = old["meeting_id"]
                        if comparable != item:
                            raise ApiError(409, "RECORD_CONFLICT", "材料标识已有不同内容")
                        response.append(record_summary(old, source_ids(state)))
                        continue
                    if item["client_record_id"] in {r["client_record_id"] for r in staged}:
                        raise ApiError(409, "RECORD_CONFLICT", "批次内材料标识重复")
                    if item["meeting_id"] and any(r["meeting_id"] == item["meeting_id"] for r in state["records"] + staged):
                        raise ApiError(422, "MEETING_GROUPING_UNSUPPORTED", "首轮演示每场只能导入一份材料")
                    item["id"] = uid("rec")
                    item["meeting_id"] = item["meeting_id"] or f"meeting_{item['id']}"
                    item["created_at"] = now()
                    item["segments"] = segments(item["content"], item["id"])
                    staged.append(item)
                    response.append(record_summary(item, source_ids(state)))
                if len(state["records"]) + len(staged) > 10 or sum(len(r["content"]) for r in state["records"] + staged) > 60000:
                    raise ApiError(422, "LIMIT_EXCEEDED", "项目材料数量或总字数超限")
                state["records"].extend(staged)
                state["project"]["record_count"] = len(state["records"])
                return 201, {"items": response}
            status, result, _ = self.store.mutate(path, key, body, import_records)
            return status, result, {}
        record_match = re.fullmatch(r"records/([^/]+)", tail or "")
        if method == "GET" and record_match:
            record = next((r for r in state["records"] if r["id"] == record_match[1]), None)
            if not record:
                raise ApiError(404, "RECORD_NOT_FOUND", "材料不存在")
            return 200, {**record_summary(record, source_ids(state)), "content": record["content"], "participants": record["participants"], "segments": record["segments"]}, {}
        if method == "POST" and tail == "analyses":
            def analyze(state):
                project = project_in(state, project_id)
                check(isinstance(body, dict) and isinstance(body.get("record_ids"), list) and body["record_ids"], "record_ids")
                ids = body["record_ids"]
                check(all(isinstance(rid, str) and rid for rid in ids) and len(set(ids)) == len(ids), "record_ids")
                check(isinstance(body.get("expected_version"), int) and not isinstance(body["expected_version"], bool) and body["expected_version"] >= 0, "expected_version")
                if body["expected_version"] != project["current_version"]:
                    raise ApiError(409, "VERSION_CONFLICT", "项目版本已变化", {"expected_version": body["expected_version"], "current_version": project["current_version"]})
                records = {r["id"]: r for r in state["records"]}
                if any(rid not in records for rid in ids):
                    raise ApiError(404, "RECORD_NOT_FOUND", "分析材料不存在")
                covered = source_ids(state)
                if any(rid in covered for rid in ids):
                    raise ApiError(409, "RECORD_ALREADY_ANALYZED", "材料已进入最新快照")
                all_ids = covered + ids
                version = project["current_version"] + 1
                previous = state["snapshots"][-1]["result"] if state["snapshots"] else None
                result = build_analysis(project, [records[rid] for rid in all_ids], previous, version)
                # Refuse to publish broken citations. A failed write leaves the old snapshot intact.
                for evidence in result["evidence"]:
                    record = records[evidence["record_id"]]
                    segment = next((s for s in record["segments"] if s["id"] == evidence["segment_id"]), None)
                    if not segment or evidence["quote"] not in segment["text"]:
                        raise ApiError(500, "EVIDENCE_MISMATCH", "引文无法定位到原文")
                timestamp, job_id = now(), uid("job")
                job = {
                    "id": job_id, "project_id": project_id, "status": "succeeded", "stage": "done",
                    "base_version": version - 1, "added_record_ids": ids, "source_record_ids": all_ids,
                    "created_at": timestamp, "started_at": timestamp, "finished_at": timestamp,
                    "result_version": version, "outcome": result["outcome"], "error": None,
                }
                state["jobs"].append(job)
                state["snapshots"].append({"version": version, "created_at": timestamp, "source_record_ids": all_ids, "result": result})
                state["versions"].append({
                    "version": version, "parent_version": version - 1, "created_at": timestamp,
                    "cause": "analysis", "job_id": job_id, "correction_id": None,
                    "source_record_ids": all_ids, "outcome": result["outcome"],
                    "summary": result["summary"], "changes": result["changes"],
                    "actor_label": None, "correction_reason": None,
                })
                project["current_version"] = version
                return 202, job
            status, result, _ = self.store.mutate(path, key, body, analyze)
            return status, result, {"Location": f"/api/v1/projects/{project_id}/jobs/{result['id']}"}
        job_match = re.fullmatch(r"jobs/([^/]+)", tail or "")
        if method == "GET" and job_match:
            job = next((j for j in state["jobs"] if j["id"] == job_match[1]), None)
            if not job:
                raise ApiError(404, "JOB_NOT_FOUND", "任务不存在")
            return 200, job, {}
        if method == "GET" and tail == "overview":
            version = parse_version(query, allow_zero=True)
            return 200, make_overview(state, version), {}
        insight_match = re.fullmatch(r"insights/([^/]+)", tail or "")
        if method == "GET" and insight_match:
            snap = snapshot_in(state, parse_version(query, allow_zero=False))
            detail = snap["result"]["details"].get(insight_match[1]) if snap else None
            if not detail:
                raise ApiError(404, "INSIGHT_NOT_FOUND_AT_VERSION", "所选版本没有该智慧点")
            return 200, deepcopy(detail), {}
        if method == "GET" and tail == "versions":
            items = state["versions"]
            if "insight_id" in query:
                wanted = query["insight_id"][0]
                items = [v for v in items if any(c["insight_id"] == wanted for c in v["changes"])]
            return 200, {"items": list(reversed(items))}, {}
        if method == "GET" and tail == "export":
            if query.get("format", ["markdown"])[0] != "markdown":
                raise ApiError(422, "VALIDATION_ERROR", "仅支持 markdown 导出")
            snap = snapshot_in(state, parse_version(query, allow_zero=False))
            if not snap:
                raise ApiError(409, "NO_ANALYSIS", "请先分析材料")
            return 200, export_markdown(state, snap), {"Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": f"attachment; filename=\"spark-collision-v{snap['version']}.md\""}
        if method == "POST" and tail == "corrections":
            raise ApiError(501, "NOT_IMPLEMENTED", "首轮演示尚未接入纠错保存；本次没有写入数据")
        raise ApiError(404, "NOT_FOUND", "接口不存在")


def parse_version(query, *, allow_zero):
    if "version" not in query:
        return None
    raw = query["version"][0]
    if not re.fullmatch(r"\d+", raw) or not allow_zero and raw == "0":
        raise ApiError(422, "VALIDATION_ERROR", "版本号无效", {"field": "version"})
    return int(raw)


class Handler(BaseHTTPRequestHandler):
    app = None

    def _send(self, status, value, headers=None, *, error=False):
        headers = headers or {}
        request_id = uid("req")
        is_markdown = isinstance(value, str)
        if is_markdown:
            payload = value.encode("utf-8")
        else:
            payload = json.dumps({"error" if error else "data": value, "request_id": request_id}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", headers.get("Content-Type", "application/json; charset=utf-8"))
        self.send_header("Content-Length", str(len(payload)))
        origin = self.headers.get("Origin")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Expose-Headers", "Content-Disposition, Location")
        for name, value in headers.items():
            if name != "Content-Type":
                self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def _send_events(self, chunks):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        origin = self.headers.get("Origin")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        try:
            count = 0
            for part in chunks:
                count += len(part)
                self.wfile.write(f"event: delta\ndata: {json.dumps({'text': part}, ensure_ascii=False)}\n\n".encode("utf-8"))
                self.wfile.flush()
            self.wfile.write(f"event: done\ndata: {json.dumps({'characters': count})}\n\n".encode())
        except ProviderError as error:
            self.wfile.write(f"event: error\ndata: {json.dumps({'code': error.code, 'message': error.message}, ensure_ascii=False)}\n\n".encode("utf-8"))
        except (BrokenPipeError, ConnectionResetError):
            return

    def do_OPTIONS(self):
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key")
            self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()

    def _handle(self):
        try:
            url = urlsplit(self.path)
            if not url.path.startswith("/api/v1/"):
                raise ApiError(404, "NOT_FOUND", "接口不存在")
            body = None
            if self.command == "POST":
                length = int(self.headers.get("Content-Length", "0"))
                if length > 1048576:
                    raise ApiError(413, "PAYLOAD_TOO_LARGE", "请求体超过 1 MiB")
                if length <= 0 or "application/json" not in self.headers.get("Content-Type", ""):
                    raise ApiError(422, "VALIDATION_ERROR", "需要 JSON 请求体")
                try:
                    body = json.loads(self.rfile.read(length))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    raise ApiError(422, "VALIDATION_ERROR", "JSON 格式无效") from None
            path = unquote(url.path[len("/api/v1"):])
            if self.command == "POST" and path == "/chat/stream":
                self._send_events(self.app.stream_chat(body))
                return
            status, result, headers = self.app.call(self.command, path, parse_qs(url.query), body, self.headers.get("Idempotency-Key"))
            self._send(status, result, headers)
        except ApiError as error:
            self._send(error.status, error.payload(), error=True)
        except Exception:
            self._send(500, {"code": "INTERNAL_ERROR", "message": "服务内部错误，请检查本机日志", "retryable": False, "details": {}}, error=True)
            raise


def main():
    parser = argparse.ArgumentParser(description="Local synthetic spark collision API")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", default="var/spark.db")
    args = parser.parse_args()
    mode = os.environ.get("SPARK_CHAT_PROVIDER", "none").strip().lower()
    if mode not in ("none", "kimi"):
        parser.error("SPARK_CHAT_PROVIDER must be none or kimi")
    try:
        provider = KimiProvider.from_env() if mode == "kimi" else None
    except ValueError as error:
        parser.error(str(error))
    Handler.app = App(args.db, chat_provider=provider)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Local engine (project analysis: mock; agent: {mode}) listening on http://127.0.0.1:{args.port}/api/v1", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
