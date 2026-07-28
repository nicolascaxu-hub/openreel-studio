"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { TransformControls } from "three/addons/controls/TransformControls.js"
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js"
import {
  applyDirectorRigPose,
  createDirectorMannequin,
  type DirectorRigJointBones,
} from "./directorMannequinModel"
import {
  createProjectDirectorCaptures,
  deleteProjectDirectorCapture,
  deleteProjectDirectorModel,
  getProjectDirector,
  promoteProjectDirectorCapture,
  reorderProjectDirectorCaptures,
  resolveMediaUrl,
  saveProjectDirectorScene,
  updateProjectDirectorCapture,
  uploadProjectDirectorModel,
} from "@/lib/api"
import {
  DIRECTOR_ASPECT_VALUES,
  DIRECTOR_BUILTINS,
  DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID,
  MAX_DIRECTOR_CAMERAS,
  cloneDirectorScene,
  createDirectorId,
  defaultDirectorDesk,
  newDirectorCamera,
  newDirectorObject,
  normalizeDirectorCustomRig,
  normalizeDirectorDesk,
  type DirectorActorLegendItem,
  type DirectorAspectRatio,
  type DirectorCapture,
  type DirectorCameraPose,
  type DirectorCameraState,
  type DirectorCustomRigState,
  type DirectorDeskState,
  type DirectorModelAsset,
  type DirectorModelHumanoid,
  type DirectorObjectState,
  type DirectorSceneState,
  type DirectorTransformMode,
} from "@/lib/directorDesk"
import {
  applyDirectorMannequinBodyPreset,
  applyDirectorMannequinPosePreset,
  DIRECTOR_MANNEQUIN_BODY_PRESETS,
  DIRECTOR_MANNEQUIN_JOINT_INFO,
  DIRECTOR_MANNEQUIN_JOINT_LIMITS,
  DIRECTOR_MANNEQUIN_JOINTS,
  DIRECTOR_MANNEQUIN_POSE_PRESETS,
  DIRECTOR_MANNEQUIN_SIZE_PRESETS,
  normalizeDirectorMannequin,
  type DirectorMannequinBodyPreset,
  type DirectorMannequinJoint,
  type DirectorMannequinPosePreset,
  type DirectorMannequinProportions,
} from "@/lib/directorMannequin"
import { cn } from "@/lib/utils"


interface DirectorDeskProps {
  projectId: string
  projectTitle?: string
  canvasPosition: { x: number; y: number }
  onClose: () => void
  onCapturePromoted: (nodeId: string, created: boolean) => Promise<void> | void
}

interface DirectorRuntime {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  orbit: OrbitControls
  transform: TransformControls
  transformHelper: THREE.Object3D
  root: THREE.Group
  cameraRoot: THREE.Group
  grid: THREE.GridHelper
  objectRoots: Map<string, THREE.Group>
  cameraRigs: Map<string, DirectorCameraRig>
  mixers: Map<string, THREE.AnimationMixer>
  objectBuildTokens: Map<string, number>
  resizeObserver: ResizeObserver
  viewport: HTMLDivElement
  cameraViewMode: "overview" | "camera"
  disposed: boolean
}

interface DirectorCameraRig {
  camera: THREE.PerspectiveCamera
  visual: THREE.Group
  helper: THREE.CameraHelper
}

interface DirectorApiResponse {
  ok?: boolean
  director?: unknown
  node?: { id?: string }
  created?: boolean
  captures?: DirectorCapture[]
}

const TRANSFORM_LABELS: Record<DirectorTransformMode, string> = {
  translate: "移动",
  rotate: "旋转",
  scale: "缩放",
}

const MANNEQUIN_PROPORTION_CONTROLS: Array<{
  key: keyof DirectorMannequinProportions
  label: string
  min: number
  max: number
  step: number
  unit?: string
}> = [
  { key: "height", label: "身高", min: 1.35, max: 2.15, step: 0.01, unit: "m" },
  { key: "build", label: "体量", min: 0.68, max: 1.38, step: 0.01 },
  { key: "shoulder_width", label: "肩宽", min: 0.72, max: 1.35, step: 0.01 },
  { key: "hip_width", label: "胯宽", min: 0.75, max: 1.3, step: 0.01 },
  { key: "torso_length", label: "躯干长度", min: 0.78, max: 1.24, step: 0.01 },
  { key: "arm_length", label: "手臂长度", min: 0.75, max: 1.3, step: 0.01 },
  { key: "leg_length", label: "腿部长度", min: 0.75, max: 1.3, step: 0.01 },
  { key: "head_scale", label: "头部比例", min: 0.78, max: 1.25, step: 0.01 },
]

type DirectorIconName =
  | "arrow-left"
  | "camera"
  | "check"
  | "chevron"
  | "copy"
  | "eye"
  | "eye-off"
  | "grid"
  | "image"
  | "layers"
  | "lock"
  | "move"
  | "redo"
  | "rotate"
  | "scale"
  | "sparkles"
  | "thirds"
  | "trash"
  | "undo"
  | "unlock"
  | "upload"

function DirectorIcon({ name, className = "h-4 w-4" }: { name: DirectorIconName; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  }
  const content: Record<DirectorIconName, ReactNode> = {
    "arrow-left": <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
    camera: <><path d="M14.5 6 13 4H7L5.5 6H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" /><circle cx="10" cy="12" r="3.5" /><path d="M18 9h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    "eye-off": <><path d="m3 3 18 18" /><path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.1 2.8M6.6 6.6C3.7 8.4 2 12 2 12s3.5 6 10 6c1.9 0 3.5-.5 4.9-1.2" /></>,
    grid: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    layers: <><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    move: <><path d="M12 2v20M2 12h20" /><path d="m8 6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" /></>,
    redo: <><path d="m17 7 4 4-4 4" /><path d="M3 17v-2a4 4 0 0 1 4-4h14" /></>,
    rotate: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>,
    scale: <><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></>,
    sparkles: <><path d="m12 3 1.2 3.2L16 8l-2.8 1.8L12 13l-1.2-3.2L8 8l2.8-1.8L12 3Z" /><path d="m5 14 .8 2.2L8 17.5l-2.2 1.3L5 21l-.8-2.2L2 17.5l2.2-1.3L5 14ZM19 3l.6 1.6L21 5.5l-1.4.9L19 8l-.6-1.6-1.4-.9 1.4-.9L19 3Z" /></>,
    thirds: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16M3 9.3h18M3 14.7h18" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
    undo: <><path d="m7 7-4 4 4 4" /><path d="M21 17v-2a4 4 0 0 0-4-4H3" /></>,
    unlock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></>,
    upload: <><path d="M12 16V3M7 8l5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>{content[name]}</svg>
}

function BuiltinGlyph({ assetId }: { assetId: string }) {
  if (assetId === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID) {
    return <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true"><circle cx="24" cy="10" r="5" fill="currentColor" /><path d="M18 17c0-2 2-4 6-4s6 2 6 4l2 12-4 2-1 11h-6l-1-11-4-2 2-12Z" fill="currentColor" opacity=".82" /><path d="m18 19-6 11m18-11 6 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
  }
  if (assetId === "builtin:table") {
    return <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true"><path d="m8 18 24-6 9 6-24 7-9-7Z" fill="currentColor" opacity=".9" /><path d="M12 22v16m24-17v13M19 25v16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".7" /></svg>
  }
  if (assetId === "builtin:chair") {
    return <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true"><path d="M13 9h22v19H13z" fill="currentColor" opacity=".55" /><path d="m10 26 25-3 4 7-25 3-4-7Z" fill="currentColor" /><path d="m16 31-2 10m20-12 3 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
  }
  if (assetId === "builtin:wall") {
    return <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true"><path d="M6 9h36v30H6z" fill="currentColor" opacity=".18" stroke="currentColor" strokeWidth="2" /><path d="M6 19h36M6 29h36M18 9v10m15-10v10M13 19v10m20-10v10M18 29v10m15-10v10" stroke="currentColor" strokeWidth="2" opacity=".75" /></svg>
  }
  if (assetId === "builtin:cylinder") {
    return <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true"><ellipse cx="24" cy="12" rx="13" ry="6" fill="currentColor" /><path d="M11 12v23c0 4 6 7 13 7s13-3 13-7V12" fill="currentColor" opacity=".55" /><ellipse cx="24" cy="35" rx="13" ry="7" fill="currentColor" opacity=".75" /></svg>
  }
  return <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true"><path d="m24 5 17 9-17 9-17-9 17-9Z" fill="currentColor" /><path d="m7 14 17 9v20L7 34V14Z" fill="currentColor" opacity=".6" /><path d="m41 14-17 9v20l17-9V14Z" fill="currentColor" opacity=".82" /></svg>
}

function material(color: string, roughness = 0.82): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 })
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  meshMaterial: THREE.Material,
  position: [number, number, number],
  rotation?: [number, number, number],
  scale?: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, meshMaterial)
  mesh.position.set(...position)
  if (rotation) mesh.rotation.set(...rotation)
  if (scale) mesh.scale.set(...scale)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function createBuiltinModel(
  assetId: string,
  color: string,
): THREE.Group {
  const group = new THREE.Group()
  const shared = material(color)
  const dark = material("#52525b")
  if (assetId === "builtin:cube") {
    addMesh(group, new THREE.BoxGeometry(1, 1, 1), shared, [0, 0.5, 0])
  } else if (assetId === "builtin:cylinder") {
    addMesh(group, new THREE.CylinderGeometry(0.5, 0.5, 1.4, 24), shared, [0, 0.7, 0])
  } else if (assetId === "builtin:table") {
    addMesh(group, new THREE.BoxGeometry(1.8, 0.12, 0.9), shared, [0, 0.82, 0])
    for (const x of [-0.72, 0.72]) for (const z of [-0.32, 0.32]) {
      addMesh(group, new THREE.BoxGeometry(0.1, 0.76, 0.1), dark, [x, 0.38, z])
    }
  } else if (assetId === "builtin:chair") {
    addMesh(group, new THREE.BoxGeometry(0.65, 0.1, 0.65), shared, [0, 0.52, 0])
    addMesh(group, new THREE.BoxGeometry(0.65, 0.85, 0.1), shared, [0, 0.95, 0.28])
    for (const x of [-0.25, 0.25]) for (const z of [-0.25, 0.25]) {
      addMesh(group, new THREE.BoxGeometry(0.08, 0.5, 0.08), dark, [x, 0.25, z])
    }
  } else if (assetId === "builtin:wall") {
    addMesh(group, new THREE.BoxGeometry(2.8, 2.4, 0.12), shared, [0, 1.2, 0])
  } else {
    addMesh(group, new THREE.BoxGeometry(1, 1, 1), material("#71717a"), [0, 0.5, 0])
  }
  return group
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry?.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const value of materials) {
      for (const candidate of Object.values(value)) {
        if (candidate instanceof THREE.Texture) candidate.dispose()
      }
      value.dispose()
    }
  })
}

const DIRECTOR_MODEL_THUMBNAIL_SIZE = 144
const directorModelThumbnailCache = new Map<string, string>()
const directorModelThumbnailPending = new Map<string, Promise<string>>()
let directorModelThumbnailQueue: Promise<void> = Promise.resolve()
let directorModelThumbnailRenderer: THREE.WebGLRenderer | null = null

function modelThumbnailCacheKey(asset: DirectorModelAsset): string {
  return `${asset.id}:${asset.size}:${asset.created_at || ""}`
}

function thumbnailRenderer(): THREE.WebGLRenderer {
  if (directorModelThumbnailRenderer) return directorModelThumbnailRenderer
  const canvas = document.createElement("canvas")
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(1)
  renderer.setSize(DIRECTOR_MODEL_THUMBNAIL_SIZE, DIRECTOR_MODEL_THUMBNAIL_SIZE, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.setClearColor(0x000000, 0)
  directorModelThumbnailRenderer = renderer
  return renderer
}

async function renderDirectorModelThumbnail(asset: DirectorModelAsset): Promise<string> {
  const renderer = thumbnailRenderer()
  const gltf = await new GLTFLoader().loadAsync(resolveMediaUrl(asset.url))
  const model = gltf.scene
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000)
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x172033, 2.4))
  const key = new THREE.DirectionalLight(0xffffff, 3.1)
  key.position.set(3, 5, 4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x8bbcff, 1.4)
  rim.position.set(-4, 2.5, -2)
  scene.add(rim)
  scene.add(model)

  let mixer: THREE.AnimationMixer | null = null
  if (gltf.animations.length > 0) {
    const clip = gltf.animations[0]
    mixer = new THREE.AnimationMixer(model)
    mixer.clipAction(clip).play()
    mixer.update(Math.min(Math.max(clip.duration * 0.16, 0.08), 0.42))
  }

  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  if (box.isEmpty()) {
    mixer?.stopAllAction()
    disposeObject(model)
    throw new Error("模型没有可预览的网格")
  }
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const fitHeightDistance = size.y / (2 * Math.tan(fov / 2))
  const fitWidthDistance = size.x / (2 * Math.tan(fov / 2))
  const distance = Math.max(fitHeightDistance, fitWidthDistance, size.z * 1.8, 0.4) * 1.22
  const direction = new THREE.Vector3(0.78, 0.22, 1.45).normalize()
  camera.position.copy(center).addScaledVector(direction, distance)
  camera.near = Math.max(distance / 100, 0.001)
  camera.far = Math.max(distance * 8, 10)
  camera.lookAt(center)
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
  const thumbnail = renderer.domElement.toDataURL("image/webp", 0.86)

  if (mixer) {
    mixer.stopAllAction()
    mixer.uncacheRoot(model)
  }
  scene.remove(model)
  disposeObject(model)
  renderer.renderLists.dispose()
  return thumbnail
}

function getDirectorModelThumbnail(asset: DirectorModelAsset): Promise<string> {
  const key = modelThumbnailCacheKey(asset)
  const cached = directorModelThumbnailCache.get(key)
  if (cached) return Promise.resolve(cached)
  const pending = directorModelThumbnailPending.get(key)
  if (pending) return pending
  const task = directorModelThumbnailQueue.then(async () => {
    const thumbnail = await renderDirectorModelThumbnail(asset)
    directorModelThumbnailCache.set(key, thumbnail)
    return thumbnail
  })
  directorModelThumbnailPending.set(key, task)
  directorModelThumbnailQueue = task.then(() => undefined, () => undefined)
  void task.then(
    () => directorModelThumbnailPending.delete(key),
    () => directorModelThumbnailPending.delete(key),
  )
  return task
}

function DirectorModelThumbnail({ asset }: { asset: DirectorModelAsset }) {
  const cacheKey = modelThumbnailCacheKey(asset)
  const [thumbnail, setThumbnail] = useState<string | null>(() => directorModelThumbnailCache.get(cacheKey) || null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    const cached = directorModelThumbnailCache.get(cacheKey)
    if (cached) {
      setThumbnail(cached)
      setFailed(false)
      return () => { current = false }
    }
    setThumbnail(null)
    setFailed(false)
    void getDirectorModelThumbnail(asset).then((value) => {
      if (current) setThumbnail(value)
    }).catch(() => {
      if (current) setFailed(true)
    })
    return () => { current = false }
  }, [asset, cacheKey])

  return (
    <span
      aria-label={`${asset.name} 模型预览`}
      data-model-preview={failed ? "failed" : thumbnail ? "ready" : "loading"}
      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.07] bg-[radial-gradient(circle_at_50%_32%,rgba(129,140,248,.2),rgba(15,23,42,.78)_58%,rgba(3,7,18,.96))]"
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" draggable={false} className="h-full w-full object-contain p-0.5" />
      ) : failed ? (
        <span className="flex flex-col items-center text-zinc-600"><BuiltinGlyph assetId="builtin:cube" /><span className="-mt-1 text-[6px]">预览失败</span></span>
      ) : (
        <span className="h-4 w-4 animate-spin rounded-full border border-violet-200/20 border-t-violet-200/80" />
      )}
      <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 py-0.5 text-[6px] font-semibold tracking-[0.08em] text-cyan-100/75">3D</span>
    </span>
  )
}

