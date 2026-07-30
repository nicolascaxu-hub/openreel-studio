import {
  DIRECTOR_MANNEQUIN_JOINTS,
  defaultDirectorMannequin,
  normalizeDirectorMannequin,
  type DirectorMannequinJoint,
  type DirectorMannequinPosePreset,
  type DirectorMannequinState,
} from "@/lib/directorMannequin"
import { DIRECTOR_UNIVERSAL_MANNEQUIN } from "@/lib/directorUniversalMannequin"

export type DirectorAspectRatio = "16:9" | "9:16" | "1:1" | "4:3"
export type DirectorTransformMode = "translate" | "rotate" | "scale"

export interface DirectorCameraPose {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

export interface DirectorCameraState extends DirectorCameraPose {
  id: string
  name: string
}

export interface DirectorObjectState {
  id: string
  asset_id: string
  name: string
  color: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  visible: boolean
  locked: boolean
  mannequin?: DirectorMannequinState
  rig?: DirectorCustomRigState
}

export interface DirectorPanoramaState {
  source_node_id?: string
  title: string
  image_url: string
  rotation_y: number
  visible: boolean
}

export interface DirectorSceneState {
  aspect_ratio: DirectorAspectRatio
  camera: DirectorCameraPose
  cameras: DirectorCameraState[]
  active_camera_id: string
  viewport_camera: DirectorCameraPose
  panorama: DirectorPanoramaState | null
  objects: DirectorObjectState[]
}

export interface DirectorModelAsset {
  id: string
  name: string
  file_name: string
  url: string
  size: number
  created_at?: string
  analysis?: DirectorModelAnalysis
}

export interface DirectorModelBone {
  node: number
  name: string
  parent_node: number | null
  parent_name: string | null
}

export interface DirectorModelSkin {
  index: number
  name: string
  joint_count: number
  skeleton_node: number | null
}

export interface DirectorModelAnimation {
  index: number
  name: string
  duration: number | null
  keyframe_count: number
  kind: "pose" | "animation"
  channel_count: number
  target_node_count: number
  properties: string[]
}

export interface DirectorModelHumanoid {
  recognized: boolean
  profile: string
  confidence: number
  mapped_joint_count: number
  joint_count: number
  joint_map: Partial<Record<DirectorMannequinJoint, string>>
  joint_node_map: Partial<Record<DirectorMannequinJoint, number>>
  missing_joints: DirectorMannequinJoint[]
}

export interface DirectorModelAnalysis {
  analysis_version: number
  format: "glb2"
  generator?: string
  error?: string
  node_count: number
  mesh_count: number
  material_count: number
  skin_count: number
  skins: DirectorModelSkin[]
  bone_count: number
  bones: DirectorModelBone[]
  animation_count: number
  animations: DirectorModelAnimation[]
  humanoid: DirectorModelHumanoid
}

export interface DirectorCustomRigState {
  mode: "bind" | "pose" | "animation"
  pose_preset: DirectorMannequinPosePreset
  joints: Record<DirectorMannequinJoint, [number, number, number]>
  animation_name: string | null
  animation_index: number | null
  animation_playing: boolean
  animation_loop: boolean
  animation_speed: number
}

export interface DirectorActorLegendItem {
  label: string
  color: string
  object_id?: string
}

export interface DirectorCapture {
  id: string
  order: number
  title: string
  file_name: string
  image_url: string
  created_at: string
  aspect_ratio: DirectorAspectRatio
  scene_snapshot: DirectorSceneState
  actor_legend: DirectorActorLegendItem[]
  camera_id?: string | null
  camera_name?: string | null
  promoted_node_id?: string | null
}

export interface DirectorDeskState {
  version: number
  revision: number
  scene: DirectorSceneState
  model_assets: DirectorModelAsset[]
  captures: DirectorCapture[]
}

const ASPECT_RATIOS = new Set<DirectorAspectRatio>(["16:9", "9:16", "1:1", "4:3"])

export const DIRECTOR_ASPECT_VALUES: Record<DirectorAspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:3": 4 / 3,
}

export const DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID = "builtin:mannequin"
export const DIRECTOR_UNIVERSAL_ACTION_MANNEQUIN_ASSET_ID = DIRECTOR_UNIVERSAL_MANNEQUIN.id
export const MAX_DIRECTOR_CAMERAS = 12

