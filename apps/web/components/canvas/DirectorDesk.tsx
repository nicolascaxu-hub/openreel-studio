"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { TransformControls } from "three/addons/controls/TransformControls.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import {
  createProjectDirectorCapture,
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
  cloneDirectorScene,
  createDirectorId,
  defaultDirectorDesk,
  newDirectorObject,
  normalizeDirectorDesk,
  type DirectorActorLegendItem,
  type DirectorAspectRatio,
  type DirectorCapture,
  type DirectorDeskState,
  type DirectorModelAsset,
  type DirectorObjectState,
  type DirectorSceneState,
  type DirectorTransformMode,
} from "@/lib/directorDesk"
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
  grid: THREE.GridHelper
  objectRoots: Map<string, THREE.Group>
  resizeObserver: ResizeObserver
  viewport: HTMLDivElement
  buildToken: number
  disposed: boolean
}

interface DirectorApiResponse {
  ok?: boolean
  director?: unknown
  node?: { id?: string }
  created?: boolean
}

const TRANSFORM_LABELS: Record<DirectorTransformMode, string> = {
  translate: "移动",
  rotate: "旋转",
  scale: "缩放",
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

function createBuiltinModel(assetId: string, color: string): THREE.Group {
  const group = new THREE.Group()
  const shared = material(color)
  const dark = material("#52525b")
  if (assetId === "builtin:mannequin") {
    addMesh(group, new THREE.SphereGeometry(0.16, 18, 12), shared, [0, 1.72, 0])
    addMesh(group, new THREE.CapsuleGeometry(0.18, 0.5, 6, 12), shared, [0, 1.24, 0])
    addMesh(group, new THREE.BoxGeometry(0.34, 0.2, 0.2), shared, [0, 0.87, 0])
    addMesh(group, new THREE.CapsuleGeometry(0.07, 0.48, 4, 8), shared, [-0.27, 1.24, 0], [0, 0, 0.12])
    addMesh(group, new THREE.CapsuleGeometry(0.07, 0.48, 4, 8), shared, [0.27, 1.24, 0], [0, 0, -0.12])
    addMesh(group, new THREE.CapsuleGeometry(0.085, 0.57, 4, 8), shared, [-0.11, 0.42, 0])
    addMesh(group, new THREE.CapsuleGeometry(0.085, 0.57, 4, 8), shared, [0.11, 0.42, 0])
    addMesh(group, new THREE.BoxGeometry(0.18, 0.08, 0.32), dark, [-0.11, 0.04, 0.05])
    addMesh(group, new THREE.BoxGeometry(0.18, 0.08, 0.32), dark, [0.11, 0.04, 0.05])
  } else if (assetId === "builtin:cube") {
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

function applyObjectTransform(root: THREE.Object3D, object: DirectorObjectState): void {
  root.position.set(...object.position)
  root.rotation.set(...object.rotation)
  root.scale.set(...object.scale)
  root.visible = object.visible
}

function snapshotRuntimeScene(runtime: DirectorRuntime, base: DirectorSceneState): DirectorSceneState {
  const next = cloneDirectorScene(base)
  next.camera = {
    position: runtime.camera.position.toArray() as [number, number, number],
    target: runtime.orbit.target.toArray() as [number, number, number],
    fov: runtime.camera.fov,
  }
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

function actorLegend(scene: DirectorSceneState): DirectorActorLegendItem[] {
  return scene.objects
    .filter((item) => item.asset_id === "builtin:mannequin")
    .map((item) => ({ label: item.name, color: item.color, object_id: item.id }))
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
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
  const [director, setDirector] = useState<DirectorDeskState>(() => defaultDirectorDesk())
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingModels, setLoadingModels] = useState(0)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<DirectorTransformMode>("translate")
  const [capturing, setCapturing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showThirds, setShowThirds] = useState(false)

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

  const rebuildRuntime = useCallback(() => {
    const runtime = runtimeRef.current
    if (!runtime || runtime.disposed) return
    runtime.buildToken += 1
    const token = runtime.buildToken
    runtime.transform.detach()
    for (const root of runtime.objectRoots.values()) {
      runtime.root.remove(root)
      disposeObject(root)
    }
    runtime.objectRoots.clear()
    const state = directorRef.current
    const modelById = new Map(state.model_assets.map((asset) => [asset.id, asset]))
    const loader = new GLTFLoader()
    for (const object of state.scene.objects) {
      const root = new THREE.Group()
      root.userData.directorObjectId = object.id
      root.name = object.name
      applyObjectTransform(root, object)
      runtime.objectRoots.set(object.id, root)
      runtime.root.add(root)
      if (object.asset_id.startsWith("builtin:")) {
        root.add(createBuiltinModel(object.asset_id, object.color))
        continue
      }
      const asset = modelById.get(object.asset_id)
      const placeholder = createBuiltinModel("builtin:cube", "#52525b")
      placeholder.name = "模型加载中"
      root.add(placeholder)
      if (!asset) {
        root.userData.loadError = "模型资产不存在"
        continue
      }
      setLoadingModels((value) => value + 1)
      void loader.loadAsync(resolveMediaUrl(asset.url)).then((gltf) => {
        if (runtime.disposed || runtime.buildToken !== token || !runtime.objectRoots.has(object.id)) {
          disposeObject(gltf.scene)
          return
        }
        root.remove(placeholder)
        disposeObject(placeholder)
        const content = gltf.scene
        const box = new THREE.Box3().setFromObject(content)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const largest = Math.max(size.x, size.y, size.z, 0.001)
        const normalizedScale = 1.8 / largest
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
    }
    runtime.camera.position.set(...state.scene.camera.position)
    runtime.camera.fov = state.scene.camera.fov
    runtime.camera.updateProjectionMatrix()
    runtime.orbit.target.set(...state.scene.camera.target)
    runtime.orbit.update()
    runtime.root.userData.aspectRatio = state.scene.aspect_ratio
    resizeDirectorRuntime(runtime)
  }, [])

  rebuildRuntimeRef.current = rebuildRuntime

  useEffect(() => {
    let canceled = false
    setLoaded(false)
    setError(null)
    void getProjectDirector<DirectorApiResponse>(projectId).then((response) => {
      if (canceled) return
      const next = normalizeDirectorDesk(response.director)
      setLocalDirector(next)
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

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08
    orbit.minDistance = 0.5
    orbit.maxDistance = 60
    orbit.maxPolarAngle = Math.PI * 0.495
    const transform = new TransformControls(camera, renderer.domElement)
    transform.setMode("translate")
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
      grid,
      objectRoots: new Map(),
      resizeObserver,
      viewport,
      buildToken: 0,
      disposed: false,
    }
    runtimeRef.current = runtime
    runtime.root.userData.aspectRatio = directorRef.current.scene.aspect_ratio
    resizeObserver.observe(viewport)
    rebuildRuntimeRef.current()

    const pointerStart = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onPointerDown = (event: PointerEvent) => pointerStart.set(event.clientX, event.clientY)
    const onPointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5 || transform.axis) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects([...runtime.objectRoots.values()], true)
      let selected: THREE.Object3D | null = hits[0]?.object || null
      while (selected && selected.parent !== root) selected = selected.parent
      const id = selected?.userData.directorObjectId
      setSelectedObjectId(typeof id === "string" ? id : null)
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown)
    renderer.domElement.addEventListener("pointerup", onPointerUp)

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

    renderer.setAnimationLoop(() => {
      orbit.update()
      renderer.render(scene, camera)
    })

    return () => {
      runtime.disposed = true
      runtime.buildToken += 1
      renderer.setAnimationLoop(null)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener("pointerdown", onPointerDown)
      renderer.domElement.removeEventListener("pointerup", onPointerUp)
      transform.removeEventListener("mouseDown", onTransformStart)
      transform.removeEventListener("mouseUp", onTransformEnd)
      transform.removeEventListener("dragging-changed", onDraggingChanged)
      orbit.removeEventListener("start", onOrbitStart)
      orbit.removeEventListener("end", onOrbitEnd)
      transform.detach()
      transform.dispose()
      orbit.dispose()
      for (const object of runtime.objectRoots.values()) disposeObject(object)
      ground.geometry.dispose()
      ;(ground.material as THREE.Material).dispose()
      renderer.dispose()
      renderer.domElement.remove()
      if (runtimeRef.current === runtime) runtimeRef.current = null
    }
  }, [commitRuntimeScene, loaded])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.grid.visible = showGrid
  }, [showGrid])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.transform.setMode(transformMode)
  }, [transformMode])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    const object = selectedObjectId
      ? director.scene.objects.find((item) => item.id === selectedObjectId)
      : null
    const root = selectedObjectId ? runtime.objectRoots.get(selectedObjectId) : null
    if (root && object && !object.locked) runtime.transform.attach(root)
    else runtime.transform.detach()
  }, [director.scene.objects, selectedObjectId])

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

  const addObject = useCallback((assetId: string, defaultName: string) => {
    const scene = cloneDirectorScene(directorRef.current.scene)
    const object = newDirectorObject(assetId, defaultName, scene.objects)
    scene.objects.push(object)
    replaceScene(scene, true)
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
    setSelectedObjectId(copy.id)
  }, [replaceScene, selectedObjectId])

  const updateSelectedObject = useCallback((patch: Partial<DirectorObjectState>) => {
    if (!selectedObjectId) return
    const scene = cloneDirectorScene(directorRef.current.scene)
    scene.objects = scene.objects.map((item) => item.id === selectedObjectId ? { ...item, ...patch } : item)
    replaceScene(scene, true)
    setSelectedObjectId(selectedObjectId)
  }, [replaceScene, selectedObjectId])

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

  const applyCameraPreset = useCallback((preset: "front" | "three" | "high" | "top") => {
    const scene = cloneDirectorScene(directorRef.current.scene)
    const target: [number, number, number] = [0, 1, 0]
    scene.camera = {
      ...scene.camera,
      target,
      position: preset === "front"
        ? [0, 2, 7]
        : preset === "three"
          ? [5.5, 3, 6]
          : preset === "high"
            ? [5, 7, 6]
            : [0.01, 10, 0.01],
    }
    replaceScene(scene, true)
  }, [replaceScene])

  const captureImage = useCallback((scene: DirectorSceneState): string => {
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
    const previousRatio = runtime.renderer.getPixelRatio()
    runtime.grid.visible = false
    runtime.transformHelper.visible = false
    runtime.renderer.setPixelRatio(1)
    runtime.renderer.setSize(width, height, false)
    runtime.camera.aspect = aspect
    runtime.camera.updateProjectionMatrix()
    runtime.renderer.render(runtime.scene, runtime.camera)
    const source = runtime.renderer.domElement
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("无法创建截图画布")
    ctx.drawImage(source, 0, 0, width, height)
    const legend = actorLegend(scene)
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
      const response = await createProjectDirectorCapture<DirectorApiResponse>(projectId, {
        data_url: captureImage(scene),
        scene_snapshot: scene as unknown as Record<string, unknown>,
        actor_legend: actorLegend(scene) as unknown as Array<Record<string, unknown>>,
        expected_revision: directorRef.current.revision,
      })
      const next = mergeServerDirector(response.director, true)
      setSelectedCaptureId(next.captures.at(-1)?.id || null)
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
    <div className="grid grid-cols-3 gap-1">
      {values.map((value, index) => (
        <label key={`${field}-${index}`} className="rounded border border-white/10 bg-black/20 px-1.5 py-1 text-[10px] text-zinc-500">
          {"XYZ"[index]}
          <input
            type="number"
            step={field === "rotation" ? 0.1 : 0.05}
            value={Number(value.toFixed(3))}
            onChange={(event) => changeVectorValue(field, index, Number(event.target.value))}
            className="mt-0.5 w-full bg-transparent text-xs text-zinc-100 outline-none"
          />
        </label>
      ))}
    </div>
  )

  return createPortal((
    <div className="fixed inset-0 z-[100] grid grid-rows-[56px_minmax(0,1fr)_190px] bg-[#070a10] text-zinc-100">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#0d1119] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => void closeDesk()} className="h-8 rounded-md border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/[0.06]">返回画布</button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">3D 导演台</div>
            <div className="truncate text-[10px] text-zinc-500">{projectTitle || "当前项目"} · 白模构图与镜头候选</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={undo} disabled={undoRef.current.length === 0} className="h-8 rounded px-2 text-xs text-zinc-400 hover:bg-white/[0.06] disabled:opacity-30">撤销</button>
          <button type="button" onClick={redo} disabled={redoRef.current.length === 0} className="h-8 rounded px-2 text-xs text-zinc-400 hover:bg-white/[0.06] disabled:opacity-30">重做</button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button type="button" onClick={() => setShowGrid((value) => !value)} className={cn("h-8 rounded px-2 text-xs", showGrid ? "bg-cyan-400/15 text-cyan-200" : "text-zinc-400 hover:bg-white/[0.06]")}>网格</button>
          <button type="button" onClick={() => setShowThirds((value) => !value)} className={cn("h-8 rounded px-2 text-xs", showThirds ? "bg-cyan-400/15 text-cyan-200" : "text-zinc-400 hover:bg-white/[0.06]")}>三分线</button>
          <button
            type="button"
            onClick={() => void createCapture()}
            disabled={!loaded || capturing || loadingModels > 0}
            className="ml-1 h-9 rounded-lg bg-cyan-300 px-4 text-xs font-semibold text-cyan-950 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50"
          >
            {capturing ? "截图中…" : loadingModels > 0 ? "模型加载中" : "截图到时间线"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)_260px]">
        <aside className="min-h-0 overflow-y-auto border-r border-white/10 bg-[#0b0f16] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">基础白模</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DIRECTOR_BUILTINS.map((item) => (
              <button key={item.id} type="button" onClick={() => addObject(item.id, item.defaultName)} className="rounded-lg border border-white/10 bg-white/[0.025] px-2 py-2.5 text-left text-xs text-zinc-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-white">
                <span className="block text-lg leading-none text-zinc-500">{item.id === "builtin:mannequin" ? "♙" : item.id === "builtin:wall" ? "▥" : "◇"}</span>
                <span className="mt-1 block">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">自定义模型</div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40">{uploading ? "上传中" : "导入 GLB"}</button>
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
          <div className="mt-2 space-y-1.5">
            {director.model_assets.length === 0 ? <div className="rounded border border-dashed border-white/10 px-2 py-3 text-center text-[10px] text-zinc-600">导入单文件 GLB 后可重复放置</div> : director.model_assets.map((asset) => (
              <div key={asset.id} className="group flex items-center gap-2 rounded border border-white/[0.07] bg-black/15 p-2">
                <button type="button" onClick={() => addObject(asset.id, asset.name.replace(/\.glb$/i, ""))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-xs text-zinc-300">{asset.name}</span>
                  <span className="block text-[9px] text-zinc-600">{formatBytes(asset.size)} · 点击添加</span>
                </button>
                <button type="button" onClick={() => void removeModel(asset)} className="opacity-0 text-[10px] text-red-300 transition group-hover:opacity-100">删除</button>
              </div>
            ))}
          </div>

          <div className="mt-5 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">场景对象 · {director.scene.objects.length}</div>
          <div className="mt-2 space-y-1">
            {director.scene.objects.map((object) => (
              <button
                key={object.id}
                type="button"
                onClick={() => setSelectedObjectId(object.id)}
                className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs", selectedObjectId === object.id ? "bg-cyan-300/12 text-cyan-100" : "text-zinc-400 hover:bg-white/[0.05]")}
              >
                <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: object.color }} />
                <span className="min-w-0 flex-1 truncate">{object.name}</span>
                {object.locked ? <span className="text-[9px] text-zinc-600">锁</span> : null}
                {!object.visible ? <span className="text-[9px] text-zinc-600">隐</span> : null}
              </button>
            ))}
          </div>
        </aside>

        <main ref={viewportRef} className="relative min-h-0 overflow-hidden bg-[#05080d]">
          {!loaded && <div className="absolute inset-0 z-20 flex items-center justify-center text-xs text-zinc-500">正在载入导演台…</div>}
          {showThirds && (
            <div className="pointer-events-none absolute inset-[15px] z-10">
              <div className="absolute left-1/3 top-0 h-full border-l border-white/25" />
              <div className="absolute left-2/3 top-0 h-full border-l border-white/25" />
              <div className="absolute left-0 top-1/3 w-full border-t border-white/25" />
              <div className="absolute left-0 top-2/3 w-full border-t border-white/25" />
            </div>
          )}
          <div className="absolute left-3 top-3 z-20 flex gap-1 rounded-lg border border-white/10 bg-black/45 p-1 backdrop-blur">
            {(Object.keys(TRANSFORM_LABELS) as DirectorTransformMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => setTransformMode(mode)} className={cn("h-7 rounded px-2 text-[10px]", transformMode === mode ? "bg-cyan-300 text-cyan-950" : "text-zinc-300 hover:bg-white/10")}>{TRANSFORM_LABELS[mode]} <span className="opacity-50">{mode === "translate" ? "W" : mode === "rotate" ? "E" : "R"}</span></button>
            ))}
          </div>
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-lg border border-white/10 bg-black/45 p-1 backdrop-blur">
            {([['front', '正面'], ['three', '斜侧'], ['high', '俯拍'], ['top', '顶视']] as const).map(([preset, label]) => (
              <button key={preset} type="button" onClick={() => applyCameraPreset(preset)} className="h-7 rounded px-2 text-[10px] text-zinc-300 hover:bg-white/10">{label}</button>
            ))}
          </div>
          {error && <div className="absolute bottom-3 right-3 z-30 max-w-sm rounded-lg border border-red-300/20 bg-red-950/80 px-3 py-2 text-[11px] text-red-100 shadow-xl">{error}</div>}
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-white/10 bg-[#0b0f16] p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">属性</div>
            <span className="text-[9px] text-zinc-600">{saving ? "保存中…" : `r${director.revision}`}</span>
          </div>
          {selectedObject ? (
            <div className="mt-3 space-y-3">
              <label className="block text-[10px] text-zinc-500">名称
                <input value={selectedObject.name} onChange={(event) => updateSelectedObject({ name: event.target.value })} className="mt-1 h-8 w-full rounded border border-white/10 bg-black/20 px-2 text-xs text-zinc-100 outline-none focus:border-cyan-300/40" />
              </label>
              <label className="flex items-center justify-between text-[10px] text-zinc-500">颜色
                <input type="color" value={selectedObject.color} onChange={(event) => updateSelectedObject({ color: event.target.value })} className="h-7 w-12 rounded border border-white/10 bg-transparent" />
              </label>
              <div><div className="mb-1 text-[10px] text-zinc-500">位置</div>{renderVectorInputs("position", selectedObject.position)}</div>
              <div><div className="mb-1 text-[10px] text-zinc-500">旋转（弧度）</div>{renderVectorInputs("rotation", selectedObject.rotation)}</div>
              <div><div className="mb-1 text-[10px] text-zinc-500">缩放</div>{renderVectorInputs("scale", selectedObject.scale)}</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateSelectedObject({ visible: !selectedObject.visible })} className="h-8 rounded border border-white/10 text-[10px] text-zinc-300 hover:bg-white/[0.06]">{selectedObject.visible ? "隐藏" : "显示"}</button>
                <button type="button" onClick={() => updateSelectedObject({ locked: !selectedObject.locked })} className="h-8 rounded border border-white/10 text-[10px] text-zinc-300 hover:bg-white/[0.06]">{selectedObject.locked ? "解锁" : "锁定"}</button>
                <button type="button" onClick={duplicateSelectedObject} className="h-8 rounded border border-white/10 text-[10px] text-zinc-300 hover:bg-white/[0.06]">复制</button>
                <button type="button" onClick={deleteSelectedObject} className="h-8 rounded border border-red-300/15 text-[10px] text-red-300 hover:bg-red-400/10">删除</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded border border-dashed border-white/10 px-3 py-5 text-center text-[10px] leading-5 text-zinc-600">点击视口中的物体或左侧对象列表进行编辑</div>
          )}

          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">镜头</div>
            <label className="mt-3 block text-[10px] text-zinc-500">画幅
              <select value={director.scene.aspect_ratio} onChange={(event) => changeAspectRatio(event.target.value as DirectorAspectRatio)} className="mt-1 h-8 w-full rounded border border-white/10 bg-[#111722] px-2 text-xs text-zinc-200">
                {(["16:9", "9:16", "1:1", "4:3"] as DirectorAspectRatio[]).map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-[10px] text-zinc-500">视场角 · {Math.round(director.scene.camera.fov)}°
              <input type="range" min="20" max="90" value={director.scene.camera.fov} onChange={(event) => {
                const scene = cloneDirectorScene(directorRef.current.scene)
                scene.camera.fov = Number(event.target.value)
                replaceScene(scene, true)
              }} className="mt-1 w-full accent-cyan-300" />
            </label>
            <div className="mt-3 text-[10px] leading-5 text-zinc-600">拖拽空白处旋转视角，滚轮缩放。截图只进入下方时间线，不会自动创建画布节点。</div>
          </div>
        </aside>
      </div>

      <section className="min-w-0 border-t border-white/10 bg-[#0a0e15] px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-200">截图时间线</span>
            <span className="ml-2 text-[10px] text-zinc-600">{director.captures.length} 个静态镜头候选 · 拖动排序</span>
          </div>
          <span className="text-[10px] text-zinc-600">点击“放入画布”后才创建图片节点</span>
        </div>
        <div className="flex h-[140px] min-w-0 gap-2 overflow-x-auto pb-2">
          {director.captures.length === 0 ? (
            <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-zinc-600">调整构图后点击右上角“截图到时间线”</div>
          ) : director.captures.map((capture, index) => (
            <article
              key={capture.id}
              draggable
              onDragStart={() => { draggedCaptureRef.current = capture.id }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void dropCapture(capture.id)}
              onClick={() => setSelectedCaptureId(capture.id)}
              className={cn("group relative w-56 shrink-0 overflow-hidden rounded-lg border bg-[#111722]", selectedCaptureId === capture.id ? "border-cyan-300/55 ring-1 ring-cyan-300/15" : "border-white/10")}
            >
              <img src={resolveMediaUrl(capture.image_url)} alt={capture.title} className="h-[82px] w-full object-cover" />
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-black/35 px-1 py-0.5 text-[9px] text-zinc-500">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">{capture.title}</span>
                  <span className="text-[9px] text-zinc-600">{capture.aspect_ratio}</span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <button type="button" onClick={(event) => { event.stopPropagation(); restoreCapture(capture) }} className="rounded px-1.5 py-1 text-[9px] text-zinc-400 hover:bg-white/[0.07]">回到机位</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); void renameCapture(capture) }} className="rounded px-1.5 py-1 text-[9px] text-zinc-400 hover:bg-white/[0.07]">重命名</button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); void promoteCapture(capture) }}
                    disabled={promotingId === capture.id}
                    className="ml-auto rounded bg-cyan-300/15 px-1.5 py-1 text-[9px] text-cyan-200 hover:bg-cyan-300/25 disabled:opacity-50"
                  >
                    {promotingId === capture.id ? "处理中" : capture.promoted_node_id ? "查看画布" : "放入画布"}
                  </button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); void removeCapture(capture) }} className="rounded px-1 py-1 text-[9px] text-red-300 opacity-0 hover:bg-red-400/10 group-hover:opacity-100">×</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  ), document.body)
}
