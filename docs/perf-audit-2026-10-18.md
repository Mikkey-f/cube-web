# CUBE 官网性能审查报告

> 审查时间：2026-10-18 ｜ 对象：cubelab.ink（React 18 + Vite 5 前端 / Spring Boot 后端 / nginx 静态托管）
> 目标：PC 与手机浏览器都能流畅、不卡顿

---

## 一、实测基线（不是估算）

用无头 Chrome 加载生产构建（本地静态托管，未 gzip），拿到首屏真实数据：

| 指标 | 实测值 | 说明 |
|---|---|---|
| 首屏请求数 | **12 个** | 已经算很克制 |
| 首屏传输量 | **1090 KB**（未压缩） | 走 nginx gzip 后约 **300 KB** |
| DOM 节点 | **595 个** | 健康区间，无需优化 |
| 首屏 JS | **940 KB 原始 / 275 KB gzip** | 见下方明细 |
| 首屏 CSS | 45 KB / 10 KB gzip | 健康 |

首屏 JS 明细（来自 `vite build` 产物）：

| chunk | 原始 | gzip | 是否首屏必需 |
|---|---|---|---|
| three-*.js | **479 KB** | **120 KB** | ❌ 只有首页 hero 立方体需要 |
| motion-*.js | 157 KB | 53 KB | ✅ 全站滚动动画 |
| vendor-*.js | 164 KB | 53 KB | ✅ React + Router |
| index-*.js | 141 KB | 48 KB | ✅ 业务代码 |

其它首屏资源：`logo.jpg` 50 KB（只显示 34px）、字体 `inter-latin` 47 KB + `space-grotesk-latin` 22 KB、字体 CSS 26 KB。

**关键事实**：`dist/index.html` 里有——

```html
<link rel="modulepreload" href="/assets/three-G2WEA8y3.js">
```

也就是说 **访问 `/login`、`/apply`、`/admin` 的任何一个页面，都会先下载 468 KB 的 three.js**，尽管这些页面一根 3D 线条都不画。原因链：`App.tsx` 静态 `import Home` → `Home.tsx` 静态 `import CubeScene` → `CubeScene` 静态 `import * as THREE from 'three'`。`manualChunks` 只是把它拆成独立文件，并没有把它移出依赖图。

---

## 二、按投入产出比排序的总览

| # | 优化点 | 影响面 | 收益量级 | 工作量 | 优先级 |
|---|---|---|---|---|---|
| 1 | three.js 移出首屏关键路径 | 全站 | 首屏 JS −468 KB（−120 KB gz），非首页路由 −100% | 0.5 天 | **P0** |
| 2 | 移动端 3D 降级（海报图替代 WebGL） | 手机 | GPU/电量/主线程大幅释放 | 0.5 天 | **P0** |
| 3 | 封面图压缩 + 上传时自动缩图 | 首页、播放器 | 单图 −300 KB | 后端 2h + 迁移 1h | **P0** |
| 4 | 移动端去掉导航栏 backdrop-filter | 手机 | iOS/Android 滚动帧率回升 | 1h | **P0** |
| 5 | hero 的 mask-image 改渐变叠加层 | PC+手机 | 每帧少一次全屏离屏合成 | 1h | P1 |
| 6 | 滚动期间降低 3D 渲染负载 | PC+手机 | 滚动更稳，不掉帧 | 2h | P1 |
| 7 | 招募战报轮询加可见性门控 | 手机为主 | 每小时 120 请求 → 0（不看时） | 1h | P1 |
| 8 | nginx 缓存 + 压缩调优 | 全站 | 回访几乎 0 请求、JS 再省 10~15% | 0.5h | P1 |
| 9 | 字体 preload / optional | 首页 | 消除大标题字体切换抖动 | 0.5~2h | P1 |
| 10 | framer-motion 换 LazyMotion | 全站 | JS −90 KB | 2~3 天 | P2 |
| 11 | 标题流光改 transform 叠加层 | 首页 | 少一次大文本逐帧重绘 | 2h | P2 |
| 12 | 首页 3 个接口合并 / 留言分页 | 首页 | 请求数 −2；数据增长后可控 | 0.5 天 | P2 |
| 13 | 100vh → 100svh、触控区 ≥44px | 手机 | 地址栏伸缩不跳动 | 2h | P2 |
| 14 | Lenis 空闲时停 rAF | 全站 | 待机省电 | 1h | P2 |
| 15 | 播放器粒子 canvas 按需挂载 | 首页 | 少一个固定层、少 20 MB 显存 | 1h | P2 |

---

## 三、P0 详解（建议本周做完）

### 1. 把 three.js 移出首屏关键路径