export const DIRECTOR_BUILTINS = [
  { id: DIRECTOR_UNIVERSAL_ACTION_MANNEQUIN_ASSET_ID, label: "通用动作白模", defaultName: "动作人物" },
  { id: "builtin:cube", label: "立方体", defaultName: "方块" },
  { id: "builtin:cylinder", label: "圆柱体", defaultName: "圆柱" },
  { id: "builtin:table", label: "桌子", defaultName: "桌子" },
  { id: "builtin:chair", label: "椅子", defaultName: "椅子" },
  { id: "builtin:wall", label: "墙面", defaultName: "墙面" },
] as const

export const DIRECTOR_CHARACTER_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316",
  "#06b6d4",
]

export function createDirectorId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function defaultDirectorScene(): DirectorSceneState {
  const camera: DirectorCameraState = {
    id: "camera-main",
    name: "机位 1",
    position: [4.8, 3, 6.8],
    target: [0, 1, 0],
    fov: 45,
  }
  return {
    aspect_ratio: "16:9",
    camera: {
      position: [...camera.position],
      target: [...camera.target],
      fov: camera.fov,
    },
    cameras: [camera],
    active_camera_id: camera.id,
    viewport_camera: {
      position: [8.8, 6, 10.8],
      target: [0, 1, 0],
      fov: 45,
    },
    panorama: null,
    objects: [],
  }
}

export function defaultDirectorDesk(): DirectorDeskState {
  return {
    version: 2,
    revision: 0,
    scene: defaultDirectorScene(),
    model_assets: [],
    captures: [],
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function vector3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) return [...fallback]
  return [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2]),
  ]
}

function nullableIndex(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function normalizeModelAnalysis(value: unknown): DirectorModelAnalysis | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const rawHumanoid = raw.humanoid && typeof raw.humanoid === "object" && !Array.isArray(raw.humanoid)
    ? raw.humanoid as Record<string, unknown>
    : {}
  const rawJointMap = rawHumanoid.joint_map && typeof rawHumanoid.joint_map === "object" && !Array.isArray(rawHumanoid.joint_map)
    ? rawHumanoid.joint_map as Record<string, unknown>
    : {}
  const rawJointNodeMap = rawHumanoid.joint_node_map && typeof rawHumanoid.joint_node_map === "object" && !Array.isArray(rawHumanoid.joint_node_map)
    ? rawHumanoid.joint_node_map as Record<string, unknown>
    : {}
  const jointMap: Partial<Record<DirectorMannequinJoint, string>> = {}
  const jointNodeMap: Partial<Record<DirectorMannequinJoint, number>> = {}
  for (const joint of DIRECTOR_MANNEQUIN_JOINTS) {
    if (typeof rawJointMap[joint] === "string" && String(rawJointMap[joint]).trim()) {
      jointMap[joint] = String(rawJointMap[joint])
    }
    const node = nullableIndex(rawJointNodeMap[joint])
    if (node !== null) jointNodeMap[joint] = node
  }
  const missingSet = new Set(
    (Array.isArray(rawHumanoid.missing_joints) ? rawHumanoid.missing_joints : []).map(String),
  )
  const bones = (Array.isArray(raw.bones) ? raw.bones : []).flatMap((item): DirectorModelBone[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const bone = item as Record<string, unknown>
    const node = nullableIndex(bone.node)
    if (node === null) return []
    return [{
      node,
      name: String(bone.name || `Node ${node}`),
      parent_node: nullableIndex(bone.parent_node),
      parent_name: bone.parent_name ? String(bone.parent_name) : null,
    }]
  })
  const skins = (Array.isArray(raw.skins) ? raw.skins : []).flatMap((item): DirectorModelSkin[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const skin = item as Record<string, unknown>
    const index = nullableIndex(skin.index)
    if (index === null) return []
    return [{
      index,
      name: String(skin.name || `Skin ${index + 1}`),
      joint_count: Math.max(0, Math.floor(finiteNumber(skin.joint_count, 0))),
      skeleton_node: nullableIndex(skin.skeleton_node),
    }]
  })
  const animations = (Array.isArray(raw.animations) ? raw.animations : []).flatMap((item): DirectorModelAnimation[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const animation = item as Record<string, unknown>
    const index = nullableIndex(animation.index)
    if (index === null) return []
    const duration = animation.duration === null || animation.duration === undefined
      ? Number.NaN
      : Number(animation.duration)
    const normalizedDuration = Number.isFinite(duration) && duration >= 0 ? duration : null
    const keyframeCount = Math.max(0, Math.floor(finiteNumber(animation.keyframe_count, 0)))
    const kind = animation.kind === "pose" || animation.kind === "animation"
      ? animation.kind
      : normalizedDuration !== null && normalizedDuration <= 0.1
        ? "pose"
        : "animation"
    return [{
      index,
      name: String(animation.name || `Animation ${index + 1}`),
      duration: normalizedDuration,
      keyframe_count: keyframeCount,
      kind,
      channel_count: Math.max(0, Math.floor(finiteNumber(animation.channel_count, 0))),
      target_node_count: Math.max(0, Math.floor(finiteNumber(animation.target_node_count, 0))),
      properties: (Array.isArray(animation.properties) ? animation.properties : []).map(String),
    }]
  })
  return {
    analysis_version: Math.max(0, Math.floor(finiteNumber(raw.analysis_version, 0))),
    format: "glb2",
    generator: raw.generator ? String(raw.generator) : undefined,
    error: raw.error ? String(raw.error) : undefined,
    node_count: Math.max(0, Math.floor(finiteNumber(raw.node_count, 0))),
    mesh_count: Math.max(0, Math.floor(finiteNumber(raw.mesh_count, 0))),
    material_count: Math.max(0, Math.floor(finiteNumber(raw.material_count, 0))),
    skin_count: Math.max(skins.length, Math.floor(finiteNumber(raw.skin_count, 0))),
    skins,
    bone_count: Math.max(bones.length, Math.floor(finiteNumber(raw.bone_count, 0))),
    bones,
    animation_count: Math.max(animations.length, Math.floor(finiteNumber(raw.animation_count, 0))),
    animations,
    humanoid: {
      recognized: rawHumanoid.recognized === true,
      profile: String(rawHumanoid.profile || "generic"),
      confidence: Math.min(1, Math.max(0, finiteNumber(rawHumanoid.confidence, 0))),
      mapped_joint_count: Math.max(0, Math.floor(finiteNumber(rawHumanoid.mapped_joint_count, Object.keys(jointMap).length))),
      joint_count: Math.max(DIRECTOR_MANNEQUIN_JOINTS.length, Math.floor(finiteNumber(rawHumanoid.joint_count, DIRECTOR_MANNEQUIN_JOINTS.length))),
      joint_map: jointMap,
      joint_node_map: jointNodeMap,
      missing_joints: DIRECTOR_MANNEQUIN_JOINTS.filter((joint) => missingSet.has(joint) || !(joint in jointMap)),
    },
  }
}

