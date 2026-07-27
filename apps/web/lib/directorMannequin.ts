export const DIRECTOR_MANNEQUIN_JOINTS = [
  "spine",
  "chest",
  "neck",
  "head",
  "leftShoulder",
  "leftElbow",
  "leftWrist",
  "rightShoulder",
  "rightElbow",
  "rightWrist",
  "leftHip",
  "leftKnee",
  "leftAnkle",
  "rightHip",
  "rightKnee",
  "rightAnkle",
] as const

export type DirectorMannequinJoint = typeof DIRECTOR_MANNEQUIN_JOINTS[number]
export type DirectorMannequinBodyPreset = "compact" | "standard" | "slender" | "athletic" | "broad" | "custom"
export type DirectorMannequinPosePreset = "relaxed" | "attention" | "a-pose" | "t-pose" | "walk" | "run" | "sit" | "crouch" | "wave" | "point" | "hands-hips" | "custom"

export interface DirectorMannequinProportions {
  height: number
  build: number
  shoulder_width: number
  hip_width: number
  torso_length: number
  arm_length: number
  leg_length: number
  head_scale: number
}

export interface DirectorMannequinState {
  body_preset: DirectorMannequinBodyPreset
  pose_preset: DirectorMannequinPosePreset
  proportions: DirectorMannequinProportions
  joints: Record<DirectorMannequinJoint, [number, number, number]>
}

export interface DirectorMannequinJointInfo {
  id: DirectorMannequinJoint
  label: string
  group: "躯干" | "左臂" | "右臂" | "左腿" | "右腿"
}

export const DIRECTOR_MANNEQUIN_JOINT_INFO: DirectorMannequinJointInfo[] = [
  { id: "spine", label: "腰 / 脊柱", group: "躯干" },
  { id: "chest", label: "胸椎", group: "躯干" },
  { id: "neck", label: "颈部", group: "躯干" },
  { id: "head", label: "头部", group: "躯干" },
  { id: "leftShoulder", label: "左肩", group: "左臂" },
  { id: "leftElbow", label: "左肘", group: "左臂" },
  { id: "leftWrist", label: "左腕", group: "左臂" },
  { id: "rightShoulder", label: "右肩", group: "右臂" },
  { id: "rightElbow", label: "右肘", group: "右臂" },
  { id: "rightWrist", label: "右腕", group: "右臂" },
  { id: "leftHip", label: "左髋", group: "左腿" },
  { id: "leftKnee", label: "左膝", group: "左腿" },
  { id: "leftAnkle", label: "左踝", group: "左腿" },
  { id: "rightHip", label: "右髋", group: "右腿" },
  { id: "rightKnee", label: "右膝", group: "右腿" },
  { id: "rightAnkle", label: "右踝", group: "右腿" },
]

export const DIRECTOR_MANNEQUIN_BODY_PRESETS: Array<{
  id: Exclude<DirectorMannequinBodyPreset, "custom">
  label: string
  description: string
  proportions: DirectorMannequinProportions
}> = [
  {
    id: "compact",
    label: "紧凑",
    description: "较短四肢与自然宽度",
    proportions: { height: 1.58, build: 0.96, shoulder_width: 0.94, hip_width: 1.02, torso_length: 0.96, arm_length: 0.94, leg_length: 0.93, head_scale: 1.04 },
  },
  {
    id: "standard",
    label: "标准",
    description: "七头半自然人体比例",
    proportions: { height: 1.72, build: 1, shoulder_width: 1, hip_width: 1, torso_length: 1, arm_length: 1, leg_length: 1, head_scale: 1 },
  },
  {
    id: "slender",
    label: "修长",
    description: "窄体型与较长四肢",
    proportions: { height: 1.8, build: 0.82, shoulder_width: 0.94, hip_width: 0.92, torso_length: 1.02, arm_length: 1.05, leg_length: 1.07, head_scale: 0.97 },
  },
  {
    id: "athletic",
    label: "运动",
    description: "肩背展开、肢体匀称",
    proportions: { height: 1.78, build: 1.12, shoulder_width: 1.14, hip_width: 0.98, torso_length: 1.02, arm_length: 1.03, leg_length: 1.03, head_scale: 0.98 },
  },
  {
    id: "broad",
    label: "厚实",
    description: "宽肩、宽躯干与粗四肢",
    proportions: { height: 1.82, build: 1.25, shoulder_width: 1.2, hip_width: 1.08, torso_length: 1.05, arm_length: 1.02, leg_length: 0.99, head_scale: 1 },
  },
]

export const DIRECTOR_MANNEQUIN_SIZE_PRESETS = [
  { label: "小", height: 1.55 },
  { label: "中", height: 1.72 },
  { label: "高", height: 1.88 },
] as const

function emptyJointMap(): Record<DirectorMannequinJoint, [number, number, number]> {
  return Object.fromEntries(
    DIRECTOR_MANNEQUIN_JOINTS.map((joint) => [joint, [0, 0, 0] as [number, number, number]]),
  ) as Record<DirectorMannequinJoint, [number, number, number]>
}

