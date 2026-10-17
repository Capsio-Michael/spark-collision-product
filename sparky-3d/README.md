# Sparky 真实 3D 组件

这个目录是独立的前端交付物。`assets/sparky.glb` 是有体积、可旋转的 glTF 2.0 模型，不是平面图贴在三维场景中。模型形体参考已经批准的 Sparky 图片，以简化的原创网格重建。图片在 `assets/sparky-fallback.png`，只在 WebGL 或模型加载失败时显示。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

打开 `http://127.0.0.1:4175/sparky-3d/`。拖动模型旋转，用状态、颜色和视角按钮检查动作及全身几何。下载依赖、安装 Blender、注册账号都不需要。浏览器需要 WebGL 2；无 WebGL 时显示静态参考图。请通过 HTTP 打开，不能直接双击 `index.html` 使用 `file://`。

## 接入页面

将整个 `sparky-3d/` 目录放入前端可访问的静态路径，保持文件相对位置。页面 `<head>` 中添加：

```html
<link rel="stylesheet" href="/sparky-3d/style.css">
<script type="importmap">
{"imports":{"three":"/sparky-3d/vendor/three.module.min.js","three/addons/":"/sparky-3d/vendor/"}}
</script>
```

页面模块中：

```js
import { mountSparky } from '/sparky-3d/sparky-viewer.js';
const sparky = await mountSparky(document.getElementById('sparky'), {
  state: 'idle', color: 'leaf'
});
sparky.setState('thinking');
sparky.setColor('mint');
sparky.setView('side');
// 页面卸载时：sparky.dispose();
```

宿主元素需要明确宽高，例如 `width: 100%; height: 420px`。`mountSparky` 异步返回 `{kind, model, setState, setColor, setView, dispose}`。`kind` 为 `real-3d` 或 `static-fallback`。`color` 可传 `leaf`、`mint`、`sky`、`lilac`，也可传 `{body:'#82c852', belly:'#eee9c8'}`。状态可用 `idle`、`reading`、`thinking`、`insight`、`complete`。`setView` 支持 `front`、`side`、`back`，此外支持鼠标和触控拖动旋转。

状态仅用于表示产品已有的任务阶段：`reading` 收到材料、`thinking` 正在分析、`insight` 真正生成了有依据的火花、`complete` 结果可查看。**不能用计时器制造假的 AI 进度或没有依据的火花。** 页面应以服务端真实状态驱动；如果没有状态源，使用 `idle` 即可。

模型节点由 JS 驱动动作：待机呼吸与眨眼、阅读低头、思考侧倾、洞察抬头与额头发光、完成点头与抬手。系统偏好减少动态效果时，循环动画停止，保留静态状态姿势。模型本身没有嵌入动画片段。

## 浏览器验收

2026-10-17 在 Mac 上使用本地 Chrome 和现有 Playwright，对 HTTP 离线预览进行了实际画面检查：正面、侧面、背面和拖动后的斜视角均可见立体形体；五种状态都能切换；换色、眨眼、完成抬手和减少动态效果均已验证。GLB 加载后为 `real-3d`，没有页面异常或控制台错误；模拟 GLB 请求失败时，`static-fallback` 图片正常显示。脚部完整位于画面内，未见严重穿模或动作变形。此前发现的凸出肚皮、断续嘴线及画面裁脚已修正。

与参考 PNG 对照：绿色蛙形轮廓、大眼、奶油色下巴与肚皮、三指/三趾、额头四角火花得以保留；目前是由椭球和曲面组成的简化玩具风格，并未逐像素复刻参考图的柔和表面、眼窝和肢体连接。侧面能看到眼球和口鼻的明显突出，这是本版模型的外观限制。GLB 没有动画片段，动作完全由 `sparky-viewer.js` 的节点变换驱动，便于按真实服务状态调用。

## 构建与检查

```sh
python3 sparky-3d/build_model.py
python3 sparky-3d/validate_model.py
node --check sparky-3d/sparky-viewer.js
```

构建器只用 Python 标准库。模型为单个无外部贴图的 GLB，可直接交给使用 Three.js GLTFLoader 的页面。`vendor/` 是随包附带的 Three.js 0.160.0 精简文件，原版权许可见 `vendor/LICENSE`。

## 局限

这是可供展示和交互验证的低复杂度模型，保留圆润轮廓、浅色肚皮、大眼睛、三指与额头火花；没有骨骼绑定、表情 blendshape 或专业级表面雕刻。若最终形象需要逐像素贴合参考图，后续可用 DCC 工具继续精修模型，但本版使用和展示不依赖它。