export function defaultDirectorCustomRig(asset?: DirectorModelAsset): DirectorCustomRigState {
  const mannequin = defaultDirectorMannequin()
  const firstClip = asset?.analysis?.animations.find((item) => item.kind === "animation")
    || asset?.analysis?.animations[0]
  const firstAnimation = firstClip?.name || null
  const firstAnimationIndex = firstClip?.index ?? null
  const continuousAnimation = firstClip?.kind === "animation"
  return {
    mode: firstAnimation ? "animation" : asset?.analysis?.humanoid.recognized ? "pose" : "bind",
    pose_preset: mannequin.pose_preset,
    joints: mannequin.joints,
    animation_name: firstAnimation,
    animation_index: firstAnimationIndex,
    animation_playing: continuousAnimation,
    animation_loop: continuousAnimation,
    animation_speed: 1,
  }
}

export function normalizeDirectorCustomRig(
  value: unknown,
  asset?: DirectorModelAsset,
): DirectorCustomRigState {
  const fallback = defaultDirectorCustomRig(asset)
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback
  const raw = value as Record<string, unknown>
  const mannequin = normalizeDirectorMannequin({
    pose_preset: raw.pose_preset,
    joints: raw.joints,
  })
  const mode = raw.mode === "pose" || raw.mode === "animation" || raw.mode === "bind"
    ? raw.mode
    : fallback.mode
  const speed = Math.min(4, Math.max(0.05, finiteNumber(raw.animation_speed, 1)))
  return {
    mode,
    pose_preset: mannequin.pose_preset,
    joints: mannequin.joints,
    animation_name: typeof raw.animation_name === "string" && raw.animation_name
      ? raw.animation_name
      : fallback.animation_name,
    animation_index: nullableIndex(raw.animation_index) ?? fallback.animation_index,
    animation_playing: raw.animation_playing !== false,
    animation_loop: raw.animation_loop !== false,
    animation_speed: speed,
  }
}

