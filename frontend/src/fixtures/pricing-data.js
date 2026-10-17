// Generated from examples/pricing-boundary/M1–M4.md and the deterministic mock.
// Synthetic demonstration only; no real customer or AI run. Regenerate with scripts/generate-demo.py.
export const pricingData = {
  "records": [
    {
      "id": "rec_01",
      "meeting_id": "M1",
      "title": "M1 客服访谈（合成）",
      "source_type": "interview",
      "source_name": "M1.md",
      "source_date": null,
      "material_basis": "synthetic",
      "authorization_note": null,
      "created_at": "2026-10-17T11:00:00+08:00",
      "covered_in_current_version": true,
      "content": "# M1 客服访谈（合成）\n\n客服负责人：标准问题可以自动回复，但报价需要人工确认。\n\n客服负责人：我目前不知道不同报价类型是否都要走同一审批流程。\n",
      "participants": [
        {
          "id": "person_01",
          "label": "客服负责人"
        }
      ],
      "segments": [
        {
          "id": "rec_01_seg_1",
          "paragraph_index": 1,
          "text": "# M1 客服访谈（合成）"
        },
        {
          "id": "rec_01_seg_2",
          "paragraph_index": 2,
          "text": "客服负责人：标准问题可以自动回复，但报价需要人工确认。"
        },
        {
          "id": "rec_01_seg_3",
          "paragraph_index": 3,
          "text": "客服负责人：我目前不知道不同报价类型是否都要走同一审批流程。"
        }
      ]
    },
    {
      "id": "rec_02",
      "meeting_id": "M2",
      "title": "M2 销售访谈（合成）",
      "source_type": "interview",
      "source_name": "M2.md",
      "source_date": null,
      "material_basis": "synthetic",
      "authorization_note": null,
      "created_at": "2026-10-17T11:00:00+08:00",
      "covered_in_current_version": true,
      "content": "# M2 销售访谈（合成）\n\n销售负责人：跨区报价需要销售确认，不能直接发送给客户。\n\n销售负责人：报价生成也许很快，但审批等待究竟多久，我们还没有统计。\n",
      "participants": [
        {
          "id": "person_02",
          "label": "销售负责人"
        }
      ],
      "segments": [
        {
          "id": "rec_02_seg_1",
          "paragraph_index": 1,
          "text": "# M2 销售访谈（合成）"
        },
        {
          "id": "rec_02_seg_2",
          "paragraph_index": 2,
          "text": "销售负责人：跨区报价需要销售确认，不能直接发送给客户。"
        },
        {
          "id": "rec_02_seg_3",
          "paragraph_index": 3,
          "text": "销售负责人：报价生成也许很快，但审批等待究竟多久，我们还没有统计。"
        }
      ]
    },
    {
      "id": "rec_03",
      "meeting_id": "M3",
      "title": "M3 运营讨论（合成）",
      "source_type": "meeting",
      "source_name": "M3.md",
      "source_date": null,
      "material_basis": "synthetic",
      "authorization_note": null,
      "created_at": "2026-10-17T11:00:00+08:00",
      "covered_in_current_version": true,
      "content": "# M3 运营讨论（合成）\n\n运营负责人：无折扣的目录价可以由系统直接发送。\n\n运营负责人：跨区报价或有特殊折扣时，仍要由销售确认。\n",
      "participants": [
        {
          "id": "person_03",
          "label": "运营负责人"
        }
      ],
      "segments": [
        {
          "id": "rec_03_seg_1",
          "paragraph_index": 1,
          "text": "# M3 运营讨论（合成）"
        },
        {
          "id": "rec_03_seg_2",
          "paragraph_index": 2,
          "text": "运营负责人：无折扣的目录价可以由系统直接发送。"
        },
        {
          "id": "rec_03_seg_3",
          "paragraph_index": 3,
          "text": "运营负责人：跨区报价或有特殊折扣时，仍要由销售确认。"
        }
      ]
    },
    {
      "id": "rec_04",
      "meeting_id": "M4",
      "title": "M4 项目复盘（合成）",
      "source_type": "meeting",
      "source_name": "M4.md",
      "source_date": null,
      "material_basis": "synthetic",
      "authorization_note": null,
      "created_at": "2026-10-17T11:00:00+08:00",
      "covered_in_current_version": true,
      "content": "# M4 项目复盘（合成）\n\n项目负责人：我认可继续验证目录价自动发送、跨区报价人工确认这个方向。\n\n项目负责人：这不代表已经批准上线或对外承诺。\n",
      "participants": [
        {
          "id": "person_04",
          "label": "项目负责人"
        }
      ],
      "segments": [
        {
          "id": "rec_04_seg_1",
          "paragraph_index": 1,
          "text": "# M4 项目复盘（合成）"
        },
        {
          "id": "rec_04_seg_2",
          "paragraph_index": 2,
          "text": "项目负责人：我认可继续验证目录价自动发送、跨区报价人工确认这个方向。"
        },
        {
          "id": "rec_04_seg_3",
          "paragraph_index": 3,
          "text": "项目负责人：这不代表已经批准上线或对外承诺。"
        }
      ]
    }
  ],
  "snapshots": {
    "1": {
      "overview": {
        "summary": "合成讨论提出报价需人工确认，具体适用范围仍待核实。",
        "insights": [
          {
            "id": "ins_quote_boundary",
            "title": "报价的确认边界",
            "judgment": {
              "id": "judgment_quote_initial",
              "text": "已讨论的报价都提到人工确认；适用范围待核实。",
              "epistemic_type": "inference",
              "fact_basis": null,
              "review_status": "unreviewed",
              "conditions": [
                "仅限已讨论的报价类型，其他情形未知"
              ],
              "evidence_ids": [
                "ev_rec_01_2_m1",
                "ev_rec_02_2_m2"
              ],
              "rationale": "按不同报价条件并列保留观点，不把未讨论的情况推成同意或反对。",
              "alternative_explanations": [
                "仍需核对正式报价授权制度和实际订单。"
              ],
              "evidence_gaps": [
                "正式授权规则和更多订单类型尚未核对。"
              ]
            },
            "dispute_status": "none",
            "coverage": {
              "unique_speakers": 2,
              "spontaneous_speakers": null,
              "prompted_speakers": null,
              "supporting_record_count": 2,
              "total_analyzed_record_count": 2,
              "identity_incomplete": false,
              "unknown_elicitation_count": 2,
              "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
            },
            "meeting_coverage": {
              "distinct_meeting_count": 2,
              "total_meeting_count": 2,
              "meeting_ids": [
                "M1",
                "M2"
              ]
            },
            "importance": {
              "rule_version": "demo-0.1",
              "score": 4,
              "max_score": 5,
              "parts": {
                "distinct_meetings": 2,
                "independent_speakers": 1,
                "documented_business_choice": 1
              },
              "raw_counts": {
                "distinct_meetings": 2,
                "independent_speakers": 2
              },
              "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
            },
            "convergence_status": "conditions_unresolved",
            "last_change": {
              "insight_id": "ins_quote_boundary",
              "type": "new",
              "reason": "形成报价确认的暂定边界。",
              "evidence_ids": [
                "ev_rec_01_2_m1",
                "ev_rec_02_2_m2"
              ],
              "previous_judgment_id": null,
              "current_judgment_id": "judgment_quote_initial",
              "candidate_judgment_id": null,
              "is_breakthrough": false
            },
            "annotations": [
              {
                "meeting_id": "M1",
                "evidence_id": "ev_rec_01_2_m1",
                "relation": "supports",
                "condition": null
              },
              {
                "meeting_id": "M2",
                "evidence_id": "ev_rec_02_2_m2",
                "relation": "supports",
                "condition": "跨区报价"
              }
            ]
          },
          {
            "id": "ins_approval_wait",
            "title": "审批等待缺少运行基线",
            "judgment": {
              "id": "judgment_wait_initial",
              "text": "审批等待可能影响报价总时长，但尚无实测基线。",
              "epistemic_type": "hypothesis",
              "fact_basis": null,
              "review_status": "unreviewed",
              "conditions": [
                "仅是待验证约束"
              ],
              "evidence_ids": [
                "ev_rec_02_3_wait"
              ],
              "rationale": "发言者明确说尚未统计，不能据此断定审批是首要瓶颈。",
              "alternative_explanations": [
                "仍需核对正式报价授权制度和实际订单。"
              ],
              "evidence_gaps": [
                "缺少处理、审批等待和返工时间记录。"
              ]
            },
            "dispute_status": "none",
            "coverage": {
              "unique_speakers": 1,
              "spontaneous_speakers": null,
              "prompted_speakers": null,
              "supporting_record_count": 1,
              "total_analyzed_record_count": 2,
              "identity_incomplete": false,
              "unknown_elicitation_count": 1,
              "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
            },
            "meeting_coverage": {
              "distinct_meeting_count": 1,
              "total_meeting_count": 2,
              "meeting_ids": [
                "M2"
              ]
            },
            "importance": {
              "rule_version": "demo-0.1",
              "score": 1,
              "max_score": 5,
              "parts": {
                "distinct_meetings": 1,
                "independent_speakers": 0,
                "documented_business_choice": 0
              },
              "raw_counts": {
                "distinct_meetings": 1,
                "independent_speakers": 1
              },
              "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
            },
            "convergence_status": "insufficient_evidence",
            "attention_flag": "需关注：低频但可能影响投入顺序",
            "last_change": {
              "insight_id": "ins_approval_wait",
              "type": "new",
              "reason": "提出需补运行基线。",
              "evidence_ids": [
                "ev_rec_02_3_wait"
              ],
              "previous_judgment_id": null,
              "current_judgment_id": "judgment_wait_initial",
              "candidate_judgment_id": null,
              "is_breakthrough": false
            }
          }
        ],
        "dimensions": [
          {
            "key": "key_facts",
            "status": "available",
            "findings": [
              {
                "id": "fact_quote",
                "title": "不同场次提出不同报价条件",
                "body": {
                  "text": "材料记录了报价确认与目录价条件；外部规则仍待核实。",
                  "epistemic_type": "inference",
                  "evidence_ids": [
                    "ev_rec_01_2_m1",
                    "ev_rec_02_2_m2"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_quote_boundary"
                ],
                "sections": []
              }
            ],
            "gaps": []
          },
          {
            "key": "cognitive_breakthroughs",
            "status": "insufficient_evidence",
            "findings": [],
            "gaps": [
              "合成短记录不足以支持该视角的可靠结论。"
            ]
          },
          {
            "key": "hidden_constraints",
            "status": "available",
            "findings": [
              {
                "id": "constraint_wait",
                "title": "审批等待尚无运行基线",
                "body": {
                  "text": "审批等待可能影响报价总时长，但尚无实测基线。",
                  "epistemic_type": "hypothesis",
                  "evidence_ids": [
                    "ev_rec_02_3_wait"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_approval_wait"
                ],
                "sections": []
              }
            ],
            "gaps": []
          },
          {
            "key": "ai_operations",
            "status": "insufficient_evidence",
            "findings": [],
            "gaps": [
              "合成短记录不足以支持该视角的可靠结论。"
            ]
          },
          {
            "key": "reusable_opportunities",
            "status": "insufficient_evidence",
            "findings": [],
            "gaps": [
              "合成短记录不足以支持该视角的可靠结论。"
            ]
          },
          {
            "key": "validation_questions",
            "status": "available",
            "findings": [
              {
                "id": "question_quote",
                "title": "核对授权规则与真实订单",
                "body": {
                  "text": "逐笔核对目录价、跨区与特殊折扣的处理边界。",
                  "epistemic_type": "inference",
                  "evidence_ids": [
                    "ev_rec_01_2_m1",
                    "ev_rec_02_2_m2"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_quote_boundary"
                ],
                "sections": []
              }
            ],
            "gaps": []
          }
        ],
        "evidence": [
          {
            "id": "ev_rec_01_2_m1",
            "label": "E01",
            "record_id": "rec_01",
            "segment_id": "rec_01_seg_2",
            "quote": "标准问题可以自动回复，但报价需要人工确认。",
            "speaker_id": "person_01",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M1"
          },
          {
            "id": "ev_rec_02_2_m2",
            "label": "E02",
            "record_id": "rec_02",
            "segment_id": "rec_02_seg_2",
            "quote": "跨区报价需要销售确认，不能直接发送给客户。",
            "speaker_id": "person_02",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M2"
          },
          {
            "id": "ev_rec_02_3_wait",
            "label": "E03",
            "record_id": "rec_02",
            "segment_id": "rec_02_seg_3",
            "quote": "报价生成也许很快，但审批等待究竟多久，我们还没有统计。",
            "speaker_id": "person_02",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M2"
          }
        ],
        "changes": [
          {
            "insight_id": "ins_quote_boundary",
            "type": "new",
            "reason": "形成报价确认的暂定边界。",
            "evidence_ids": [
              "ev_rec_01_2_m1",
              "ev_rec_02_2_m2"
            ],
            "previous_judgment_id": null,
            "current_judgment_id": "judgment_quote_initial",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          },
          {
            "insight_id": "ins_approval_wait",
            "type": "new",
            "reason": "提出需补运行基线。",
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "previous_judgment_id": null,
            "current_judgment_id": "judgment_wait_initial",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          }
        ],
        "outcome": "updated",
        "project": {
          "id": "prj_demo",
          "name": "报价授权边界调研",
          "created_at": "2026-10-17T11:00:00+08:00",
          "current_version": 3,
          "record_count": 4
        },
        "snapshot_version": 1,
        "active_job_id": null,
        "source_record_ids": [
          "rec_01",
          "rec_02"
        ],
        "unanalyzed_record_ids": [],
        "pending_confirmation_count": 0,
        "engine_mode": "mock"
      },
      "details": {
        "ins_quote_boundary": {
          "id": "ins_quote_boundary",
          "title": "报价的确认边界",
          "judgment": {
            "id": "judgment_quote_initial",
            "text": "已讨论的报价都提到人工确认；适用范围待核实。",
            "epistemic_type": "inference",
            "fact_basis": null,
            "review_status": "unreviewed",
            "conditions": [
              "仅限已讨论的报价类型，其他情形未知"
            ],
            "evidence_ids": [
              "ev_rec_01_2_m1",
              "ev_rec_02_2_m2"
            ],
            "rationale": "按不同报价条件并列保留观点，不把未讨论的情况推成同意或反对。",
            "alternative_explanations": [
              "仍需核对正式报价授权制度和实际订单。"
            ],
            "evidence_gaps": [
              "正式授权规则和更多订单类型尚未核对。"
            ]
          },
          "dispute_status": "none",
          "coverage": {
            "unique_speakers": 2,
            "spontaneous_speakers": null,
            "prompted_speakers": null,
            "supporting_record_count": 2,
            "total_analyzed_record_count": 2,
            "identity_incomplete": false,
            "unknown_elicitation_count": 2,
            "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
          },
          "meeting_coverage": {
            "distinct_meeting_count": 2,
            "total_meeting_count": 2,
            "meeting_ids": [
              "M1",
              "M2"
            ]
          },
          "importance": {
            "rule_version": "demo-0.1",
            "score": 4,
            "max_score": 5,
            "parts": {
              "distinct_meetings": 2,
              "independent_speakers": 1,
              "documented_business_choice": 1
            },
            "raw_counts": {
              "distinct_meetings": 2,
              "independent_speakers": 2
            },
            "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
          },
          "convergence_status": "conditions_unresolved",
          "last_change": {
            "insight_id": "ins_quote_boundary",
            "type": "new",
            "reason": "形成报价确认的暂定边界。",
            "evidence_ids": [
              "ev_rec_01_2_m1",
              "ev_rec_02_2_m2"
            ],
            "previous_judgment_id": null,
            "current_judgment_id": "judgment_quote_initial",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          },
          "annotations": [
            {
              "meeting_id": "M1",
              "evidence_id": "ev_rec_01_2_m1",
              "relation": "supports",
              "condition": null
            },
            {
              "meeting_id": "M2",
              "evidence_id": "ev_rec_02_2_m2",
              "relation": "supports",
              "condition": "跨区报价"
            }
          ],
          "snapshot_version": 1,
          "candidate_judgment": null,
          "evidence": [
            {
              "id": "ev_rec_01_2_m1",
              "label": "E01",
              "record_id": "rec_01",
              "segment_id": "rec_01_seg_2",
              "quote": "标准问题可以自动回复，但报价需要人工确认。",
              "speaker_id": "person_01",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M1"
            },
            {
              "id": "ev_rec_02_2_m2",
              "label": "E02",
              "record_id": "rec_02",
              "segment_id": "rec_02_seg_2",
              "quote": "跨区报价需要销售确认，不能直接发送给客户。",
              "speaker_id": "person_02",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M2"
            }
          ],
          "relations": [
            {
              "evidence_id": "ev_rec_01_2_m1",
              "relation": "supports"
            },
            {
              "evidence_id": "ev_rec_02_2_m2",
              "relation": "supports"
            }
          ],
          "collision_card": null,
          "validations": [
            {
              "id": "val_quote_boundary",
              "question": "不同报价类型的批准规则是否与访谈描述一致？",
              "decision_impact": "决定自动发送与人工确认的边界。",
              "evidence_ids": [
                "ev_rec_01_2_m1",
                "ev_rec_02_2_m2"
              ],
              "required_materials": [
                "获准使用的报价授权规则",
                "跨区与目录价订单样本"
              ],
              "interview_roles": [
                "销售负责人",
                "运营负责人"
              ],
              "experiment": "对照规则与订单，逐笔标出直接发送或人工确认，并记录例外。",
              "success_criteria": "样本和正式规则支持同一条件边界。",
              "failure_criteria": "发现反例或正式规则与访谈表述不一致。",
              "next_decision": "依据验证结果保留、修正或撤回暂定判断。",
              "owner": null,
              "due_at": null,
              "workstream": "internal_research",
              "status": "proposed"
            }
          ],
          "priority": {
            "business_impact": {
              "level": "high",
              "reason": "合成原话涉及报价能否直接对外发送；实际经营影响待验证。"
            },
            "evidence_strength": {
              "level": "low",
              "reason": "仅有合成访谈，无正式授权规则。"
            },
            "validation_feasibility": {
              "level": "medium",
              "reason": "可用授权规则和订单样本核查。"
            }
          }
        },
        "ins_approval_wait": {
          "id": "ins_approval_wait",
          "title": "审批等待缺少运行基线",
          "judgment": {
            "id": "judgment_wait_initial",
            "text": "审批等待可能影响报价总时长，但尚无实测基线。",
            "epistemic_type": "hypothesis",
            "fact_basis": null,
            "review_status": "unreviewed",
            "conditions": [
              "仅是待验证约束"
            ],
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "rationale": "发言者明确说尚未统计，不能据此断定审批是首要瓶颈。",
            "alternative_explanations": [
              "仍需核对正式报价授权制度和实际订单。"
            ],
            "evidence_gaps": [
              "缺少处理、审批等待和返工时间记录。"
            ]
          },
          "dispute_status": "none",
          "coverage": {
            "unique_speakers": 1,
            "spontaneous_speakers": null,
            "prompted_speakers": null,
            "supporting_record_count": 1,
            "total_analyzed_record_count": 2,
            "identity_incomplete": false,
            "unknown_elicitation_count": 1,
            "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
          },
          "meeting_coverage": {
            "distinct_meeting_count": 1,
            "total_meeting_count": 2,
            "meeting_ids": [
              "M2"
            ]
          },
          "importance": {
            "rule_version": "demo-0.1",
            "score": 1,
            "max_score": 5,
            "parts": {
              "distinct_meetings": 1,
              "independent_speakers": 0,
              "documented_business_choice": 0
            },
            "raw_counts": {
              "distinct_meetings": 1,
              "independent_speakers": 1
            },
            "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
          },
          "convergence_status": "insufficient_evidence",
          "attention_flag": "需关注：低频但可能影响投入顺序",
          "last_change": {
            "insight_id": "ins_approval_wait",
            "type": "new",
            "reason": "提出需补运行基线。",
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "previous_judgment_id": null,
            "current_judgment_id": "judgment_wait_initial",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          },
          "snapshot_version": 1,
          "candidate_judgment": null,
          "evidence": [
            {
              "id": "ev_rec_02_3_wait",
              "label": "E03",
              "record_id": "rec_02",
              "segment_id": "rec_02_seg_3",
              "quote": "报价生成也许很快，但审批等待究竟多久，我们还没有统计。",
              "speaker_id": "person_02",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M2"
            }
          ],
          "relations": [
            {
              "evidence_id": "ev_rec_02_3_wait",
              "relation": "supplements"
            }
          ],
          "annotations": [
            {
              "meeting_id": "M2",
              "evidence_id": "ev_rec_02_3_wait",
              "relation": "supplements",
              "condition": null
            }
          ],
          "collision_card": null,
          "validations": [],
          "priority": {
            "business_impact": {
              "level": "unknown",
              "reason": "审批等待没有实测时长。"
            },
            "evidence_strength": {
              "level": "low",
              "reason": "仅一场合成讨论提出，尚未核实。"
            },
            "validation_feasibility": {
              "level": "medium",
              "reason": "可记录同一笔订单各步骤耗时。"
            }
          }
        }
      }
    },
    "2": {
      "overview": {
        "summary": "合成讨论表明报价确认存在条件边界；审批等待仍缺运行基线。",
        "insights": [
          {
            "id": "ins_quote_boundary",
            "title": "报价的确认边界",
            "judgment": {
              "id": "judgment_quote_qualified",
              "text": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。",
              "epistemic_type": "inference",
              "fact_basis": null,
              "review_status": "unreviewed",
              "conditions": [
                "无折扣目录价",
                "跨区或特殊折扣报价"
              ],
              "evidence_ids": [
                "ev_rec_01_2_m1",
                "ev_rec_02_2_m2",
                "ev_rec_03_2_m3a",
                "ev_rec_03_3_m3b"
              ],
              "rationale": "按不同报价条件并列保留观点，不把未讨论的情况推成同意或反对。",
              "alternative_explanations": [
                "仍需核对正式报价授权制度和实际订单。"
              ],
              "evidence_gaps": [
                "正式授权规则和更多订单类型尚未核对。"
              ]
            },
            "dispute_status": "none",
            "coverage": {
              "unique_speakers": 3,
              "spontaneous_speakers": null,
              "prompted_speakers": null,
              "supporting_record_count": 3,
              "total_analyzed_record_count": 3,
              "identity_incomplete": false,
              "unknown_elicitation_count": 4,
              "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
            },
            "meeting_coverage": {
              "distinct_meeting_count": 3,
              "total_meeting_count": 3,
              "meeting_ids": [
                "M1",
                "M2",
                "M3"
              ]
            },
            "importance": {
              "rule_version": "demo-0.1",
              "score": 5,
              "max_score": 5,
              "parts": {
                "distinct_meetings": 3,
                "independent_speakers": 1,
                "documented_business_choice": 1
              },
              "raw_counts": {
                "distinct_meetings": 3,
                "independent_speakers": 3
              },
              "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
            },
            "convergence_status": "conditional_convergence",
            "last_change": {
              "insight_id": "ins_quote_boundary",
              "type": "qualified",
              "reason": "目录价与跨区/折扣报价需要分条件判断。",
              "evidence_ids": [
                "ev_rec_03_2_m3a"
              ],
              "previous_judgment_id": "judgment_quote_initial",
              "current_judgment_id": "judgment_quote_qualified",
              "candidate_judgment_id": null,
              "is_breakthrough": true
            },
            "annotations": [
              {
                "meeting_id": "M1",
                "evidence_id": "ev_rec_01_2_m1",
                "relation": "supports",
                "condition": null
              },
              {
                "meeting_id": "M2",
                "evidence_id": "ev_rec_02_2_m2",
                "relation": "supports",
                "condition": "跨区报价"
              },
              {
                "meeting_id": "M3",
                "evidence_id": "ev_rec_03_2_m3a",
                "relation": "qualifies",
                "condition": "无折扣目录价"
              },
              {
                "meeting_id": "M3",
                "evidence_id": "ev_rec_03_3_m3b",
                "relation": "supports",
                "condition": "跨区或特殊折扣"
              }
            ],
            "spark": {
              "status": "collision",
              "latest_event_id": "spark_quote_condition",
              "conversations": [
                {
                  "id": "M1",
                  "title": "M1 客服访谈（合成）",
                  "date": null,
                  "record_ids": [
                    "rec_01"
                  ]
                },
                {
                  "id": "M3",
                  "title": "M3 运营讨论（合成）",
                  "date": null,
                  "record_ids": [
                    "rec_03"
                  ]
                }
              ],
              "events": [
                {
                  "id": "spark_quote_condition",
                  "version": 2,
                  "kind": "collision",
                  "scope": "cross",
                  "previous_event_id": null,
                  "conversation_ids": [
                    "M1",
                    "M3"
                  ],
                  "before": "已讨论的报价都提到人工确认；适用范围待核实。",
                  "after": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。",
                  "reason": "运营讨论给报价确认补充了目录价与例外条件，修正了无条件人工确认的读法。",
                  "contributions": [
                    {
                      "conversation_id": "M1",
                      "text": "客服提出报价需人工确认。",
                      "evidence_ids": [
                        "ev_rec_01_2_m1"
                      ]
                    },
                    {
                      "conversation_id": "M3",
                      "text": "运营提出无折扣目录价可直接发送。",
                      "evidence_ids": [
                        "ev_rec_03_2_m3a"
                      ]
                    }
                  ]
                }
              ]
            }
          },
          {
            "id": "ins_approval_wait",
            "title": "审批等待缺少运行基线",
            "judgment": {
              "id": "judgment_wait_initial",
              "text": "审批等待可能影响报价总时长，但尚无实测基线。",
              "epistemic_type": "hypothesis",
              "fact_basis": null,
              "review_status": "unreviewed",
              "conditions": [
                "仅是待验证约束"
              ],
              "evidence_ids": [
                "ev_rec_02_3_wait"
              ],
              "rationale": "发言者明确说尚未统计，不能据此断定审批是首要瓶颈。",
              "alternative_explanations": [
                "仍需核对正式报价授权制度和实际订单。"
              ],
              "evidence_gaps": [
                "缺少处理、审批等待和返工时间记录。"
              ]
            },
            "dispute_status": "none",
            "coverage": {
              "unique_speakers": 1,
              "spontaneous_speakers": null,
              "prompted_speakers": null,
              "supporting_record_count": 1,
              "total_analyzed_record_count": 3,
              "identity_incomplete": false,
              "unknown_elicitation_count": 1,
              "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
            },
            "meeting_coverage": {
              "distinct_meeting_count": 1,
              "total_meeting_count": 3,
              "meeting_ids": [
                "M2"
              ]
            },
            "importance": {
              "rule_version": "demo-0.1",
              "score": 1,
              "max_score": 5,
              "parts": {
                "distinct_meetings": 1,
                "independent_speakers": 0,
                "documented_business_choice": 0
              },
              "raw_counts": {
                "distinct_meetings": 1,
                "independent_speakers": 1
              },
              "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
            },
            "convergence_status": "insufficient_evidence",
            "attention_flag": "需关注：低频但可能影响投入顺序",
            "last_change": {
              "insight_id": "ins_approval_wait",
              "type": "unchanged",
              "reason": "本次未增加审批等待信息。",
              "evidence_ids": [
                "ev_rec_02_3_wait"
              ],
              "previous_judgment_id": "judgment_wait_initial",
              "current_judgment_id": "judgment_wait_initial",
              "candidate_judgment_id": null,
              "is_breakthrough": false
            }
          }
        ],
        "dimensions": [
          {
            "key": "key_facts",
            "status": "available",
            "findings": [
              {
                "id": "fact_quote",
                "title": "不同场次提出不同报价条件",
                "body": {
                  "text": "材料记录了报价确认与目录价条件；外部规则仍待核实。",
                  "epistemic_type": "inference",
                  "evidence_ids": [
                    "ev_rec_01_2_m1",
                    "ev_rec_02_2_m2",
                    "ev_rec_03_2_m3a"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_quote_boundary"
                ],
                "sections": []
              }
            ],
            "gaps": []
          },
          {
            "key": "cognitive_breakthroughs",
            "status": "available",
            "findings": [
              {
                "id": "breakthrough_quote",
                "title": "从无条件人工确认到条件边界",
                "body": {
                  "text": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。",
                  "epistemic_type": "inference",
                  "evidence_ids": [
                    "ev_rec_01_2_m1",
                    "ev_rec_02_2_m2",
                    "ev_rec_03_2_m3a",
                    "ev_rec_03_3_m3b"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_quote_boundary"
                ],
                "sections": []
              }
            ],
            "gaps": []
          },
          {
            "key": "hidden_constraints",
            "status": "available",
            "findings": [
              {
                "id": "constraint_wait",
                "title": "审批等待尚无运行基线",
                "body": {
                  "text": "审批等待可能影响报价总时长，但尚无实测基线。",
                  "epistemic_type": "hypothesis",
                  "evidence_ids": [
                    "ev_rec_02_3_wait"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_approval_wait"
                ],
                "sections": []
              }
            ],
            "gaps": []
          },
          {
            "key": "ai_operations",
            "status": "insufficient_evidence",
            "findings": [],
            "gaps": [
              "合成短记录不足以支持该视角的可靠结论。"
            ]
          },
          {
            "key": "reusable_opportunities",
            "status": "insufficient_evidence",
            "findings": [],
            "gaps": [
              "合成短记录不足以支持该视角的可靠结论。"
            ]
          },
          {
            "key": "validation_questions",
            "status": "available",
            "findings": [
              {
                "id": "question_quote",
                "title": "核对授权规则与真实订单",
                "body": {
                  "text": "逐笔核对目录价、跨区与特殊折扣的处理边界。",
                  "epistemic_type": "inference",
                  "evidence_ids": [
                    "ev_rec_01_2_m1",
                    "ev_rec_02_2_m2",
                    "ev_rec_03_2_m3a",
                    "ev_rec_03_3_m3b"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_quote_boundary"
                ],
                "sections": []
              }
            ],
            "gaps": []
          }
        ],
        "evidence": [
          {
            "id": "ev_rec_01_2_m1",
            "label": "E01",
            "record_id": "rec_01",
            "segment_id": "rec_01_seg_2",
            "quote": "标准问题可以自动回复，但报价需要人工确认。",
            "speaker_id": "person_01",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M1"
          },
          {
            "id": "ev_rec_02_2_m2",
            "label": "E02",
            "record_id": "rec_02",
            "segment_id": "rec_02_seg_2",
            "quote": "跨区报价需要销售确认，不能直接发送给客户。",
            "speaker_id": "person_02",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M2"
          },
          {
            "id": "ev_rec_02_3_wait",
            "label": "E03",
            "record_id": "rec_02",
            "segment_id": "rec_02_seg_3",
            "quote": "报价生成也许很快，但审批等待究竟多久，我们还没有统计。",
            "speaker_id": "person_02",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M2"
          },
          {
            "id": "ev_rec_03_2_m3a",
            "label": "E04",
            "record_id": "rec_03",
            "segment_id": "rec_03_seg_2",
            "quote": "无折扣的目录价可以由系统直接发送。",
            "speaker_id": "person_03",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M3"
          },
          {
            "id": "ev_rec_03_3_m3b",
            "label": "E05",
            "record_id": "rec_03",
            "segment_id": "rec_03_seg_3",
            "quote": "跨区报价或有特殊折扣时，仍要由销售确认。",
            "speaker_id": "person_03",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M3"
          }
        ],
        "changes": [
          {
            "insight_id": "ins_quote_boundary",
            "type": "qualified",
            "reason": "目录价与跨区/折扣报价需要分条件判断。",
            "evidence_ids": [
              "ev_rec_03_2_m3a"
            ],
            "previous_judgment_id": "judgment_quote_initial",
            "current_judgment_id": "judgment_quote_qualified",
            "candidate_judgment_id": null,
            "is_breakthrough": true
          },
          {
            "insight_id": "ins_approval_wait",
            "type": "unchanged",
            "reason": "本次未增加审批等待信息。",
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "previous_judgment_id": "judgment_wait_initial",
            "current_judgment_id": "judgment_wait_initial",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          }
        ],
        "outcome": "updated",
        "project": {
          "id": "prj_demo",
          "name": "报价授权边界调研",
          "created_at": "2026-10-17T11:00:00+08:00",
          "current_version": 3,
          "record_count": 4
        },
        "snapshot_version": 2,
        "active_job_id": null,
        "source_record_ids": [
          "rec_01",
          "rec_02",
          "rec_03"
        ],
        "unanalyzed_record_ids": [],
        "pending_confirmation_count": 0,
        "engine_mode": "mock"
      },
      "details": {
        "ins_quote_boundary": {
          "id": "ins_quote_boundary",
          "title": "报价的确认边界",
          "judgment": {
            "id": "judgment_quote_qualified",
            "text": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。",
            "epistemic_type": "inference",
            "fact_basis": null,
            "review_status": "unreviewed",
            "conditions": [
              "无折扣目录价",
              "跨区或特殊折扣报价"
            ],
            "evidence_ids": [
              "ev_rec_01_2_m1",
              "ev_rec_02_2_m2",
              "ev_rec_03_2_m3a",
              "ev_rec_03_3_m3b"
            ],
            "rationale": "按不同报价条件并列保留观点，不把未讨论的情况推成同意或反对。",
            "alternative_explanations": [
              "仍需核对正式报价授权制度和实际订单。"
            ],
            "evidence_gaps": [
              "正式授权规则和更多订单类型尚未核对。"
            ]
          },
          "dispute_status": "none",
          "coverage": {
            "unique_speakers": 3,
            "spontaneous_speakers": null,
            "prompted_speakers": null,
            "supporting_record_count": 3,
            "total_analyzed_record_count": 3,
            "identity_incomplete": false,
            "unknown_elicitation_count": 4,
            "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
          },
          "meeting_coverage": {
            "distinct_meeting_count": 3,
            "total_meeting_count": 3,
            "meeting_ids": [
              "M1",
              "M2",
              "M3"
            ]
          },
          "importance": {
            "rule_version": "demo-0.1",
            "score": 5,
            "max_score": 5,
            "parts": {
              "distinct_meetings": 3,
              "independent_speakers": 1,
              "documented_business_choice": 1
            },
            "raw_counts": {
              "distinct_meetings": 3,
              "independent_speakers": 3
            },
            "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
          },
          "convergence_status": "conditional_convergence",
          "last_change": {
            "insight_id": "ins_quote_boundary",
            "type": "qualified",
            "reason": "目录价与跨区/折扣报价需要分条件判断。",
            "evidence_ids": [
              "ev_rec_03_2_m3a"
            ],
            "previous_judgment_id": "judgment_quote_initial",
            "current_judgment_id": "judgment_quote_qualified",
            "candidate_judgment_id": null,
            "is_breakthrough": true
          },
          "annotations": [
            {
              "meeting_id": "M1",
              "evidence_id": "ev_rec_01_2_m1",
              "relation": "supports",
              "condition": null
            },
            {
              "meeting_id": "M2",
              "evidence_id": "ev_rec_02_2_m2",
              "relation": "supports",
              "condition": "跨区报价"
            },
            {
              "meeting_id": "M3",
              "evidence_id": "ev_rec_03_2_m3a",
              "relation": "qualifies",
              "condition": "无折扣目录价"
            },
            {
              "meeting_id": "M3",
              "evidence_id": "ev_rec_03_3_m3b",
              "relation": "supports",
              "condition": "跨区或特殊折扣"
            }
          ],
          "spark": {
            "status": "collision",
            "latest_event_id": "spark_quote_condition",
            "conversations": [
              {
                "id": "M1",
                "title": "M1 客服访谈（合成）",
                "date": null,
                "record_ids": [
                  "rec_01"
                ]
              },
              {
                "id": "M3",
                "title": "M3 运营讨论（合成）",
                "date": null,
                "record_ids": [
                  "rec_03"
                ]
              }
            ],
            "events": [
              {
                "id": "spark_quote_condition",
                "version": 2,
                "kind": "collision",
                "scope": "cross",
                "previous_event_id": null,
                "conversation_ids": [
                  "M1",
                  "M3"
                ],
                "before": "已讨论的报价都提到人工确认；适用范围待核实。",
                "after": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。",
                "reason": "运营讨论给报价确认补充了目录价与例外条件，修正了无条件人工确认的读法。",
                "contributions": [
                  {
                    "conversation_id": "M1",
                    "text": "客服提出报价需人工确认。",
                    "evidence_ids": [
                      "ev_rec_01_2_m1"
                    ]
                  },
                  {
                    "conversation_id": "M3",
                    "text": "运营提出无折扣目录价可直接发送。",
                    "evidence_ids": [
                      "ev_rec_03_2_m3a"
                    ]
                  }
                ]
              }
            ]
          },
          "snapshot_version": 2,
          "candidate_judgment": null,
          "evidence": [
            {
              "id": "ev_rec_01_2_m1",
              "label": "E01",
              "record_id": "rec_01",
              "segment_id": "rec_01_seg_2",
              "quote": "标准问题可以自动回复，但报价需要人工确认。",
              "speaker_id": "person_01",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M1"
            },
            {
              "id": "ev_rec_02_2_m2",
              "label": "E02",
              "record_id": "rec_02",
              "segment_id": "rec_02_seg_2",
              "quote": "跨区报价需要销售确认，不能直接发送给客户。",
              "speaker_id": "person_02",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M2"
            },
            {
              "id": "ev_rec_03_2_m3a",
              "label": "E04",
              "record_id": "rec_03",
              "segment_id": "rec_03_seg_2",
              "quote": "无折扣的目录价可以由系统直接发送。",
              "speaker_id": "person_03",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M3"
            },
            {
              "id": "ev_rec_03_3_m3b",
              "label": "E05",
              "record_id": "rec_03",
              "segment_id": "rec_03_seg_3",
              "quote": "跨区报价或有特殊折扣时，仍要由销售确认。",
              "speaker_id": "person_03",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M3"
            }
          ],
          "relations": [
            {
              "evidence_id": "ev_rec_01_2_m1",
              "relation": "supports"
            },
            {
              "evidence_id": "ev_rec_02_2_m2",
              "relation": "supports"
            },
            {
              "evidence_id": "ev_rec_03_2_m3a",
              "relation": "qualifies"
            },
            {
              "evidence_id": "ev_rec_03_3_m3b",
              "relation": "supports"
            }
          ],
          "collision_card": null,
          "validations": [
            {
              "id": "val_quote_boundary",
              "question": "不同报价类型的批准规则是否与访谈描述一致？",
              "decision_impact": "决定自动发送与人工确认的边界。",
              "evidence_ids": [
                "ev_rec_01_2_m1",
                "ev_rec_02_2_m2"
              ],
              "required_materials": [
                "获准使用的报价授权规则",
                "跨区与目录价订单样本"
              ],
              "interview_roles": [
                "销售负责人",
                "运营负责人"
              ],
              "experiment": "对照规则与订单，逐笔标出直接发送或人工确认，并记录例外。",
              "success_criteria": "样本和正式规则支持同一条件边界。",
              "failure_criteria": "发现反例或正式规则与访谈表述不一致。",
              "next_decision": "依据验证结果保留、修正或撤回暂定判断。",
              "owner": null,
              "due_at": null,
              "workstream": "internal_research",
              "status": "proposed"
            }
          ],
          "priority": {
            "business_impact": {
              "level": "high",
              "reason": "合成原话涉及报价能否直接对外发送；实际经营影响待验证。"
            },
            "evidence_strength": {
              "level": "low",
              "reason": "仅有合成访谈，无正式授权规则。"
            },
            "validation_feasibility": {
              "level": "medium",
              "reason": "可用授权规则和订单样本核查。"
            }
          }
        },
        "ins_approval_wait": {
          "id": "ins_approval_wait",
          "title": "审批等待缺少运行基线",
          "judgment": {
            "id": "judgment_wait_initial",
            "text": "审批等待可能影响报价总时长，但尚无实测基线。",
            "epistemic_type": "hypothesis",
            "fact_basis": null,
            "review_status": "unreviewed",
            "conditions": [
              "仅是待验证约束"
            ],
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "rationale": "发言者明确说尚未统计，不能据此断定审批是首要瓶颈。",
            "alternative_explanations": [
              "仍需核对正式报价授权制度和实际订单。"
            ],
            "evidence_gaps": [
              "缺少处理、审批等待和返工时间记录。"
            ]
          },
          "dispute_status": "none",
          "coverage": {
            "unique_speakers": 1,
            "spontaneous_speakers": null,
            "prompted_speakers": null,
            "supporting_record_count": 1,
            "total_analyzed_record_count": 3,
            "identity_incomplete": false,
            "unknown_elicitation_count": 1,
            "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
          },
          "meeting_coverage": {
            "distinct_meeting_count": 1,
            "total_meeting_count": 3,
            "meeting_ids": [
              "M2"
            ]
          },
          "importance": {
            "rule_version": "demo-0.1",
            "score": 1,
            "max_score": 5,
            "parts": {
              "distinct_meetings": 1,
              "independent_speakers": 0,
              "documented_business_choice": 0
            },
            "raw_counts": {
              "distinct_meetings": 1,
              "independent_speakers": 1
            },
            "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
          },
          "convergence_status": "insufficient_evidence",
          "attention_flag": "需关注：低频但可能影响投入顺序",
          "last_change": {
            "insight_id": "ins_approval_wait",
            "type": "unchanged",
            "reason": "本次未增加审批等待信息。",
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "previous_judgment_id": "judgment_wait_initial",
            "current_judgment_id": "judgment_wait_initial",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          },
          "snapshot_version": 2,
          "candidate_judgment": null,
          "evidence": [
            {
              "id": "ev_rec_02_3_wait",
              "label": "E03",
              "record_id": "rec_02",
              "segment_id": "rec_02_seg_3",
              "quote": "报价生成也许很快，但审批等待究竟多久，我们还没有统计。",
              "speaker_id": "person_02",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M2"
            }
          ],
          "relations": [
            {
              "evidence_id": "ev_rec_02_3_wait",
              "relation": "supplements"
            }
          ],
          "annotations": [
            {
              "meeting_id": "M2",
              "evidence_id": "ev_rec_02_3_wait",
              "relation": "supplements",
              "condition": null
            }
          ],
          "collision_card": null,
          "validations": [],
          "priority": {
            "business_impact": {
              "level": "unknown",
              "reason": "审批等待没有实测时长。"
            },
            "evidence_strength": {
              "level": "low",
              "reason": "仅一场合成讨论提出，尚未核实。"
            },
            "validation_feasibility": {
              "level": "medium",
              "reason": "可记录同一笔订单各步骤耗时。"
            }
          }
        }
      }
    },
    "3": {
      "overview": {
        "summary": "合成讨论表明报价确认存在条件边界；审批等待仍缺运行基线。",
        "insights": [
          {
            "id": "ins_quote_boundary",
            "title": "报价的确认边界",
            "judgment": {
              "id": "judgment_quote_qualified",
              "text": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。",
              "epistemic_type": "inference",
              "fact_basis": null,
              "review_status": "unreviewed",
              "conditions": [
                "无折扣目录价",
                "跨区或特殊折扣报价"
              ],
              "evidence_ids": [
                "ev_rec_01_2_m1",
                "ev_rec_02_2_m2",
                "ev_rec_03_2_m3a",
                "ev_rec_03_3_m3b",
                "ev_rec_04_2_m4a",
                "ev_rec_04_3_m4b"
              ],
              "rationale": "按不同报价条件并列保留观点，不把未讨论的情况推成同意或反对。",
              "alternative_explanations": [
                "仍需核对正式报价授权制度和实际订单。"
              ],
              "evidence_gaps": [
                "正式授权规则和更多订单类型尚未核对。"
              ]
            },
            "dispute_status": "none",
            "coverage": {
              "unique_speakers": 4,
              "spontaneous_speakers": null,
              "prompted_speakers": null,
              "supporting_record_count": 4,
              "total_analyzed_record_count": 4,
              "identity_incomplete": false,
              "unknown_elicitation_count": 6,
              "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
            },
            "meeting_coverage": {
              "distinct_meeting_count": 4,
              "total_meeting_count": 4,
              "meeting_ids": [
                "M1",
                "M2",
                "M3",
                "M4"
              ]
            },
            "importance": {
              "rule_version": "demo-0.1",
              "score": 5,
              "max_score": 5,
              "parts": {
                "distinct_meetings": 3,
                "independent_speakers": 1,
                "documented_business_choice": 1
              },
              "raw_counts": {
                "distinct_meetings": 4,
                "independent_speakers": 4
              },
              "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
            },
            "convergence_status": "conditional_convergence",
            "last_change": {
              "insight_id": "ins_quote_boundary",
              "type": "unchanged",
              "reason": "新增讨论没有改变已有条件边界。",
              "evidence_ids": [
                "ev_rec_03_2_m3a",
                "ev_rec_04_2_m4a"
              ],
              "previous_judgment_id": "judgment_quote_qualified",
              "current_judgment_id": "judgment_quote_qualified",
              "candidate_judgment_id": null,
              "is_breakthrough": false
            },
            "annotations": [
              {
                "meeting_id": "M1",
                "evidence_id": "ev_rec_01_2_m1",
                "relation": "supports",
                "condition": null
              },
              {
                "meeting_id": "M2",
                "evidence_id": "ev_rec_02_2_m2",
                "relation": "supports",
                "condition": "跨区报价"
              },
              {
                "meeting_id": "M3",
                "evidence_id": "ev_rec_03_2_m3a",
                "relation": "qualifies",
                "condition": "无折扣目录价"
              },
              {
                "meeting_id": "M3",
                "evidence_id": "ev_rec_03_3_m3b",
                "relation": "supports",
                "condition": "跨区或特殊折扣"
              },
              {
                "meeting_id": "M4",
                "evidence_id": "ev_rec_04_2_m4a",
                "relation": "supports",
                "condition": null
              },
              {
                "meeting_id": "M4",
                "evidence_id": "ev_rec_04_3_m4b",
                "relation": "supplements",
                "condition": null
              }
            ],
            "spark": {
              "status": "collision",
              "latest_event_id": "spark_quote_repeat",
              "conversations": [
                {
                  "id": "M1",
                  "title": "M1 客服访谈（合成）",
                  "date": null,
                  "record_ids": [
                    "rec_01"
                  ]
                },
                {
                  "id": "M3",
                  "title": "M3 运营讨论（合成）",
                  "date": null,
                  "record_ids": [
                    "rec_03"
                  ]
                },
                {
                  "id": "M4",
                  "title": "M4 项目复盘（合成）",
                  "date": null,
                  "record_ids": [
                    "rec_04"
                  ]
                }
              ],
              "events": [
                {
                  "id": "spark_quote_condition",
                  "version": 2,
                  "kind": "collision",
                  "scope": "cross",
                  "previous_event_id": null,
                  "conversation_ids": [
                    "M1",
                    "M3"
                  ],
                  "before": "已讨论的报价都提到人工确认；适用范围待核实。",
                  "after": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。",
                  "reason": "运营讨论给报价确认补充了目录价与例外条件，修正了无条件人工确认的读法。",
                  "contributions": [
                    {
                      "conversation_id": "M1",
                      "text": "客服提出报价需人工确认。",
                      "evidence_ids": [
                        "ev_rec_01_2_m1"
                      ]
                    },
                    {
                      "conversation_id": "M3",
                      "text": "运营提出无折扣目录价可直接发送。",
                      "evidence_ids": [
                        "ev_rec_03_2_m3a"
                      ]
                    }
                  ]
                },
                {
                  "id": "spark_quote_repeat",
                  "version": 3,
                  "kind": "corroboration",
                  "scope": null,
                  "previous_event_id": "spark_quote_condition",
                  "conversation_ids": [
                    "M4"
                  ],
                  "before": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。",
                  "after": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。",
                  "reason": "复盘只重复已知方向，未提出新的适用条件；认可继续验证不等于批准上线。",
                  "contributions": [
                    {
                      "conversation_id": "M4",
                      "text": "重复认可已有的条件边界。",
                      "evidence_ids": [
                        "ev_rec_04_2_m4a"
                      ]
                    }
                  ]
                }
              ]
            }
          },
          {
            "id": "ins_approval_wait",
            "title": "审批等待缺少运行基线",
            "judgment": {
              "id": "judgment_wait_initial",
              "text": "审批等待可能影响报价总时长，但尚无实测基线。",
              "epistemic_type": "hypothesis",
              "fact_basis": null,
              "review_status": "unreviewed",
              "conditions": [
                "仅是待验证约束"
              ],
              "evidence_ids": [
                "ev_rec_02_3_wait"
              ],
              "rationale": "发言者明确说尚未统计，不能据此断定审批是首要瓶颈。",
              "alternative_explanations": [
                "仍需核对正式报价授权制度和实际订单。"
              ],
              "evidence_gaps": [
                "缺少处理、审批等待和返工时间记录。"
              ]
            },
            "dispute_status": "none",
            "coverage": {
              "unique_speakers": 1,
              "spontaneous_speakers": null,
              "prompted_speakers": null,
              "supporting_record_count": 1,
              "total_analyzed_record_count": 4,
              "identity_incomplete": false,
              "unknown_elicitation_count": 1,
              "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
            },
            "meeting_coverage": {
              "distinct_meeting_count": 1,
              "total_meeting_count": 4,
              "meeting_ids": [
                "M2"
              ]
            },
            "importance": {
              "rule_version": "demo-0.1",
              "score": 1,
              "max_score": 5,
              "parts": {
                "distinct_meetings": 1,
                "independent_speakers": 0,
                "documented_business_choice": 0
              },
              "raw_counts": {
                "distinct_meetings": 1,
                "independent_speakers": 1
              },
              "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
            },
            "convergence_status": "insufficient_evidence",
            "attention_flag": "需关注：低频但可能影响投入顺序",
            "last_change": {
              "insight_id": "ins_approval_wait",
              "type": "unchanged",
              "reason": "本次未增加审批等待信息。",
              "evidence_ids": [
                "ev_rec_02_3_wait"
              ],
              "previous_judgment_id": "judgment_wait_initial",
              "current_judgment_id": "judgment_wait_initial",
              "candidate_judgment_id": null,
              "is_breakthrough": false
            }
          }
        ],
        "dimensions": [
          {
            "key": "key_facts",
            "status": "available",
            "findings": [
              {
                "id": "fact_quote",
                "title": "不同场次提出不同报价条件",
                "body": {
                  "text": "材料记录了报价确认与目录价条件；外部规则仍待核实。",
                  "epistemic_type": "inference",
                  "evidence_ids": [
                    "ev_rec_01_2_m1",
                    "ev_rec_02_2_m2",
                    "ev_rec_03_2_m3a"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_quote_boundary"
                ],
                "sections": []
              }
            ],
            "gaps": []
          },
          {
            "key": "cognitive_breakthroughs",
            "status": "available",
            "findings": [
              {
                "id": "breakthrough_quote",
                "title": "从无条件人工确认到条件边界",
                "body": {
                  "text": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。",
                  "epistemic_type": "inference",
                  "evidence_ids": [
                    "ev_rec_01_2_m1",
                    "ev_rec_02_2_m2",
                    "ev_rec_03_2_m3a",
                    "ev_rec_03_3_m3b",
                    "ev_rec_04_2_m4a",
                    "ev_rec_04_3_m4b"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_quote_boundary"
                ],
                "sections": []
              }
            ],
            "gaps": []
          },
          {
            "key": "hidden_constraints",
            "status": "available",
            "findings": [
              {
                "id": "constraint_wait",
                "title": "审批等待尚无运行基线",
                "body": {
                  "text": "审批等待可能影响报价总时长，但尚无实测基线。",
                  "epistemic_type": "hypothesis",
                  "evidence_ids": [
                    "ev_rec_02_3_wait"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_approval_wait"
                ],
                "sections": []
              }
            ],
            "gaps": []
          },
          {
            "key": "ai_operations",
            "status": "insufficient_evidence",
            "findings": [],
            "gaps": [
              "合成短记录不足以支持该视角的可靠结论。"
            ]
          },
          {
            "key": "reusable_opportunities",
            "status": "insufficient_evidence",
            "findings": [],
            "gaps": [
              "合成短记录不足以支持该视角的可靠结论。"
            ]
          },
          {
            "key": "validation_questions",
            "status": "available",
            "findings": [
              {
                "id": "question_quote",
                "title": "核对授权规则与真实订单",
                "body": {
                  "text": "逐笔核对目录价、跨区与特殊折扣的处理边界。",
                  "epistemic_type": "inference",
                  "evidence_ids": [
                    "ev_rec_01_2_m1",
                    "ev_rec_02_2_m2",
                    "ev_rec_03_2_m3a",
                    "ev_rec_03_3_m3b",
                    "ev_rec_04_2_m4a",
                    "ev_rec_04_3_m4b"
                  ],
                  "conditions": [],
                  "alternative_explanations": [
                    "还可能受现有授权规则影响。"
                  ],
                  "gaps": []
                },
                "insight_ids": [
                  "ins_quote_boundary"
                ],
                "sections": []
              }
            ],
            "gaps": []
          }
        ],
        "evidence": [
          {
            "id": "ev_rec_01_2_m1",
            "label": "E01",
            "record_id": "rec_01",
            "segment_id": "rec_01_seg_2",
            "quote": "标准问题可以自动回复，但报价需要人工确认。",
            "speaker_id": "person_01",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M1"
          },
          {
            "id": "ev_rec_02_2_m2",
            "label": "E02",
            "record_id": "rec_02",
            "segment_id": "rec_02_seg_2",
            "quote": "跨区报价需要销售确认，不能直接发送给客户。",
            "speaker_id": "person_02",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M2"
          },
          {
            "id": "ev_rec_02_3_wait",
            "label": "E03",
            "record_id": "rec_02",
            "segment_id": "rec_02_seg_3",
            "quote": "报价生成也许很快，但审批等待究竟多久，我们还没有统计。",
            "speaker_id": "person_02",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M2"
          },
          {
            "id": "ev_rec_03_2_m3a",
            "label": "E04",
            "record_id": "rec_03",
            "segment_id": "rec_03_seg_2",
            "quote": "无折扣的目录价可以由系统直接发送。",
            "speaker_id": "person_03",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M3"
          },
          {
            "id": "ev_rec_03_3_m3b",
            "label": "E05",
            "record_id": "rec_03",
            "segment_id": "rec_03_seg_3",
            "quote": "跨区报价或有特殊折扣时，仍要由销售确认。",
            "speaker_id": "person_03",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M3"
          },
          {
            "id": "ev_rec_04_2_m4a",
            "label": "E06",
            "record_id": "rec_04",
            "segment_id": "rec_04_seg_2",
            "quote": "我认可继续验证目录价自动发送、跨区报价人工确认这个方向。",
            "speaker_id": "person_04",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M4"
          },
          {
            "id": "ev_rec_04_3_m4b",
            "label": "E07",
            "record_id": "rec_04",
            "segment_id": "rec_04_seg_3",
            "quote": "这不代表已经批准上线或对外承诺。",
            "speaker_id": "person_04",
            "elicitation": "unknown",
            "claim_origin": "participant_statement",
            "meeting_id": "M4"
          }
        ],
        "changes": [
          {
            "insight_id": "ins_quote_boundary",
            "type": "unchanged",
            "reason": "新增讨论没有改变已有条件边界。",
            "evidence_ids": [
              "ev_rec_03_2_m3a",
              "ev_rec_04_2_m4a"
            ],
            "previous_judgment_id": "judgment_quote_qualified",
            "current_judgment_id": "judgment_quote_qualified",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          },
          {
            "insight_id": "ins_approval_wait",
            "type": "unchanged",
            "reason": "本次未增加审批等待信息。",
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "previous_judgment_id": "judgment_wait_initial",
            "current_judgment_id": "judgment_wait_initial",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          }
        ],
        "outcome": "no_new_insight",
        "project": {
          "id": "prj_demo",
          "name": "报价授权边界调研",
          "created_at": "2026-10-17T11:00:00+08:00",
          "current_version": 3,
          "record_count": 4
        },
        "snapshot_version": 3,
        "active_job_id": null,
        "source_record_ids": [
          "rec_01",
          "rec_02",
          "rec_03",
          "rec_04"
        ],
        "unanalyzed_record_ids": [],
        "pending_confirmation_count": 0,
        "engine_mode": "mock"
      },
      "details": {
        "ins_quote_boundary": {
          "id": "ins_quote_boundary",
          "title": "报价的确认边界",
          "judgment": {
            "id": "judgment_quote_qualified",
            "text": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。",
            "epistemic_type": "inference",
            "fact_basis": null,
            "review_status": "unreviewed",
            "conditions": [
              "无折扣目录价",
              "跨区或特殊折扣报价"
            ],
            "evidence_ids": [
              "ev_rec_01_2_m1",
              "ev_rec_02_2_m2",
              "ev_rec_03_2_m3a",
              "ev_rec_03_3_m3b",
              "ev_rec_04_2_m4a",
              "ev_rec_04_3_m4b"
            ],
            "rationale": "按不同报价条件并列保留观点，不把未讨论的情况推成同意或反对。",
            "alternative_explanations": [
              "仍需核对正式报价授权制度和实际订单。"
            ],
            "evidence_gaps": [
              "正式授权规则和更多订单类型尚未核对。"
            ]
          },
          "dispute_status": "none",
          "coverage": {
            "unique_speakers": 4,
            "spontaneous_speakers": null,
            "prompted_speakers": null,
            "supporting_record_count": 4,
            "total_analyzed_record_count": 4,
            "identity_incomplete": false,
            "unknown_elicitation_count": 6,
            "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
          },
          "meeting_coverage": {
            "distinct_meeting_count": 4,
            "total_meeting_count": 4,
            "meeting_ids": [
              "M1",
              "M2",
              "M3",
              "M4"
            ]
          },
          "importance": {
            "rule_version": "demo-0.1",
            "score": 5,
            "max_score": 5,
            "parts": {
              "distinct_meetings": 3,
              "independent_speakers": 1,
              "documented_business_choice": 1
            },
            "raw_counts": {
              "distinct_meetings": 4,
              "independent_speakers": 4
            },
            "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
          },
          "convergence_status": "conditional_convergence",
          "last_change": {
            "insight_id": "ins_quote_boundary",
            "type": "unchanged",
            "reason": "新增讨论没有改变已有条件边界。",
            "evidence_ids": [
              "ev_rec_03_2_m3a",
              "ev_rec_04_2_m4a"
            ],
            "previous_judgment_id": "judgment_quote_qualified",
            "current_judgment_id": "judgment_quote_qualified",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          },
          "annotations": [
            {
              "meeting_id": "M1",
              "evidence_id": "ev_rec_01_2_m1",
              "relation": "supports",
              "condition": null
            },
            {
              "meeting_id": "M2",
              "evidence_id": "ev_rec_02_2_m2",
              "relation": "supports",
              "condition": "跨区报价"
            },
            {
              "meeting_id": "M3",
              "evidence_id": "ev_rec_03_2_m3a",
              "relation": "qualifies",
              "condition": "无折扣目录价"
            },
            {
              "meeting_id": "M3",
              "evidence_id": "ev_rec_03_3_m3b",
              "relation": "supports",
              "condition": "跨区或特殊折扣"
            },
            {
              "meeting_id": "M4",
              "evidence_id": "ev_rec_04_2_m4a",
              "relation": "supports",
              "condition": null
            },
            {
              "meeting_id": "M4",
              "evidence_id": "ev_rec_04_3_m4b",
              "relation": "supplements",
              "condition": null
            }
          ],
          "spark": {
            "status": "collision",
            "latest_event_id": "spark_quote_repeat",
            "conversations": [
              {
                "id": "M1",
                "title": "M1 客服访谈（合成）",
                "date": null,
                "record_ids": [
                  "rec_01"
                ]
              },
              {
                "id": "M3",
                "title": "M3 运营讨论（合成）",
                "date": null,
                "record_ids": [
                  "rec_03"
                ]
              },
              {
                "id": "M4",
                "title": "M4 项目复盘（合成）",
                "date": null,
                "record_ids": [
                  "rec_04"
                ]
              }
            ],
            "events": [
              {
                "id": "spark_quote_condition",
                "version": 2,
                "kind": "collision",
                "scope": "cross",
                "previous_event_id": null,
                "conversation_ids": [
                  "M1",
                  "M3"
                ],
                "before": "已讨论的报价都提到人工确认；适用范围待核实。",
                "after": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。",
                "reason": "运营讨论给报价确认补充了目录价与例外条件，修正了无条件人工确认的读法。",
                "contributions": [
                  {
                    "conversation_id": "M1",
                    "text": "客服提出报价需人工确认。",
                    "evidence_ids": [
                      "ev_rec_01_2_m1"
                    ]
                  },
                  {
                    "conversation_id": "M3",
                    "text": "运营提出无折扣目录价可直接发送。",
                    "evidence_ids": [
                      "ev_rec_03_2_m3a"
                    ]
                  }
                ]
              },
              {
                "id": "spark_quote_repeat",
                "version": 3,
                "kind": "corroboration",
                "scope": null,
                "previous_event_id": "spark_quote_condition",
                "conversation_ids": [
                  "M4"
                ],
                "before": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。",
                "after": "无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。",
                "reason": "复盘只重复已知方向，未提出新的适用条件；认可继续验证不等于批准上线。",
                "contributions": [
                  {
                    "conversation_id": "M4",
                    "text": "重复认可已有的条件边界。",
                    "evidence_ids": [
                      "ev_rec_04_2_m4a"
                    ]
                  }
                ]
              }
            ]
          },
          "snapshot_version": 3,
          "candidate_judgment": null,
          "evidence": [
            {
              "id": "ev_rec_01_2_m1",
              "label": "E01",
              "record_id": "rec_01",
              "segment_id": "rec_01_seg_2",
              "quote": "标准问题可以自动回复，但报价需要人工确认。",
              "speaker_id": "person_01",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M1"
            },
            {
              "id": "ev_rec_02_2_m2",
              "label": "E02",
              "record_id": "rec_02",
              "segment_id": "rec_02_seg_2",
              "quote": "跨区报价需要销售确认，不能直接发送给客户。",
              "speaker_id": "person_02",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M2"
            },
            {
              "id": "ev_rec_03_2_m3a",
              "label": "E04",
              "record_id": "rec_03",
              "segment_id": "rec_03_seg_2",
              "quote": "无折扣的目录价可以由系统直接发送。",
              "speaker_id": "person_03",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M3"
            },
            {
              "id": "ev_rec_03_3_m3b",
              "label": "E05",
              "record_id": "rec_03",
              "segment_id": "rec_03_seg_3",
              "quote": "跨区报价或有特殊折扣时，仍要由销售确认。",
              "speaker_id": "person_03",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M3"
            },
            {
              "id": "ev_rec_04_2_m4a",
              "label": "E06",
              "record_id": "rec_04",
              "segment_id": "rec_04_seg_2",
              "quote": "我认可继续验证目录价自动发送、跨区报价人工确认这个方向。",
              "speaker_id": "person_04",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M4"
            },
            {
              "id": "ev_rec_04_3_m4b",
              "label": "E07",
              "record_id": "rec_04",
              "segment_id": "rec_04_seg_3",
              "quote": "这不代表已经批准上线或对外承诺。",
              "speaker_id": "person_04",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M4"
            }
          ],
          "relations": [
            {
              "evidence_id": "ev_rec_01_2_m1",
              "relation": "supports"
            },
            {
              "evidence_id": "ev_rec_02_2_m2",
              "relation": "supports"
            },
            {
              "evidence_id": "ev_rec_03_2_m3a",
              "relation": "qualifies"
            },
            {
              "evidence_id": "ev_rec_03_3_m3b",
              "relation": "supports"
            },
            {
              "evidence_id": "ev_rec_04_2_m4a",
              "relation": "supports"
            },
            {
              "evidence_id": "ev_rec_04_3_m4b",
              "relation": "supplements"
            }
          ],
          "collision_card": null,
          "validations": [
            {
              "id": "val_quote_boundary",
              "question": "不同报价类型的批准规则是否与访谈描述一致？",
              "decision_impact": "决定自动发送与人工确认的边界。",
              "evidence_ids": [
                "ev_rec_01_2_m1",
                "ev_rec_02_2_m2"
              ],
              "required_materials": [
                "获准使用的报价授权规则",
                "跨区与目录价订单样本"
              ],
              "interview_roles": [
                "销售负责人",
                "运营负责人"
              ],
              "experiment": "对照规则与订单，逐笔标出直接发送或人工确认，并记录例外。",
              "success_criteria": "样本和正式规则支持同一条件边界。",
              "failure_criteria": "发现反例或正式规则与访谈表述不一致。",
              "next_decision": "依据验证结果保留、修正或撤回暂定判断。",
              "owner": null,
              "due_at": null,
              "workstream": "internal_research",
              "status": "proposed"
            }
          ],
          "priority": {
            "business_impact": {
              "level": "high",
              "reason": "合成原话涉及报价能否直接对外发送；实际经营影响待验证。"
            },
            "evidence_strength": {
              "level": "low",
              "reason": "仅有合成访谈，无正式授权规则。"
            },
            "validation_feasibility": {
              "level": "medium",
              "reason": "可用授权规则和订单样本核查。"
            }
          }
        },
        "ins_approval_wait": {
          "id": "ins_approval_wait",
          "title": "审批等待缺少运行基线",
          "judgment": {
            "id": "judgment_wait_initial",
            "text": "审批等待可能影响报价总时长，但尚无实测基线。",
            "epistemic_type": "hypothesis",
            "fact_basis": null,
            "review_status": "unreviewed",
            "conditions": [
              "仅是待验证约束"
            ],
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "rationale": "发言者明确说尚未统计，不能据此断定审批是首要瓶颈。",
            "alternative_explanations": [
              "仍需核对正式报价授权制度和实际订单。"
            ],
            "evidence_gaps": [
              "缺少处理、审批等待和返工时间记录。"
            ]
          },
          "dispute_status": "none",
          "coverage": {
            "unique_speakers": 1,
            "spontaneous_speakers": null,
            "prompted_speakers": null,
            "supporting_record_count": 1,
            "total_analyzed_record_count": 4,
            "identity_incomplete": false,
            "unknown_elicitation_count": 1,
            "note": "场次按明确归属去重；材料未说明主动提起或被问回应，提问方式保持未知。未提及不等于不关心。"
          },
          "meeting_coverage": {
            "distinct_meeting_count": 1,
            "total_meeting_count": 4,
            "meeting_ids": [
              "M2"
            ]
          },
          "importance": {
            "rule_version": "demo-0.1",
            "score": 1,
            "max_score": 5,
            "parts": {
              "distinct_meetings": 1,
              "independent_speakers": 0,
              "documented_business_choice": 0
            },
            "raw_counts": {
              "distinct_meetings": 1,
              "independent_speakers": 1
            },
            "note": "合成案例的解释性优先阅读分数，未用真实业务数据校准，不是概率或多数票。"
          },
          "convergence_status": "insufficient_evidence",
          "attention_flag": "需关注：低频但可能影响投入顺序",
          "last_change": {
            "insight_id": "ins_approval_wait",
            "type": "unchanged",
            "reason": "本次未增加审批等待信息。",
            "evidence_ids": [
              "ev_rec_02_3_wait"
            ],
            "previous_judgment_id": "judgment_wait_initial",
            "current_judgment_id": "judgment_wait_initial",
            "candidate_judgment_id": null,
            "is_breakthrough": false
          },
          "snapshot_version": 3,
          "candidate_judgment": null,
          "evidence": [
            {
              "id": "ev_rec_02_3_wait",
              "label": "E03",
              "record_id": "rec_02",
              "segment_id": "rec_02_seg_3",
              "quote": "报价生成也许很快，但审批等待究竟多久，我们还没有统计。",
              "speaker_id": "person_02",
              "elicitation": "unknown",
              "claim_origin": "participant_statement",
              "meeting_id": "M2"
            }
          ],
          "relations": [
            {
              "evidence_id": "ev_rec_02_3_wait",
              "relation": "supplements"
            }
          ],
          "annotations": [
            {
              "meeting_id": "M2",
              "evidence_id": "ev_rec_02_3_wait",
              "relation": "supplements",
              "condition": null
            }
          ],
          "collision_card": null,
          "validations": [],
          "priority": {
            "business_impact": {
              "level": "unknown",
              "reason": "审批等待没有实测时长。"
            },
            "evidence_strength": {
              "level": "low",
              "reason": "仅一场合成讨论提出，尚未核实。"
            },
            "validation_feasibility": {
              "level": "medium",
              "reason": "可记录同一笔订单各步骤耗时。"
            }
          }
        }
      }
    }
  },
  "versions": [
    {
      "version": 3,
      "parent_version": 2,
      "created_at": "2026-10-17T11:30:00+08:00",
      "cause": "analysis",
      "job_id": "synthetic_job_3",
      "correction_id": null,
      "source_record_ids": [
        "rec_01",
        "rec_02",
        "rec_03",
        "rec_04"
      ],
      "outcome": "no_new_insight",
      "summary": "合成讨论表明报价确认存在条件边界；审批等待仍缺运行基线。",
      "changes": [
        {
          "insight_id": "ins_quote_boundary",
          "type": "unchanged",
          "reason": "新增讨论没有改变已有条件边界。",
          "evidence_ids": [
            "ev_rec_03_2_m3a",
            "ev_rec_04_2_m4a"
          ],
          "previous_judgment_id": "judgment_quote_qualified",
          "current_judgment_id": "judgment_quote_qualified",
          "candidate_judgment_id": null,
          "is_breakthrough": false
        },
        {
          "insight_id": "ins_approval_wait",
          "type": "unchanged",
          "reason": "本次未增加审批等待信息。",
          "evidence_ids": [
            "ev_rec_02_3_wait"
          ],
          "previous_judgment_id": "judgment_wait_initial",
          "current_judgment_id": "judgment_wait_initial",
          "candidate_judgment_id": null,
          "is_breakthrough": false
        }
      ],
      "actor_label": null,
      "correction_reason": null
    },
    {
      "version": 2,
      "parent_version": 1,
      "created_at": "2026-10-17T11:20:00+08:00",
      "cause": "analysis",
      "job_id": "synthetic_job_2",
      "correction_id": null,
      "source_record_ids": [
        "rec_01",
        "rec_02",
        "rec_03"
      ],
      "outcome": "updated",
      "summary": "合成讨论表明报价确认存在条件边界；审批等待仍缺运行基线。",
      "changes": [
        {
          "insight_id": "ins_quote_boundary",
          "type": "qualified",
          "reason": "目录价与跨区/折扣报价需要分条件判断。",
          "evidence_ids": [
            "ev_rec_03_2_m3a"
          ],
          "previous_judgment_id": "judgment_quote_initial",
          "current_judgment_id": "judgment_quote_qualified",
          "candidate_judgment_id": null,
          "is_breakthrough": true
        },
        {
          "insight_id": "ins_approval_wait",
          "type": "unchanged",
          "reason": "本次未增加审批等待信息。",
          "evidence_ids": [
            "ev_rec_02_3_wait"
          ],
          "previous_judgment_id": "judgment_wait_initial",
          "current_judgment_id": "judgment_wait_initial",
          "candidate_judgment_id": null,
          "is_breakthrough": false
        }
      ],
      "actor_label": null,
      "correction_reason": null
    },
    {
      "version": 1,
      "parent_version": 0,
      "created_at": "2026-10-17T11:10:00+08:00",
      "cause": "analysis",
      "job_id": "synthetic_job_1",
      "correction_id": null,
      "source_record_ids": [
        "rec_01",
        "rec_02"
      ],
      "outcome": "updated",
      "summary": "合成讨论提出报价需人工确认，具体适用范围仍待核实。",
      "changes": [
        {
          "insight_id": "ins_quote_boundary",
          "type": "new",
          "reason": "形成报价确认的暂定边界。",
          "evidence_ids": [
            "ev_rec_01_2_m1",
            "ev_rec_02_2_m2"
          ],
          "previous_judgment_id": null,
          "current_judgment_id": "judgment_quote_initial",
          "candidate_judgment_id": null,
          "is_breakthrough": false
        },
        {
          "insight_id": "ins_approval_wait",
          "type": "new",
          "reason": "提出需补运行基线。",
          "evidence_ids": [
            "ev_rec_02_3_wait"
          ],
          "previous_judgment_id": null,
          "current_judgment_id": "judgment_wait_initial",
          "candidate_judgment_id": null,
          "is_breakthrough": false
        }
      ],
      "actor_label": null,
      "correction_reason": null
    }
  ]
};
