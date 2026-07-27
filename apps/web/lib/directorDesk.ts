import {
  defaultDirectorMannequin,
  normalizeDirectorMannequin,
  type DirectorMannequinState,
} from "@/lib/directorMannequin"

export type DirectorAspectRatio = "16:9" | "9:16" | "1:1" | "4:3"
export type DirectorTransformMode = "translate" | "rotate" | "scale"

export interface DirectorCameraState {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
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
}

export interface DirectorSceneState {
  aspect_ratio: DirectorAspectRatio
  camera: DirectorCameraState
  objects: DirectorObjectState[]
}

export interface DirectorModelAsset {
  id: string
  name: string
  file_name: string
  url: string
  size: number
  created_at?: string
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

export const DIRECTOR_BUILTINS = [
  { id: "builtin:mannequin", label: "可调人物", defaultName: "人物" },
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
  return {
    aspect_ratio: "16:9",
    camera: {
      position: [4.8, 3, 6.8],
      target: [0, 1, 0],
      fov: 45,
    },
    objects: [],
  }
}

export function defaultDirectorDesk(): DirectorDeskState {
  return {
    version: 1,
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

export function normalizeDirectorScene(value: unknown): DirectorSceneState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const rawCamera = source.camera && typeof source.camera === "object" && !Array.isArray(source.camera)
    ? source.camera as Record<string, unknown>
    : {}
  const aspectCandidate = String(source.aspect_ratio || "16:9") as DirectorAspectRatio
  const rawObjects = Array.isArray(source.objects) ? source.objects : []
  return {
    aspect_ratio: ASPECT_RATIOS.has(aspectCandidate) ? aspectCandidate : "16:9",
    camera: {
      position: vector3(rawCamera.position, [4.8, 3, 6.8]),
      target: vector3(rawCamera.target, [0, 1, 0]),
      fov: Math.min(120, Math.max(10, finiteNumber(rawCamera.fov, 45))),
    },
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
        mannequin: assetId === "builtin:mannequin"
          ? normalizeDirectorMannequin(raw.mannequin)
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
    version: 1,
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
        promoted_node_id: raw.promoted_node_id ? String(raw.promoted_node_id) : null,
      }]
    }).sort((a, b) => a.order - b.order),
  }
}

export function cloneDirectorScene(scene: DirectorSceneState): DirectorSceneState {
  return normalizeDirectorScene(JSON.parse(JSON.stringify(scene)) as unknown)
}

export function newDirectorObject(
  assetId: string,
  defaultName: string,
  existing: DirectorObjectState[],
): DirectorObjectState {
  const sameAssetCount = existing.filter((item) => item.asset_id === assetId).length
  const mannequinCount = existing.filter((item) => item.asset_id === "builtin:mannequin").length
  return {
    id: createDirectorId("object"),
    asset_id: assetId,
    name: `${defaultName} ${sameAssetCount + 1}`,
    color: assetId === "builtin:mannequin"
      ? DIRECTOR_CHARACTER_COLORS[mannequinCount % DIRECTOR_CHARACTER_COLORS.length]
      : "#a1a1aa",
    position: [Math.min(3, existing.length * 0.45), 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    mannequin: assetId === "builtin:mannequin" ? defaultDirectorMannequin() : undefined,
  }
}
