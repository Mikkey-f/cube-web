import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/**
 * CUBE 立方体 3D 场景（v2 美术重构 —— 对齐 2D Logo 参考图）
 * 等距视角的空心立方体框架（12 根金属梁，霓虹蓝 → 紫罗兰顶点渐变）
 * + 中心悬浮实心发光小立方体 + 霓虹青轨道环（带两个发光节点）+ 泛光后期
 *
 * 交互：
 * - 轨迹球式拖拽旋转：绕「垂直于拖动方向的屏幕轴」旋转，任意姿态下手感一致
 * - 松手后惯性衰减，自转绕立方体自身竖轴继续（翻转后姿态保持，不强制回正）
 * - 拖拽时锁定鼠标视差避免画面晃动；悬停/拖拽时转速、亮度、相机距离轻微加成
 *
 * 彩蛋：
 * - 点击（非拖拽）立方体：一次「充能」—— Bloom 脉冲 + 内核弹跳
 * - 连续点击 5 次或输入 Konami 码（↑↑↓↓←→←→BA）：彩蛋模式，320 颗粒子从立方体中心爆开
 */
const PAGE_BG = 0x08090a

/** 霓虹渐变两端色：蓝 → 紫罗兰（对齐 logo） */
const NEON_BLUE = new THREE.Color(0x2f7bff)
const NEON_VIOLET = new THREE.Color(0x9d4dff)
/** 渐变轴：从左上后方（蓝）走向右下前方（紫），对齐参考图的成色方向 */
const GRAD_AXIS = new THREE.Vector3(0.5, -0.62, 0.45).normalize()
const HALF = 1.3 // 框架半宽

/** 按「位置在渐变轴上的投影」给几何体顶点着色；brighten>1 时输出 HDR 色用于触发泛光 */
function paintGradient(geo: THREE.BufferGeometry, brighten = 1) {
  const pos = geo.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const raw = (pos.getX(i) * GRAD_AXIS.x + pos.getY(i) * GRAD_AXIS.y + pos.getZ(i) * GRAD_AXIS.z) / HALF * 0.5 + 0.5
    // 压缩紫罗兰段：参考图以蓝为主，紫只出现在右下棱角附近
    const t = THREE.MathUtils.clamp((raw - 0.18) / 0.82, 0, 1)
    c.copy(NEON_BLUE).lerp(NEON_VIOLET, t).multiplyScalar(brighten)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/** 自定义反射环境：深色底 + 几条 HDR 彩色灯带。
 *  金属梁靠它映出蓝紫高光条，比灰白 RoomEnvironment 更有「车漆」感。 */
function buildEnvScene() {
  const env = new THREE.Scene()
  env.background = new THREE.Color(0x04060a)
  const bar = (r: number, g: number, b: number, w: number, h: number,
    px: number, py: number, pz: number, rx: number, ry: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide })
    )
    m.position.set(px, py, pz)
    m.rotation.set(rx, ry, 0)
    env.add(m)
  }
  bar(4, 5, 6.5, 7, 2, 0, 5, 0, Math.PI / 2, 0)         // 顶部冷白长条（主高光）
  bar(0.3, 1.8, 2.6, 6, 2.5, -5, 1, 0, 0, Math.PI / 2)  // 左侧青色灯带
  bar(1.6, 0.6, 3.2, 6, 2.5, 5, -0.5, 0, 0, -Math.PI / 2) // 右侧紫罗兰灯带
  bar(0.2, 0.45, 1, 9, 4, 0, 0, 6, 0, Math.PI)          // 正面弱蓝补光
  return env
}

