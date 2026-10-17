"""Deterministic, explicitly mock analysis of the frozen synthetic pricing case.

Other input produces an evidence-gap result. This module does not call an LLM.
"""
from __future__ import annotations

from copy import deepcopy

DIMENSIONS = (
    "key_facts", "cognitive_breakthroughs", "hidden_constraints",
    "ai_operations", "reusable_opportunities", "validation_questions",
)
PHRASES = {
    "m1": "标准问题可以自动回复，但报价需要人工确认。",
    "m2": "跨区报价需要销售确认，不能直接发送给客户。",
    "wait": "报价生成也许很快，但审批等待究竟多久，我们还没有统计。",
    "m3a": "无折扣的目录价可以由系统直接发送。",
    "m3b": "跨区报价或有特殊折扣时，仍要由销售确认。",
    "m4a": "我认可继续验证目录价自动发送、跨区报价人工确认这个方向。",
    "m4b": "这不代表已经批准上线或对外承诺。",
}
MAIN_KEYS = ("m1", "m2", "m3a", "m3b", "m4a", "m4b")
INSIGHT_ID = "ins_quote_boundary"
WAIT_ID = "ins_approval_wait"


def detect_evidence(records):
    found = {}
    for record in records:
        if record["material_basis"] != "synthetic":
            continue  # The case-specific mock must not analyze authorized real material.
        for segment in record["segments"]:
            for key, phrase in PHRASES.items():
                if key in found or phrase not in segment["text"]:
                    continue
                found[key] = {
                    "id": f"ev_{record['id']}_{segment['paragraph_index']}_{key}",
                    "label": "",
                    "record_id": record["id"],
                    "segment_id": segment["id"],
                    "quote": phrase,
                    "speaker_id": record["participants"][0]["id"] if record["participants"] else None,
                    "elicitation": "unknown",
                    "claim_origin": "participant_statement",
                    "meeting_id": record["meeting_id"],
                }
    for index, item in enumerate(found.values(), 1):
        item["label"] = f"E{index:02d}"
    return found


def meeting_coverage(keys, found, records):
    meetings = list(dict.fromkeys(found[key]["meeting_id"] for key in keys if key in found))
    all_meetings = list(dict.fromkeys(item["meeting_id"] for item in records))
    return {
        "distinct_meeting_count": len(meetings),
        "total_meeting_count": len(all_meetings),
        "meeting_ids": meetings,
    }


def coverage(keys, found, records):
    selected = [found[key] for key in keys if key in found]
    speakers = {item["speaker_id"] for item in selected if item["speaker_id"]}
    unknown_identity = any(not item["speaker_id"] for item in selected)
    elicitation_known = any(item["elicitation"] != "unknown" for item in selected)
    return {
        "unique_speakers": len(speakers) if speakers else None,
        "spontaneous_speakers": len({item["speaker_id"] for item in selected if item["speaker_id"] and item["elicitation"] == "spontaneous"}) if elicitation_known else None,
        "prompted_speakers": len({item["speaker_id"] for item in selected if item["speaker_id"] and item["elicitation"] == "prompted"}) if elicitation_known else None,
        "supporting_record_count": len({item["record_id"] for item in selected}),
        "total_analyzed_record_count": len(records),
        "identity_incomplete": unknown_identity,
        "unknown_elicitation_count": sum(item["elicitation"] == "unknown" for item in selected),
        "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。",
    }


def importance(keys, found, records):
    meeting = meeting_coverage(keys, found, records)
    speakers = {found[key]["speaker_id"] for key in keys if key in found and found[key]["speaker_id"]}
    business = bool(set(keys) & {"m1", "m2", "m3a", "m3b"})
    parts = {
        "distinct_meetings": min(meeting["distinct_meeting_count"], 3),
        "independent_speakers": int(len(speakers) >= 2),
        "documented_business_choice": int(business),
    }
    return {
        "rule_version": "demo-0.1",
        "score": sum(parts.values()),
        "max_score": 5,
        "parts": parts,
        "raw_counts": {
            "distinct_meetings": meeting["distinct_meeting_count"],
            "independent_speakers": len(speakers) if speakers else None,
        },
        "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。",
    }