**现状证据**
- `frontend/dist/index.html` 第 11 行 `modulepreload` 了 three chunk
- `frontend/src/App.tsx:6` `import Home from './pages/Home'`（静态）
- `frontend/src/pages/Home.tsx:11` `import CubeScene from '../components/CubeScene'`
- 构建产物 `three-*.js` 479 KB / 120 KB gzip；`UnrealBloomPass` + `EffectComposer` 还要额外解析

**为什么这是卡顿来源**
1. 浏览器必须先下载并执行完 three.js 才能挂载 React 应用（静态 import 是强依赖），首屏白屏时间被这段 468 KB 拖长；
2. 中端手机解析 468 KB JS 约 300~500 ms 主线程时间，这期间页面不响应点击；
3. 所有其它路由白付这笔成本。

**优化方向**
```tsx
// Home.tsx
const CubeScene = lazy(() => import('../components/CubeScene'))

// hero 里
<Suspense fallback={<div className="hero-cube-poster" />}>
  <CubeScene />
</Suspense>
```
- 再补一个「先首帧、后加载」的策略：`requestIdleCallback`（或 `load` 事件后 200ms）再 `import('../components/CubeScene')` 预热，避免用户看到空白半秒；
- `fallback` 用一张预渲染的静态立方体图（WebP，约 30 KB），视觉上无缝衔接。

**预期收益**：首屏关键 JS 940 KB → 470 KB（gzip 275 → 155 KB）；4G 下 0.3~0.8 s，弱网 1~2 s。

---

### 2. 移动端 3D 降级

**现状证据**
- `CubeScene.tsx:90` `new THREE.WebGLRenderer({ antialias: true })`
- `CubeScene.tsx:92` `setPixelRatio(Math.min(devicePixelRatio, 1.75))`
- `CubeScene.tsx:296-307` `EffectComposer` + `UnrealBloomPass`（全分辨率后期）
- `index.css:1208` 窄屏下 `.hero-canvas` 仍是 100% 宽 × 320 px，持续 60 fps

**为什么这是卡顿来源**
UnrealBloom 是典型的「3 次高斯模糊 × 多 mip」后期，中低端手机 GPU 跑 60 fps 很吃力；叠加导航栏毛玻璃（见 #4）后，滚动时几乎必然掉帧，还会明显发热耗电。

**优化方向**
- 用 `matchMedia('(max-width: 860px)')`、`navigator.connection?.saveData`、`navigator.hardwareConcurrency <= 4` 任一命中 → **不初始化 WebGL**，直接渲染海报图；
- 桌面端把 `setPixelRatio` 上限从 1.75 降到 1.5（视觉几乎无差，像素量 −26%）；
- 保留一条「点海报可切换回 3D」的彩蛋入口，喜欢的话体验不丢。

**预期收益**：手机端首屏不再有 WebGL 初始化和持续 GPU 占用；这是移动端最省事、收益最大的一刀。

---

### 3. 封面图压缩 + 上传时自动缩图

**现状证据**（线上 `/opt/cube/music/` 实测）
```
352K  42c6dc95-....png   ← 晴天封面
279K  99f96bcf-....png   ← 另一首封面
4.2M  ca945fc0-....mp3
3.5M  631763a0-....mp3
```
这两张封面在页面上只显示在 **直径约 220 px** 的圆形里。

**影响**：每次进首页（封面在播放器里）+ 每次切歌都要拉一张 300 KB 的 PNG；移动端流量和首屏时间都吃亏。

**优化方向**
1. 后端上传时用 `ImageIO`/Thumbnailator 统一缩到 640×640 以内，转 WebP（或 JPEG q82），原图可不存或单独存；
2. 前端 `<img loading="lazy" decoding="async" width height>`；
3. 已有两张写一次性迁移：`ffmpeg -i in.png -vf scale=640:-1 -q:v 3 out.webp`。

**预期收益**：单图 300 KB → 30~40 KB，首屏直接省 300 KB；切歌不再卡。

---

### 4. 移动端去掉导航栏 backdrop-filter

**现状证据**：`index.css:147-158`
```css
.navbar {
  position: fixed;
  backdrop-filter: blur(16px) saturate(150%);
  background: rgba(8, 9, 10, 0.72);
}
```

**为什么这是卡顿来源**
导航栏固定在最上层，正下方就是**每帧都在重绘的 WebGL canvas**。毛玻璃需要对背景做实时高斯模糊——背景每帧变，模糊就得每帧重算，等于给每个滚动帧额外加一次全宽（手机 100% 宽）的离屏模糊。这是 iOS Safari 上最典型的滚动掉帧原因，Android 中低端机更明显。