export default function CubeScene() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const BASE_SCALE = 1.12
    const BASE_Y = 0.18
    // 需要完整落在画面内的内容半径。轨道环半径是 3.2，
    // 这里故意取小一点：让环左右轻微出界，形成 Lumen 那种「全出血」的观感。
    const FIT_RADIUS = 3.3

    const disposables: { dispose: () => void }[] = []

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 9)

    // 泛光需要不透明画布，底色与页面保持一致
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setClearColor(PAGE_BG, 1)
    // ACES 色调映射：高光不过曝、暗部有层次，电影感的关键一步
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)

    // 环境反射贴图：自定义蓝紫灯带场景经 PMREM 预滤波，
    // 给金属梁提供彩色高光条而非灰白板反射
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(buildEnvScene(), 0.06).texture
    scene.environment = envTex

    // 拖拽只在画布上生效，并加抓手光标；禁用文本选择，避免拖拽变成选中文字
    const canvas = renderer.domElement
    canvas.style.touchAction = 'none'
    canvas.style.cursor = 'grab'
    canvas.style.userSelect = 'none'
    canvas.style.webkitUserSelect = 'none'

    // 按容器宽高比算相机距离：取水平/垂直视场角中较小的那个来拟合
    const fitCamera = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      const aspect = Math.max(w / h, 0.4)
      camera.aspect = aspect
      const vFov = (camera.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
      camera.position.z = FIT_RADIUS / Math.sin(Math.min(vFov, hFov) / 2)
    }
    fitCamera()
    const baseZ = camera.position.z

    // ---------- 立方体主体：空心框架 ----------
    const group = new THREE.Group()
    scene.add(group)
    group.scale.setScalar(BASE_SCALE)
    group.position.y = BASE_Y

    // 12 根金属梁拼成空心立方体框架。几何体直接平移到位（顶点着色用的是世界位置），
    // 梁在顶点处互相穿插，同材质下看不出接缝。
    const beamMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.85,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.0,
      emissive: 0x0a1030,
      emissiveIntensity: 0.55
    })
    disposables.push(beamMat)

    const BEAM_T = 0.21 // 梁粗：参考图的框架相当厚实
    const beamGeos: THREE.BufferGeometry[] = []
    for (const s1 of [-HALF, HALF]) for (const s2 of [-HALF, HALF]) {
      const gx = new THREE.BoxGeometry(HALF * 2 + BEAM_T, BEAM_T, BEAM_T)
      gx.translate(0, s1, s2); beamGeos.push(gx)
      const gy = new THREE.BoxGeometry(BEAM_T, HALF * 2 + BEAM_T, BEAM_T)
      gy.translate(s1, 0, s2); beamGeos.push(gy)
      const gz = new THREE.BoxGeometry(BEAM_T, BEAM_T, HALF * 2 + BEAM_T)
      gz.translate(s1, s2, 0); beamGeos.push(gz)
    }
    for (const g of beamGeos) {
      paintGradient(g)
      group.add(new THREE.Mesh(g, beamMat))
      disposables.push(g)
    }

    // 框架外轮廓霓虹线：HDR 顶点色（>1），专门喂给泛光，形成「边缘发光」
    const frameEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2 + BEAM_T, HALF * 2 + BEAM_T, HALF * 2 + BEAM_T))
    paintGradient(frameEdgeGeo, 1.35)
    const frameEdgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65 })
    group.add(new THREE.LineSegments(frameEdgeGeo, frameEdgeMat))
    disposables.push(frameEdgeGeo, frameEdgeMat)

    // ---------- 中心悬浮实心发光小立方体 ----------
    const innerRoot = new THREE.Group()
    group.add(innerRoot)

    // 光晕壳：稍大的半透明蓝壳，给内核一圈柔光
    const shellGeo = new THREE.BoxGeometry(1.12, 1.12, 1.12)
    const shellMat = new THREE.MeshBasicMaterial({ color: 0x3f8fe0, transparent: true, opacity: 0.16 })
    innerRoot.add(new THREE.Mesh(shellGeo, shellMat))
    disposables.push(shellGeo, shellMat)

    // 实心核：顶点渐变（顶面亮青白 → 底面饱和蓝），亮度足够触发泛光
    const coreGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9)
    {
      const pos = coreGeo.getAttribute('position')
      const colors = new Float32Array(pos.count * 3)
      const top = new THREE.Color(0x8fc8ff)
      const bottom = new THREE.Color(0x2a6ef5)
      const c = new THREE.Color()
      for (let i = 0; i < pos.count; i++) {
        const t = THREE.MathUtils.clamp(pos.getY(i) / 0.9 + 0.5, 0, 1)
        c.copy(bottom).lerp(top, t).multiplyScalar(1.18)
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }
      coreGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    const coreMat = new THREE.MeshBasicMaterial({ vertexColors: true })
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    const coreEdgeGeo = new THREE.EdgesGeometry(coreGeo)
    const coreEdgeMat = new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.7 })
    coreMesh.add(new THREE.LineSegments(coreEdgeGeo, coreEdgeMat))
    innerRoot.add(coreMesh)
    disposables.push(coreGeo, coreMat, coreEdgeGeo, coreEdgeMat)

    // ---------- 霓虹青轨道环 + 两个发光节点 ----------
    const ringGroup = new THREE.Group()
    ringGroup.rotation.x = Math.PI / 2.35
    ringGroup.rotation.y = 0.4
    ringGroup.position.y = BASE_Y
    scene.add(ringGroup)

    const RING_R = 3.2
    const ringGeo = new THREE.TorusGeometry(RING_R, 0.02, 12, 200)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4df3ff, transparent: true, opacity: 0.95 })
    ringGroup.add(new THREE.Mesh(ringGeo, ringMat))
    disposables.push(ringGeo, ringMat)

    const nodeGeo = new THREE.SphereGeometry(0.095, 16, 16)
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xd8ffff })
    disposables.push(nodeGeo, nodeMat)
    const nodes: THREE.Mesh[] = []
    for (let i = 0; i < 2; i++) {
      const node = new THREE.Mesh(nodeGeo, nodeMat)
      const light = new THREE.PointLight(0x54f0ff, 7, 3.5)
      node.add(light)
      ringGroup.add(node)
      nodes.push(node)
    }

    // ---------- 彩蛋粒子：一次性建好 320 颗，触发时从立方体中心爆开 ----------
    // 位置缓冲每帧由「方向向量 × 膨胀进度」重写，避免每次触发都重新分配内存
    const EGG_COUNT = 320
    const EGG_DURATION = 2.6
    const eggGeo = new THREE.BufferGeometry()
    const eggPos = new Float32Array(EGG_COUNT * 3)
    const eggColors = new Float32Array(EGG_COUNT * 3)
    const eggVel: THREE.Vector3[] = []
    const eggPalette = [0x4f8cff, 0x22d3ee, 0x9d4dff, 0xeaf6ff].map((c) => new THREE.Color(c))
    for (let i = 0; i < EGG_COUNT; i++) {
      eggVel.push(new THREE.Vector3().randomDirection().multiplyScalar(2.4 + Math.random() * 4.6))
      const c = eggPalette[(Math.random() * eggPalette.length) | 0]
      eggColors[i * 3] = c.r
      eggColors[i * 3 + 1] = c.g
      eggColors[i * 3 + 2] = c.b
    }
    eggGeo.setAttribute('position', new THREE.BufferAttribute(eggPos, 3))
    eggGeo.setAttribute('color', new THREE.BufferAttribute(eggColors, 3))
    const eggMat = new THREE.PointsMaterial({
      size: 0.1, vertexColors: true, transparent: true, opacity: 0, depthWrite: false
    })
    const eggPoints = new THREE.Points(eggGeo, eggMat)
    eggPoints.position.y = BASE_Y
    eggPoints.visible = false
    eggPoints.frustumCulled = false // 粒子爆开后超出原始包围球，关掉视锥剔除防闪没
    scene.add(eggPoints)
    disposables.push(eggGeo, eggMat)

    let charge = 0        // 充能量（点击累加，逐帧衰减），驱动 Bloom 脉冲与内核弹跳
    let clickCount = 0    // 连续点击计数（2.5s 窗口）
    let lastClickAt = 0
    let eggStart = -1     // >=0 时彩蛋爆开进行中（值为开始的 clock 秒）

    const triggerEgg = () => {
      eggStart = clock.getElapsedTime()
      eggPoints.visible = true
      charge = 0.9 // 强脉冲，但别把核心糊成白块
    }

    // ---------- 背景粒子 ----------
    const COUNT = 240
    const pos = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18
      pos[i * 3 + 1] = (Math.random() - 0.5) * 11
      pos[i * 3 + 2] = (Math.random() - 0.5) * 7 - 2
    }
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const particleMat = new THREE.PointsMaterial({
      color: 0x4d7fd6, size: 0.035, transparent: true, opacity: 0.5
    })
    scene.add(new THREE.Points(particleGeo, particleMat))
    disposables.push(particleGeo, particleMat)

    // ---------- 灯光：电影级三点 + 边缘光 ----------
    scene.add(new THREE.AmbientLight(0x8899ff, 0.5))
    const p1 = new THREE.PointLight(0x66aaff, 70)   // 主光：冷蓝
    p1.position.set(4, 4, 4)
    scene.add(p1)
    const p2 = new THREE.PointLight(0x9d4dff, 55)   // 边缘光：紫罗兰，从背侧勾轮廓
    p2.position.set(-4.5, 2.5, -4)
    scene.add(p2)
    const p3 = new THREE.PointLight(0x22d3ee, 28)   // 补光：青，托住暗部
    p3.position.set(-3, -3.5, 2.5)
    scene.add(p3)

    // ---------- 后期处理：泛光（让霓虹真正"发光"） ----------
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
      mount.clientWidth || 1, mount.clientHeight || 1, { samples: 4, type: THREE.HalfFloatType }
    ))
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth || 1, mount.clientHeight || 1),
      0.38, // 强度：克制一点，避免线条发虚
      0.42, // 半径
      0.5   // 阈值：只有最亮的霓虹边线和内核才发光
    )
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    // ---------- 交互状态 ----------
    // 轨迹球式旋转：姿态用四元数维护，拖拽绕「垂直于拖动方向的屏幕轴」旋转，
    // 无论立方体翻到什么姿态，拖拽方向都符合直觉（固定轴欧拉角翻转后会反向）
    let dragging = false
    let lastX = 0
    let lastY = 0
    let downX = 0               // 按下位置/时间：用于区分「点击充能」和「拖拽旋转」
    let downY = 0
    let downAt = 0
    let pendDX = 0              // 本帧累积的拖拽像素（x）
    let pendDY = 0
    let velSX = 0               // 屏幕空间惯性速度（弧度/帧，EMA 平滑）
    let velSY = 0
    let hoverBoost = 0          // 悬停加成（转速/亮度），缓动
    const userQuat = new THREE.Quaternion() // 用户姿态（含自转）
    const floatQuat = new THREE.Quaternion() // 展示用俯仰微摆动（不污染用户姿态）
    const tmpQ = new THREE.Quaternion()
    const tmpAxis = new THREE.Vector3()
    const LOCAL_Y = new THREE.Vector3(0, 1, 0)
    const tmpEuler = new THREE.Euler()

    // 初始姿态：等距视角（绕竖轴 45°，配合下方的 35.26° 俯仰）
    userQuat.setFromAxisAngle(LOCAL_Y, Math.PI / 4)

    // 未拖拽时：挂在 window 上的视差（保留原行为）
    let mouseX = 0
    let mouseY = 0
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault() // 阻止浏览器把按下+移动当成文本选择/原生拖拽
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      downX = e.clientX
      downY = e.clientY
      downAt = performance.now()
      pendDX = 0
      pendDY = 0
      velSX = 0
      velSY = 0
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      pendDX += dx
      pendDY += dy
      // 像素 → 弧度：拖过整个容器约转 290°；EMA 平滑惯性采样，防抖
      const k = (Math.PI * 1.6) / Math.max(1, canvas.clientWidth)
      velSX = velSX * 0.55 + dx * k * 0.45
      velSY = velSY * 0.55 + dy * k * 0.45
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* 忽略 */ }
      canvas.style.cursor = 'grab'
      // 位移 < 8px 且按住 < 500ms 视为「点击」而非拖拽 → 充能
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY)
      if (dist < 8 && performance.now() - downAt < 500) onCubeClick()
    }

    /** 点击充能：Bloom 脉冲；2.5s 窗口内连点 5 次进彩蛋模式 */
    const onCubeClick = () => {
      charge = Math.min(1, charge + 0.9)
      const now = performance.now()
      if (now - lastClickAt > 2500) clickCount = 0
      clickCount++
      lastClickAt = now
      if (clickCount >= 5) {
        clickCount = 0
        triggerEgg()
      }
    }

    // Konami 码（↑↑↓↓←→←→BA）：输对同样触发彩蛋
    const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown',
      'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']
    let konamiIdx = 0
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      konamiIdx = k === KONAMI[konamiIdx] ? konamiIdx + 1 : (k === KONAMI[0] ? 1 : 0)
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0
        triggerEgg()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    const onEnter = () => { hoverBoost = 1 }
    const onLeave = () => { hoverBoost = 0 }
    // 兜底：拖拽过程中若浏览器仍尝试开始选择（如拖到画布外），直接拦掉
    const onSelectStart = (e: Event) => { if (dragging) e.preventDefault() }
    document.addEventListener('selectstart', onSelectStart)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerenter', onEnter)
    canvas.addEventListener('pointerleave', onLeave)

    const onResize = () => {
      fitCamera()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      composer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // 滚出视口后暂停 WebGL 渲染：hero 滚走后立方体已淡出到 0.05，
    // 继续全帧渲染只会白占 GPU、拖累整页滚动帧率
    let inView = true
    const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting }, { threshold: 0 })
    io.observe(mount)

    // ---------- 动画 ----------
    const clock = new THREE.Clock()
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      if (!inView) return // 画布滚出视口：跳过所有更新与渲染
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.getElapsedTime()
      hoverBoost += ((dragging ? 1 : hoverBoost > 0.5 ? 1 : 0) - hoverBoost) * 0.08

      // 轨迹球旋转：
      // - 拖拽中：把本帧累积像素转成「屏幕轴 → 世界轴」的旋转，premultiply 到用户姿态
      // - 松手后：沿松手方向的惯性指数衰减 + 绕自身竖轴的自转
      if (dragging) {
        const angle = Math.hypot(pendDX, pendDY) * (Math.PI * 1.6) / Math.max(1, canvas.clientWidth)
        if (angle > 1e-6) {
          tmpAxis.set(pendDY, pendDX, 0).normalize().applyQuaternion(camera.quaternion)
          tmpQ.setFromAxisAngle(tmpAxis, angle)
          userQuat.premultiply(tmpQ)
        }
        pendDX = 0
        pendDY = 0
      } else {
        const ia = Math.hypot(velSX, velSY)
        if (ia > 1e-5) {
          tmpAxis.set(velSY, velSX, 0).normalize().applyQuaternion(camera.quaternion)
          tmpQ.setFromAxisAngle(tmpAxis, ia)
          userQuat.premultiply(tmpQ)
          const decay = Math.pow(0.02, dt)
          velSX *= decay
          velSY *= decay
        }
        // 自转：绕立方体自身竖轴，翻转后姿态保持、自转轴跟着走（拿在手里的直觉）
        tmpQ.setFromAxisAngle(LOCAL_Y, (0.32 + hoverBoost * 0.25) * dt)
        userQuat.multiply(tmpQ)
      }
      // 展示用俯仰：等距角 35.26° 附近微摆动，叠加在最外层，不影响用户姿态
      const floatX = Math.sin(t * 0.5) * 0.1 + 0.6155
      floatQuat.setFromEuler(tmpEuler.set(floatX, 0, 0))
      group.quaternion.copy(floatQuat).multiply(userQuat)

      // 内核：实心核与光晕壳反向慢转
      coreMesh.rotation.y = t * 0.55
      coreMesh.rotation.z = t * 0.2
      innerRoot.rotation.y = -t * 0.35

      // 科技感高频微抖动
      group.position.x = Math.sin(t * 13.7) * 0.012 + Math.sin(t * 29.1) * 0.005
      group.position.y = BASE_Y + Math.sin(t * 17.3) * 0.012 + Math.cos(t * 23.9) * 0.005

      // 呼吸：拖拽/悬停时更亮更大一点
      const boost = 1 + hoverBoost * 0.18
      group.scale.setScalar(BASE_SCALE * (1 + Math.sin(t * 1.6) * 0.035) * boost)
      const pulse = 0.86 + Math.sin(t * 2.2) * 0.14
      shellMat.opacity = 0.16 * (0.8 + pulse * 0.2) * boost
      coreEdgeMat.opacity = (0.7 + pulse * 0.15) * boost
      frameEdgeMat.opacity = (0.75 + Math.sin(t * 1.9) * 0.1 + hoverBoost * 0.2) * boost
      // 拖拽/悬停时金属反射更亮一点
      beamMat.envMapIntensity = 1.0 * boost

      // 两个轨道节点：对角分布，缓慢环游
      const a = t * 0.5
      nodes[0].position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0)
      nodes[1].position.set(Math.cos(a + Math.PI) * RING_R, Math.sin(a + Math.PI) * RING_R, 0)

      // 彩蛋：充能衰减 → Bloom 脉冲 + 内核弹跳；爆开时粒子从中心沿速度向量膨胀
      charge *= Math.pow(0.06, dt)
      let eggGlow = 0
      if (eggStart >= 0) {
        const et = t - eggStart
        if (et >= EGG_DURATION) {
          eggStart = -1
          eggPoints.visible = false
          eggMat.opacity = 0
        } else {
          // easeOutCubic：前 0.3s 冲出去 70%，剩下慢慢散开淡出
          const k = 1 - Math.pow(1 - et / EGG_DURATION, 3)
          const pAttr = eggGeo.getAttribute('position') as THREE.BufferAttribute
          for (let i = 0; i < EGG_COUNT; i++) {
            const v = eggVel[i]
            pAttr.setXYZ(i, v.x * k, v.y * k - et * et * 0.55, v.z * k)
          }
          pAttr.needsUpdate = true
          eggMat.opacity = Math.min(1, 2 * (1 - et / EGG_DURATION))
          eggPoints.rotation.y = et * 0.35
          eggGlow = (1 - et / EGG_DURATION) * 0.35
        }
      }
      bloom.strength = 0.38 + charge * 1.15 + eggGlow
      coreMesh.scale.setScalar(1 + charge * 0.3)

      // 鼠标视差（缓动跟随）；拖拽时锁定视差避免「边转边晃」，相机拉近一点增加临场感
      const targetZ = baseZ - (dragging ? 0.55 : 0) - hoverBoost * 0.12
      const px = dragging ? 0 : mouseX * 0.7
      const py = dragging ? 0 : -mouseY * 0.5
      camera.position.x += (px - camera.position.x) * 0.04
      camera.position.y += (py - camera.position.y) * 0.04
      camera.position.z += (targetZ - camera.position.z) * 0.06
      camera.lookAt(0, 0, 0)

      composer.render()
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerenter', onEnter)
      canvas.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('selectstart', onSelectStart)
      mount.removeChild(renderer.domElement)
      composer.dispose()
      envTex.dispose()
      pmrem.dispose()
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%', userSelect: 'none', WebkitUserSelect: 'none' }} />
}