def judgment(text, identifier, evidence_ids, conditions, rationale, gaps, kind="inference"):
    return {
        "id": identifier,
        "text": text,
        "epistemic_type": kind,
        "fact_basis": None,
        "review_status": "unreviewed",
        "conditions": conditions,
        "evidence_ids": evidence_ids,
        "rationale": rationale,
        "alternative_explanations": ["仍需核对正式报价授权制度和实际订单。"] if kind in ("inference", "hypothesis") else [],
        "evidence_gaps": gaps,
    }


def block(text, evidence_ids, conditions=None, kind="inference", gaps=None):
    return {
        "text": text, "epistemic_type": kind, "evidence_ids": evidence_ids,
        "conditions": conditions or [], "alternative_explanations": ["还可能受现有授权规则影响。"] if kind in ("inference", "hypothesis") else [],
        "gaps": gaps or [],
    }


def validation(evidence_ids):
    return [{
        "id": "val_quote_boundary",
        "question": "不同报价类型的批准规则是否与访谈描述一致？",
        "decision_impact": "决定自动发送与人工确认的边界。",
        "evidence_ids": evidence_ids,
        "required_materials": ["获准使用的报价授权规则", "跨区与目录价订单样本"],
        "interview_roles": ["销售负责人", "运营负责人"],
        "experiment": "对照规则与订单，逐笔标出直接发送或人工确认，并记录例外。",
        "success_criteria": "样本和正式规则支持同一条件边界。",
        "failure_criteria": "发现反例或正式规则与访谈表述不一致。",
        "next_decision": "依据验证结果保留、修正或撤回暂定判断。",
        "owner": None, "due_at": None,
        "workstream": "internal_research", "status": "proposed",
    }]


def spark_path(keys, found, records, version):
    if "m3a" not in found or "m1" not in found:
        return None
    by_id = {record["id"]: record for record in records}
    selected = ["m1", "m3a"]
    if "m4a" in found:
        selected.append("m4a")
    conversations = []
    for key in selected:
        ev = found[key]
        record = by_id[ev["record_id"]]
        conversations.append({
            "id": ev["meeting_id"], "title": record["title"],
            "date": record["source_date"], "record_ids": [record["id"]],
        })
    # The collision is between the initial caution and the later condition, not a vote.
    first, later = found["m1"], found["m3a"]
    before = "已讨论的报价都提到人工确认；适用范围待核实。"
    after = "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。"
    events = [{
        "id": "spark_quote_condition", "version": version if "m3a" in found else 1,
        "kind": "collision", "scope": "cross", "previous_event_id": None,
        "conversation_ids": [first["meeting_id"], later["meeting_id"]],
        "before": before, "after": after,
        "reason": "运营讨论给报价确认补充了目录价与例外条件，修正了无条件人工确认的读法。",
        "contributions": [
            {"conversation_id": first["meeting_id"], "text": "客服提出报价需人工确认。", "evidence_ids": [first["id"]]},
            {"conversation_id": later["meeting_id"], "text": "运营提出无折扣目录价可直接发送。", "evidence_ids": [later["id"]]},
        ],
    }]
    if "m4a" in found:
        ev = found["m4a"]
        events.append({
            "id": "spark_quote_repeat", "version": version, "kind": "corroboration",
            "scope": None, "previous_event_id": "spark_quote_condition",
            "conversation_ids": [ev["meeting_id"]],
            "before": after, "after": after,
            "reason": "复盘只重复已知方向，未提出新的适用条件；认可继续验证不等于批准上线。",
            "contributions": [{
                "conversation_id": ev["meeting_id"], "text": "重复认可已有的条件边界。",
                "evidence_ids": [ev["id"]],
            }],
        })
    return {
        "status": "collision", "latest_event_id": events[-1]["id"],
        "conversations": conversations, "events": events,
    }


def finding(identifier, title, text, evidence_ids, insight_ids, kind="inference"):
    return {
        "id": identifier, "title": title,
        "body": block(text, evidence_ids, kind=kind),
        "insight_ids": insight_ids, "sections": [],
    }