function applyObjectTransform(root: THREE.Object3D, object: DirectorObjectState): void {
  root.position.set(...object.position)
  root.rotation.set(...object.rotation)
  root.scale.set(...object.scale)
  root.visible = object.visible
}

function cameraPose(camera: DirectorCameraState): DirectorCameraPose {
  return {
    position: [...camera.position],
    target: [...camera.target],
    fov: camera.fov,
  }
}

function activeDirectorCamera(scene: DirectorSceneState): DirectorCameraState {
  return scene.cameras.find((item) => item.id === scene.active_camera_id) || scene.cameras[0]
}

function syncLegacyActiveCamera(scene: DirectorSceneState): void {
  scene.camera = cameraPose(activeDirectorCamera(scene))
}

function createDirectorCameraRig(
  state: DirectorCameraState,
  aspect: number,
  color: number,
): DirectorCameraRig {
  const visual = new THREE.Group()
  visual.name = `${state.name} camera rig`
  visual.userData.directorCameraId = state.id
  visual.userData.focusDistance = Math.max(
    0.25,
    new THREE.Vector3(...state.position).distanceTo(new THREE.Vector3(...state.target)),
  )
  visual.position.set(...state.position)
  const orientation = new THREE.PerspectiveCamera()
  orientation.position.set(...state.position)
  orientation.lookAt(new THREE.Vector3(...state.target))
  visual.quaternion.copy(orientation.quaternion)

  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.42), bodyMaterial)
  body.castShadow = true
  visual.add(body)
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.16, 0.22, 16),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.45 }),
  )
  lens.rotation.x = Math.PI / 2
  lens.position.z = -0.31
  visual.add(lens)
  const direction = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, -0.46),
    Math.min(visual.userData.focusDistance, 2.6),
    color,
    0.22,
    0.12,
  )
  visual.add(direction)

  const camera = new THREE.PerspectiveCamera(state.fov, aspect, 0.05, 500)
  camera.name = `${state.name} shot camera`
  camera.updateProjectionMatrix()
  visual.add(camera)
  const helper = new THREE.CameraHelper(camera)
  helper.name = `${state.name} frustum`
  helper.userData.directorCameraId = state.id
  const helperColor = new THREE.Color(color)
  helper.setColors(helperColor, helperColor, helperColor, helperColor, helperColor)
  return { camera, visual, helper }
}

function clearDirectorCameraRigs(runtime: DirectorRuntime): void {
  for (const rig of runtime.cameraRigs.values()) {
    runtime.cameraRoot.remove(rig.helper)
    runtime.cameraRoot.remove(rig.visual)
    rig.helper.dispose()
    disposeObject(rig.visual)
  }
  runtime.cameraRigs.clear()
}

function syncDirectorCameraRigs(runtime: DirectorRuntime, scene: DirectorSceneState): void {
  clearDirectorCameraRigs(runtime)
  const colors = [0x67e8f9, 0xa78bfa, 0xfbbf24, 0x34d399, 0xfb7185, 0x60a5fa]
  const aspect = DIRECTOR_ASPECT_VALUES[scene.aspect_ratio]
  scene.cameras.forEach((camera, index) => {
    const rig = createDirectorCameraRig(camera, aspect, colors[index % colors.length])
    runtime.cameraRoot.add(rig.visual)
    runtime.cameraRoot.add(rig.helper)
    runtime.cameraRigs.set(camera.id, rig)
  })
  runtime.scene.updateMatrixWorld(true)
  for (const rig of runtime.cameraRigs.values()) rig.helper.update()
}

function setDirectorCameraRigVisibility(runtime: DirectorRuntime, visible: boolean): void {
  for (const rig of runtime.cameraRigs.values()) {
    rig.visual.visible = visible
    rig.helper.visible = visible
  }
}

function applyRuntimeCameraView(
  runtime: DirectorRuntime,
  scene: DirectorSceneState,
  mode: "overview" | "camera",
): void {
  runtime.cameraViewMode = mode
  const pose = mode === "overview" ? scene.viewport_camera : activeDirectorCamera(scene)
  runtime.camera.position.set(...pose.position)
  runtime.camera.fov = pose.fov
  runtime.camera.updateProjectionMatrix()
  runtime.orbit.target.set(...pose.target)
  runtime.orbit.update()
  setDirectorCameraRigVisibility(runtime, mode === "overview")
}

function anatomicalJointForStage(joint: DirectorMannequinJoint): DirectorMannequinJoint {
  if (joint.startsWith("left")) return `right${joint.slice(4)}` as DirectorMannequinJoint
  if (joint.startsWith("right")) return `left${joint.slice(5)}` as DirectorMannequinJoint
  return joint
}

function resolveCustomRigBones(
  gltf: GLTF,
  humanoid: DirectorModelHumanoid,
): DirectorRigJointBones {
  const objectsByNode = new Map<number, THREE.Bone>()
  gltf.scene.traverse((child) => {
    if (!(child instanceof THREE.Bone)) return
    const association = gltf.parser.associations.get(child) as { nodes?: number } | undefined
    if (Number.isInteger(association?.nodes)) objectsByNode.set(association!.nodes!, child)
  })
  const result: DirectorRigJointBones = {}
  for (const stageJoint of DIRECTOR_MANNEQUIN_JOINTS) {
    const sourceJoint = anatomicalJointForStage(stageJoint)
    const node = humanoid.joint_node_map[sourceJoint]
    const target = node === undefined ? undefined : objectsByNode.get(node)
    if (target) result[stageJoint] = target
  }
  return result
}

function stopRuntimeMixers(runtime: DirectorRuntime): void {
  for (const mixer of runtime.mixers.values()) {
    mixer.stopAllAction()
    mixer.uncacheRoot(mixer.getRoot())
  }
  runtime.mixers.clear()
}

function stopRuntimeMixer(runtime: DirectorRuntime, objectId: string): void {
  const mixer = runtime.mixers.get(objectId)
  if (!mixer) return
  mixer.stopAllAction()
  mixer.uncacheRoot(mixer.getRoot())
  runtime.mixers.delete(objectId)
}

function removeRuntimeObject(runtime: DirectorRuntime, objectId: string): void {
  runtime.objectBuildTokens.set(objectId, (runtime.objectBuildTokens.get(objectId) || 0) + 1)
  stopRuntimeMixer(runtime, objectId)
  const root = runtime.objectRoots.get(objectId)
  if (!root) return
  if (runtime.transform.object === root) runtime.transform.detach()
  runtime.root.remove(root)
  runtime.objectRoots.delete(objectId)
  disposeObject(root)
}

function snapshotRuntimeScene(runtime: DirectorRuntime, base: DirectorSceneState): DirectorSceneState {
  const next = cloneDirectorScene(base)
  next.cameras = next.cameras.map((camera) => {
    const rig = runtime.cameraRigs.get(camera.id)
    if (!rig) return camera
    const position = rig.visual.position.toArray() as [number, number, number]
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.visual.quaternion).normalize()
    const distance = Math.max(0.25, Number(rig.visual.userData.focusDistance) || 1)
    const target = new THREE.Vector3(...position).addScaledVector(direction, distance)
    return { ...camera, position, target: target.toArray() as [number, number, number] }
  })
  if (runtime.cameraViewMode === "camera") {
    next.cameras = next.cameras.map((camera) => camera.id === next.active_camera_id
      ? {
          ...camera,
          position: runtime.camera.position.toArray() as [number, number, number],
          target: runtime.orbit.target.toArray() as [number, number, number],
          fov: runtime.camera.fov,
        }
      : camera)
  } else {
    next.viewport_camera = {
      position: runtime.camera.position.toArray() as [number, number, number],
      target: runtime.orbit.target.toArray() as [number, number, number],
      fov: runtime.camera.fov,
    }
  }
  syncLegacyActiveCamera(next)
  next.objects = next.objects.map((object) => {
    const root = runtime.objectRoots.get(object.id)
    if (!root) return object
    return {
      ...object,
      position: root.position.toArray() as [number, number, number],
      rotation: [root.rotation.x, root.rotation.y, root.rotation.z],
      scale: root.scale.toArray() as [number, number, number],
      visible: root.visible,
    }
  })
  return next
}