function pose(
  values: Partial<Record<DirectorMannequinJoint, [number, number, number]>>,
): Record<DirectorMannequinJoint, [number, number, number]> {
  return { ...emptyJointMap(), ...values }
}

export const DIRECTOR_MANNEQUIN_POSE_PRESETS: Array<{
  id: Exclude<DirectorMannequinPosePreset, "custom">
  label: string
  description: string
  joints: Record<DirectorMannequinJoint, [number, number, number]>
}> = [
  {
    id: "relaxed",
    label: "自然站立",
    description: "适合对话和构图起点",
    joints: pose({
      spine: [0, 0, 1], chest: [0, 0, -1], head: [1, 0, 0],
      leftShoulder: [-3, 0, -7], rightShoulder: [-3, 0, 7],
      leftElbow: [-7, 0, -2], rightElbow: [-7, 0, 2],
      leftHip: [2, 0, -2], rightHip: [-3, 0, 2],
      leftKnee: [3, 0, 0], rightKnee: [6, 0, 0],
    }),
  },
  {
    id: "attention",
    label: "立正",
    description: "身体挺直、手臂贴近",
    joints: pose({ leftShoulder: [0, 0, -3], rightShoulder: [0, 0, 3] }),
  },
  {
    id: "a-pose",
    label: "A Pose",
    description: "手臂自然展开",
    joints: pose({ leftShoulder: [0, 0, -34], rightShoulder: [0, 0, 34] }),
  },
  {
    id: "t-pose",
    label: "T Pose",
    description: "手臂水平展开",
    joints: pose({ leftShoulder: [0, 0, -90], rightShoulder: [0, 0, 90] }),
  },
  {
    id: "walk",
    label: "行走",
    description: "自然迈步与摆臂",
    joints: pose({
      spine: [3, -4, 0], chest: [-2, 5, 0],
      leftShoulder: [27, 0, -7], rightShoulder: [-30, 0, 7],
      leftElbow: [-18, 0, 0], rightElbow: [-22, 0, 0],
      leftHip: [-30, 0, -2], rightHip: [24, 0, 2],
      leftKnee: [34, 0, 0], rightKnee: [8, 0, 0],
      leftAnkle: [-8, 0, 0], rightAnkle: [9, 0, 0],
    }),
  },
  {
    id: "run",
    label: "奔跑",
    description: "前倾、高抬腿与屈肘",
    joints: pose({
      spine: [-12, 0, 0], chest: [-6, 0, 0], neck: [9, 0, 0],
      leftShoulder: [48, 0, -8], rightShoulder: [-55, 0, 8],
      leftElbow: [-72, 0, 0], rightElbow: [-82, 0, 0],
      leftHip: [-58, 0, -3], rightHip: [38, 0, 3],
      leftKnee: [82, 0, 0], rightKnee: [58, 0, 0],
      leftAnkle: [-22, 0, 0], rightAnkle: [12, 0, 0],
    }),
  },
  {
    id: "sit",
    label: "坐姿",
    description: "髋膝约九十度",
    joints: pose({
      spine: [5, 0, 0], chest: [-3, 0, 0],
      leftShoulder: [-8, 0, -10], rightShoulder: [-8, 0, 10],
      leftElbow: [-18, 0, 0], rightElbow: [-18, 0, 0],
      leftHip: [-88, 0, 0], rightHip: [-88, 0, 0],
      leftKnee: [86, 0, 0], rightKnee: [86, 0, 0],
      leftAnkle: [2, 0, 0], rightAnkle: [2, 0, 0],
    }),
  },
  {
    id: "crouch",
    label: "下蹲",
    description: "重心降低、膝盖弯曲",
    joints: pose({
      spine: [-19, 0, 0], chest: [7, 0, 0], neck: [9, 0, 0],
      leftShoulder: [-17, 0, -15], rightShoulder: [-17, 0, 15],
      leftElbow: [-30, 0, 0], rightElbow: [-30, 0, 0],
      leftHip: [-48, 0, -4], rightHip: [-48, 0, 4],
      leftKnee: [93, 0, 0], rightKnee: [93, 0, 0],
      leftAnkle: [-40, 0, 0], rightAnkle: [-40, 0, 0],
    }),
  },
  {
    id: "wave",
    label: "挥手",
    description: "右手举起打招呼",
    joints: pose({
      chest: [0, -7, 0], head: [0, 8, 0],
      leftShoulder: [-4, 0, -8], leftElbow: [-8, 0, 0],
      rightShoulder: [-10, 8, 132], rightElbow: [-12, 0, -88], rightWrist: [0, 0, 18],
      leftHip: [2, 0, -2], rightHip: [-3, 0, 2],
    }),
  },
  {
    id: "point",
    label: "指向",
    description: "右臂向前指示",
    joints: pose({
      chest: [0, -12, 0], head: [0, -8, 0],
      leftShoulder: [-4, 0, -8], rightShoulder: [-88, 0, 5],
      rightElbow: [-8, 0, 0], rightWrist: [2, 0, 0],
    }),
  },
  {
    id: "hands-hips",
    label: "叉腰",
    description: "双臂外展、手落髋部",
    joints: pose({
      chest: [0, 0, 0],
      leftShoulder: [-10, 12, -40], rightShoulder: [-10, -12, 40],
      leftElbow: [-18, 0, 104], rightElbow: [-18, 0, -104],
      leftWrist: [0, 0, -18], rightWrist: [0, 0, 18],
    }),
  },
]

