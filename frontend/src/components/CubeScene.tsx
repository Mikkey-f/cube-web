import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * CUBE 立方体 3D 场景
 * 真实玻璃外壳（PBR 折射 + 清漆 + 环境反射 + 彩虹薄膜）
 * + 三层嵌套发光内核 + 倾斜轨道环 + 环绕小球 + 泛光后期
 *
 * 交互：
 * - 按住拖拽自由旋转（双轴任意翻转，带惯性），触屏可用
 * - 松手后惯性衰减，俯仰角缓慢回归基础角度，水平方向接管回自转
 * - 未拖拽时保留鼠标视差；悬停/拖拽时转速、亮度、相机距离轻微加成
 */
const PAGE_BG = 0x08090a

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

    // 环境反射贴图：RoomEnvironment 经 PMREM 预滤波，
    // 给玻璃外壳提供真实的高光条和反射层次（无需外部 HDR 资源）
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
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
    // 不透明内核会被折射捕获，透过玻璃能看到扭曲发光的内核。
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xd8ecff,
      metalness: 0,
      roughness: 0.05,
      transmission: 1,
      thickness: 1.6,
      ior: 1.48,
      attenuationColor: new THREE.Color(0x7fb8ff),
      attenuationDistance: 3.2,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.28,
      iridescenceIOR: 1.32,
      envMapIntensity: 1.5,
      specularIntensity: 1
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
    // 内两层必须不透明，才会出现在玻璃的折射缓冲里（透过外壳可见）；
    // 呼吸效果从调透明度改为调颜色亮度。
    const innerRoot = new THREE.Group()
    group.add(innerRoot)
    const innerLayers: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; baseColor: THREE.Color }[] = []
    const innerSpecs = [
      { size: 0.95, color: 0x3f8fe0, opacity: 0.16, transparent: true },
      { size: 0.72, color: 0x8cc8ff, opacity: 1, transparent: false },
      { size: 0.46, color: 0xe8f4ff, opacity: 1, transparent: false }
    ]
    for (const spec of innerSpecs) {
      const geo = new THREE.BoxGeometry(spec.size, spec.size, spec.size)
      const mat = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: spec.transparent,
        opacity: spec.opacity
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.85 })
      ))
      innerRoot.add(mesh)
      innerLayers.push({ mesh, mat, baseColor: new THREE.Color(spec.color) })
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
    // 自由双轴旋转：rotY 无限累积（自转叠加在其上），rotX 松手后缓慢回归基础俯仰
    let dragging = false
    let lastX = 0
    let lastY = 0
    let velY = 0              // 绕 Y 惯性角速度（每帧增量，弧度）
    let velX = 0              // 绕 X 惯性角速度
    let rotY = 0              // 当前水平角
    let rotX = 0.18           // 当前俯仰角
    let hoverBoost = 0        // 悬停加成（转速/亮度），缓动

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
      velY = 0
      velX = 0
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      // 像素 → 弧度：拖过整个容器约转 290°
      const k = (Math.PI * 1.6) / Math.max(1, canvas.clientWidth)
      velY = dx * k
      velX = dy * k
      rotY += velY
      rotX += velX // 不钳制：允许任意翻转
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

    // ---------- 动画 ----------
    const clock = new THREE.Clock()
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.getElapsedTime()
      hoverBoost += ((dragging ? 1 : hoverBoost > 0.5 ? 1 : 0) - hoverBoost) * 0.08

      // 旋转：拖拽时由手势直接驱动；松手后惯性指数衰减，
      // 水平方向平滑接管回自转，俯仰角沿最短路径缓慢回归基础角度
      if (!dragging) {
        rotY += (0.32 + hoverBoost * 0.25) * dt + velY
        rotX += velX
        velY *= Math.pow(0.02, dt)
        velX *= Math.pow(0.02, dt)
        let diff = (0.18 - rotX) % (Math.PI * 2)
        if (diff > Math.PI) diff -= Math.PI * 2
        if (diff < -Math.PI) diff += Math.PI * 2
        rotX += diff * (1 - Math.pow(0.05, dt)) // 很慢的弹簧，翻过的面会停留一会儿
      }
      group.rotation.y = rotY
      const floatX = Math.sin(t * 0.5) * 0.12
      group.rotation.x = rotX + floatX

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
        // 不透明内核：用颜色亮度做呼吸（透明度固定为 1，保证折射可见）
        const brightness = (idx === 1 ? 0.9 : 0.96) * (0.85 + pulse * 0.15) * boost
        l.mat.color.copy(l.baseColor).multiplyScalar(Math.min(brightness, 1.6))
      })
      edgeMat.opacity = (0.75 + Math.sin(t * 1.9) * 0.1 + hoverBoost * 0.25) * boost
      vertexMat.size = 0.11 * (1 + Math.sin(t * 2.6) * 0.22)
      vertexMat.opacity = Math.min(1, (0.8 + Math.sin(t * 2.6) * 0.15) * boost)
      // 拖拽/悬停时玻璃反射更亮一点
      glassMat.envMapIntensity = 1.5 * boost

      // 环绕小球
      const a = t * 0.85
      orbiter.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0)

      // 鼠标视差（缓动跟随）；拖拽时相机拉近一点，增加「抓在手里」的临场感
      const targetZ = baseZ - (dragging ? 0.55 : 0) - hoverBoost * 0.12
      camera.position.x += (mouseX * 0.7 - camera.position.x) * 0.04
      camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.04
      camera.position.z += (targetZ - camera.position.z) * 0.06
      camera.lookAt(0, 0, 0)

      composer.render()
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
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