def dimensions(insights, found):
    result = []
    main = next((item for item in insights if item["id"] == INSIGHT_ID), None)
    wait = next((item for item in insights if item["id"] == WAIT_ID), None)
    for key in DIMENSIONS:
        items = []
        if key == "key_facts" and main:
            ids = [found[k]["id"] for k in ("m1", "m2", "m3a") if k in found]
            items.append(finding("fact_quote", "不同场次提出不同报价条件", "材料记录了报价确认与目录价条件；外部规则仍待核实。", ids, [INSIGHT_ID]))
        if key == "cognitive_breakthroughs" and main and "m3a" in found:
            items.append(finding("breakthrough_quote", "从无条件人工确认到条件边界", main["judgment"]["text"], main["judgment"]["evidence_ids"], [INSIGHT_ID]))
        if key == "hidden_constraints" and wait:
            items.append(finding("constraint_wait", "审批等待尚无运行基线", wait["judgment"]["text"], wait["judgment"]["evidence_ids"], [WAIT_ID], "hypothesis"))
        if key == "validation_questions" and main:
            items.append(finding("question_quote", "核对授权规则与真实订单", "逐笔核对目录价、跨区与特殊折扣的处理边界。", main["judgment"]["evidence_ids"], [INSIGHT_ID]))
        result.append({
            "key": key, "status": "available" if items else "insufficient_evidence",
            "findings": items,
            "gaps": [] if items else ["合成短记录不足以支持该视角的可靠结论。"],
        })
    return result


