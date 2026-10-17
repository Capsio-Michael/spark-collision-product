# Sparky 的本机 Kimi 接口

当前默认仍是本机 mock。只有在**服务端进程环境**同时设置以下四项，Sparky 对话和独立引文分析才会启用；前端不接收或保存 API Key。

| 环境变量 | 填写内容 |
| --- | --- |
| `SPARK_CHAT_PROVIDER` | `kimi` |
| `SPARK_KIMI_BASE_URL` | 按账户区域选择 `https://api.moonshot.cn/v1` 或 `https://api.moonshot.ai/v1`，必须与实际 Key 区域相符 |
| `SPARK_KIMI_MODEL` | 账户中已开通的模型标识，由用户确认 |
| `SPARK_KIMI_API_KEY` | 用户仅在本机服务进程环境中输入的密钥，不放进仓库、网页或截图 |

`.env.example` 只有空占位，仓库的 `.gitignore` 忽略 `.env` 和 `.env.*`（例外仅 `.env.example`）。服务**不会自动读取** `.env`；请在启动服务的终端或本机受控环境中设置变量。不要把 Key 贴给协作者或写进前端代码。配置区域和接口格式可对照 [Kimi 中国区 API 概述](https://platform.kimi.com/docs/api/overview) 与 [国际区 API 概述](https://platform.kimi.ai/docs/api/overview)。

本机启动：

```sh
python3 -m engine.server --port 8000 --db var/spark.db
```

另一个终端运行 `cd frontend && npm run dev`，打开 `http://127.0.0.1:5173/`。`GET /api/v1/health` 的 `chat_provider: "kimi"` 只说明服务进程**已读取配置**，不能证明 Key、额度或网络已验证；实际接通仍需用合成材料进行一次最小调用。区域、模型或 Key 不完整时服务拒绝以 Kimi 模式启动，不会退回 mock 冒充真实结果。

对话使用 `POST /api/v1/chat/stream`，服务端只把最近的用户／助手消息交给 Kimi，不传工具或本机文件权限。对话回复不能冒充材料分析结果。分析用 `POST /api/v1/projects/{id}/agent-analysis`，接收已导入项目的 `record_id` 与 `allow_external_processing` 布尔值；获准材料必须由用户确认有权发送给 Kimi，服务端也会拒绝未确认请求。后端按原文件段落逐字核对每条引文，自己计算本轮新关注点、补充和修正数量。JSON 或引文不合格时返回错误且不保存。通过核对的结果存入 SQLite 的 `agent_analyses`，并在对话卡片中标为 **Kimi 引文分析**；它尚未并入旧版项目快照、六维总览、纠错和导出。旧 `POST /analyses` 及项目总览仍明确是 mock。

本轮只用离线 stub 和合成案例测试了协议与界面，**没有使用真实 Key，也没有发起真实 Kimi 调用**。真正的模型表现、费用、跨场归纳质量和提示词需在用户完成本机配置后再单独验证。