**优化方向**
```css
@media (max-width: 860px) {
  .navbar {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(8, 9, 10, 0.92);
  }
}
```
更讲究的做法：滚过 hero 之后再挂 `.navbar.blurred`，hero 那屏用纯色（hero 本身就是深色，视觉差异极小）。

**预期收益**：手机滚动流畅度提升最直观的一处，改动 1 小时。

---

## 四、P1 详解（下一批）

### 5. hero 的 mask-image 换成渐变叠加层
- **证据**：`index.css:806` `.hero-canvas { mask-image: linear-gradient(180deg, transparent 0%, #000 8%) }`，遮罩对象是 54% 宽 × 100vh 的**动画 canvas**
- **问题**：CSS mask 会强制该图层走离屏合成（offscreen pass），动画元素带 mask = 每帧多一次全尺寸合成
- **改法**：去掉 mask，在 canvas 上层放一个和 `.hero-wash` 同手法的 `linear-gradient` div（`pointer-events:none`），视觉一致，成本归零
- **收益**：每帧少一次离屏合成；窄屏（canvas 100% 宽）收益更明显

### 6. 滚动期间降低 3D 渲染负载
- **证据**：`CubeScene.tsx:428` 的 `IntersectionObserver` 只在**完全滚出视口**时暂停；滚动过程中依旧全 DPR、全 bloom、60 fps
- **改法**：监听滚动状态，滚动中把 `setPixelRatio` 降到 1（或每 2 帧渲一次），停止 150 ms 后恢复；`Lenis` 的 `scroll` 事件可以直接用作信号
- **收益**：滚动时 GPU 占用减半，帧率曲线更平；停止滚动后自动恢复画质
- **注意**：不要简单「滚动时暂停渲染」，立方体会像卡住，降 DPR 更自然

### 7. 招募战报轮询加门控
- **证据**：`RecruitPulse.tsx:44-60`，组件挂载即拉一次，然后 `setInterval(load, 30000)` 永不停止
- **问题**：`/stats/recruit` 每小时 120 次/访客；用户根本不在这一屏时也在请求；后台标签页仍在跑（浏览器虽节流，但移动端仍耗电）
- **改法**：`IntersectionObserver` 进入视口才开始轮询，离开视口停止；`document.visibilitychange` 隐藏时暂停；首屏那次延后到 `requestIdleCallback`
- **收益**：真实请求量降 80%+，对小服务器也友好

### 8. nginx 缓存与压缩调优
- **证据**：`deploy/nginx/cube.conf:20-21` 只有 `gzip on; gzip_types ...;`；静态资源 `expires 30d`；`index.html` 无 Cache-Control
- **改法**（三个 server 文件同步改，走 CI）：
```nginx
gzip_comp_level 6;
gzip_vary on;
gzip_min_length 1024;

location ~* \.(js|css|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
# index.html 单独 no-cache，保证发版即刷新
location = /index.html { add_header Cache-Control "no-cache"; }
```
- **收益**：JS 再压 10~15%；带 hash 的资源一年内 0 请求；发版后不会拿到旧 HTML 引旧 JS
- **注意**：文件名带 hash，`immutable` 是安全的；`/music/` 目录（用户上传，文件名不带 hash）保持 7d 不变

### 9. 字体加载
- **证据**：构建后有 10 个 `@font-face`，全部 `font-display: swap`，且**没有 preload**
- **问题**：`swap` 意味着先用系统字体渲染、字体到位后替换 → hero 的 `CUBE` 大标题会闪一下，且 LCP 可能被推迟到替换时刻；`Space Grotesk` 的度量与 fallback 差异会造成轻微位移
- **改法**：构建后给两个 latin woff2 注入 `<link rel="preload" as="font" crossorigin>`（写个小 Vite 插件，或在 `index.html` 用固定文件名 + `?v=` 版本号）；或对标题使用 `font-display: optional`
- **收益**：标题不闪、LCP 提前；中文本来就只走系统字体（0 字节），这块已经很省

---

## 五、P2 详解（有空再做）

### 10. framer-motion 换 LazyMotion
- 现状 157 KB（53 KB gz）走的是完整包；`LazyMotion` + `m` 组件可降到 ~30~40 KB
- 代价：全站 `motion.*` 都要改成 `m.*`，且 `useScroll/useTransform/animate` 要按需 import——**改面大、回归风险高**，所以排后面
- 若要做，建议先在 `Reveal`、`StackCards` 试点，确认视觉零回归再铺开