function actorLegend(
  scene: DirectorSceneState,
  modelAssets: DirectorModelAsset[] = [],
): DirectorActorLegendItem[] {
  const humanoidAssetIds = new Set(
    modelAssets.filter((asset) => asset.analysis?.humanoid.recognized).map((asset) => asset.id),
  )
  return scene.objects
    .filter((item) => item.asset_id === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID || humanoidAssetIds.has(item.asset_id))
    .map((item) => ({ label: item.name, color: item.color, object_id: item.id }))
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function modelClipCounts(analysis: DirectorModelAsset["analysis"]): { poses: number; animations: number } {
  if (!analysis) return { poses: 0, animations: 0 }
  return {
    poses: analysis.animations.filter((item) => item.kind === "pose").length,
    animations: analysis.animations.filter((item) => item.kind === "animation").length,
  }
}

function resizeDirectorRuntime(runtime: DirectorRuntime): void {
  if (runtime.disposed) return
  const rect = runtime.viewport.getBoundingClientRect()
  const aspect = DIRECTOR_ASPECT_VALUES[directorAspect(runtime)]
  let width = Math.max(320, rect.width - 30)
  let height = width / aspect
  if (height > rect.height - 30) {
    height = Math.max(220, rect.height - 30)
    width = height * aspect
  }
  runtime.renderer.setSize(Math.floor(width), Math.floor(height), true)
  runtime.camera.aspect = aspect
  runtime.camera.updateProjectionMatrix()
}

function directorAspect(runtime: DirectorRuntime): DirectorAspectRatio {
  const value = runtime.root.userData.aspectRatio
  return value === "9:16" || value === "1:1" || value === "4:3" ? value : "16:9"
}

export default function DirectorDesk({
  projectId,
  projectTitle,
  canvasPosition,
  onClose,
  onCapturePromoted,
}: DirectorDeskProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const runtimeRef = useRef<DirectorRuntime | null>(null)
  const directorRef = useRef<DirectorDeskState>(defaultDirectorDesk())
  const rebuildRuntimeRef = useRef<() => void>(() => undefined)
  const undoRef = useRef<DirectorSceneState[]>([])
  const redoRef = useRef<DirectorSceneState[]>([])
  const interactionBeforeRef = useRef<DirectorSceneState | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const promotionOffsetRef = useRef(0)
  const draggedCaptureRef = useRef<string | null>(null)
  const placementModeRef = useRef<"ground" | "free">("ground")
  const transformModeRef = useRef<DirectorTransformMode>("translate")
  const cameraViewModeRef = useRef<"overview" | "camera">("overview")
  const snapToGridRef = useRef(false)
  const [director, setDirector] = useState<DirectorDeskState>(() => defaultDirectorDesk())
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingModels, setLoadingModels] = useState(0)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<DirectorTransformMode>("translate")
  const [capturing, setCapturing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showThirds, setShowThirds] = useState(false)
  const [leftPanelTab, setLeftPanelTab] = useState<"library" | "scene" | "cameras">("library")
  const [cameraViewMode, setCameraViewMode] = useState<"overview" | "camera">("overview")
  const [placementMode, setPlacementMode] = useState<"ground" | "free">("ground")
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [selectedJoint, setSelectedJoint] = useState<DirectorMannequinJoint>("spine")

  const setLocalDirector = useCallback((next: DirectorDeskState) => {
    directorRef.current = next
    setDirector(next)
  }, [])

  const mergeServerDirector = useCallback((raw: unknown, preserveScene = true) => {
    const server = normalizeDirectorDesk(raw)
    const current = directorRef.current
    const merged = preserveScene ? { ...server, scene: current.scene } : server
    setLocalDirector(merged)
    return merged
  }, [setLocalDirector])

  const saveSceneRequest = useCallback(async (scene: DirectorSceneState) => {
    setSaving(true)
    try {
      const response = await saveProjectDirectorScene<DirectorApiResponse>(projectId, {
        scene: scene as unknown as Record<string, unknown>,
        expected_revision: directorRef.current.revision,
      })
      mergeServerDirector(response.director, true)
      setError(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      throw saveError
    } finally {
      setSaving(false)
    }
  }, [mergeServerDirector, projectId])

  const enqueueSceneSave = useCallback((scene: DirectorSceneState) => {
    const snapshot = cloneDirectorScene(scene)
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveSceneRequest(snapshot))
    return saveQueueRef.current
  }, [saveSceneRequest])

  const replaceScene = useCallback((scene: DirectorSceneState, recordHistory = true) => {
    const current = directorRef.current
    if (recordHistory) {
      undoRef.current = [...undoRef.current.slice(-49), cloneDirectorScene(current.scene)]
      redoRef.current = []
    }
    setLocalDirector({ ...current, scene: cloneDirectorScene(scene) })
    setSelectedObjectId(null)
    setSelectedCameraId(scene.active_camera_id)
    rebuildRuntimeRef.current()
    void enqueueSceneSave(scene)
  }, [enqueueSceneSave, setLocalDirector])

  const commitRuntimeScene = useCallback((before?: DirectorSceneState | null) => {
    const runtime = runtimeRef.current
    if (!runtime) return
    const current = directorRef.current
    const nextScene = snapshotRuntimeScene(runtime, current.scene)
    if (before) {
      undoRef.current = [...undoRef.current.slice(-49), cloneDirectorScene(before)]
      redoRef.current = []
    }
    setLocalDirector({ ...current, scene: nextScene })
    void enqueueSceneSave(nextScene)
  }, [enqueueSceneSave, setLocalDirector])

  const buildRuntimeObject = useCallback((
    runtime: DirectorRuntime,
    object: DirectorObjectState,
    asset?: DirectorModelAsset,
  ) => {
    const token = (runtime.objectBuildTokens.get(object.id) || 0) + 1
    runtime.objectBuildTokens.set(object.id, token)
    const loader = new GLTFLoader()
    const root = new THREE.Group()
    root.userData.directorObjectId = object.id
    root.name = object.name
    applyObjectTransform(root, object)
    runtime.objectRoots.set(object.id, root)
    runtime.root.add(root)
    const isCurrent = () => (
      !runtime.disposed
      && runtime.objectBuildTokens.get(object.id) === token
      && runtime.objectRoots.get(object.id) === root
    )
    if (object.asset_id === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID) {
      const placeholder = createBuiltinModel("builtin:cylinder", object.color)
      placeholder.name = "人体模型加载中"
      placeholder.scale.set(0.34, 1.28, 0.34)
      root.add(placeholder)
      setLoadingModels((value) => value + 1)
      void createDirectorMannequin(object.mannequin, object.color).then((content) => {
        if (!isCurrent()) {
          disposeObject(content)
          return
        }
        root.remove(placeholder)
        disposeObject(placeholder)
        root.add(content)
      }).catch((loadError) => {
        root.userData.loadError = loadError instanceof Error ? loadError.message : String(loadError)
      }).finally(() => {
        setLoadingModels((value) => Math.max(0, value - 1))
      })
      return
    }
    if (object.asset_id.startsWith("builtin:")) {
      root.add(createBuiltinModel(object.asset_id, object.color))
      return
    }
    const placeholder = createBuiltinModel("builtin:cube", "#52525b")
    placeholder.name = "模型加载中"
    root.add(placeholder)
    if (!asset) {
      root.userData.loadError = "模型资产不存在"
      return
    }
    setLoadingModels((value) => value + 1)
    void loader.loadAsync(resolveMediaUrl(asset.url)).then((gltf) => {
      if (!isCurrent()) {
        disposeObject(gltf.scene)
        return
      }
      root.remove(placeholder)
      disposeObject(placeholder)
      const model = gltf.scene
      const analysis = asset.analysis
      const rig = normalizeDirectorCustomRig(object.rig, asset)
      model.updateMatrixWorld(true)
      const restBox = new THREE.Box3().setFromObject(model)
      const restSize = restBox.getSize(new THREE.Vector3())
      if (rig.mode === "pose" && analysis?.humanoid.recognized) {
        applyDirectorRigPose(model, rig, resolveCustomRigBones(gltf, analysis.humanoid))
      } else if (rig.mode === "animation" && gltf.animations.length > 0) {
        const clip = (rig.animation_index === null ? undefined : gltf.animations[rig.animation_index])
          || gltf.animations.find((item) => item.name === rig.animation_name)
          || gltf.animations[0]
        const clipDescriptor = analysis?.animations.find((item) => item.index === rig.animation_index)
          || analysis?.animations.find((item) => item.name === clip.name)
        const isNativePose = clipDescriptor?.kind === "pose"
        const mixer = new THREE.AnimationMixer(model)
        const action = mixer.clipAction(clip)
        action.enabled = true
        action.timeScale = isNativePose ? 1 : rig.animation_speed
        action.clampWhenFinished = isNativePose || !rig.animation_loop
        action.setLoop(
          isNativePose || !rig.animation_loop ? THREE.LoopOnce : THREE.LoopRepeat,
          isNativePose || !rig.animation_loop ? 1 : Infinity,
        )
        action.play()
        if (isNativePose) {
          mixer.setTime(Math.max(0, clip.duration))
          action.paused = true
        } else {
          action.paused = !rig.animation_playing
          mixer.update(0)
        }
        runtime.mixers.set(object.id, mixer)
      }
      model.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const largest = Math.max(restSize.x, restSize.y, restSize.z, 0.001)
      const normalizationExtent = analysis?.humanoid.recognized
        ? Math.max(restSize.y, 0.001)
        : largest
      const normalizedScale = 1.8 / normalizationExtent
      const content = new THREE.Group()
      content.name = `${asset.name} normalization frame`
      content.add(model)
      content.scale.setScalar(normalizedScale)
      content.position.set(-center.x * normalizedScale, -box.min.y * normalizedScale, -center.z * normalizedScale)
      content.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      root.add(content)
    }).catch((loadError) => {
      root.userData.loadError = loadError instanceof Error ? loadError.message : String(loadError)
    }).finally(() => {
      setLoadingModels((value) => Math.max(0, value - 1))
    })
  }, [])

  const rebuildRuntimeObject = useCallback((objectId: string) => {
    const runtime = runtimeRef.current
    if (!runtime || runtime.disposed) return
    const state = directorRef.current
    const object = state.scene.objects.find((item) => item.id === objectId)
    removeRuntimeObject(runtime, objectId)
    if (!object) return
    const asset = state.model_assets.find((item) => item.id === object.asset_id)
    buildRuntimeObject(runtime, object, asset)
  }, [buildRuntimeObject])

  const rebuildRuntime = useCallback(() => {
    const runtime = runtimeRef.current
    if (!runtime || runtime.disposed) return
    runtime.transform.detach()
    stopRuntimeMixers(runtime)
    for (const objectId of [...runtime.objectRoots.keys()]) removeRuntimeObject(runtime, objectId)
    const state = directorRef.current
    const modelById = new Map(state.model_assets.map((asset) => [asset.id, asset]))
    for (const object of state.scene.objects) {
      buildRuntimeObject(runtime, object, modelById.get(object.asset_id))
    }
    syncDirectorCameraRigs(runtime, state.scene)
    applyRuntimeCameraView(runtime, state.scene, cameraViewModeRef.current)
    runtime.root.userData.aspectRatio = state.scene.aspect_ratio
    resizeDirectorRuntime(runtime)
  }, [buildRuntimeObject])

  rebuildRuntimeRef.current = rebuildRuntime

  useEffect(() => {
    let canceled = false
    setLoaded(false)
    setError(null)
    void getProjectDirector<DirectorApiResponse>(projectId).then((response) => {
      if (canceled) return
      const next = normalizeDirectorDesk(response.director)
      setLocalDirector(next)
      setSelectedCameraId(next.scene.active_camera_id)
      setSelectedCaptureId(next.captures[0]?.id || null)
      setLoaded(true)
    }).catch((loadError) => {
      if (canceled) return
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setLoaded(true)
    })
    return () => { canceled = true }
  }, [projectId, setLocalDirector])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !loaded) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x090d14)
    scene.fog = new THREE.Fog(0x090d14, 18, 42)
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 500)
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.domElement.className = "absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-lg shadow-2xl"
    renderer.domElement.tabIndex = 0
    viewport.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x18181b, 1.8))
    const key = new THREE.DirectionalLight(0xffffff, 2.6)
    key.position.set(5, 9, 4)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.8)
    fill.position.set(-5, 4, -3)
    scene.add(fill)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x171c26, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(40, 40, 0x52627a, 0x283244)
    grid.position.y = 0.002
    scene.add(grid)
    const root = new THREE.Group()
    scene.add(root)
    const cameraRoot = new THREE.Group()
    cameraRoot.name = "director camera rigs"
    scene.add(cameraRoot)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.1
    orbit.rotateSpeed = 0.68
    orbit.zoomSpeed = 0.78
    orbit.panSpeed = 0.72
    orbit.screenSpacePanning = false
    orbit.zoomToCursor = true
    orbit.minDistance = 0.5
    orbit.maxDistance = 60
    orbit.maxPolarAngle = Math.PI * 0.495
    const transform = new TransformControls(camera, renderer.domElement)
    transform.setMode("translate")
    transform.size = 0.82
    transform.showY = false
    transform.showXY = false
    transform.showYZ = false
    transform.showXZ = true
    renderer.domElement.style.cursor = "grab"
    const transformHelper = transform.getHelper()
    scene.add(transformHelper)

    const resizeObserver = new ResizeObserver(() => {
      const active = runtimeRef.current
      if (active) resizeDirectorRuntime(active)
    })
    const runtime: DirectorRuntime = {
      renderer,
      scene,
      camera,
      orbit,
      transform,
      transformHelper,
      root,
      cameraRoot,
      grid,
      objectRoots: new Map(),
      cameraRigs: new Map(),
      mixers: new Map(),
      objectBuildTokens: new Map(),
      resizeObserver,
      viewport,
      cameraViewMode: cameraViewModeRef.current,
      disposed: false,
    }
    runtimeRef.current = runtime
    runtime.root.userData.aspectRatio = directorRef.current.scene.aspect_ratio
    resizeObserver.observe(viewport)
    rebuildRuntimeRef.current()

    const pointerStart = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const planePoint = new THREE.Vector3()
    let planeDrag: {
      pointerId: number
      root: THREE.Group
      objectId: string
      y: number
      offsetX: number
      offsetZ: number
      before: DirectorSceneState
      moved: boolean
    } | null = null
    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
    }
    const rootAtPointer = (event: PointerEvent): THREE.Group | null => {
      updatePointer(event)
      const hits = raycaster.intersectObjects([...runtime.objectRoots.values()], true)
      let selected: THREE.Object3D | null = hits[0]?.object || null
      while (selected && selected.parent !== root) selected = selected.parent
      return selected instanceof THREE.Group ? selected : null
    }
    const cameraAtPointer = (event: PointerEvent): THREE.Group | null => {
      if (runtime.cameraViewMode !== "overview") return null
      updatePointer(event)
      const hits = raycaster.intersectObjects(
        [...runtime.cameraRigs.values()].map((item) => item.visual),
        true,
      )
      let selected: THREE.Object3D | null = hits[0]?.object || null
      while (selected && selected.parent !== runtime.cameraRoot) selected = selected.parent
      return selected instanceof THREE.Group ? selected : null
    }
    const selectCamera = (cameraId: string) => {
      const current = directorRef.current
      if (!current.scene.cameras.some((item) => item.id === cameraId)) return
      const sceneState = cloneDirectorScene(current.scene)
      sceneState.active_camera_id = cameraId
      syncLegacyActiveCamera(sceneState)
      setLocalDirector({ ...current, scene: sceneState })
      setSelectedObjectId(null)
      setSelectedCameraId(cameraId)
      applyRuntimeCameraView(runtime, sceneState, cameraViewModeRef.current)
      void enqueueSceneSave(sceneState)
    }
    const onPointerDown = (event: PointerEvent) => {
      pointerStart.set(event.clientX, event.clientY)
      if (
        event.button !== 0
        || placementModeRef.current !== "ground"
        || transformModeRef.current !== "translate"
        || transform.axis
      ) return
      if (cameraAtPointer(event)) return
      const selectedRoot = rootAtPointer(event)
      const objectId = selectedRoot?.userData.directorObjectId
      if (!selectedRoot || typeof objectId !== "string") return
      const object = directorRef.current.scene.objects.find((item) => item.id === objectId)
      if (!object || object.locked) {
        setSelectedCameraId(null)
        setSelectedObjectId(objectId)
        return
      }
      groundPlane.constant = -selectedRoot.position.y
      updatePointer(event)
      if (!raycaster.ray.intersectPlane(groundPlane, planePoint)) return
      planeDrag = {
        pointerId: event.pointerId,
        root: selectedRoot,
        objectId,
        y: selectedRoot.position.y,
        offsetX: selectedRoot.position.x - planePoint.x,
        offsetZ: selectedRoot.position.z - planePoint.z,
        before: snapshotRuntimeScene(runtime, directorRef.current.scene),
        moved: false,
      }
      setSelectedCameraId(null)
      setSelectedObjectId(objectId)
      orbit.enabled = false
      renderer.domElement.style.cursor = "grabbing"
      renderer.domElement.setPointerCapture(event.pointerId)
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!planeDrag || planeDrag.pointerId !== event.pointerId) return
      updatePointer(event)
      groundPlane.constant = -planeDrag.y
      if (!raycaster.ray.intersectPlane(groundPlane, planePoint)) return
      let x = planePoint.x + planeDrag.offsetX
      let z = planePoint.z + planeDrag.offsetZ
      if (snapToGridRef.current) {
        x = Math.round(x / 0.25) * 0.25
        z = Math.round(z / 0.25) * 0.25
      }
      planeDrag.root.position.set(x, planeDrag.y, z)
      planeDrag.moved = planeDrag.moved || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 2
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const finishPlaneDrag = (event: PointerEvent) => {
      if (!planeDrag || planeDrag.pointerId !== event.pointerId) return false
      const completed = planeDrag
      planeDrag = null
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
      orbit.enabled = true
      renderer.domElement.style.cursor = "grab"
      if (completed.moved) commitRuntimeScene(completed.before)
      event.preventDefault()
      event.stopImmediatePropagation()
      return true
    }
    const onPointerUp = (event: PointerEvent) => {
      if (finishPlaneDrag(event)) return
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5 || transform.axis) return
      const selectedCamera = cameraAtPointer(event)
      const cameraId = selectedCamera?.userData.directorCameraId
      if (typeof cameraId === "string") {
        selectCamera(cameraId)
        return
      }
      const selected = rootAtPointer(event)
      const id = selected?.userData.directorObjectId
      setSelectedCameraId(null)
      setSelectedObjectId(typeof id === "string" ? id : null)
    }
    const onPointerCancel = (event: PointerEvent) => { finishPlaneDrag(event) }
    renderer.domElement.addEventListener("pointerdown", onPointerDown, true)
    renderer.domElement.addEventListener("pointermove", onPointerMove, true)
    renderer.domElement.addEventListener("pointerup", onPointerUp, true)
    renderer.domElement.addEventListener("pointercancel", onPointerCancel, true)

    const onTransformStart = () => {
      interactionBeforeRef.current = snapshotRuntimeScene(runtime, directorRef.current.scene)
    }
    const onTransformEnd = () => {
      commitRuntimeScene(interactionBeforeRef.current)
      interactionBeforeRef.current = null
    }
    const onDraggingChanged = (event: { value?: unknown }) => {
      orbit.enabled = event.value !== true
    }
    const onOrbitStart = () => {
      interactionBeforeRef.current = snapshotRuntimeScene(runtime, directorRef.current.scene)
    }
    const onOrbitEnd = () => {
      if (!transform.dragging) {
        commitRuntimeScene(interactionBeforeRef.current)
        interactionBeforeRef.current = null
      }
    }
    transform.addEventListener("mouseDown", onTransformStart)
    transform.addEventListener("mouseUp", onTransformEnd)
    transform.addEventListener("dragging-changed", onDraggingChanged)
    orbit.addEventListener("start", onOrbitStart)
    orbit.addEventListener("end", onOrbitEnd)

    const clock = new THREE.Clock()
    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.1)
      for (const mixer of runtime.mixers.values()) mixer.update(delta)
      orbit.update()
      runtime.scene.updateMatrixWorld(true)
      for (const rig of runtime.cameraRigs.values()) rig.helper.update()
      renderer.render(scene, camera)
    })

    return () => {
      runtime.disposed = true
      renderer.setAnimationLoop(null)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener("pointerdown", onPointerDown, true)
      renderer.domElement.removeEventListener("pointermove", onPointerMove, true)
      renderer.domElement.removeEventListener("pointerup", onPointerUp, true)
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel, true)
      transform.removeEventListener("mouseDown", onTransformStart)
      transform.removeEventListener("mouseUp", onTransformEnd)
      transform.removeEventListener("dragging-changed", onDraggingChanged)
      orbit.removeEventListener("start", onOrbitStart)
      orbit.removeEventListener("end", onOrbitEnd)
      transform.detach()
      stopRuntimeMixers(runtime)
      clearDirectorCameraRigs(runtime)
      transform.dispose()
      orbit.dispose()
      for (const object of runtime.objectRoots.values()) disposeObject(object)
      ground.geometry.dispose()
      ;(ground.material as THREE.Material).dispose()
      renderer.dispose()
      renderer.domElement.remove()
      if (runtimeRef.current === runtime) runtimeRef.current = null
    }
  }, [commitRuntimeScene, enqueueSceneSave, loaded, setLocalDirector])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.grid.visible = showGrid
  }, [showGrid])

  useEffect(() => {
    transformModeRef.current = transformMode
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.transform.setMode(transformMode)
  }, [transformMode])

  useEffect(() => {
    placementModeRef.current = placementMode
    snapToGridRef.current = snapToGrid
    const runtime = runtimeRef.current
    if (!runtime) return
    const editingCamera = Boolean(selectedCameraId) && cameraViewMode === "overview"
    const groundTranslate = !editingCamera && placementMode === "ground" && transformMode === "translate"
    runtime.transform.showX = true
    runtime.transform.showY = !groundTranslate
    runtime.transform.showZ = true
    runtime.transform.showXY = !groundTranslate
    runtime.transform.showYZ = !groundTranslate
    runtime.transform.showXZ = true
    runtime.transform.translationSnap = placementMode === "ground" && snapToGrid ? 0.25 : null
    runtime.renderer.domElement.style.cursor = groundTranslate ? "grab" : "default"
  }, [cameraViewMode, placementMode, selectedCameraId, snapToGrid, transformMode])

  useEffect(() => {
    cameraViewModeRef.current = cameraViewMode
    const runtime = runtimeRef.current
    if (!runtime) return
    applyRuntimeCameraView(runtime, directorRef.current.scene, cameraViewMode)
  }, [cameraViewMode])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    const object = selectedObjectId
      ? director.scene.objects.find((item) => item.id === selectedObjectId)
      : null
    const root = selectedObjectId ? runtime.objectRoots.get(selectedObjectId) : null
    const cameraRig = selectedCameraId ? runtime.cameraRigs.get(selectedCameraId) : null
    if (cameraViewMode === "overview" && cameraRig && transformMode !== "scale") {
      runtime.transform.attach(cameraRig.visual)
    } else if (root && object && !object.locked) runtime.transform.attach(root)
    else runtime.transform.detach()
  }, [cameraViewMode, director.scene.objects, selectedCameraId, selectedObjectId, transformMode])

  const undo = useCallback(() => {
    const previous = undoRef.current.pop()
    if (!previous) return
    redoRef.current.push(cloneDirectorScene(directorRef.current.scene))
    replaceScene(previous, false)
  }, [replaceScene])

  const redo = useCallback(() => {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(cloneDirectorScene(directorRef.current.scene))
    replaceScene(next, false)
  }, [replaceScene])

  const selectedObject = useMemo(
    () => director.scene.objects.find((item) => item.id === selectedObjectId) || null,
    [director.scene.objects, selectedObjectId],
  )
  const selectedCamera = useMemo(
    () => director.scene.cameras.find((item) => item.id === selectedCameraId)
      || activeDirectorCamera(director.scene),
    [director.scene, selectedCameraId],
  )
  const selectedMannequin = useMemo(
    () => selectedObject?.asset_id === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID
      ? normalizeDirectorMannequin(selectedObject.mannequin)
      : null,
    [selectedObject],
  )
  const selectedCustomAsset = useMemo(
    () => selectedObject && !selectedObject.asset_id.startsWith("builtin:")
      ? director.model_assets.find((asset) => asset.id === selectedObject.asset_id) || null
      : null,
    [director.model_assets, selectedObject],
  )
  const selectedCustomRig = useMemo(
    () => selectedCustomAsset && selectedObject
      ? normalizeDirectorCustomRig(selectedObject.rig, selectedCustomAsset)
      : null,
    [selectedCustomAsset, selectedObject],
  )
  const selectedNativePoseClips = useMemo(
    () => selectedCustomAsset?.analysis?.animations.filter((item) => item.kind === "pose") || [],
    [selectedCustomAsset],
  )
  const selectedContinuousAnimationClips = useMemo(
    () => selectedCustomAsset?.analysis?.animations.filter((item) => item.kind === "animation") || [],
    [selectedCustomAsset],
  )
  const selectedNativeClip = useMemo(
    () => selectedCustomRig
      ? selectedCustomAsset?.analysis?.animations.find((item) => item.index === selectedCustomRig.animation_index)
        || selectedCustomAsset?.analysis?.animations.find((item) => item.name === selectedCustomRig.animation_name)
        || null
      : null,
    [selectedCustomAsset, selectedCustomRig],
  )

  const addObject = useCallback((assetId: string, defaultName: string) => {
    const scene = cloneDirectorScene(directorRef.current.scene)
    const asset = directorRef.current.model_assets.find((item) => item.id === assetId)
    const object = newDirectorObject(assetId, defaultName, scene.objects, asset)
    scene.objects.push(object)
    replaceScene(scene, true)
    setSelectedCameraId(null)
    setSelectedObjectId(object.id)
  }, [replaceScene])

  const deleteSelectedObject = useCallback(() => {
    if (!selectedObjectId) return
    const scene = cloneDirectorScene(directorRef.current.scene)
    scene.objects = scene.objects.filter((item) => item.id !== selectedObjectId)
    replaceScene(scene, true)
  }, [replaceScene, selectedObjectId])

  const duplicateSelectedObject = useCallback(() => {
    const source = directorRef.current.scene.objects.find((item) => item.id === selectedObjectId)
    if (!source) return
    const scene = cloneDirectorScene(directorRef.current.scene)
    const copy: DirectorObjectState = {
      ...source,
      id: createDirectorId("object"),
      name: `${source.name} 副本`,
      position: [source.position[0] + 0.45, source.position[1], source.position[2] + 0.25],
    }
    scene.objects.push(copy)
    replaceScene(scene, true)
    setSelectedCameraId(null)
    setSelectedObjectId(copy.id)
  }, [replaceScene, selectedObjectId])

  const updateSelectedObject = useCallback((patch: Partial<DirectorObjectState>) => {
    if (!selectedObjectId) return
    const current = directorRef.current
    const previousObject = current.scene.objects.find((item) => item.id === selectedObjectId)
    if (!previousObject) return
    const nextObject = { ...previousObject, ...patch }
    const scene = cloneDirectorScene(current.scene)
    scene.objects = scene.objects.map((item) => item.id === selectedObjectId ? nextObject : item)
    undoRef.current = [...undoRef.current.slice(-49), cloneDirectorScene(current.scene)]
    redoRef.current = []
    setLocalDirector({ ...current, scene })
    const contentChanged = ["asset_id", "color", "mannequin", "rig"].some((key) => key in patch)
    const runtime = runtimeRef.current
    const root = runtime?.objectRoots.get(selectedObjectId)
    if (contentChanged || !runtime || !root) {
      rebuildRuntimeObject(selectedObjectId)
    } else {
      root.name = nextObject.name
      applyObjectTransform(root, nextObject)
    }
    void enqueueSceneSave(scene)
    setSelectedObjectId(selectedObjectId)
  }, [enqueueSceneSave, rebuildRuntimeObject, selectedObjectId, setLocalDirector])

  const updateSelectedMannequin = useCallback((
    updater: (current: ReturnType<typeof normalizeDirectorMannequin>) => ReturnType<typeof normalizeDirectorMannequin>,
  ) => {
    if (!selectedObject || selectedObject.asset_id !== DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID) return
    const current = normalizeDirectorMannequin(selectedObject.mannequin)
    updateSelectedObject({ mannequin: normalizeDirectorMannequin(updater(current)) })
  }, [selectedObject, updateSelectedObject])

  const applyBodyPreset = useCallback((presetId: Exclude<DirectorMannequinBodyPreset, "custom">) => {
    updateSelectedMannequin((current) => applyDirectorMannequinBodyPreset(current, presetId))
  }, [updateSelectedMannequin])

  const applyPosePreset = useCallback((presetId: Exclude<DirectorMannequinPosePreset, "custom">) => {
    updateSelectedMannequin((current) => applyDirectorMannequinPosePreset(current, presetId))
  }, [updateSelectedMannequin])

  const updateMannequinProportion = useCallback((
    key: keyof DirectorMannequinProportions,
    value: number,
  ) => {
    if (!Number.isFinite(value)) return
    updateSelectedMannequin((current) => ({
      ...current,
      body_preset: "custom",
      proportions: { ...current.proportions, [key]: value },
    }))
  }, [updateSelectedMannequin])

  const updateMannequinJoint = useCallback((axis: number, value: number) => {
    if (!Number.isFinite(value)) return
    updateSelectedMannequin((current) => {
      const rotation = [...current.joints[selectedJoint]] as [number, number, number]
      rotation[axis] = value
      return {
        ...current,
        pose_preset: "custom",
        joints: { ...current.joints, [selectedJoint]: rotation },
      }
    })
  }, [selectedJoint, updateSelectedMannequin])

  const resetMannequinJoint = useCallback(() => {
    updateSelectedMannequin((current) => ({
      ...current,
      pose_preset: "custom",
      joints: { ...current.joints, [selectedJoint]: [0, 0, 0] },
    }))
  }, [selectedJoint, updateSelectedMannequin])

  const updateSelectedCustomRig = useCallback((
    updater: (current: DirectorCustomRigState) => DirectorCustomRigState,
  ) => {
    if (!selectedObject || !selectedCustomAsset) return
    const current = normalizeDirectorCustomRig(selectedObject.rig, selectedCustomAsset)
    updateSelectedObject({ rig: normalizeDirectorCustomRig(updater(current), selectedCustomAsset) })
  }, [selectedCustomAsset, selectedObject, updateSelectedObject])

  const applyCustomPosePreset = useCallback((presetId: Exclude<DirectorMannequinPosePreset, "custom">) => {
    updateSelectedCustomRig((current) => {
      const pose = applyDirectorMannequinPosePreset(
        normalizeDirectorMannequin({ pose_preset: current.pose_preset, joints: current.joints }),
        presetId,
      )
      return { ...current, mode: "pose", pose_preset: pose.pose_preset, joints: pose.joints }
    })
  }, [updateSelectedCustomRig])

  const updateCustomRigJoint = useCallback((axis: number, value: number) => {
    if (!Number.isFinite(value)) return
    updateSelectedCustomRig((current) => {
      const rotation = [...current.joints[selectedJoint]] as [number, number, number]
      rotation[axis] = value
      return {
        ...current,
        mode: "pose",
        pose_preset: "custom",
        joints: { ...current.joints, [selectedJoint]: rotation },
      }
    })
  }, [selectedJoint, updateSelectedCustomRig])

  const resetCustomRigJoint = useCallback(() => {
    updateSelectedCustomRig((current) => ({
      ...current,
      mode: "pose",
      pose_preset: "custom",
      joints: { ...current.joints, [selectedJoint]: [0, 0, 0] },
    }))
  }, [selectedJoint, updateSelectedCustomRig])

  const changeVectorValue = useCallback((
    field: "position" | "rotation" | "scale",
    index: number,
    value: number,
  ) => {
    if (!selectedObject) return
    const next = [...selectedObject[field]] as [number, number, number]
    next[index] = Number.isFinite(value) ? value : next[index]
    updateSelectedObject({ [field]: next })
  }, [selectedObject, updateSelectedObject])

  const persistCameraScene = useCallback((
    scene: DirectorSceneState,
    options: { recordHistory?: boolean; rebuildRigs?: boolean } = {},
  ) => {
    const current = directorRef.current
    syncLegacyActiveCamera(scene)
    if (options.recordHistory !== false) {
      undoRef.current = [...undoRef.current.slice(-49), cloneDirectorScene(current.scene)]
      redoRef.current = []
    }
    setLocalDirector({ ...current, scene })
    const runtime = runtimeRef.current
    if (runtime) {
      if (options.rebuildRigs !== false) {
        runtime.transform.detach()
        syncDirectorCameraRigs(runtime, scene)
      }
      applyRuntimeCameraView(runtime, scene, cameraViewModeRef.current)
    }
    void enqueueSceneSave(scene)
  }, [enqueueSceneSave, setLocalDirector])

  const activateCamera = useCallback((cameraId: string, preview = false) => {
    const current = directorRef.current
    if (!current.scene.cameras.some((item) => item.id === cameraId)) return
    const runtime = runtimeRef.current
    const scene = runtime ? snapshotRuntimeScene(runtime, current.scene) : cloneDirectorScene(current.scene)
    scene.active_camera_id = cameraId
    syncLegacyActiveCamera(scene)
    setSelectedObjectId(null)
    setSelectedCameraId(cameraId)
    if (preview) setCameraViewMode("camera")
    persistCameraScene(scene, { recordHistory: false, rebuildRigs: false })
  }, [persistCameraScene])

  const switchCameraView = useCallback((mode: "overview" | "camera") => {
    const runtime = runtimeRef.current
    if (runtime) {
      const scene = snapshotRuntimeScene(runtime, directorRef.current.scene)
      setLocalDirector({ ...directorRef.current, scene })
      void enqueueSceneSave(scene)
    }
    setCameraViewMode(mode)
  }, [enqueueSceneSave, setLocalDirector])

  const addCamera = useCallback(() => {
    const current = directorRef.current
    if (current.scene.cameras.length >= MAX_DIRECTOR_CAMERAS) {
      setError(`最多可添加 ${MAX_DIRECTOR_CAMERAS} 个机位`)
      return
    }
    const runtime = runtimeRef.current
    const scene = runtime ? snapshotRuntimeScene(runtime, current.scene) : cloneDirectorScene(current.scene)
    const source = activeDirectorCamera(scene)
    const camera = newDirectorCamera(scene.cameras, source)
    scene.cameras.push(camera)
    scene.active_camera_id = camera.id
    setSelectedObjectId(null)
    setSelectedCameraId(camera.id)
    setCameraViewMode("overview")
    persistCameraScene(scene)
  }, [persistCameraScene])

  const removeSelectedCamera = useCallback(() => {
    const current = directorRef.current
    if (current.scene.cameras.length <= 1) return
    const camera = current.scene.cameras.find((item) => item.id === selectedCameraId)
      || activeDirectorCamera(current.scene)
    if (!window.confirm(`删除机位“${camera.name}”？已有截图不会删除。`)) return
    const runtime = runtimeRef.current
    const scene = runtime ? snapshotRuntimeScene(runtime, current.scene) : cloneDirectorScene(current.scene)
    const index = scene.cameras.findIndex((item) => item.id === camera.id)
    scene.cameras = scene.cameras.filter((item) => item.id !== camera.id)
    const replacement = scene.cameras[Math.min(Math.max(index, 0), scene.cameras.length - 1)]
    scene.active_camera_id = replacement.id
    setSelectedCameraId(replacement.id)
    setSelectedObjectId(null)
    setCameraViewMode("overview")
    persistCameraScene(scene)
  }, [persistCameraScene, selectedCameraId])

  const updateSelectedCamera = useCallback((patch: Partial<DirectorCameraState>) => {
    const current = directorRef.current
    const cameraId = selectedCameraId || current.scene.active_camera_id
    const runtime = runtimeRef.current
    const scene = runtime ? snapshotRuntimeScene(runtime, current.scene) : cloneDirectorScene(current.scene)
    scene.cameras = scene.cameras.map((camera) => camera.id === cameraId ? { ...camera, ...patch } : camera)
    persistCameraScene(scene)
  }, [persistCameraScene, selectedCameraId])

  const changeCameraVector = useCallback((field: "position" | "target", index: number, value: number) => {
    if (!Number.isFinite(value)) return
    const vector = [...selectedCamera[field]] as [number, number, number]
    vector[index] = value
    updateSelectedCamera({ [field]: vector })
  }, [selectedCamera, updateSelectedCamera])

  const applyCameraPreset = useCallback((preset: "front" | "three" | "high" | "top") => {
    const target: [number, number, number] = [0, 1, 0]
    updateSelectedCamera({
      target,
      position: preset === "front"
        ? [0, 2, 7]
        : preset === "three"
          ? [5.5, 3, 6]
          : preset === "high"
            ? [5, 7, 6]
            : [0.01, 10, 0.01],
    })
  }, [updateSelectedCamera])

  const captureImage = useCallback((scene: DirectorSceneState, shot: DirectorCameraState): string => {
    const runtime = runtimeRef.current
    if (!runtime) throw new Error("导演台尚未准备完成")
    const aspect = DIRECTOR_ASPECT_VALUES[scene.aspect_ratio]
    const [width, height] = aspect < 0.8
      ? [720, 1280]
      : aspect === 1
        ? [1024, 1024]
        : aspect < 1.5
          ? [1200, 900]
          : [1280, 720]
    const previousGrid = runtime.grid.visible
    const previousHelper = runtime.transformHelper.visible
    const previousCameraRoot = runtime.cameraRoot.visible
    const previousRatio = runtime.renderer.getPixelRatio()
    runtime.grid.visible = false
    runtime.transformHelper.visible = false
    runtime.cameraRoot.visible = false
    runtime.renderer.setPixelRatio(1)
    runtime.renderer.setSize(width, height, false)
    const captureCamera = new THREE.PerspectiveCamera(shot.fov, aspect, 0.05, 500)
    captureCamera.position.set(...shot.position)
    captureCamera.lookAt(new THREE.Vector3(...shot.target))
    captureCamera.updateProjectionMatrix()
    runtime.renderer.render(runtime.scene, captureCamera)
    const source = runtime.renderer.domElement
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("无法创建截图画布")
    ctx.drawImage(source, 0, 0, width, height)
    const legend = actorLegend(scene, directorRef.current.model_assets)
    if (legend.length > 0) {
      const lineHeight = Math.max(28, Math.round(height * 0.035))
      const panelWidth = Math.min(width * 0.42, 430)
      const panelHeight = lineHeight * legend.length + 28
      ctx.fillStyle = "rgba(3,7,18,.72)"
      ctx.fillRect(20, height - panelHeight - 20, panelWidth, panelHeight)
      ctx.font = `${Math.max(16, Math.round(height * 0.022))}px sans-serif`
      ctx.textBaseline = "middle"
      legend.forEach((item, index) => {
        const y = height - panelHeight + 14 + lineHeight * index
        ctx.fillStyle = item.color
        ctx.fillRect(36, y, 18, 18)
        ctx.fillStyle = "#f8fafc"
        ctx.fillText(item.label, 66, y + 9)
      })
    }
    const dataUrl = canvas.toDataURL("image/png")
    runtime.grid.visible = previousGrid
    runtime.transformHelper.visible = previousHelper
    runtime.cameraRoot.visible = previousCameraRoot
    runtime.renderer.setPixelRatio(previousRatio)
    runtime.resizeObserver.unobserve(runtime.viewport)
    runtime.resizeObserver.observe(runtime.viewport)
    const rect = runtime.viewport.getBoundingClientRect()
    let displayWidth = Math.max(320, rect.width - 30)
    let displayHeight = displayWidth / aspect
    if (displayHeight > rect.height - 30) {
      displayHeight = Math.max(220, rect.height - 30)
      displayWidth = displayHeight * aspect
    }
    runtime.renderer.setSize(Math.floor(displayWidth), Math.floor(displayHeight), true)
    runtime.camera.aspect = aspect
    runtime.camera.updateProjectionMatrix()
    return dataUrl
  }, [])

  const createCapture = useCallback(async () => {
    if (capturing || loadingModels > 0) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setCapturing(true)
    setError(null)
    try {
      const scene = snapshotRuntimeScene(runtime, directorRef.current.scene)
      setLocalDirector({ ...directorRef.current, scene })
      await enqueueSceneSave(scene)
      const legend = actorLegend(scene, directorRef.current.model_assets) as unknown as Array<Record<string, unknown>>
      const captures = scene.cameras.map((camera) => {
        const snapshot = cloneDirectorScene(scene)
        snapshot.active_camera_id = camera.id
        syncLegacyActiveCamera(snapshot)
        return {
          title: camera.name,
          camera_id: camera.id,
          camera_name: camera.name,
          data_url: captureImage(scene, camera),
          scene_snapshot: snapshot as unknown as Record<string, unknown>,
          actor_legend: legend,
        }
      })
      const response = await createProjectDirectorCaptures<DirectorApiResponse>(projectId, {
        scene: scene as unknown as Record<string, unknown>,
        captures,
        expected_revision: directorRef.current.revision,
      })
      const next = mergeServerDirector(response.director, true)
      setSelectedCaptureId(response.captures?.at(-1)?.id || next.captures.at(-1)?.id || null)
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : String(captureError))
    } finally {
      setCapturing(false)
    }
  }, [captureImage, capturing, enqueueSceneSave, loadingModels, mergeServerDirector, projectId, setLocalDirector])

  const uploadModel = useCallback(async (file: File) => {
    if (uploading) return
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("首期只支持 GLB 模型")
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("GLB 模型不能超过 50 MB")
      return
    }
    setUploading(true)
    setError(null)
    try {
      await saveQueueRef.current.catch(() => undefined)
      const response = await uploadProjectDirectorModel<DirectorApiResponse & { asset?: DirectorModelAsset }>(
        projectId,
        file,
        directorRef.current.revision,
      )
      mergeServerDirector(response.director, true)
      if (response.asset) addObject(response.asset.id, file.name.replace(/\.glb$/i, ""))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError))
    } finally {
      setUploading(false)
    }
  }, [addObject, mergeServerDirector, projectId, uploading])

  const removeModel = useCallback(async (asset: DirectorModelAsset) => {
    if (!window.confirm(`删除自定义模型“${asset.name}”？`)) return
    try {
      await saveQueueRef.current.catch(() => undefined)
      const response = await deleteProjectDirectorModel<DirectorApiResponse>(
        projectId,
        asset.id,
        directorRef.current.revision,
      )
      mergeServerDirector(response.director, true)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
    }
  }, [mergeServerDirector, projectId])

  const restoreCapture = useCallback((capture: DirectorCapture) => {
    replaceScene(capture.scene_snapshot, true)
    setSelectedCaptureId(capture.id)
  }, [replaceScene])

  const renameCapture = useCallback(async (capture: DirectorCapture) => {
    const title = window.prompt("镜头标题", capture.title)?.trim()
    if (!title || title === capture.title) return
    try {
      await saveQueueRef.current.catch(() => undefined)
      const response = await updateProjectDirectorCapture<DirectorApiResponse>(projectId, capture.id, {
        title,
        expected_revision: directorRef.current.revision,
      })
      mergeServerDirector(response.director, true)
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : String(renameError))
    }
  }, [mergeServerDirector, projectId])

  const removeCapture = useCallback(async (capture: DirectorCapture) => {
    if (!window.confirm(`从截图时间线移除“${capture.title}”？`)) return
    try {
      await saveQueueRef.current.catch(() => undefined)
      const response = await deleteProjectDirectorCapture<DirectorApiResponse>(
        projectId,
        capture.id,
        directorRef.current.revision,
      )
      const next = mergeServerDirector(response.director, true)
      setSelectedCaptureId(next.captures[0]?.id || null)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError))
    }
  }, [mergeServerDirector, projectId])

  const promoteCapture = useCallback(async (capture: DirectorCapture) => {
    if (promotingId) return
    setPromotingId(capture.id)
    setError(null)
    try {
      await saveQueueRef.current.catch(() => undefined)
      const offset = promotionOffsetRef.current * 34
      const response = await promoteProjectDirectorCapture<DirectorApiResponse>(projectId, capture.id, {
        x: canvasPosition.x + offset,
        y: canvasPosition.y + offset,
      })
      const nodeId = String(response.node?.id || "")
      mergeServerDirector(response.director, true)
      if (!nodeId) throw new Error("构图参考节点创建失败")
      if (response.created) promotionOffsetRef.current += 1
      await onCapturePromoted(nodeId, response.created === true)
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : String(promoteError))
    } finally {
      setPromotingId(null)
    }
  }, [canvasPosition.x, canvasPosition.y, mergeServerDirector, onCapturePromoted, projectId, promotingId])

  const dropCapture = useCallback(async (targetId: string) => {
    const sourceId = draggedCaptureRef.current
    draggedCaptureRef.current = null
    if (!sourceId || sourceId === targetId) return
    const ids = directorRef.current.captures.map((item) => item.id)
    const sourceIndex = ids.indexOf(sourceId)
    const targetIndex = ids.indexOf(targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    ids.splice(sourceIndex, 1)
    ids.splice(targetIndex, 0, sourceId)
    try {
      await saveQueueRef.current.catch(() => undefined)
      const response = await reorderProjectDirectorCaptures<DirectorApiResponse>(
        projectId,
        ids,
        directorRef.current.revision,
      )
      mergeServerDirector(response.director, true)
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : String(reorderError))
    }
  }, [mergeServerDirector, projectId])

  const closeDesk = useCallback(async () => {
    const runtime = runtimeRef.current
    if (runtime) {
      const scene = snapshotRuntimeScene(runtime, directorRef.current.scene)
      setLocalDirector({ ...directorRef.current, scene })
      await enqueueSceneSave(scene).catch(() => undefined)
    }
    onClose()
  }, [enqueueSceneSave, onClose, setLocalDirector])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, button")) return
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault()
        duplicateSelectedObject()
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        deleteSelectedObject()
      } else if (event.key.toLowerCase() === "w") setTransformMode("translate")
      else if (event.key.toLowerCase() === "e") setTransformMode("rotate")
      else if (event.key.toLowerCase() === "r") setTransformMode("scale")
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [deleteSelectedObject, duplicateSelectedObject, redo, undo])

  const changeAspectRatio = useCallback((aspect: DirectorAspectRatio) => {
    const scene = cloneDirectorScene(directorRef.current.scene)
    scene.aspect_ratio = aspect
    replaceScene(scene, true)
  }, [replaceScene])

  const renderVectorInputs = (
    field: "position" | "rotation" | "scale",
    values: [number, number, number],
  ) => (
    <div className="grid grid-cols-3 gap-1.5">
      {values.map((value, index) => (
        <label key={`${field}-${index}`} className="group rounded-lg border border-white/[0.075] bg-black/20 px-2 py-1.5 transition focus-within:border-violet-300/35 focus-within:bg-violet-300/[0.04]">
          <span className={cn(
            "text-[9px] font-semibold",
            index === 0 ? "text-rose-300/70" : index === 1 ? "text-emerald-300/70" : "text-sky-300/70",
          )}>{"XYZ"[index]}</span>
          <input
            type="number"
            step={field === "rotation" ? 0.1 : 0.05}
            value={Number(value.toFixed(3))}
            onChange={(event) => changeVectorValue(field, index, Number(event.target.value))}
            className="mt-0.5 w-full bg-transparent text-[11px] tabular-nums text-zinc-100 outline-none"
          />
        </label>
      ))}
    </div>
  )

  return createPortal((
    <div className="openreel-director-desk fixed inset-0 z-[100] isolate grid min-w-[960px] grid-rows-[68px_minmax(0,1fr)_208px] overflow-hidden bg-[#070910] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_-10%,rgba(139,124,255,.11),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(85,215,255,.06),transparent_28%)]" />
      <header className="relative z-30 flex items-center justify-between gap-4 border-b border-white/[0.075] bg-[#0b0e16]/95 px-4 shadow-[0_14px_45px_rgba(0,0,0,.24)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => void closeDesk()}
            className="group flex h-9 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 text-[11px] font-medium text-zinc-300 transition hover:border-violet-300/25 hover:bg-violet-300/[0.07] hover:text-white"
          >
            <DirectorIcon name="arrow-left" className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
            返回画布
          </button>
          <div className="h-7 w-px bg-white/[0.08]" />
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/20 bg-[linear-gradient(145deg,rgba(139,124,255,.22),rgba(85,215,255,.1))] text-violet-100 shadow-[0_12px_30px_rgba(83,63,205,.18)]">
            <DirectorIcon name="camera" className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold tracking-[-.01em] text-zinc-50">导演台</div>
              <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.14em] text-violet-200/80">3D blocking</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-zinc-500">
              <span className="truncate">{projectTitle || "当前项目"}</span>
              <span className="text-zinc-700">/</span>
              <span>空间构图与镜头预演</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center rounded-xl border border-white/[0.075] bg-black/20 p-1 lg:flex">
            <button type="button" title="撤销 (Ctrl/⌘ Z)" onClick={undo} disabled={undoRef.current.length === 0} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-25"><DirectorIcon name="undo" className="h-3.5 w-3.5" /></button>
            <button type="button" title="重做 (Ctrl/⌘ Shift Z)" onClick={redo} disabled={redoRef.current.length === 0} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-25"><DirectorIcon name="redo" className="h-3.5 w-3.5" /></button>
          </div>
          <div className="hidden items-center rounded-xl border border-white/[0.075] bg-black/20 p-1 md:flex">
            <button type="button" title="显示网格" onClick={() => setShowGrid((value) => !value)} className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] transition", showGrid ? "bg-violet-300/12 text-violet-100" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200")}><DirectorIcon name="grid" className="h-3.5 w-3.5" />网格</button>
            <button type="button" title="显示三分构图线" onClick={() => setShowThirds((value) => !value)} className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] transition", showThirds ? "bg-violet-300/12 text-violet-100" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200")}><DirectorIcon name="thirds" className="h-3.5 w-3.5" />三分线</button>
          </div>
          <button
            type="button"
            onClick={() => void createCapture()}
            disabled={!loaded || capturing || loadingModels > 0}
            className="group relative ml-1 flex h-10 items-center gap-2 overflow-hidden rounded-xl border border-cyan-100/25 bg-[linear-gradient(135deg,#72e4ff,#9be8ff)] px-4 text-[11px] font-semibold text-[#06121a] shadow-[0_10px_30px_rgba(85,215,255,.2)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(85,215,255,.28)] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-50"
          >
            <DirectorIcon name="camera" className="h-4 w-4" />
            {capturing ? `正在保存 ${director.scene.cameras.length} 个机位…` : loadingModels > 0 ? "模型加载中" : `截图全部机位 · ${director.scene.cameras.length}`}
          </button>
        </div>
      </header>

      <div className="relative z-10 grid min-h-0 grid-cols-[220px_minmax(0,1fr)_250px] 2xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 flex-col border-r border-white/[0.07] bg-[#0a0d14]/94">
          <div className="border-b border-white/[0.065] px-3 pb-3 pt-3">
            <div className="grid grid-cols-3 rounded-xl border border-white/[0.075] bg-black/25 p-1">
              <button type="button" onClick={() => setLeftPanelTab("library")} className={cn("flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-medium transition", leftPanelTab === "library" ? "bg-white/[0.085] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}><DirectorIcon name="sparkles" className="h-3.5 w-3.5" />素材</button>
              <button type="button" onClick={() => setLeftPanelTab("scene")} className={cn("flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-medium transition", leftPanelTab === "scene" ? "bg-white/[0.085] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}><DirectorIcon name="layers" className="h-3.5 w-3.5" />场景 <span className="rounded-full bg-black/30 px-1.5 text-[8px] tabular-nums text-zinc-400">{director.scene.objects.length}</span></button>
              <button type="button" onClick={() => setLeftPanelTab("cameras")} className={cn("flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-medium transition", leftPanelTab === "cameras" ? "bg-white/[0.085] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}><DirectorIcon name="camera" className="h-3.5 w-3.5" />机位 <span className="rounded-full bg-black/30 px-1.5 text-[8px] tabular-nums text-zinc-400">{director.scene.cameras.length}</span></button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {leftPanelTab === "library" ? (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-200">内置模型</div>
                    <div className="mt-0.5 text-[9px] text-zinc-600">点击添加到场景</div>
                  </div>
                  <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[8px] text-zinc-500">{DIRECTOR_BUILTINS.length} 项</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DIRECTOR_BUILTINS.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addObject(item.id, item.defaultName)}
                      className="group relative min-h-[92px] overflow-hidden rounded-xl border border-white/[0.075] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012))] p-2.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-violet-300/[0.065] hover:shadow-[0_12px_28px_rgba(0,0,0,.2)]"
                    >
                      <span className={cn("flex h-11 w-full items-center justify-center rounded-lg transition group-hover:scale-105", index % 3 === 0 ? "bg-violet-300/[0.08] text-violet-200/70" : index % 3 === 1 ? "bg-cyan-300/[0.07] text-cyan-200/70" : "bg-amber-300/[0.055] text-amber-100/65")}><BuiltinGlyph assetId={item.id} /></span>
                      <span className="mt-2 flex items-center justify-between text-[10px] font-medium text-zinc-300 group-hover:text-white"><span>{item.label}</span><span className="translate-x-1 text-zinc-700 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">＋</span></span>
                    </button>
                  ))}
                </div>

                <div className="mb-2 mt-5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-200">我的模型</div>
                    <div className="mt-0.5 text-[9px] text-zinc-600">支持单文件 GLB · 最大 50 MB</div>
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.085] bg-white/[0.025] px-2.5 text-[9px] font-medium text-zinc-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] hover:text-cyan-100 disabled:opacity-40"><DirectorIcon name="upload" className="h-3 w-3" />{uploading ? "上传中" : "导入"}</button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".glb,model/gltf-binary"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (file) void uploadModel(file)
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  {director.model_assets.length === 0 ? (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="group flex w-full flex-col items-center rounded-xl border border-dashed border-white/[0.09] bg-white/[0.012] px-3 py-5 text-center transition hover:border-violet-300/25 hover:bg-violet-300/[0.035]">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-zinc-600 transition group-hover:bg-violet-300/10 group-hover:text-violet-200"><DirectorIcon name="upload" className="h-3.5 w-3.5" /></span>
                      <span className="mt-2 text-[10px] text-zinc-500 group-hover:text-zinc-300">导入你的第一个 3D 模型</span>
                      <span className="mt-0.5 text-[8px] text-zinc-700">导入后可在场景中重复使用</span>
                    </button>
                  ) : director.model_assets.map((asset) => (
                    <div key={asset.id} className="group flex items-center gap-2 rounded-xl border border-white/[0.065] bg-white/[0.018] p-2 transition hover:border-white/[0.12] hover:bg-white/[0.035]">
                      <button type="button" onClick={() => addObject(asset.id, asset.name.replace(/\.glb$/i, ""))} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <DirectorModelThumbnail asset={asset} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 truncate text-[10px] text-zinc-300">
                            <span className="truncate">{asset.name}</span>
                            {asset.analysis?.humanoid.recognized ? <span className="shrink-0 rounded bg-cyan-300/10 px-1 py-0.5 text-[7px] text-cyan-200/80">人形</span> : null}
                          </span>
                          <span className="mt-0.5 block text-[8px] text-zinc-600">
                            {asset.analysis
                              ? `${asset.analysis.bone_count} 骨骼 · ${modelClipCounts(asset.analysis).poses} 动作 · ${modelClipCounts(asset.analysis).animations} 动画`
                              : formatBytes(asset.size)} · 点击放置
                          </span>
                        </span>
                      </button>
                      <button type="button" title="删除模型" onClick={() => void removeModel(asset)} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-700 opacity-0 transition hover:bg-red-400/10 hover:text-red-300 group-hover:opacity-100"><DirectorIcon name="trash" className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              </>
            ) : leftPanelTab === "scene" ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-200">场景对象</div>
                    <div className="mt-0.5 text-[9px] text-zinc-600">按添加顺序排列</div>
                  </div>
                  <span className="text-[9px] tabular-nums text-zinc-600">{director.scene.objects.length} 个</span>
                </div>
                <div className="space-y-1.5">
                  {director.scene.objects.length === 0 ? (
                    <button type="button" onClick={() => setLeftPanelTab("library")} className="flex w-full flex-col items-center rounded-xl border border-dashed border-white/[0.09] px-3 py-6 text-center text-zinc-600 transition hover:border-violet-300/25 hover:text-zinc-300"><DirectorIcon name="layers" className="h-5 w-5" /><span className="mt-2 text-[10px]">场景还是空的</span><span className="mt-1 text-[8px] text-zinc-700">前往素材库添加模型</span></button>
                  ) : director.scene.objects.map((object, index) => (
                    <button
                      key={object.id}
                      type="button"
                      onClick={() => { setSelectedCameraId(null); setSelectedObjectId(object.id) }}
                      className={cn("group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition", selectedObjectId === object.id ? "border-violet-300/22 bg-violet-300/[0.085] text-violet-50 shadow-[inset_3px_0_rgba(167,139,250,.65)]" : "border-transparent text-zinc-400 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-zinc-200")}
                    >
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-black/20 text-[9px] font-semibold tabular-nums text-zinc-600"><span className="absolute bottom-1 right-1 h-2 w-2 rounded-full border border-[#11151e]" style={{ backgroundColor: object.color }} />{String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium">{object.name}</span><span className="mt-0.5 block truncate text-[8px] text-zinc-600">{object.asset_id === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID ? "标准骨骼人物" : object.asset_id.startsWith("builtin:") ? "内置模型" : "自定义模型"}</span></span>
                      <span className="flex items-center gap-1 text-zinc-700">{object.locked ? <DirectorIcon name="lock" className="h-3 w-3" /> : null}{!object.visible ? <DirectorIcon name="eye-off" className="h-3 w-3" /> : null}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-200">多机位</div>
                    <div className="mt-0.5 text-[9px] text-zinc-600">总览中显示位置、朝向和取景框</div>
                  </div>
                  <button type="button" onClick={addCamera} disabled={director.scene.cameras.length >= MAX_DIRECTOR_CAMERAS} className="flex h-7 items-center gap-1 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] px-2 text-[8px] font-medium text-cyan-100 transition hover:bg-cyan-300/[0.12] disabled:cursor-not-allowed disabled:opacity-30">＋ 添加</button>
                </div>
                <div className="space-y-2">
                  {director.scene.cameras.map((camera, index) => {
                    const active = director.scene.active_camera_id === camera.id
                    const selected = selectedCamera.id === camera.id
                    return (
                      <div key={camera.id} className={cn("overflow-hidden rounded-xl border transition", selected ? "border-cyan-300/25 bg-cyan-300/[0.06]" : "border-white/[0.065] bg-white/[0.018]")}>
                        <button type="button" onClick={() => activateCamera(camera.id)} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
                          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[9px] font-semibold tabular-nums", active ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" : "border-white/[0.07] bg-black/20 text-zinc-500")}>{String(index + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="truncate text-[10px] font-medium text-zinc-300">{camera.name}</span>{active ? <span className="rounded bg-cyan-300/10 px-1 py-0.5 text-[6px] text-cyan-200/80">当前</span> : null}</span><span className="mt-0.5 block truncate text-[7px] tabular-nums text-zinc-600">P {camera.position.map((value) => value.toFixed(1)).join(" / ")} · {Math.round(camera.fov)}°</span></span>
                        </button>
                        <div className="grid grid-cols-2 border-t border-white/[0.05] bg-black/10 p-1">
                          <button type="button" onClick={() => activateCamera(camera.id)} className="h-6 rounded text-[7px] text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200">空间选择</button>
                          <button type="button" onClick={() => activateCamera(camera.id, true)} className="h-6 rounded text-[7px] text-cyan-200/75 transition hover:bg-cyan-300/[0.08] hover:text-cyan-100">进入取景</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 p-2 text-[7px] leading-3.5 text-zinc-600">总览模式下点击相机模型即可选择；使用 W 移动、E 旋转调整方向。截图会为全部 {director.scene.cameras.length} 个机位各生成一张。</div>
              </>
            )}
          </div>
        </aside>

        <main className="relative min-h-0 overflow-hidden bg-[#05070c] p-3 2xl:p-4">
          <div ref={viewportRef} className="relative h-full overflow-hidden rounded-2xl border border-white/[0.075] bg-[#05080d] shadow-[0_24px_70px_rgba(0,0,0,.38),inset_0_1px_rgba(255,255,255,.035)]">
            <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_38%,transparent_35%,rgba(0,0,0,.24)_100%)]" />
            {!loaded && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#070a10]/90 text-[10px] text-zinc-500 backdrop-blur-sm"><span className="mb-3 h-7 w-7 animate-spin rounded-full border-2 border-violet-300/20 border-t-violet-300" />正在准备 3D 场景…</div>}
            {showThirds && (
              <div className="pointer-events-none absolute inset-[15px] z-10 rounded-xl border border-white/[0.06]">
                <div className="absolute left-1/3 top-0 h-full border-l border-cyan-100/20" />
                <div className="absolute left-2/3 top-0 h-full border-l border-cyan-100/20" />
                <div className="absolute left-0 top-1/3 w-full border-t border-cyan-100/20" />
                <div className="absolute left-0 top-2/3 w-full border-t border-cyan-100/20" />
              </div>
            )}

            <div className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-white/[0.1] bg-[#0a0d14]/72 p-1 shadow-[0_12px_34px_rgba(0,0,0,.28)] backdrop-blur-xl">
              {(Object.keys(TRANSFORM_LABELS) as DirectorTransformMode[]).map((mode) => {
                const iconName: DirectorIconName = mode === "translate" ? "move" : mode === "rotate" ? "rotate" : "scale"
                const shortcut = mode === "translate" ? "W" : mode === "rotate" ? "E" : "R"
                return (
                  <button key={mode} type="button" title={`${TRANSFORM_LABELS[mode]} (${shortcut})`} onClick={() => setTransformMode(mode)} className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium transition", transformMode === mode ? "bg-white text-zinc-950 shadow-[0_6px_18px_rgba(0,0,0,.2)]" : "text-zinc-400 hover:bg-white/[0.07] hover:text-white")}><DirectorIcon name={iconName} className="h-3.5 w-3.5" /><span className="hidden 2xl:inline">{TRANSFORM_LABELS[mode]}</span><kbd className={cn("ml-0.5 text-[8px] font-medium", transformMode === mode ? "text-zinc-500" : "text-zinc-600")}>{shortcut}</kbd></button>
                )
              })}
              <span className="mx-0.5 h-5 w-px bg-white/[0.09]" />
              <button
                type="button"
                title="平面摆放：直接拖动物体，只改变地面 X/Z 位置"
                onClick={() => { setPlacementMode("ground"); setTransformMode("translate") }}
                className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[9px] font-medium transition", placementMode === "ground" ? "bg-violet-300/15 text-violet-100" : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200")}
              >
                <DirectorIcon name="grid" className="h-3.5 w-3.5" />
                平面
              </button>
              <button
                type="button"
                title="自由变换：允许调整物体高度"
                onClick={() => setPlacementMode("free")}
                className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[9px] font-medium transition", placementMode === "free" ? "bg-violet-300/15 text-violet-100" : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200")}
              >
                <DirectorIcon name="move" className="h-3.5 w-3.5" />
                自由
              </button>
              {placementMode === "ground" ? (
                <button
                  type="button"
                  title="按 0.25 个单位吸附到网格"
                  onClick={() => setSnapToGrid((value) => !value)}
                  className={cn("flex h-8 items-center rounded-lg px-2 text-[8px] font-medium transition", snapToGrid ? "bg-cyan-300/12 text-cyan-100" : "text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300")}
                >
                  吸附 {snapToGrid ? "开" : "关"}
                </button>
              ) : null}
            </div>

            <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#0a0d14]/68 px-2.5 py-1.5 text-[8px] text-zinc-500 shadow-lg backdrop-blur-xl">
              <span className={cn("h-1.5 w-1.5 rounded-full", saving ? "animate-pulse bg-amber-300" : "bg-emerald-300")} />
              {saving ? "正在同步" : "已同步"}
              <span className="text-zinc-700">·</span>
              <span>{cameraViewMode === "overview" ? "空间总览" : selectedCamera.name}</span>
              <span className="text-zinc-700">·</span>
              <span>{director.scene.aspect_ratio}</span>
            </div>

            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/[0.1] bg-[#0a0d14]/76 p-1 shadow-[0_12px_34px_rgba(0,0,0,.28)] backdrop-blur-xl">
              <button type="button" onClick={() => switchCameraView("overview")} className={cn("h-8 rounded-lg px-3 text-[9px] font-medium transition", cameraViewMode === "overview" ? "bg-cyan-300/12 text-cyan-100" : "text-zinc-500 hover:bg-white/[0.07] hover:text-white")}>空间总览</button>
              <button type="button" onClick={() => switchCameraView("camera")} className={cn("h-8 max-w-[112px] truncate rounded-lg px-3 text-[9px] font-medium transition", cameraViewMode === "camera" ? "bg-violet-300/15 text-violet-100" : "text-zinc-500 hover:bg-white/[0.07] hover:text-white")}>取景 · {selectedCamera.name}</button>
              <span className="mx-1 h-5 w-px bg-white/[0.08]" />
              {([['front', '正面'], ['three', '斜侧'], ['high', '俯拍'], ['top', '顶视']] as const).map(([preset, label]) => (
                <button key={preset} type="button" onClick={() => applyCameraPreset(preset)} className="h-8 rounded-lg px-3 text-[9px] font-medium text-zinc-400 transition hover:bg-white/[0.08] hover:text-white">{label}</button>
              ))}
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden items-center gap-2 text-[8px] text-zinc-600 2xl:flex"><span className="rounded border border-white/[0.07] bg-black/30 px-1.5 py-1">{cameraViewMode === "overview" ? "彩色相机 · 机位和方向" : `正在预览 · ${selectedCamera.name}`}</span><span className="rounded border border-white/[0.07] bg-black/30 px-1.5 py-1">滚轮 · 指针缩放</span><span className="rounded border border-white/[0.07] bg-black/30 px-1.5 py-1">右键 · 平移视角</span></div>
            {error && <div className="absolute bottom-4 right-4 z-30 flex max-w-sm items-start gap-2 rounded-xl border border-red-300/20 bg-red-950/85 px-3 py-2.5 text-[10px] leading-4 text-red-100 shadow-[0_18px_44px_rgba(0,0,0,.4)] backdrop-blur-xl"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300" />{error}</div>}
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-white/[0.07] bg-[#0a0d14]/94 p-3 2xl:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-zinc-200">检查器</div>
              <div className="mt-0.5 text-[9px] text-zinc-600">编辑对象与镜头参数</div>
            </div>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[8px] tabular-nums text-zinc-600">r{director.revision}</span>
          </div>

          {selectedObject ? (
            <>
            <section className="overflow-hidden rounded-2xl border border-white/[0.075] bg-white/[0.018] shadow-[inset_0_1px_rgba(255,255,255,.025)]">
              <div className="flex items-center gap-2.5 border-b border-white/[0.065] p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20 text-violet-200/60"><BuiltinGlyph assetId={selectedObject.asset_id} /></span>
                <label className="min-w-0 flex-1"><span className="sr-only">名称</span><input value={selectedObject.name} onChange={(event) => updateSelectedObject({ name: event.target.value })} className="h-7 w-full border-0 bg-transparent px-0 text-[11px] font-semibold text-zinc-100 outline-none placeholder:text-zinc-600" /></label>
                <label title="对象颜色" className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-white/[0.12] shadow-inner"><input type="color" value={selectedObject.color} onChange={(event) => updateSelectedObject({ color: event.target.value })} className="absolute -inset-2 h-12 w-12 cursor-pointer border-0 bg-transparent" /></label>
              </div>
              <div className="space-y-4 p-3">
                <div><div className="mb-1.5 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-500">位置</span><span className="text-[8px] text-zinc-700">世界坐标</span></div>{renderVectorInputs("position", selectedObject.position)}</div>
                <div><div className="mb-1.5 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-500">旋转</span><span className="text-[8px] text-zinc-700">弧度</span></div>{renderVectorInputs("rotation", selectedObject.rotation)}</div>
                <div><div className="mb-1.5 text-[9px] font-medium text-zinc-500">缩放</div>{renderVectorInputs("scale", selectedObject.scale)}</div>
              </div>
              <div className="grid grid-cols-4 border-t border-white/[0.065] bg-black/10 p-1.5">
                <button type="button" title={selectedObject.visible ? "隐藏" : "显示"} onClick={() => updateSelectedObject({ visible: !selectedObject.visible })} className="flex h-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100">{selectedObject.visible ? <DirectorIcon name="eye" className="h-3.5 w-3.5" /> : <DirectorIcon name="eye-off" className="h-3.5 w-3.5" />}</button>
                <button type="button" title={selectedObject.locked ? "解锁" : "锁定"} onClick={() => updateSelectedObject({ locked: !selectedObject.locked })} className="flex h-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100">{selectedObject.locked ? <DirectorIcon name="unlock" className="h-3.5 w-3.5" /> : <DirectorIcon name="lock" className="h-3.5 w-3.5" />}</button>
                <button type="button" title="复制 (Ctrl/⌘ D)" onClick={duplicateSelectedObject} className="flex h-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100"><DirectorIcon name="copy" className="h-3.5 w-3.5" /></button>
                <button type="button" title="删除" onClick={deleteSelectedObject} className="flex h-8 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-red-400/10 hover:text-red-300"><DirectorIcon name="trash" className="h-3.5 w-3.5" /></button>
              </div>
            </section>
            {selectedMannequin ? (
              <section className="mt-3 overflow-hidden rounded-2xl border border-violet-300/[0.12] bg-[linear-gradient(145deg,rgba(139,124,255,.055),rgba(255,255,255,.012))]">
                <div className="flex items-center justify-between border-b border-white/[0.065] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-300/[0.09] text-violet-100/80"><DirectorIcon name="sparkles" className="h-3.5 w-3.5" /></span>
                    <div><div className="text-[10px] font-medium text-zinc-200">人物塑形与姿态</div><div className="text-[8px] text-zinc-600">原版 66 骨架 · {DIRECTOR_MANNEQUIN_JOINTS.length} 个可控关节，含手掌、手指与脚趾</div></div>
                  </div>
                  <span className="rounded-full border border-white/[0.07] bg-black/20 px-2 py-0.5 text-[8px] text-zinc-500">{Math.round(selectedMannequin.proportions.height * 100)} cm</span>
                </div>

                <div className="space-y-4 p-3">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">人体类型</span><span className="text-[8px] text-zinc-700">解剖轮廓</span></div>
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.065] bg-black/20 p-1">
                      {([{"id":"masculine","label":"男性素模"},{"id":"feminine","label":"女性素模"}] as const).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => updateSelectedMannequin((current) => normalizeDirectorMannequin({ ...current, anatomy: option.id }))}
                          className={cn("h-7 rounded-lg text-[8px] font-medium transition", selectedMannequin.anatomy === option.id ? "bg-violet-300/[0.13] text-violet-100" : "text-zinc-600 hover:text-zinc-300")}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">体型预设</span><span className="text-[8px] text-zinc-700">选择后仍可微调</span></div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DIRECTOR_MANNEQUIN_BODY_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          title={preset.description}
                          onClick={() => applyBodyPreset(preset.id)}
                          className={cn("rounded-lg border px-2 py-1.5 text-left transition", selectedMannequin.body_preset === preset.id ? "border-violet-300/30 bg-violet-300/12 text-violet-100" : "border-white/[0.065] bg-black/15 text-zinc-500 hover:border-white/[0.13] hover:text-zinc-200")}
                        >
                          <span className="block text-[9px] font-medium">{preset.label}</span>
                          <span className="mt-0.5 block truncate text-[7px] opacity-60">{preset.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-[9px] font-medium text-zinc-500">身高预设</div>
                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.065] bg-black/20 p-1">
                      {DIRECTOR_MANNEQUIN_SIZE_PRESETS.map((preset) => (
                        <button key={preset.label} type="button" onClick={() => updateMannequinProportion("height", preset.height)} className={cn("h-7 rounded-lg text-[8px] transition", Math.abs(selectedMannequin.proportions.height - preset.height) < 0.005 ? "bg-white/[0.1] text-white" : "text-zinc-600 hover:text-zinc-300")}>{preset.label} · {Math.round(preset.height * 100)}</button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {MANNEQUIN_PROPORTION_CONTROLS.map((control) => {
                      const value = selectedMannequin.proportions[control.key]
                      return (
                        <label key={control.key} className="block">
                          <span className="mb-1 flex items-center justify-between text-[8px]"><span className="text-zinc-500">{control.label}</span><span className="tabular-nums text-cyan-100/75">{control.key === "height" ? value.toFixed(2) : value.toFixed(2)}{control.unit || "×"}</span></span>
                          <input type="range" min={control.min} max={control.max} step={control.step} value={value} onChange={(event) => updateMannequinProportion(control.key, Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.09] accent-violet-300" />
                        </label>
                      )
                    })}
                  </div>

                  <div className="border-t border-white/[0.065] pt-3">
                    <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">姿势预设</span><span className="text-[8px] text-zinc-700">{DIRECTOR_MANNEQUIN_POSE_PRESETS.length} 组定格动作</span></div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DIRECTOR_MANNEQUIN_POSE_PRESETS.map((preset) => (
                        <button key={preset.id} type="button" title={preset.description} onClick={() => applyPosePreset(preset.id)} className={cn("h-8 rounded-lg border text-[8px] font-medium transition", selectedMannequin.pose_preset === preset.id ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/[0.06] bg-black/15 text-zinc-500 hover:border-white/[0.13] hover:text-zinc-200")}>{preset.label}</button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/[0.065] pt-3">
                    <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">关节微调</span><button type="button" onClick={resetMannequinJoint} className="text-[8px] text-zinc-600 transition hover:text-zinc-200">归零当前关节</button></div>
                    <select value={selectedJoint} onChange={(event) => setSelectedJoint(event.target.value as DirectorMannequinJoint)} className="h-8 w-full rounded-lg border border-white/[0.08] bg-[#0b0e16] px-2 text-[9px] text-zinc-300 outline-none focus:border-violet-300/35">
                      {(["躯干", "左臂", "左手", "右臂", "右手", "左腿", "右腿"] as const).map((group) => (
                        <optgroup key={group} label={group}>
                          {DIRECTOR_MANNEQUIN_JOINT_INFO.filter((joint) => joint.group === group).map((joint) => <option key={joint.id} value={joint.id}>{joint.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <div className="mt-3 space-y-2.5">
                      {(["X", "Y", "Z"] as const).map((axis, index) => {
                        const value = selectedMannequin.joints[selectedJoint][index]
                        return (
                          <label key={axis} className="grid grid-cols-[16px_minmax(0,1fr)_48px] items-center gap-2">
                            <span className={cn("text-[9px] font-semibold", index === 0 ? "text-rose-300/75" : index === 1 ? "text-emerald-300/75" : "text-sky-300/75")}>{axis}</span>
                            <input type="range" min={DIRECTOR_MANNEQUIN_JOINT_LIMITS[selectedJoint][index][0]} max={DIRECTOR_MANNEQUIN_JOINT_LIMITS[selectedJoint][index][1]} step="1" value={value} onChange={(event) => updateMannequinJoint(index, Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.09] accent-cyan-300" />
                            <span className="rounded-md bg-black/25 px-1.5 py-1 text-right text-[8px] tabular-nums text-zinc-400">{Math.round(value)}°</span>
                          </label>
                        )
                      })}
                    </div>
                    <div className="mt-2 text-[7px] leading-3 text-zinc-700">XYZ 使用原版骨骼的分部位安全活动范围；手指含根节、中节、末节，足部含踝和前脚掌。</div>
                  </div>
                </div>
              </section>
            ) : null}
            {selectedCustomAsset && selectedCustomRig ? (
              <section className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/[0.12] bg-[linear-gradient(145deg,rgba(34,211,238,.045),rgba(255,255,255,.012))]">
                <div className="flex items-center justify-between border-b border-white/[0.065] px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-300/[0.09] text-cyan-100/80"><DirectorIcon name="sparkles" className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium text-zinc-200">导入骨架、动作与动画</div>
                      <div className="truncate text-[8px] text-zinc-600">
                        {selectedCustomAsset.analysis
                          ? `${selectedCustomAsset.analysis.bone_count} 骨骼 · ${selectedNativePoseClips.length} 定格动作 · ${selectedContinuousAnimationClips.length} 连续动画`
                          : "等待模型分析"}
                      </div>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[8px]", selectedCustomAsset.analysis?.humanoid.recognized ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-200/80" : "border-white/[0.07] bg-black/20 text-zinc-500")}>
                    {selectedCustomAsset.analysis?.humanoid.recognized ? "已识别人形" : selectedCustomAsset.analysis?.bone_count ? "通用骨架" : "静态模型"}
                  </span>
                </div>

                {selectedCustomAsset.analysis ? (
                  <div className="space-y-4 p-3">
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.065] bg-black/20 p-1">
                      <button type="button" onClick={() => updateSelectedCustomRig((current) => ({ ...current, mode: "bind" }))} className={cn("h-8 rounded-lg text-[8px] font-medium transition", selectedCustomRig.mode === "bind" ? "bg-cyan-300/[0.13] text-cyan-100" : "text-zinc-600 hover:text-zinc-300")}>原始姿势</button>
                      <button type="button" disabled={!selectedCustomAsset.analysis.humanoid.recognized} onClick={() => updateSelectedCustomRig((current) => ({ ...current, mode: "pose" }))} className={cn("h-8 rounded-lg text-[8px] font-medium transition disabled:cursor-not-allowed disabled:opacity-25", selectedCustomRig.mode === "pose" ? "bg-cyan-300/[0.13] text-cyan-100" : "text-zinc-600 hover:text-zinc-300")}>系统姿势</button>
                      <button type="button" disabled={!selectedNativePoseClips.length} onClick={() => {
                        const clip = selectedNativeClip?.kind === "pose" ? selectedNativeClip : selectedNativePoseClips[0]
                        if (!clip) return
                        updateSelectedCustomRig((current) => ({ ...current, mode: "animation", animation_index: clip.index, animation_name: clip.name, animation_playing: false, animation_loop: false }))
                      }} className={cn("h-8 rounded-lg text-[8px] font-medium transition disabled:cursor-not-allowed disabled:opacity-25", selectedCustomRig.mode === "animation" && selectedNativeClip?.kind === "pose" ? "bg-cyan-300/[0.13] text-cyan-100" : "text-zinc-600 hover:text-zinc-300")}>自带定格动作</button>
                      <button type="button" disabled={!selectedContinuousAnimationClips.length} onClick={() => {
                        const clip = selectedNativeClip?.kind === "animation" ? selectedNativeClip : selectedContinuousAnimationClips[0]
                        if (!clip) return
                        updateSelectedCustomRig((current) => ({ ...current, mode: "animation", animation_index: clip.index, animation_name: clip.name, animation_playing: true, animation_loop: true }))
                      }} className={cn("h-8 rounded-lg text-[8px] font-medium transition disabled:cursor-not-allowed disabled:opacity-25", selectedCustomRig.mode === "animation" && selectedNativeClip?.kind === "animation" ? "bg-cyan-300/[0.13] text-cyan-100" : "text-zinc-600 hover:text-zinc-300")}>连续动画</button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="rounded-lg border border-white/[0.055] bg-black/15 px-1 py-2"><span className="block text-[11px] font-semibold tabular-nums text-zinc-300">{selectedCustomAsset.analysis.skin_count}</span><span className="text-[7px] text-zinc-700">蒙皮</span></div>
                      <div className="rounded-lg border border-white/[0.055] bg-black/15 px-1 py-2"><span className="block text-[11px] font-semibold tabular-nums text-zinc-300">{selectedCustomAsset.analysis.humanoid.mapped_joint_count}/{selectedCustomAsset.analysis.humanoid.joint_count}</span><span className="text-[7px] text-zinc-700">人体映射</span></div>
                      <div className="rounded-lg border border-white/[0.055] bg-black/15 px-1 py-2"><span className="block truncate text-[9px] font-semibold uppercase text-zinc-300">{selectedCustomAsset.analysis.humanoid.profile}</span><span className="text-[7px] text-zinc-700">骨架类型</span></div>
                    </div>

                    {selectedNativePoseClips.length > 0 ? (
                      <div className="border-t border-white/[0.065] pt-3">
                        <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">模型自带定格动作</span><span className="text-[8px] text-zinc-700">GLB 原始短关键帧 · 选中后定格</span></div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {selectedNativePoseClips.map((clip) => (
                            <button key={`${clip.index}-${clip.name}`} type="button" title={`${clip.keyframe_count} 个关键帧${clip.duration !== null ? ` · ${clip.duration.toFixed(3)} 秒` : ""}`} onClick={() => updateSelectedCustomRig((current) => ({ ...current, mode: "animation", animation_index: clip.index, animation_name: clip.name, animation_playing: false, animation_loop: false }))} className={cn("min-h-9 rounded-lg border px-2 py-1 text-left text-[8px] transition", selectedCustomRig.mode === "animation" && selectedNativeClip?.index === clip.index ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/[0.06] bg-black/15 text-zinc-500 hover:border-white/[0.13] hover:text-zinc-200")}>
                              <span className="block truncate font-medium">{clip.name}</span>
                              <span className="mt-0.5 block text-[7px] text-zinc-700">{clip.keyframe_count || "短"} 关键帧{clip.duration !== null ? ` · ${clip.duration.toFixed(3)}s` : ""}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedContinuousAnimationClips.length > 0 ? (
                      <div className="border-t border-white/[0.065] pt-3">
                        <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">模型内置连续动画</span><span className="text-[8px] text-zinc-700">GLB 原始时间序列 · 可播放和循环</span></div>
                        <select value={selectedNativeClip?.kind === "animation" ? selectedNativeClip.index : ""} onChange={(event) => {
                          const animationIndex = Number(event.target.value)
                          const animation = selectedContinuousAnimationClips.find((item) => item.index === animationIndex)
                          if (!animation) return
                          updateSelectedCustomRig((current) => ({ ...current, mode: "animation", animation_index: animationIndex, animation_name: animation.name, animation_playing: true }))
                        }} className="h-8 w-full rounded-lg border border-white/[0.08] bg-[#0b0e16] px-2 text-[9px] text-zinc-300 outline-none focus:border-cyan-300/35">
                          <option value="" disabled>选择连续动画</option>
                          {selectedContinuousAnimationClips.map((animation) => <option key={`${animation.index}-${animation.name}`} value={animation.index}>#{animation.index + 1} {animation.name}{animation.duration !== null ? ` · ${animation.duration.toFixed(2)}s` : ""}</option>)}
                        </select>
                        {selectedNativeClip?.kind === "animation" ? (
                          <div className="mt-2 grid grid-cols-[1fr_1fr_76px] gap-1.5">
                            <button type="button" onClick={() => updateSelectedCustomRig((current) => ({ ...current, mode: "animation", animation_playing: !current.animation_playing }))} className="h-8 rounded-lg border border-white/[0.07] bg-black/15 text-[8px] text-zinc-400 transition hover:text-white">{selectedCustomRig.animation_playing ? "暂停" : "播放"}</button>
                            <button type="button" onClick={() => updateSelectedCustomRig((current) => ({ ...current, mode: "animation", animation_loop: !current.animation_loop }))} className={cn("h-8 rounded-lg border text-[8px] transition", selectedCustomRig.animation_loop ? "border-cyan-300/20 bg-cyan-300/8 text-cyan-100" : "border-white/[0.07] bg-black/15 text-zinc-500")}>循环 {selectedCustomRig.animation_loop ? "开" : "关"}</button>
                            <select aria-label="动画速度" value={selectedCustomRig.animation_speed} onChange={(event) => updateSelectedCustomRig((current) => ({ ...current, mode: "animation", animation_speed: Number(event.target.value) }))} className="h-8 rounded-lg border border-white/[0.08] bg-[#0b0e16] px-1 text-[8px] text-zinc-400 outline-none">
                              {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {selectedCustomAsset.analysis.humanoid.recognized ? (
                      <>
                        <div className="border-t border-white/[0.065] pt-3">
                          <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">系统姿势预设</span><span className="text-[8px] text-zinc-700">OpenReel 关节数据 · 非模型原动画</span></div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {DIRECTOR_MANNEQUIN_POSE_PRESETS.map((preset) => <button key={preset.id} type="button" title={preset.description} onClick={() => applyCustomPosePreset(preset.id)} className={cn("h-8 rounded-lg border text-[8px] font-medium transition", selectedCustomRig.mode === "pose" && selectedCustomRig.pose_preset === preset.id ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/[0.06] bg-black/15 text-zinc-500 hover:border-white/[0.13] hover:text-zinc-200")}>{preset.label}</button>)}
                          </div>
                        </div>

                        <div className="border-t border-white/[0.065] pt-3">
                          <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">映射关节微调</span><button type="button" onClick={resetCustomRigJoint} className="text-[8px] text-zinc-600 transition hover:text-zinc-200">归零当前关节</button></div>
                          <select value={selectedJoint} onChange={(event) => setSelectedJoint(event.target.value as DirectorMannequinJoint)} className="h-8 w-full rounded-lg border border-white/[0.08] bg-[#0b0e16] px-2 text-[9px] text-zinc-300 outline-none focus:border-cyan-300/35">
                            {(["躯干", "左臂", "左手", "右臂", "右手", "左腿", "右腿"] as const).map((group) => <optgroup key={group} label={group}>{DIRECTOR_MANNEQUIN_JOINT_INFO.filter((joint) => joint.group === group).map((joint) => <option key={joint.id} value={joint.id}>{joint.label}{selectedCustomAsset.analysis?.humanoid.joint_map[anatomicalJointForStage(joint.id)] ? "" : "（未映射）"}</option>)}</optgroup>)}
                          </select>
                          <div className="mt-3 space-y-2.5">
                            {(["X", "Y", "Z"] as const).map((axis, index) => {
                              const value = selectedCustomRig.joints[selectedJoint][index]
                              return <label key={axis} className="grid grid-cols-[16px_minmax(0,1fr)_48px] items-center gap-2"><span className={cn("text-[9px] font-semibold", index === 0 ? "text-rose-300/75" : index === 1 ? "text-emerald-300/75" : "text-sky-300/75")}>{axis}</span><input type="range" min={DIRECTOR_MANNEQUIN_JOINT_LIMITS[selectedJoint][index][0]} max={DIRECTOR_MANNEQUIN_JOINT_LIMITS[selectedJoint][index][1]} step="1" value={value} onChange={(event) => updateCustomRigJoint(index, Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.09] accent-cyan-300" /><span className="rounded-md bg-black/25 px-1.5 py-1 text-right text-[8px] tabular-nums text-zinc-400">{Math.round(value)}°</span></label>
                            })}
                          </div>
                        </div>
                      </>
                    ) : null}

                    <details className="border-t border-white/[0.065] pt-3 text-[8px] text-zinc-500">
                      <summary className="cursor-pointer select-none font-medium text-zinc-400">完整识别结果 · {selectedCustomAsset.analysis.bone_count} 骨骼 / {selectedNativePoseClips.length} 定格动作 / {selectedContinuousAnimationClips.length} 连续动画</summary>
                      {selectedCustomAsset.analysis.error ? <p className="mt-2 text-red-300/70">{selectedCustomAsset.analysis.error}</p> : null}
                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/[0.055] bg-black/20 p-2 font-mono text-[7px] leading-3 text-zinc-600">
                        {selectedCustomAsset.analysis.bones.length ? selectedCustomAsset.analysis.bones.map((item) => <div key={item.node}><span className="text-zinc-400">#{item.node} {item.name}</span>{item.parent_name ? ` ← ${item.parent_name}` : ""}</div>) : <div>没有 skin joints</div>}
                      </div>
                      {selectedCustomAsset.analysis.animations.length ? <div className="mt-2 space-y-1">{selectedCustomAsset.analysis.animations.map((item) => <div key={`${item.index}-${item.name}`} className="rounded-lg border border-white/[0.05] bg-black/15 px-2 py-1.5"><span className={cn("mr-1 rounded px-1 py-0.5 text-[6px] font-semibold", item.kind === "pose" ? "bg-amber-300/10 text-amber-200/80" : "bg-cyan-300/10 text-cyan-200/80")}>{item.kind === "pose" ? "定格动作" : "连续动画"}</span><span className="text-zinc-400">{item.name}</span> · {item.keyframe_count || "?"} 关键帧 · {item.channel_count} 通道 · {item.target_node_count} 节点 · {item.properties.join("/") || "未知属性"}</div>)}</div> : null}
                    </details>
                  </div>
                ) : (
                  <div className="p-3 text-[8px] leading-4 text-zinc-600">该模型尚无解析数据，重新载入导演台后会自动补充骨骼、定格动作与连续动画识别。</div>
                )}
              </section>
            ) : null}
            </>
          ) : (
            <section className="flex flex-col items-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.012] px-4 py-7 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.025] text-zinc-600"><DirectorIcon name={selectedCameraId ? "camera" : "move"} className="h-4 w-4" /></span>
              <span className="mt-3 text-[10px] font-medium text-zinc-400">{selectedCameraId ? `已选择 ${selectedCamera.name}` : "选择一个场景对象或机位"}</span>
              <span className="mt-1 max-w-[190px] text-[8px] leading-4 text-zinc-700">{selectedCameraId ? "可在总览中移动或旋转相机，也可用下方坐标精确调整。" : "在视口中点击模型或相机，或从左侧列表中选择。"}</span>
            </section>
          )}

          <section className="mt-3 overflow-hidden rounded-2xl border border-white/[0.075] bg-white/[0.018]">
            <div className="flex items-center gap-2 border-b border-white/[0.065] px-3 py-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300/[0.07] text-cyan-200/70"><DirectorIcon name="camera" className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><div className="truncate text-[10px] font-medium text-zinc-300">多机位设置</div><span className="rounded bg-white/[0.05] px-1 text-[7px] text-zinc-500">{director.scene.cameras.length}/{MAX_DIRECTOR_CAMERAS}</span></div><div className="truncate text-[8px] text-zinc-700">每个机位独立保存位置、方向和焦段</div></div></div>
            <div className="space-y-4 p-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-500">当前机位</span><span className="text-[7px] text-cyan-200/60">截图时全部输出</span></div>
                <select value={selectedCamera.id} onChange={(event) => activateCamera(event.target.value)} className="h-8 w-full rounded-lg border border-white/[0.08] bg-[#0b0e16] px-2 text-[9px] text-zinc-300 outline-none focus:border-cyan-300/35">
                  {director.scene.cameras.map((camera, index) => <option key={camera.id} value={camera.id}>{index + 1}. {camera.name}</option>)}
                </select>
                <input value={selectedCamera.name} maxLength={120} onChange={(event) => updateSelectedCamera({ name: event.target.value || selectedCamera.name })} className="mt-1.5 h-8 w-full rounded-lg border border-white/[0.08] bg-black/20 px-2 text-[9px] text-zinc-300 outline-none focus:border-cyan-300/35" aria-label="机位名称" />
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => switchCameraView("overview")} className={cn("h-7 rounded-lg border text-[8px] transition", cameraViewMode === "overview" ? "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100" : "border-white/[0.06] bg-black/15 text-zinc-500")}>空间总览</button>
                  <button type="button" onClick={() => switchCameraView("camera")} className={cn("h-7 rounded-lg border text-[8px] transition", cameraViewMode === "camera" ? "border-violet-300/20 bg-violet-300/[0.08] text-violet-100" : "border-white/[0.06] bg-black/15 text-zinc-500")}>进入取景</button>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[9px] font-medium text-zinc-500">画幅比例</div>
                <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.07] bg-black/20 p-1">
                  {(["16:9", "9:16", "1:1", "4:3"] as DirectorAspectRatio[]).map((item) => <button key={item} type="button" onClick={() => changeAspectRatio(item)} className={cn("h-7 rounded-lg text-[8px] font-medium transition", director.scene.aspect_ratio === item ? "bg-white/[0.1] text-zinc-100 shadow-sm" : "text-zinc-600 hover:text-zinc-300")}>{item}</button>)}
                </div>
              </div>
              {(["position", "target"] as const).map((field) => (
                <div key={field}>
                  <div className="mb-1.5 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-500">{field === "position" ? "相机位置" : "观察目标"}</span><span className="text-[7px] text-zinc-700">世界坐标</span></div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {selectedCamera[field].map((value, index) => <label key={`${field}-${index}`} className="rounded-lg border border-white/[0.07] bg-black/20 px-2 py-1"><span className={cn("text-[8px] font-semibold", index === 0 ? "text-rose-300/70" : index === 1 ? "text-emerald-300/70" : "text-sky-300/70")}>{"XYZ"[index]}</span><input type="number" step="0.1" value={Number(value.toFixed(3))} onChange={(event) => changeCameraVector(field, index, Number(event.target.value))} className="mt-0.5 w-full bg-transparent text-[9px] tabular-nums text-zinc-200 outline-none" /></label>)}
                  </div>
                </div>
              ))}
              <label className="block">
                <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-500">视场角</span><span className="rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] tabular-nums text-cyan-200/80">{Math.round(selectedCamera.fov)}°</span></div>
                <input type="range" min="20" max="90" value={selectedCamera.fov} onChange={(event) => updateSelectedCamera({ fov: Number(event.target.value) })} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.09] accent-cyan-300" />
                <div className="mt-1.5 flex justify-between text-[7px] text-zinc-700"><span>长焦 20°</span><span>广角 90°</span></div>
              </label>
              <div className="grid grid-cols-[1fr_1fr_34px] gap-1.5 border-t border-white/[0.06] pt-3">
                <button type="button" onClick={addCamera} disabled={director.scene.cameras.length >= MAX_DIRECTOR_CAMERAS} className="h-8 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] text-[8px] font-medium text-cyan-100 transition hover:bg-cyan-300/[0.12] disabled:opacity-30">添加机位</button>
                <button type="button" onClick={() => applyCameraPreset("three")} className="h-8 rounded-lg border border-white/[0.07] bg-black/15 text-[8px] text-zinc-400 transition hover:text-white">设为斜侧</button>
                <button type="button" title="删除当前机位" onClick={removeSelectedCamera} disabled={director.scene.cameras.length <= 1} className="flex h-8 items-center justify-center rounded-lg border border-red-300/10 bg-red-400/[0.03] text-red-300/60 transition hover:bg-red-400/[0.1] disabled:cursor-not-allowed disabled:opacity-20"><DirectorIcon name="trash" className="h-3 w-3" /></button>
              </div>
            </div>
          </section>

          <div className="mt-3 rounded-xl border border-violet-300/[0.09] bg-violet-300/[0.035] px-3 py-2.5 text-[8px] leading-4 text-zinc-600"><span className="font-medium text-violet-200/70">工作提示：</span>空间总览显示全部相机的位置、朝向箭头和取景框；点击“截图全部机位”会按每台相机的观察位置各保存一张到镜头条。</div>
        </aside>
      </div>

      <section className="relative z-20 min-w-0 border-t border-white/[0.075] bg-[#090c13]/97 px-4 py-3 shadow-[0_-16px_48px_rgba(0,0,0,.2)]">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/[0.07] text-violet-200/80"><DirectorIcon name="image" className="h-3.5 w-3.5" /></span>
            <div><div className="flex items-center gap-2"><span className="text-[11px] font-semibold text-zinc-200">镜头条</span><span className="rounded-full bg-white/[0.045] px-1.5 py-0.5 text-[8px] tabular-nums text-zinc-500">{director.captures.length}</span></div><div className="mt-0.5 text-[8px] text-zinc-700">每次按全部机位分别截图 · 拖动即可重新排序</div></div>
          </div>
          <div className="flex items-center gap-2 text-[8px] text-zinc-600"><span className="hidden md:inline">镜头不会自动进入创作画布</span><span className="h-1 w-1 rounded-full bg-zinc-700" /><span>手动选择“放入画布”</span></div>
        </div>
        <div className="flex h-[142px] min-w-0 gap-3 overflow-x-auto pb-1">
          {director.captures.length === 0 ? (
            <div className="group flex w-full items-center justify-center rounded-2xl border border-dashed border-white/[0.085] bg-[radial-gradient(circle_at_50%_0%,rgba(139,124,255,.07),transparent_45%)]">
              <div className="flex items-center gap-3 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-zinc-600"><DirectorIcon name="camera" className="h-4 w-4" /></span><span><span className="block text-[10px] font-medium text-zinc-400">还没有保存镜头</span><span className="mt-1 block text-[8px] text-zinc-700">添加和摆放多个机位，然后点击右上角“截图全部机位”</span></span></div>
            </div>
          ) : director.captures.map((capture, index) => (
            <article
              key={capture.id}
              draggable
              onDragStart={() => { draggedCaptureRef.current = capture.id }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void dropCapture(capture.id)}
              onClick={() => setSelectedCaptureId(capture.id)}
              className={cn("group relative w-[218px] shrink-0 cursor-pointer overflow-hidden rounded-xl border bg-[#111620] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,.3)]", selectedCaptureId === capture.id ? "border-cyan-200/55 ring-2 ring-cyan-300/10" : "border-white/[0.09] hover:border-white/[0.18]")}
            >
              <div className="relative h-[96px] overflow-hidden bg-black/30">
                <img src={resolveMediaUrl(capture.image_url)} alt={capture.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d121b]/90 via-transparent to-black/10" />
                <span className="absolute left-2 top-2 rounded-md border border-white/[0.09] bg-black/45 px-1.5 py-0.5 text-[8px] font-semibold tabular-nums text-white/80 backdrop-blur">{String(index + 1).padStart(2, "0")}</span>
                <span className="absolute right-2 top-2 rounded-md border border-white/[0.09] bg-black/45 px-1.5 py-0.5 text-[8px] text-white/65 backdrop-blur">{capture.aspect_ratio}</span>
                {capture.camera_name ? <span className="absolute bottom-2 left-2 rounded-md border border-cyan-200/10 bg-black/45 px-1.5 py-0.5 text-[7px] text-cyan-100/70 backdrop-blur">{capture.camera_name}</span> : null}
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button type="button" title="恢复这个机位" onClick={(event) => { event.stopPropagation(); restoreCapture(capture) }} className="rounded-lg border border-white/[0.1] bg-black/55 px-2 py-1 text-[8px] text-zinc-200 backdrop-blur hover:bg-black/75">恢复机位</button>
                  <button type="button" title="重命名" onClick={(event) => { event.stopPropagation(); void renameCapture(capture) }} className="rounded-lg border border-white/[0.1] bg-black/55 px-2 py-1 text-[8px] text-zinc-200 backdrop-blur hover:bg-black/75">重命名</button>
                  <button type="button" title="移除镜头" onClick={(event) => { event.stopPropagation(); void removeCapture(capture) }} className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg border border-red-300/10 bg-black/55 text-red-300/80 backdrop-blur hover:bg-red-400/15"><DirectorIcon name="trash" className="h-2.5 w-2.5" /></button>
                </div>
              </div>
              <div className="flex h-[44px] items-center gap-2 px-2.5">
                <span className="min-w-0 flex-1 truncate text-[9px] font-medium text-zinc-200">{capture.title}</span>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); void promoteCapture(capture) }}
                  disabled={promotingId === capture.id}
                  className={cn("flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[8px] font-semibold transition disabled:opacity-50", capture.promoted_node_id ? "bg-emerald-300/[0.08] text-emerald-200/80 hover:bg-emerald-300/[0.13]" : "bg-cyan-300/[0.1] text-cyan-100 hover:bg-cyan-300/[0.18]")}
                >
                  {capture.promoted_node_id ? <DirectorIcon name="check" className="h-2.5 w-2.5" /> : <DirectorIcon name="chevron" className="h-2.5 w-2.5" />}
                  {promotingId === capture.id ? "处理中" : capture.promoted_node_id ? "已在画布" : "放入画布"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  ), document.body)
}
