import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/**
 * CUBE 立方体 3D 场景
 * 真实玻璃外壳（PBR 折射 + 清漆 + 自定义蓝紫灯带环境反射 + 彩虹薄膜）
 * + 三层嵌套发光内核 + 倾斜轨道环 + 环绕小球 + 泛光后期
 *
 * 交互：
 * - 轨迹球式拖拽旋转：绕「垂直于拖动方向的屏幕轴」旋转，任意姿态下手感一致
 * - 松手后惯性衰减，自转绕立方体自身竖轴继续（翻转后姿态保持，不强制回正）
 * - 拖拽时锁定鼠标视差避免画面晃动；悬停/拖拽时转速、亮度、相机距离轻微加成
 */
const PAGE_BG = 0x08090a

/** 自定义反射环境：深色底 + 几条 HDR 彩色灯带。
 *  比 RoomEnvironment 的灰白灯板更有「手机玻璃/车漆」的高级反射感。 */
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
  bar(4, 5, 6.5, 7, 2, 0, 5, 0, Math.PI / 2, 0)      // 顶部冷白长条（主高光）
  bar(0.3, 1.8, 2.4, 6, 2.5, -5, 1, 0, 0, Math.PI / 2)  // 左侧青色灯带（压柔，避免整面染色）
  bar(1.3, 0.6, 3, 6, 2.5, 5, -0.5, 0, 0, -Math.PI / 2) // 右侧蓝紫灯带（压柔）
  bar(0.2, 0.45, 1, 9, 4, 0, 0, 6, 0, Math.PI)   // 正面弱蓝补光
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

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 9)

    // 泛光需要不透明画布，底色与页面保持一致
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setClearColor(PAGE_BG, 1)
    // ACES 色调映射：高光不过曝、暗部有层次，玻璃质感的关键一步
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)

    // 环境反射贴图：自定义蓝紫灯带场景经 PMREM 预滤波，
    // 给玻璃外壳提供彩色高光条而非灰白板反射
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

    // ---------- 立方体主体 ----------
    const group = new THREE.Group()
    scene.add(group)

    const outerGeo = new THREE.BoxGeometry(2.6, 2.6, 2.6)
    group.scale.setScalar(BASE_SCALE)
    group.position.y = BASE_Y

    // 真实玻璃外壳：transmission 折射 + clearcoat 清漆层 + 边缘染色 + 彩虹薄膜。
    // 厚度压到 0.5：折射只保留轻微扭曲感，避免相邻面采样错位过大。
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xeaf4ff,
      metalness: 0,
      roughness: 0.08,
      transmission: 1,
      thickness: 0.5,
      ior: 1.48,
      attenuationColor: new THREE.Color(0x5ea0ff),
      attenuationDistance: 3.0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
      iridescence: 0.2,
      iridescenceIOR: 1.32,
      envMapIntensity: 0.7,
      specularIntensity: 0.9
    })
    group.add(new THREE.Mesh(outerGeo, glassMat))

    // 外轮廓线：透明度交给动画层做呼吸
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x86bdff, transparent: true, opacity: 1 })
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(outerGeo), edgeMat))
    // 顶点光点：大小呼吸 + 自发光颜色交给动画层
    const vertexGeo = new THREE.BufferGeometry()
    const v: number[] = []
    for (const x of [-1.3, 1.3]) for (const y of [-1.3, 1.3]) for (const z of [-1.3, 1.3]) v.push(x, y, z)
    vertexGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    const vertexMat = new THREE.PointsMaterial({ color: 0xbfdcff, size: 0.11, transparent: true, opacity: 0.95 })
    group.add(new THREE.Points(vertexGeo, vertexMat))

    // 三层嵌套发光内核：大→小逐层反向旋转。
    // 全部保持透明渲染、不进玻璃的折射缓冲：折射缓冲会让每个面各自采样内核，
    // 棱角视角下同一内核在两个面上错位成「两个方块」。透明渲染只画一次，
    // 任何角度看都严格在同一个 3D 位置，与玻璃面自然叠合。
    const innerRoot = new THREE.Group()
    group.add(innerRoot)
    const innerLayers: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = []
    const innerSpecs = [
      { size: 0.95, color: 0x3f8fe0, opacity: 0.16 },
      { size: 0.72, color: 0x8cc8ff, opacity: 0.95 },
      { size: 0.46, color: 0xe8f4ff, opacity: 0.98 }
    ]
    for (const spec of innerSpecs) {
      const geo = new THREE.BoxGeometry(spec.size, spec.size, spec.size)
      const mat = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: spec.opacity
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.85 })
      ))
      innerRoot.add(mesh)
      innerLayers.push({ mesh, mat })
      // 最外层那档尺寸偏大，作为光晕壳，不参与 edges 描述的硬线条
      if (spec.size > 0.8) mesh.children[0].visible = false
    }

    // ---------- 轨道环 + 环绕小球 ----------
    const ringGroup = new THREE.Group()
    ringGroup.rotation.x = Math.PI / 2.35
    ringGroup.rotation.y = 0.4
    ringGroup.position.y = BASE_Y
    scene.add(ringGroup)

    const RING_R = 3.2
    ringGroup.add(new THREE.Mesh(
      new THREE.TorusGeometry(RING_R, 0.014, 12, 160),
      new THREE.MeshBasicMaterial({ color: 0x6fd0f5, transparent: true, opacity: 0.7 })
    ))
    const orbiter = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xd6fdff })
    )
    const orbiterGlow = new THREE.PointLight(0x4fe0f0, 8, 4)
    orbiter.add(orbiterGlow)
    ringGroup.add(orbiter)

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
    scene.add(new THREE.Points(particleGeo, new THREE.PointsMaterial({
      color: 0x4d7fd6, size: 0.035, transparent: true, opacity: 0.5
    })))

    // ---------- 灯光 ----------
    scene.add(new THREE.AmbientLight(0x8899ff, 0.55))
    const p1 = new THREE.PointLight(0x66aaff, 70)
    p1.position.set(4, 4, 4)
    scene.add(p1)
    const p2 = new THREE.PointLight(0x3355ff, 45)
    p2.position.set(-4, -3, -2)
    scene.add(p2)

    // ---------- 后期处理：泛光（让立方体真正"发光"） ----------
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
      mount.clientWidth || 1, mount.clientHeight || 1, { samples: 4, type: THREE.HalfFloatType }
    ))
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth || 1, mount.clientHeight || 1),
      0.38, // 强度：克制一点，避免线条发虚
      0.42, // 半径
      0.5   // 阈值：只有最亮的核心和顶点才发光
    )
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    // ---------- 交互状态 ----------
    // 轨迹球式旋转：姿态用四元数维护，拖拽绕「垂直于拖动方向的屏幕轴」旋转，
    // 无论立方体翻到什么姿态，拖拽方向都符合直觉（固定轴欧拉角翻转后会反向）
    let dragging = false
    let lastX = 0
    let lastY = 0
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
    }
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
      // 展示用俯仰微摆动叠加在最外层，不影响用户姿态
      const floatX = Math.sin(t * 0.5) * 0.12 + 0.18
      floatQuat.setFromEuler(tmpEuler.set(floatX, 0, 0))
      group.quaternion.copy(floatQuat).multiply(userQuat)

      // 内核：三层反向旋转，最内层最快
      innerLayers.forEach((l, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1
        const speed = 0.55 + idx * 0.35
        l.mesh.rotation.y = dir * t * speed
        l.mesh.rotation.z = dir * t * speed * 0.36
      })

      // 科技感高频微抖动
      group.position.x = Math.sin(t * 13.7) * 0.012 + Math.sin(t * 29.1) * 0.005
      group.position.y = BASE_Y + Math.sin(t * 17.3) * 0.012 + Math.cos(t * 23.9) * 0.005

      // 呼吸：拖拽/悬停时更亮更大一点
      const boost = 1 + hoverBoost * 0.18
      group.scale.setScalar(BASE_SCALE * (1 + Math.sin(t * 1.6) * 0.035) * boost)
      const pulse = 0.86 + Math.sin(t * 2.2) * 0.14
      innerLayers.forEach((l, idx) => {
        if (idx === 0) return
        // 透明内核：透明度做呼吸，底色足够亮，峰值照样触发泛光
        l.mat.opacity = (idx === 1 ? 0.9 : 0.96) * (0.85 + pulse * 0.15) * boost
      })
      edgeMat.opacity = (0.75 + Math.sin(t * 1.9) * 0.1 + hoverBoost * 0.25) * boost
      vertexMat.size = 0.11 * (1 + Math.sin(t * 2.6) * 0.22)
      vertexMat.opacity = Math.min(1, (0.8 + Math.sin(t * 2.6) * 0.15) * boost)
      // 拖拽/悬停时玻璃反射更亮一点
      glassMat.envMapIntensity = 0.7 * boost

      // 环绕小球
      const a = t * 0.85
      orbiter.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0)

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
      glassMat.dispose()
      renderer.dispose()
      outerGeo.dispose()
      particleGeo.dispose()
      vertexGeo.dispose()
      innerLayers.forEach((l) => l.mesh.geometry.dispose())
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%', userSelect: 'none', WebkitUserSelect: 'none' }} />
}
