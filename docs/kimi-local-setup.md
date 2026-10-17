# Sparky 的本机 Kimi 接口

当前默认仍是本机 mock。只有在**服务端进程环境**同时设置以下四项，Sparky 对话和独立引文分析才会启用；前端不接收或保存 API Key。

| 环境变量 | 填写内容 |
| --- | --- |
| `SPARK_CHAT_PROVIDER` | `kimi` |
| `SPARK_KIMI_BASE_URL` | 按账户区域选择 `https://api.moonshot.cn/v1` 或 `https://api.moonshot.ai/v1`，必须与实际 Key 区域相符 |
| `SPARK_KIMI_MODEL` | 本次联调选用 `kimi-k2.6`，以账户实际开通情况为准 |
| `SPARK_KIMI_API_KEY` | 用户仅在本机服务进程环境中输入的密钥，不放进仓库、网页或截图 |

`.env.example` 只有空占位，仓库的 `.gitignore` 忽略 `.env` 和 `.env.*`（例外仅 `.env.example`）。服务**不会自动读取** `.env`；请在启动服务的终端或本机受控环境中设置变量。不要把 Key 贴给协作者或写进前端代码。配置区域和接口格式可对照 [Kimi 中国区 API 概述](https://platform.kimi.com/docs/api/overview) 与 [国际区 API 概述](https://platform.kimi.ai/docs/api/overview)。

本机启动：

Windows 用户在仓库根目录打开 PowerShell，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-kimi-local.ps1
```

出现 `Kimi API Key (hidden)` 后粘贴 Key、回车即可。输入不会回显，也不进入命令历史；脚本只给本机后端进程设置变量，不写密钥文件。保持窗口开启，`Ctrl+C` 停止。中国区地址为 `https://api.moonshot.cn/v1`，默认模型 `kimi-k2.6`；按[官方模型说明](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart)设置即时模式和最多 4096 个输出 token。脚本使用独立数据库 `var/kimi-live.db`，不覆盖此前演示库。需要换端口可追加 `-Port 8001`，同时修改页面连接地址。

脚本优先选择本机 Codex 附带的 Python，再查找系统 Python，跳过 WindowsApps 安装别名，并在询问 Key 前验证 Python 3.10+、SQLite 和端口。可追加 `-CheckOnly` 单独检查运行环境，不询问 Key，也不启动服务。旧版出现退出码 `9009` 时更新脚本后重试；启动失败会清除本次进程中的临时 Key，下次需要重新在隐藏提示中输入。

持续联调可加 `-Reload`：`powershell -ExecutionPolicy Bypass -File .\scripts\start-kimi-local.ps1 -Reload`。父进程保留本次内存配置，检测 `engine/*.py` 变动后重启本机子服务，继续使用同一数据库，不再次询问 Key；退出窗口后仍不保存 Key。修改时应等待当前生成请求结束。此模式已用独立测试库验证真实 HTTP 启动、修改代码后重启及项目持久化，仅用于本机开发。

前端可在另一终端运行：

```powershell
cd frontend
$env:PORT = '5205'
npm run dev
```

打开 `http://127.0.0.1:5205/#overview`，在「连接设置」中填写 `http://127.0.0.1:8000/api/v1`，连接并建立项目，再粘贴一小段合成会议记录、选择「合成演示材料」、点击生成。5205 是本次联调独立页面地址，避免沿用 5201 已绑定的演示项目。只连接本机服务不产生模型调用；点击生成会向 Kimi 发送材料，产生 API 用量。获授权材料及其历史上下文还需勾选有权发送给 Kimi。卡片点开后可以逐段返回原文。

本次沿用浅色聊天首页。服务支持 `/chat/stream`，但首页生成按钮目前接的是 `/agent-analysis`；并未把自由对话文字当成有引文的分析。断网或超时后用「继续处理已保存材料」恢复，先查询已保存结果，未完成的请求复用幂等标识。API Key 不出现在浏览器。

其他系统手动配置上述进程变量后启动：

```sh
python3 -m engine.server --port 8000 --db var/spark.db
```

另一个终端运行 `cd frontend && npm run dev`，打开 `http://127.0.0.1:5173/`。`GET /api/v1/health` 的 `chat_provider: "kimi"` 只说明服务进程**已读取配置**，不能证明 Key、额度或网络已验证；实际接通仍需用合成材料进行一次最小调用。区域、模型或 Key 不完整时服务拒绝以 Kimi 模式启动，不会退回 mock 冒充真实结果。

对话使用 `POST /api/v1/chat/stream`，服务端只把最近的用户／助手消息交给 Kimi，不传工具或本机文件权限。对话回复不能冒充材料分析结果。分析用 `POST /api/v1/projects/{id}/agent-analysis`，接收已导入项目的 `record_id` 与 `allow_external_processing` 布尔值；获准材料必须由用户确认有权发送给 Kimi，服务端也会拒绝未确认请求。后端按原文件段落逐字核对每条引文，自己计算本轮新关注点、补充和修正数量。JSON 或引文不合格时返回错误且不保存。通过核对的结果存入 SQLite 的 `agent_analyses`，并在对话卡片中标为 **Kimi 引文分析**；它尚未并入旧版项目快照、六维总览、纠错和导出。旧 `POST /analyses` 及项目总览仍明确是 mock。

2026-10-17 首次真实调用返回 HTTP 404，未保存分析结果。核对[官方模型列表](https://platform.kimi.com/docs/models)后确认此前选择的 `kimi-k2.5` 已于 2026-08-31 下线，已改用 `kimi-k2.6`，待重启后再验证真实生成。启动会先用同一个后端进程中的 Key 请求官方 `/models`，确认配置模型在当前列表中；这一步不进行文本生成。检查失败则拒绝启动，不回退为模拟成功。模型输出质量、费用与跨场归纳仍需真实验收。

K2.6 首次真实返回未通过 JSON 解析，分析请求现显式设置 `response_format: {"type":"json_object"}`，而自由对话流保持文本格式。参考[官方 JSON Mode](https://platform.kimi.com/docs/guide/use-json-mode-feature-of-kimi-api)。API 负责输出合法 JSON，应用继续独立检查字段、类型、新旧关注点和逐字引文；不会从解释文字中猜取一个对象，或跳过证据核验。

启用 JSON Mode 后，首份合成记录已真实返回并保存 `no_new_insight`；第二份记录的返回因“新旧关注点关系不一致”被拒绝保存。已在提示词中明确 `known_focus_titles` 为全部已存标题：新标题只可标 new，已有标题才能标支持、细化、修正或质疑；摘要提到过不等于已有关注点。此调整待新服务加载后验证正向卡片与原话路径。
