import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/**
 * CUBE 立方体 3D 场景
 * 线框立方体（轮廓即六边形，贴合 logo）+ 内嵌发光小立方体 + 倾斜轨道环 + 环绕小球
 *
 * 现在服务于「Hero 右侧窄容器」（约 52% 宽），所以：
 * - 相机距离按容器宽高比自适应，避免轨道环在窄容器里被过度裁切
 * - BASE_Y 接近 0，让立方体在容器内垂直居中（旧版是配合「文字在下方」的构图）
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
    mount.appendChild(renderer.domElement)

    // 按容器宽高比算相机距离：取水平/垂直视场角中较小的那个来拟合
    const fitCamera = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      const aspect = Math.max(w / h, 0.4)
      camera.aspect = aspect
      const vFov = (camera.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
      camera.position.z = FIT_RADIUS / Math.sin(Math.min(vFov, hFov) / 2)
      camera.updateProjectionMatrix()
    }
    fitCamera()

    // ---------- 立方体主体 ----------
    const group = new THREE.Group()
    scene.add(group)

    const outerGeo = new THREE.BoxGeometry(2.6, 2.6, 2.6)
    group.scale.setScalar(BASE_SCALE)
    group.position.y = BASE_Y
    // 半透明面（很淡，避免压暗内部发光核心）
    group.add(new THREE.Mesh(
      outerGeo,
      new THREE.MeshBasicMaterial({
        color: 0x3f7fd0, transparent: true, opacity: 0.07,
        side: THREE.DoubleSide, depthWrite: false
      })
    ))
    // 外轮廓线
    group.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(outerGeo),
      new THREE.LineBasicMaterial({ color: 0x86bdff, transparent: true, opacity: 1 })
    ))
    // 顶点光点
    const vertexGeo = new THREE.BufferGeometry()
    const v: number[] = []
    for (const x of [-1.3, 1.3]) for (const y of [-1.3, 1.3]) for (const z of [-1.3, 1.3]) v.push(x, y, z)
    vertexGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    group.add(new THREE.Points(vertexGeo, new THREE.PointsMaterial({ color: 0xbfdcff, size: 0.09 })))

    // 内嵌发光小立方体
    const innerGeo = new THREE.BoxGeometry(0.72, 0.72, 0.72)
    const innerBase = new THREE.Color(0x8cc8ff)
    const innerMat = new THREE.MeshBasicMaterial({ color: innerBase.clone() })
    const inner = new THREE.Mesh(innerGeo, innerMat)
    inner.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(innerGeo),
      new THREE.LineBasicMaterial({ color: 0xcfe4ff })
    ))
    group.add(inner)

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

    // ---------- 交互与动画 ----------
    let mouseX = 0
    let mouseY = 0
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    const onResize = () => {
      fitCamera()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      composer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const clock = new THREE.Clock()
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // 自转
      group.rotation.y = t * 0.32
      group.rotation.x = 0.18 + Math.sin(t * 0.5) * 0.12
      inner.rotation.y = -t * 0.55
      inner.rotation.z = t * 0.2

      // 科技感高频微抖动
      group.position.x = Math.sin(t * 13.7) * 0.012 + Math.sin(t * 29.1) * 0.005
      group.position.y = BASE_Y + Math.sin(t * 17.3) * 0.012 + Math.cos(t * 23.9) * 0.005

      // 呼吸
      group.scale.setScalar(BASE_SCALE * (1 + Math.sin(t * 1.6) * 0.035))
      innerMat.color.copy(innerBase).multiplyScalar(0.86 + Math.sin(t * 2.2) * 0.14)

      // 环绕小球
      const a = t * 0.85
      orbiter.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0)

      // 鼠标视差（缓动跟随）
      camera.position.x += (mouseX * 0.7 - camera.position.x) * 0.04
      camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.04
      camera.lookAt(0, 0, 0)

      composer.render()
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      mount.removeChild(renderer.domElement)
      composer.dispose()
      renderer.dispose()
      outerGeo.dispose()
      innerGeo.dispose()
      particleGeo.dispose()
      vertexGeo.dispose()
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