function normalizeCameraPose(value: unknown, fallback: DirectorCameraPose): DirectorCameraPose {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  return {
    position: vector3(raw.position, fallback.position),
    target: vector3(raw.target, fallback.target),
    fov: Math.min(120, Math.max(10, finiteNumber(raw.fov, fallback.fov))),
  }
}

export function normalizeDirectorScene(value: unknown): DirectorSceneState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const rawCamera = source.camera && typeof source.camera === "object" && !Array.isArray(source.camera)
    ? source.camera as Record<string, unknown>
    : {}
  const legacyCamera = normalizeCameraPose(rawCamera, {
    position: [4.8, 3, 6.8],
    target: [0, 1, 0],
    fov: 45,
  })
  const cameraIds = new Set<string>()
  const cameras = (Array.isArray(source.cameras) ? source.cameras : []).slice(0, MAX_DIRECTOR_CAMERAS).flatMap((item, index): DirectorCameraState[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const raw = item as Record<string, unknown>
    const id = String(raw.id || "").trim()
    if (!id || cameraIds.has(id)) return []
    cameraIds.add(id)
    return [{
      id,
      name: String(raw.name || `机位 ${index + 1}`).trim().slice(0, 120) || `机位 ${index + 1}`,
      ...normalizeCameraPose(raw, legacyCamera),
    }]
  })
  if (cameras.length === 0) {
    cameras.push({ id: "camera-main", name: "机位 1", ...legacyCamera })
  }
  const requestedActiveCameraId = String(source.active_camera_id || "").trim()
  const activeCamera = cameras.find((item) => item.id === requestedActiveCameraId) || cameras[0]
  const viewportFallback: DirectorCameraPose = {
    position: [
      activeCamera.position[0] + 4,
      activeCamera.position[1] + 3,
      activeCamera.position[2] + 4,
    ],
    target: [...activeCamera.target],
    fov: 45,
  }
  const aspectCandidate = String(source.aspect_ratio || "16:9") as DirectorAspectRatio
  const rawObjects = Array.isArray(source.objects) ? source.objects : []
  const rawPanorama = source.panorama && typeof source.panorama === "object" && !Array.isArray(source.panorama)
    ? source.panorama as Record<string, unknown>
    : null
  const panoramaUrl = String(rawPanorama?.image_url || "").trim()
  return {
    aspect_ratio: ASPECT_RATIOS.has(aspectCandidate) ? aspectCandidate : "16:9",
    camera: {
      position: [...activeCamera.position],
      target: [...activeCamera.target],
      fov: activeCamera.fov,
    },
    cameras,
    active_camera_id: activeCamera.id,
    viewport_camera: normalizeCameraPose(source.viewport_camera, viewportFallback),
    panorama: rawPanorama && panoramaUrl
      ? {
          source_node_id: String(rawPanorama.source_node_id || "").trim() || undefined,
          title: String(rawPanorama.title || "全景环境").trim().slice(0, 200) || "全景环境",
          image_url: panoramaUrl,
          rotation_y: Math.min(180, Math.max(-180, finiteNumber(rawPanorama.rotation_y, 0))),
          visible: rawPanorama.visible !== false,
        }
      : null,
    objects: rawObjects.slice(0, 100).flatMap((item, index): DirectorObjectState[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return []
      const raw = item as Record<string, unknown>
      const id = String(raw.id || "").trim()
      const assetId = String(raw.asset_id || "").trim()
      if (!id || !assetId) return []
      return [{
        id,
        asset_id: assetId,
        name: String(raw.name || `物体 ${index + 1}`),
        color: String(raw.color || "#a1a1aa"),
        position: vector3(raw.position, [0, 0, 0]),
        rotation: vector3(raw.rotation, [0, 0, 0]),
        scale: vector3(raw.scale, [1, 1, 1]),
        visible: raw.visible !== false,
        locked: raw.locked === true,
        mannequin: assetId === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID
          ? normalizeDirectorMannequin(raw.mannequin)
          : undefined,
        rig: !assetId.startsWith("builtin:") && raw.rig !== undefined
          ? normalizeDirectorCustomRig(raw.rig)
          : undefined,
      }]
    }),
  }
}

