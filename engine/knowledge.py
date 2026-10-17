"""Read-only mapping of project mock snapshots and separate Kimi agent results."""
from __future__ import annotations


def _citations(state, evidence):
    records = {record["id"]: record for record in state["records"]}
    output = []
    for entry in evidence:
        record = records.get(entry.get("record_id"))
        segment = next((part for part in record["segments"] if part["id"] == entry.get("segment_id")), None) if record else None
        quote = entry.get("quote")
        if not segment or not isinstance(quote, str) or quote not in segment["text"]:
            raise ValueError("stored citation no longer resolves to its source paragraph")
        output.append({"record_id": record["id"], "segment_id": segment["id"], "quote": quote,
                       "meeting_id": record["meeting_id"], "source_title": record["title"],
                       "elicitation": entry.get("elicitation", "unknown")})
    return output


def knowledge_items(state):
    project = state.get("project")
    if not project:
        return []
    items = []
    for snapshot in state["snapshots"]:
        result = snapshot["result"]
        current = {change["insight_id"]: change for change in result["changes"]} if result["outcome"] == "updated" else {}
        for insight in result["insights"]:
            detail = result["details"][insight["id"]]
            citations = _citations(state, detail.get("evidence", []))
            change = current.get(insight["id"])
            result_id = f"mock@{snapshot['version']}@{insight['id']}"
            items.append({"id": result_id, "origin": "mock", "title": insight["title"],
                          "change_type": change["type"] if change else "unchanged",
                          "one_line": change["reason"] if change else insight["judgment"]["text"],
                          "version": snapshot["version"], "version_kind": "project_snapshot",
                          "provenance": {"provider": "deterministic_mock", "model": None, "project_id": project["id"], "result_id": result_id,
                                         "record_ids": list(dict.fromkeys(ref["record_id"] for ref in citations)),
                                         "meeting_ids": list(dict.fromkeys(ref["meeting_id"] for ref in citations))}})
    for agent_version, analysis in enumerate(state.get("agent_analyses", []), 1):
        for index, change in enumerate(analysis["result"]["changes"]):
            citations = _citations(state, change["evidence"])
            result_id = f"kimi@{analysis['id']}@{index}"
            items.append({"id": result_id, "origin": "kimi", "title": change["title"],
                          "change_type": change["type"], "one_line": change["reason"],
                          "version": analysis.get("version", agent_version), "version_kind": "agent_round",
                          "provenance": {"provider": "kimi", "model": analysis.get("model"), "project_id": project["id"], "result_id": result_id,
                                         "record_ids": list(dict.fromkeys(ref["record_id"] for ref in citations)),
                                         "meeting_ids": list(dict.fromkeys(ref["meeting_id"] for ref in citations))}})
    return items


def knowledge_detail(state, result_id):
    item = next((entry for entry in knowledge_items(state) if entry["id"] == result_id), None)
    if item is None:
        return None
    if item["origin"] == "mock":
        version, insight_id = result_id.split("@", 2)[1:]
        snapshot = next(entry for entry in state["snapshots"] if str(entry["version"]) == version)
        detail = snapshot["result"]["details"][insight_id]
        return {"item": item, "judgment": detail["judgment"]["text"],
                "conditions": detail["judgment"]["conditions"], "citations": _citations(state, detail.get("evidence", [])),
                "question_response_status": "提问与回应链尚未结构化标注；引文中的提问方式可逐条核查。",
                "importance": detail.get("importance"), "convergence_status": detail.get("convergence_status"),
                "full_detail": {"insight_id": insight_id, "snapshot_version": snapshot["version"]}}
    analysis_id, index = result_id.split("@", 2)[1:]
    analysis = next(entry for entry in state["agent_analyses"] if entry["id"] == analysis_id)
    change = analysis["result"]["changes"][int(index)]
    return {"item": item, "judgment": change["judgment"], "conditions": change.get("conditions", []),
            "citations": _citations(state, change["evidence"]),
            "question_response_status": "当前材料尚未结构化标注追问与回应，不能反推提问方式。",
            "importance": None, "convergence_status": "unknown", "full_detail": None}