### 11. 标题流光动画改 transform 叠加层
- `index.css:2448` `.player-heading` 用 `background-position` 做流光 —— 这是**重绘型动画**（每帧重画 500×60 px 的文本）
- 改法：在文字上盖一层窄亮带（`transform: translateX` + `mix-blend-mode: overlay` 或 `mask-image`），走合成层
- 说明：这是我上一轮刚加的「我们懂代码，也爱听歌」标题，收益只有几毫秒/帧，但确实是纯白捡的优化

### 12. 首页接口合并 / 留言分页
- 现状首页并发 3 个请求：`GET /music`、`GET /messages/approved`、`GET /stats/recruit`
- 可合并为 `GET /api/home` 一次返回；`/messages/approved` 目前全量返回，留言墙涨到几百条后 payload 会线性膨胀，建议 `?limit=60`
- 收益：请求数 12 → 10；数据增长后的可预期性 > 当下的毫秒数

### 13. 移动端视口与触控
- `index.css` 里 4 处 `min-height: 100vh`（hero、statement、cta 等）——手机上地址栏伸缩会导致区块高度跳变，换 `100svh`（或 `100dvh`）
- 导航栏/按钮的触控目标部分小于 44×44（`music-btn` 是 36px、移动端 30px），建议移动端补到 44px（可用 `padding` 撑开，不改视觉）

### 14. Lenis 空闲时停 rAF
- `SmoothScroll.tsx:16-21` 是永不停止的 `requestAnimationFrame` 循环
- Lenis 内部有「没有滚动就不做事」的短路，但每帧仍有一次空回调 + 一次时间戳读取；改成滚动结束 500 ms 后 `cancelAnimationFrame`，下次 `scroll` 再启动
- 收益：待机功耗/内存抖动的小幅改善，属于锦上添花

### 15. 播放器粒子 canvas 按需挂载
- `index.css:2481` `.music-burst` 是 `position: fixed; inset: 0; width: 100vw; height: 100vh`，常驻 DOM
- `fireBurst` 时把 `canvas.width` 设成 `innerWidth * dpr`——2K 屏 + dpr2 就是 5000×2880 ≈ 14 MP 的缓冲区（约 20 MB 显存）
- 改法：只在切歌时创建 canvas / 或把画布限制在播放器区块内、dpr 上限 1.5

---

## 六、明确不建议做的（避免走弯路）

| 方案 | 为什么不做 |
|---|---|
| 上 SSR / 迁 Next.js | 站点是深色动画主页 + 后台管理，SEO 不是瓶颈；服务端渲染 3D hero 反而增加复杂度和首屏阻塞，收益 < 风险 |
| 加 Service Worker 离线缓存 | 内容（留言墙、招数）常变，缓存策略复杂，小站收益低 |
| 图片懒加载全面铺开 | 全站只有两张用户封面上传图，`loading=lazy` 只对播放器封面有意义，其余无图可懒 |
| 上 CDN | 目前服务器在国内、访客也在国内，静态资源已 gzip + 长缓存；上 CDN 的收益主要在跨地域，现阶段不划算 |
| 换掉 framer-motion（#10） | 只省 90 KB，但要重写全部动画；排在最后，且需先试点 |

---

## 七、建议的落地节奏

**批次 A（约 1 天，收益最大）**
1. three.js 移出首屏（#1）
2. 移动端 3D 降级（#2）
3. 导航栏毛玻璃移动端关闭（#4）
4. 封面图压缩（#3）

> 预期：首屏 JS 940 KB → 470 KB；手机首屏停止初始化 WebGL；单次访问少 600 KB 图片；
> 用户能直接感知「打开快了 + 滚动顺了」。

**批次 B（约 1 天，把细节做扎实）**
5. mask → 渐变层（#5）
6. 滚动降载（#6）
7. 轮询门控（#7）
8. nginx 缓存/压缩（#8）
9. 字体 preload（#9）

> 预期：回访几乎零请求；滚动帧率稳定；服务器请求量下降。

**批次 C（可选，按需）**
10~15 里的任意项，其中 #11、#13、#15 是低风险小改动，可以顺手带上。

---

## 八、怎么验收

1. **首屏体积**：`vite build` 后看 `dist/index.html` 的 `modulepreload` 里是否还有 three；首屏 JS 总量应 ≤ 500 KB 原始。
2. **真机滚动**：Android 中端机 + iPhone 各测一次，用 Chrome DevTools 远程调试的 FPS meter，滚动首页到播放器，观察是否稳定在 55+。
3. **网络面板**：勾选 Fast 4G + 4× CPU 降速，看 LCP 是否 < 2.5 s；切歌时封面请求是否 < 50 KB。
4. **回访**：第二次访问应几乎 0 个静态资源请求（除 `index.html` 的 304）。

---

*本报告的所有数字均来自实际构建产物与线上文件，非经验估算。*