def build_analysis(project, records, previous, version):
    found = detect_evidence(records)
    main_keys = [key for key in MAIN_KEYS if key in found]
    insights = []
    details = {}
    if main_keys:
        ids = [found[key]["id"] for key in main_keys]
        qualified = "m3a" in found
        statement = (
            "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。"
            if qualified else "已讨论的报价都提到人工确认；适用范围待核实。"
        )
        conditions = (
            ["无折扣目录价", "跨区或特殊折扣报价"] if qualified
            else ["仅限已讨论的报价类型，其他情形未知"]
        )
        current = judgment(
            statement, "judgment_quote_qualified" if qualified else "judgment_quote_initial",
            ids, conditions,
            "按不同报价条件并列保留观点，不把未讨论的情况推成同意或反对。",
            ["正式授权规则和更多订单类型尚未核对。"],
        )
        previous_main = next((item for item in previous.get("insights", []) if item["id"] == INSIGHT_ID), None) if previous else None
        prior_id = previous_main["judgment"]["id"] if previous_main else None
        if not previous_main:
            change_type, breakthrough, reason = "new", False, "形成报价确认的暂定边界。"
        elif prior_id != current["id"]:
            change_type, breakthrough, reason = "qualified", True, "目录价与跨区/折扣报价需要分条件判断。"
        else:
            change_type, breakthrough, reason = "unchanged", False, "新增讨论没有改变已有条件边界。"
        change = {
            "insight_id": INSIGHT_ID, "type": change_type, "reason": reason,
            "evidence_ids": [found[key]["id"] for key in ("m3a", "m4a") if key in found] or ids,
            "previous_judgment_id": prior_id, "current_judgment_id": current["id"],
            "candidate_judgment_id": None, "is_breakthrough": breakthrough,
        }
        meeting = meeting_coverage(main_keys, found, records)
        summary = {
            "id": INSIGHT_ID, "title": "报价的确认边界",
            "judgment": current, "dispute_status": "none",
            "coverage": coverage(main_keys, found, records),
            "meeting_coverage": meeting,
            "importance": importance(main_keys, found, records),
            "convergence_status": "conditional_convergence" if qualified else "conditions_unresolved",
            "last_change": change,
        }
        annotation_relation = {
            "m1": "supports", "m2": "supports", "m3a": "qualifies",
            "m3b": "supports", "m4a": "supports", "m4b": "supplements",
        }
        summary["annotations"] = [
            {
                "meeting_id": found[key]["meeting_id"], "evidence_id": found[key]["id"],
                "relation": annotation_relation[key],
                "condition": "无折扣目录价" if key == "m3a" else "跨区或特殊折扣" if key in ("m2", "m3b") else None,
            }
            for key in main_keys
        ]
        spark = spark_path(main_keys, found, records, version)
        if spark:
            # The first collision version must remain stable in later snapshots.
            if previous_main and previous_main.get("spark"):
                original = previous_main["spark"]["events"][0]["version"]
                spark["events"][0]["version"] = original
            summary["spark"] = spark
        insights.append(summary)
        evidence = [found[key] for key in main_keys]
        details[INSIGHT_ID] = {
            **deepcopy(summary), "snapshot_version": version,
            "candidate_judgment": None, "evidence": evidence,
            "relations": [{"evidence_id": found[key]["id"], "relation": annotation_relation[key]} for key in main_keys],
            "annotations": summary["annotations"],
            "collision_card": None,
            "validations": validation(ids[:2]),
            "priority": {
                "business_impact": {"level": "high", "reason": "合成原话涉及报价能否直接对外发送；实际经营影响待验证。"},
                "evidence_strength": {"level": "low", "reason": "仅有合成访谈，无正式授权规则。"},
                "validation_feasibility": {"level": "medium", "reason": "可用授权规则和订单样本核查。"},
            },
        }
    if "wait" in found:
        ev = found["wait"]
        current = judgment(
            "审批等待可能影响报价总时长，但尚无实测基线。",
            "judgment_wait_initial", [ev["id"]], ["仅是待验证约束"],
            "发言者明确说尚未统计，不能据此断定审批是首要瓶颈。",
            ["缺少处理、审批等待和返工时间记录。"], "hypothesis",
        )
        prior = next((item for item in previous.get("insights", []) if item["id"] == WAIT_ID), None) if previous else None
        change = {
            "insight_id": WAIT_ID, "type": "new" if not prior else "unchanged",
            "reason": "提出需补运行基线。" if not prior else "本次未增加审批等待信息。",
            "evidence_ids": [ev["id"]], "previous_judgment_id": prior["judgment"]["id"] if prior else None,
            "current_judgment_id": current["id"], "candidate_judgment_id": None,
            "is_breakthrough": False,
        }
        item = {
            "id": WAIT_ID, "title": "审批等待缺少运行基线",
            "judgment": current, "dispute_status": "none",
            "coverage": coverage(["wait"], found, records),
            "meeting_coverage": meeting_coverage(["wait"], found, records),
            "importance": importance(["wait"], found, records),
            "convergence_status": "insufficient_evidence",
            "attention_flag": "需关注：低频但可能影响投入顺序",
            "last_change": change,
        }
        insights.append(item)
        details[WAIT_ID] = {
            **deepcopy(item), "snapshot_version": version, "candidate_judgment": None,
            "evidence": [ev], "relations": [{"evidence_id": ev["id"], "relation": "supplements"}],
            "annotations": [{"meeting_id": ev["meeting_id"], "evidence_id": ev["id"], "relation": "supplements", "condition": None}],
            "collision_card": None, "validations": [],
            "priority": {
                "business_impact": {"level": "unknown", "reason": "审批等待没有实测时长。"},
                "evidence_strength": {"level": "low", "reason": "仅一场合成讨论提出，尚未核实。"},
                "validation_feasibility": {"level": "medium", "reason": "可记录同一笔订单各步骤耗时。"},
            },
        }
    evidence = list(found.values())
    changes = [item["last_change"] for item in insights]
    prior_ids = {item["id"] for item in previous.get("insights", [])} if previous else set()
    materially_changed = any(item["last_change"]["type"] in ("new", "qualified", "revised", "challenged") for item in insights if item["id"] not in prior_ids or item["last_change"]["type"] != "new")
    outcome = "insufficient_evidence" if not insights else "updated" if materially_changed else "no_new_insight"
    if outcome == "no_new_insight":
        for item in insights:
            item["last_change"]["is_breakthrough"] = False
    return {
        "summary": (
            "材料不足以形成有依据的智慧点；本次不制造火花。" if not insights else
            "合成讨论表明报价确认存在条件边界；审批等待仍缺运行基线。"
            if "m3a" in found else
            "合成讨论提出报价需人工确认，具体适用范围仍待核实。"
        ),
        "insights": insights, "details": details,
        "dimensions": dimensions(insights, found),
        "evidence": evidence, "changes": changes, "outcome": outcome,
    }