export function normalizeDirectorDesk(value: unknown): DirectorDeskState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const modelAssets = Array.isArray(source.model_assets) ? source.model_assets : []
  const captures = Array.isArray(source.captures) ? source.captures : []
  return {
    version: 2,
    revision: Math.max(0, Math.floor(finiteNumber(source.revision, 0))),
    scene: normalizeDirectorScene(source.scene),
    model_assets: modelAssets.slice(0, 100).flatMap((item): DirectorModelAsset[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return []
      const raw = item as Record<string, unknown>
      const id = String(raw.id || "").trim()
      const url = String(raw.url || "").trim()
      if (!id || !url) return []
      return [{
        id,
        name: String(raw.name || "model.glb"),
        file_name: String(raw.file_name || ""),
        url,
        size: Math.max(0, finiteNumber(raw.size, 0)),
        created_at: raw.created_at ? String(raw.created_at) : undefined,
        analysis: normalizeModelAnalysis(raw.analysis),
      }]
    }),
    captures: captures.slice(0, 200).flatMap((item, index): DirectorCapture[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return []
      const raw = item as Record<string, unknown>
      const id = String(raw.id || "").trim()
      const imageUrl = String(raw.image_url || "").trim()
      if (!id || !imageUrl) return []
      const aspect = String(raw.aspect_ratio || "16:9") as DirectorAspectRatio
      const legend = Array.isArray(raw.actor_legend) ? raw.actor_legend : []
      return [{
        id,
        order: Math.max(0, Math.floor(finiteNumber(raw.order, index))),
        title: String(raw.title || `镜头 ${index + 1}`),
        file_name: String(raw.file_name || ""),
        image_url: imageUrl,
        created_at: String(raw.created_at || ""),
        aspect_ratio: ASPECT_RATIOS.has(aspect) ? aspect : "16:9",
        scene_snapshot: normalizeDirectorScene(raw.scene_snapshot),
        actor_legend: legend.slice(0, 40).flatMap((entry): DirectorActorLegendItem[] => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
          const record = entry as Record<string, unknown>
          return [{
            label: String(record.label || "人物"),
            color: String(record.color || "#a1a1aa"),
            object_id: record.object_id ? String(record.object_id) : undefined,
          }]
        }),
        camera_id: raw.camera_id ? String(raw.camera_id) : null,
        camera_name: raw.camera_name ? String(raw.camera_name) : null,
        promoted_node_id: raw.promoted_node_id ? String(raw.promoted_node_id) : null,
      }]
    }).sort((a, b) => a.order - b.order),
  }
}

export function cloneDirectorScene(scene: DirectorSceneState): DirectorSceneState {
  return normalizeDirectorScene(JSON.parse(JSON.stringify(scene)) as unknown)
}

export function newDirectorCamera(existing: DirectorCameraState[], source: DirectorCameraPose): DirectorCameraState {
  const usedNames = new Set(existing.map((item) => item.name))
  let number = existing.length + 1
  while (usedNames.has(`机位 ${number}`)) number += 1
  return {
    id: createDirectorId("camera"),
    name: `机位 ${number}`,
    position: [...source.position],
    target: [...source.target],
    fov: source.fov,
  }
}

function nextDirectorObjectPosition(existing: DirectorObjectState[]): [number, number, number] {
  const columnOrder = [0, -1, 1, -2, 2]
  const xSpacing = 2.2
  const zSpacing = 1.8
  const minimumSpacing = 1.35
  for (let row = 0; row < 20; row += 1) {
    for (const column of columnOrder) {
      const x = column * xSpacing
      const z = -row * zSpacing
      const occupied = existing.some((item) => Math.hypot(item.position[0] - x, item.position[2] - z) < minimumSpacing)
      if (!occupied) return [x, 0, z]
    }
  }
  return [0, 0, -20 * zSpacing]
}

export function newDirectorObject(
  assetId: string,
  defaultName: string,
  existing: DirectorObjectState[],
  asset?: DirectorModelAsset,
): DirectorObjectState {
  const sameAssetCount = existing.filter((item) => item.asset_id === assetId).length
  const mannequinCount = existing.filter((item) => item.asset_id === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID).length
  return {
    id: createDirectorId("object"),
    asset_id: assetId,
    name: `${defaultName} ${sameAssetCount + 1}`,
    color: assetId === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID
      ? DIRECTOR_CHARACTER_COLORS[mannequinCount % DIRECTOR_CHARACTER_COLORS.length]
      : "#a1a1aa",
    position: nextDirectorObjectPosition(existing),
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    mannequin: assetId === DIRECTOR_STANDARD_MANNEQUIN_ASSET_ID ? defaultDirectorMannequin() : undefined,
    rig: asset ? defaultDirectorCustomRig(asset) : undefined,
  }
}