const BODY_PRESET_IDS: ReadonlySet<string> = new Set(DIRECTOR_MANNEQUIN_BODY_PRESETS.map((item) => item.id))
const POSE_PRESET_IDS: ReadonlySet<string> = new Set(DIRECTOR_MANNEQUIN_POSE_PRESETS.map((item) => item.id))

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)))
}

function vector3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) return [...fallback]
  return [
    clamp(value[0], -180, 180, fallback[0]),
    clamp(value[1], -180, 180, fallback[1]),
    clamp(value[2], -180, 180, fallback[2]),
  ]
}

export function defaultDirectorMannequin(): DirectorMannequinState {
  const body = DIRECTOR_MANNEQUIN_BODY_PRESETS.find((item) => item.id === "standard")!
  const posture = DIRECTOR_MANNEQUIN_POSE_PRESETS.find((item) => item.id === "relaxed")!
  return {
    body_preset: body.id,
    pose_preset: posture.id,
    proportions: { ...body.proportions },
    joints: Object.fromEntries(
      DIRECTOR_MANNEQUIN_JOINTS.map((joint) => [joint, [...posture.joints[joint]]]),
    ) as Record<DirectorMannequinJoint, [number, number, number]>,
  }
}

export function normalizeDirectorMannequin(value: unknown): DirectorMannequinState {
  const fallback = defaultDirectorMannequin()
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const rawProportions = source.proportions && typeof source.proportions === "object" && !Array.isArray(source.proportions)
    ? source.proportions as Record<string, unknown>
    : {}
  const rawJoints = source.joints && typeof source.joints === "object" && !Array.isArray(source.joints)
    ? source.joints as Record<string, unknown>
    : {}
  const bodyPreset = String(source.body_preset || fallback.body_preset)
  const posePreset = String(source.pose_preset || fallback.pose_preset)
  return {
    body_preset: (bodyPreset === "custom" || BODY_PRESET_IDS.has(bodyPreset) ? bodyPreset : fallback.body_preset) as DirectorMannequinBodyPreset,
    pose_preset: (posePreset === "custom" || POSE_PRESET_IDS.has(posePreset) ? posePreset : fallback.pose_preset) as DirectorMannequinPosePreset,
    proportions: {
      height: clamp(rawProportions.height, 1.35, 2.15, fallback.proportions.height),
      build: clamp(rawProportions.build, 0.68, 1.38, fallback.proportions.build),
      shoulder_width: clamp(rawProportions.shoulder_width, 0.72, 1.35, fallback.proportions.shoulder_width),
      hip_width: clamp(rawProportions.hip_width, 0.75, 1.3, fallback.proportions.hip_width),
      torso_length: clamp(rawProportions.torso_length, 0.78, 1.24, fallback.proportions.torso_length),
      arm_length: clamp(rawProportions.arm_length, 0.75, 1.3, fallback.proportions.arm_length),
      leg_length: clamp(rawProportions.leg_length, 0.75, 1.3, fallback.proportions.leg_length),
      head_scale: clamp(rawProportions.head_scale, 0.78, 1.25, fallback.proportions.head_scale),
    },
    joints: Object.fromEntries(
      DIRECTOR_MANNEQUIN_JOINTS.map((joint) => [joint, vector3(rawJoints[joint], fallback.joints[joint])]),
    ) as Record<DirectorMannequinJoint, [number, number, number]>,
  }
}

export function applyDirectorMannequinBodyPreset(
  state: DirectorMannequinState,
  presetId: Exclude<DirectorMannequinBodyPreset, "custom">,
): DirectorMannequinState {
  const preset = DIRECTOR_MANNEQUIN_BODY_PRESETS.find((item) => item.id === presetId)
  if (!preset) return normalizeDirectorMannequin(state)
  return normalizeDirectorMannequin({
    ...state,
    body_preset: preset.id,
    proportions: preset.proportions,
  })
}

export function applyDirectorMannequinPosePreset(
  state: DirectorMannequinState,
  presetId: Exclude<DirectorMannequinPosePreset, "custom">,
): DirectorMannequinState {
  const preset = DIRECTOR_MANNEQUIN_POSE_PRESETS.find((item) => item.id === presetId)
  if (!preset) return normalizeDirectorMannequin(state)
  return normalizeDirectorMannequin({
    ...state,
    pose_preset: preset.id,
    joints: preset.joints,
  })
}
