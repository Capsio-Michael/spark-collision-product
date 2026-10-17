# Sparky 小青蛙组件样例

打开方式：在本目录运行 `python3 -m http.server 4174`，访问 `http://127.0.0.1:4174/`。页面是**独立动效预览**，没有分析、请求、上传或处理计时功能。图形是原创 SVG/CSS，没有复刻未提供的个人头像。Sparky 是本轮暂定角色名，产品仍叫“智慧火花碰撞”，未核查商标或名称独占性。

用户认可的 [Sparky 静态 3D 风格 PNG](../../references/Sparky_3D_reference_v1.png) 和 [模型／动作说明 TXT](../../references/Sparky_3D_generation_brief_v1.txt) 已放在共享分支的 `references/`。应以 PNG 对齐后续视觉方向；当前 SVG 仅是可复用的交互样例，**不是该 PNG 的 3D 模型、绑定或实际动画**。

一鸣可复制 [`frog.js`](frog.js) 和 [`frog.css`](frog.css) 到工作台，`import { mountFrog } from './frog.js'` 后调用 `mountFrog(hostElement, { style: 'round', palette: 'lime', state: 'reading', compact: false })`。返回对象有 `setState(state)`、`setAppearance({style,palette})`、`setCompact(boolean)`。样式 `round/pixel`；配色 `lime/mint/sky/lilac`，颜色集中在 `PALETTES` 的 `body/shade/ink/blush`，映射为 CSS `--frog-*`。点形象才出现选项；`onPreferenceChange` 可在应用侧保存外观偏好，但不应触发分析重跑。

| 组件状态 | 正式接入的建议来源 | 预览说明 |
| --- | --- | --- |
| `reading` 阅读 | 已收到材料、尚未开始分析 | 预览默认；没有真实文件读取声明 |
| `thinking` 思考 | 服务端 job 确认处于 queued/running | 手动按钮只是动效样例 |
| `spark` 发现火花 | 成功快照确有新洞察或条件变化 | `no_new_insight` 不触发 |
| `complete` 完成 | 服务端 job 成功并且结果已读取 | job 失败不触发 |

仅打开 Dashboard 时使用小尺寸 `compact: true`；进入证据原文页时保持小尺寸或静止，遵守减少动态效果的系统设置。预置演示内容不能假装经历 `thinking → spark → complete` 的真实流程。组件当前只在此分支有素材，**尚未集成到一鸣的工作台**。
