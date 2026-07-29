import {
  DIRECTOR_SHORT_DRAMA_POSE_DEFINITIONS,
  type DirectorShortDramaHandShape,
  type DirectorShortDramaPoseDefinition,
  type DirectorShortDramaPoseId,
} from "@/lib/directorShortDramaPoses"

export const DIRECTOR_MANNEQUIN_JOINTS = [
  "pelvis",
  "spine",
  "spineMiddle",
  "chest",
  "neck",
  "head",
  "leftClavicle",
  "leftShoulder",
  "leftElbow",
  "leftWrist",
  "leftThumb1",
  "leftThumb2",
  "leftThumb3",
  "leftIndex1",
  "leftIndex2",
  "leftIndex3",
  "leftMiddle1",
  "leftMiddle2",
  "leftMiddle3",
  "leftRing1",
  "leftRing2",
  "leftRing3",
  "leftPinky1",
  "leftPinky2",
  "leftPinky3",
  "rightClavicle",
  "rightShoulder",
  "rightElbow",
  "rightWrist",
  "rightThumb1",
  "rightThumb2",
  "rightThumb3",
  "rightIndex1",
  "rightIndex2",
  "rightIndex3",
  "rightMiddle1",
  "rightMiddle2",
  "rightMiddle3",
  "rightRing1",
  "rightRing2",
  "rightRing3",
  "rightPinky1",
  "rightPinky2",
  "rightPinky3",
  "leftHip",
  "leftKnee",
  "leftAnkle",
  "leftToe",
  "rightHip",
  "rightKnee",
  "rightAnkle",
  "rightToe",
] as const

export type DirectorMannequinJoint = typeof DIRECTOR_MANNEQUIN_JOINTS[number]
export type DirectorMannequinAnatomy = "masculine" | "feminine"
export type DirectorMannequinBodyPreset = "compact" | "standard" | "slender" | "athletic" | "broad" | "custom"
type DirectorMannequinCorePosePreset =
  | "relaxed"
  | "attention"
  | "a-pose"
  | "t-pose"
  | "walk"
  | "run"
  | "sit"
  | "crouch"
  | "wave"
  | "point"
  | "hands-hips"
  | "open-arms"
  | "explain"
  | "hands-back"
  | "look-back"
  | "salute"
  | "celebrate"
  | "lunge"
  | "high-step"

export type DirectorMannequinPosePreset =
  | DirectorMannequinCorePosePreset
  | DirectorShortDramaPoseId
  | "custom"

export const DIRECTOR_MANNEQUIN_POSE_CATEGORIES = [
  "骨骼基准",
  "基础站姿",
  "沟通交流",
  "情绪表演",
  "日常生活",
  "行走运动",
  "冲突动作",
] as const

export type DirectorMannequinPoseCategory = typeof DIRECTOR_MANNEQUIN_POSE_CATEGORIES[number]

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
  anatomy: DirectorMannequinAnatomy
  body_preset: DirectorMannequinBodyPreset
  pose_preset: DirectorMannequinPosePreset
  proportions: DirectorMannequinProportions
  joints: Record<DirectorMannequinJoint, [number, number, number]>
}

export interface DirectorMannequinJointInfo {
  id: DirectorMannequinJoint
  label: string
  group: "躯干" | "左臂" | "左手" | "右臂" | "右手" | "左腿" | "右腿"
}

export type DirectorMannequinJointLimits = Record<
  DirectorMannequinJoint,
  [[number, number], [number, number], [number, number]]
>

// The director desk stores left/right from the viewer-facing stage coordinate
// system used by the original procedural mannequin. These limits describe the
// safe control envelope of the standard Mesh2Motion humanoid rig.
export const DIRECTOR_MANNEQUIN_JOINT_LIMITS: DirectorMannequinJointLimits = {
  pelvis: [[-35, 35], [-50, 50], [-30, 30]],
  spine: [[-45, 45], [-55, 55], [-35, 35]],
  spineMiddle: [[-35, 35], [-45, 45], [-30, 30]],
  chest: [[-45, 45], [-55, 55], [-35, 35]],
  neck: [[-45, 45], [-70, 70], [-35, 35]],
  head: [[-55, 55], [-80, 80], [-45, 45]],
  leftClavicle: [[-35, 35], [-30, 30], [-40, 40]],
  leftShoulder: [[-120, 120], [-90, 90], [-150, 150]],
  leftElbow: [[-145, 15], [-45, 45], [-120, 120]],
  leftWrist: [[-75, 75], [-80, 80], [-75, 75]],
  leftThumb1: [[-55, 65], [-55, 55], [-55, 55]],
  leftThumb2: [[-15, 85], [-25, 25], [-25, 25]],
  leftThumb3: [[-10, 85], [-20, 20], [-20, 20]],
  leftIndex1: [[-25, 95], [-25, 25], [-25, 25]],
  leftIndex2: [[-10, 110], [-12, 12], [-12, 12]],
  leftIndex3: [[-10, 100], [-12, 12], [-12, 12]],
  leftMiddle1: [[-25, 95], [-20, 20], [-20, 20]],
  leftMiddle2: [[-10, 110], [-12, 12], [-12, 12]],
  leftMiddle3: [[-10, 100], [-12, 12], [-12, 12]],
  leftRing1: [[-25, 95], [-20, 20], [-20, 20]],
  leftRing2: [[-10, 110], [-12, 12], [-12, 12]],
  leftRing3: [[-10, 100], [-12, 12], [-12, 12]],
  leftPinky1: [[-25, 95], [-25, 25], [-25, 25]],
  leftPinky2: [[-10, 110], [-12, 12], [-12, 12]],
  leftPinky3: [[-10, 100], [-12, 12], [-12, 12]],
  rightClavicle: [[-35, 35], [-30, 30], [-40, 40]],
  rightShoulder: [[-120, 120], [-90, 90], [-150, 150]],
  rightElbow: [[-145, 15], [-45, 45], [-120, 120]],
  rightWrist: [[-75, 75], [-80, 80], [-75, 75]],
  rightThumb1: [[-55, 65], [-55, 55], [-55, 55]],
  rightThumb2: [[-15, 85], [-25, 25], [-25, 25]],
  rightThumb3: [[-10, 85], [-20, 20], [-20, 20]],
  rightIndex1: [[-25, 95], [-25, 25], [-25, 25]],
  rightIndex2: [[-10, 110], [-12, 12], [-12, 12]],
  rightIndex3: [[-10, 100], [-12, 12], [-12, 12]],
  rightMiddle1: [[-25, 95], [-20, 20], [-20, 20]],
  rightMiddle2: [[-10, 110], [-12, 12], [-12, 12]],
  rightMiddle3: [[-10, 100], [-12, 12], [-12, 12]],
  rightRing1: [[-25, 95], [-20, 20], [-20, 20]],
  rightRing2: [[-10, 110], [-12, 12], [-12, 12]],
  rightRing3: [[-10, 100], [-12, 12], [-12, 12]],
  rightPinky1: [[-25, 95], [-25, 25], [-25, 25]],
  rightPinky2: [[-10, 110], [-12, 12], [-12, 12]],
  rightPinky3: [[-10, 100], [-12, 12], [-12, 12]],
  leftHip: [[-110, 65], [-60, 60], [-55, 55]],
  leftKnee: [[-5, 145], [-15, 15], [-15, 15]],
  leftAnkle: [[-55, 45], [-35, 35], [-35, 35]],
  leftToe: [[-45, 55], [-18, 18], [-18, 18]],
  rightHip: [[-110, 65], [-60, 60], [-55, 55]],
  rightKnee: [[-5, 145], [-15, 15], [-15, 15]],
  rightAnkle: [[-55, 45], [-35, 35], [-35, 35]],
  rightToe: [[-45, 55], [-18, 18], [-18, 18]],
}

export const DIRECTOR_MANNEQUIN_JOINT_INFO: DirectorMannequinJointInfo[] = [
  { id: "pelvis", label: "骨盆", group: "躯干" },
  { id: "spine", label: "腰 / 脊柱", group: "躯干" },
  { id: "spineMiddle", label: "胸椎中段", group: "躯干" },
  { id: "chest", label: "胸椎上段", group: "躯干" },
  { id: "neck", label: "颈部", group: "躯干" },
  { id: "head", label: "头部", group: "躯干" },
  { id: "leftClavicle", label: "左锁骨", group: "左臂" },
  { id: "leftShoulder", label: "左肩", group: "左臂" },
  { id: "leftElbow", label: "左肘", group: "左臂" },
  { id: "leftWrist", label: "左腕 / 手掌", group: "左臂" },
  { id: "leftThumb1", label: "左拇指根节", group: "左手" },
  { id: "leftThumb2", label: "左拇指中节", group: "左手" },
  { id: "leftThumb3", label: "左拇指末节", group: "左手" },
  { id: "leftIndex1", label: "左食指根节", group: "左手" },
  { id: "leftIndex2", label: "左食指中节", group: "左手" },
  { id: "leftIndex3", label: "左食指末节", group: "左手" },
  { id: "leftMiddle1", label: "左中指根节", group: "左手" },
  { id: "leftMiddle2", label: "左中指中节", group: "左手" },
  { id: "leftMiddle3", label: "左中指末节", group: "左手" },
  { id: "leftRing1", label: "左无名指根节", group: "左手" },
  { id: "leftRing2", label: "左无名指中节", group: "左手" },
  { id: "leftRing3", label: "左无名指末节", group: "左手" },
  { id: "leftPinky1", label: "左小指根节", group: "左手" },
  { id: "leftPinky2", label: "左小指中节", group: "左手" },
  { id: "leftPinky3", label: "左小指末节", group: "左手" },
  { id: "rightClavicle", label: "右锁骨", group: "右臂" },
  { id: "rightShoulder", label: "右肩", group: "右臂" },
  { id: "rightElbow", label: "右肘", group: "右臂" },
  { id: "rightWrist", label: "右腕 / 手掌", group: "右臂" },
  { id: "rightThumb1", label: "右拇指根节", group: "右手" },
  { id: "rightThumb2", label: "右拇指中节", group: "右手" },
  { id: "rightThumb3", label: "右拇指末节", group: "右手" },
  { id: "rightIndex1", label: "右食指根节", group: "右手" },
  { id: "rightIndex2", label: "右食指中节", group: "右手" },
  { id: "rightIndex3", label: "右食指末节", group: "右手" },
  { id: "rightMiddle1", label: "右中指根节", group: "右手" },
  { id: "rightMiddle2", label: "右中指中节", group: "右手" },
  { id: "rightMiddle3", label: "右中指末节", group: "右手" },
  { id: "rightRing1", label: "右无名指根节", group: "右手" },
  { id: "rightRing2", label: "右无名指中节", group: "右手" },
  { id: "rightRing3", label: "右无名指末节", group: "右手" },
  { id: "rightPinky1", label: "右小指根节", group: "右手" },
  { id: "rightPinky2", label: "右小指中节", group: "右手" },
  { id: "rightPinky3", label: "右小指末节", group: "右手" },
  { id: "leftHip", label: "左髋", group: "左腿" },
  { id: "leftKnee", label: "左膝", group: "左腿" },
  { id: "leftAnkle", label: "左踝", group: "左腿" },
  { id: "leftToe", label: "左前脚掌 / 脚趾", group: "左腿" },
  { id: "rightHip", label: "右髋", group: "右腿" },
  { id: "rightKnee", label: "右膝", group: "右腿" },
  { id: "rightAnkle", label: "右踝", group: "右腿" },
  { id: "rightToe", label: "右前脚掌 / 脚趾", group: "右腿" },
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

type DirectorMannequinJointValues = Partial<
  Record<DirectorMannequinJoint, [number, number, number]>
>

type DirectorHandShape =
  | "relaxed"
  | "straight"
  | "open"
  | "soft-fist"
  | "fist"
  | "point"
  | "waist"
  | "clasp"

function fingerShape(
  side: "left" | "right",
  finger: "Thumb" | "Index" | "Middle" | "Ring" | "Pinky",
  curl: [number, number, number],
  spread = 0,
): DirectorMannequinJointValues {
  return {
    [`${side}${finger}1`]: [curl[0], 0, spread],
    [`${side}${finger}2`]: [curl[1], 0, 0],
    [`${side}${finger}3`]: [curl[2], 0, 0],
  }
}

function handShape(
  side: "left" | "right",
  shape: DirectorHandShape,
): DirectorMannequinJointValues {
  const mirror = side === "left" ? -1 : 1
  const fingers = (
    index: [number, number, number],
    middle: [number, number, number],
    ring: [number, number, number],
    pinky: [number, number, number],
    spread = 0,
  ): DirectorMannequinJointValues => ({
    ...fingerShape(side, "Index", index, -spread * mirror),
    ...fingerShape(side, "Middle", middle, -spread * 0.3 * mirror),
    ...fingerShape(side, "Ring", ring, spread * 0.35 * mirror),
    ...fingerShape(side, "Pinky", pinky, spread * mirror),
  })

  if (shape === "straight") {
    return {
      ...fingerShape(side, "Thumb", [2, 3, 2], 2 * mirror),
      ...fingers([0, 1, 0], [0, 1, 0], [1, 2, 1], [2, 3, 2]),
    }
  }
  if (shape === "open") {
    return {
      ...fingerShape(side, "Thumb", [-5, 4, 2], 8 * mirror),
      ...fingers([0, 1, 1], [0, 1, 1], [1, 2, 1], [2, 3, 2], 5),
    }
  }
  if (shape === "soft-fist") {
    return {
      ...fingerShape(side, "Thumb", [18, 18, 10], 3 * mirror),
      ...fingers([34, 48, 30], [38, 52, 34], [42, 56, 38], [46, 60, 42], 1),
    }
  }
  if (shape === "fist") {
    return {
      ...fingerShape(side, "Thumb", [30, 34, 20], 1 * mirror),
      ...fingers([58, 84, 64], [62, 88, 68], [64, 90, 70], [66, 92, 72]),
    }
  }
  if (shape === "point") {
    return {
      ...fingerShape(side, "Thumb", [30, 34, 20], 1 * mirror),
      ...fingerShape(side, "Index", [0, 1, 1]),
      ...fingerShape(side, "Middle", [62, 86, 66]),
      ...fingerShape(side, "Ring", [66, 90, 70]),
      ...fingerShape(side, "Pinky", [68, 92, 72]),
    }
  }
  if (shape === "waist") {
    return {
      ...fingerShape(side, "Thumb", [8, 10, 6], 3 * mirror),
      ...fingers([12, 20, 12], [14, 23, 14], [16, 25, 16], [18, 28, 18], 1.5),
    }
  }
  if (shape === "clasp") {
    return {
      ...fingerShape(side, "Thumb", [20, 24, 14], 1 * mirror),
      ...fingers([26, 38, 24], [30, 42, 27], [34, 46, 30], [38, 50, 34]),
    }
  }
  return {
    ...fingerShape(side, "Thumb", [7, 9, 5], 3 * mirror),
    ...fingers([5, 8, 5], [7, 10, 7], [9, 12, 8], [12, 15, 10], 1.5),
  }
}

function pose(
  values: DirectorMannequinJointValues,
): Record<DirectorMannequinJoint, [number, number, number]> {
  return {
    ...emptyJointMap(),
    ...handShape("left", "relaxed"),
    ...handShape("right", "relaxed"),
    ...values,
  }
}

const DIRECTOR_MANNEQUIN_CORE_POSE_PRESETS: Array<{
  id: DirectorMannequinCorePosePreset
  label: string
  description: string
  joints: Record<DirectorMannequinJoint, [number, number, number]>
}> = [
  {
    id: "relaxed",
    label: "自然站立",
    description: "骨盆轻移、脊柱自然反向平衡，手指保持松弛弧度",
    joints: pose({
      pelvis: [0, -2, 1], spine: [-1, 1, -1], spineMiddle: [1, 1, 1], chest: [0, 0, -1],
      neck: [0, -1, 0], head: [1, 1, 0],
      leftClavicle: [0, 0, -1], rightClavicle: [0, 0, 1],
      leftShoulder: [-3, 0, -7], rightShoulder: [-3, 0, 7],
      leftElbow: [-7, 0, -2], rightElbow: [-7, 0, 2], leftWrist: [2, 0, 1], rightWrist: [2, 0, -1],
      leftHip: [2, 0, -2], rightHip: [-3, 0, 2],
      leftKnee: [3, 0, 0], rightKnee: [6, 0, 0],
      leftAnkle: [-1, 0, 0], rightAnkle: [1, 0, 0], leftToe: [1, 0, 0], rightToe: [0, 0, 0],
    }),
  },
  {
    id: "attention",
    label: "立正",
    description: "骨盆居中、胸廓展开，掌指并拢贴近裤线",
    joints: pose({
      pelvis: [-1, 0, 0], spine: [1, 0, 0], spineMiddle: [-1, 0, 0], chest: [-1, 0, 0],
      neck: [1, 0, 0], head: [0, 0, 0],
      leftClavicle: [0, 0, -1], rightClavicle: [0, 0, 1],
      leftShoulder: [1, 0, -3], rightShoulder: [1, 0, 3],
      leftElbow: [-2, 0, 0], rightElbow: [-2, 0, 0], leftWrist: [0, 0, 1], rightWrist: [0, 0, -1],
      leftHip: [0, 0, -1], rightHip: [0, 0, 1], leftKnee: [1, 0, 0], rightKnee: [1, 0, 0],
      leftAnkle: [-1, 0, 0], rightAnkle: [-1, 0, 0], leftToe: [1, 0, 0], rightToe: [1, 0, 0],
      ...handShape("left", "straight"), ...handShape("right", "straight"),
    }),
  },
  {
    id: "a-pose",
    label: "A Pose",
    description: "锁骨带动双臂自然下斜，掌指伸展且双脚稳定",
    joints: pose({
      spine: [0, 0, 0], spineMiddle: [0, 0, 0], chest: [-1, 0, 0], neck: [1, 0, 0],
      leftClavicle: [0, 0, -4], rightClavicle: [0, 0, 4],
      leftShoulder: [0, 0, -30], rightShoulder: [0, 0, 30],
      leftElbow: [-3, 0, 0], rightElbow: [-3, 0, 0], leftWrist: [0, 0, 1], rightWrist: [0, 0, -1],
      leftHip: [0, 0, -2], rightHip: [0, 0, 2], leftAnkle: [-1, 0, 0], rightAnkle: [-1, 0, 0],
      ...handShape("left", "open"), ...handShape("right", "open"),
    }),
  },
  {
    id: "t-pose",
    label: "T Pose",
    description: "锁骨、肩、肘、腕形成水平基准，掌指完全展开",
    joints: pose({
      pelvis: [0, 0, 0], spine: [0, 0, 0], spineMiddle: [0, 0, 0], chest: [0, 0, 0],
      leftClavicle: [0, 0, -8], rightClavicle: [0, 0, 8],
      leftShoulder: [0, 0, -82], rightShoulder: [0, 0, 82],
      leftElbow: [-2, 0, 0], rightElbow: [-2, 0, 0], leftWrist: [0, 0, 1], rightWrist: [0, 0, -1],
      leftHip: [0, 0, -1], rightHip: [0, 0, 1], leftAnkle: [-1, 0, 0], rightAnkle: [-1, 0, 0],
      ...handShape("left", "open"), ...handShape("right", "open"),
    }),
  },
  {
    id: "walk",
    label: "行走",
    description: "骨盆与胸廓反向扭转，摆臂、踝和前脚掌形成完整步态",
    joints: pose({
      pelvis: [2, -5, 1], spine: [2, -3, -1], spineMiddle: [1, 2, 1], chest: [-2, 5, 0],
      neck: [1, -2, 0], head: [0, 1, 0],
      leftClavicle: [1, 2, -1], rightClavicle: [-1, -2, 1],
      leftShoulder: [27, 0, -7], rightShoulder: [-30, 0, 7],
      leftElbow: [-18, 0, 0], rightElbow: [-22, 0, 0], leftWrist: [4, 0, 1], rightWrist: [3, 0, -1],
      leftHip: [-30, 0, -2], rightHip: [24, 0, 2],
      leftKnee: [34, 0, 0], rightKnee: [8, 0, 0],
      leftAnkle: [-5, 0, 0], rightAnkle: [7, 0, 0], leftToe: [7, 0, 0], rightToe: [-6, 0, 0],
    }),
  },
  {
    id: "run",
    label: "奔跑",
    description: "骨盆前倾、胸廓稳定，屈肘握拳并通过踝趾完成离地步态",
    joints: pose({
      pelvis: [-7, -3, 1], spine: [-9, 1, -1], spineMiddle: [-5, 1, 1], chest: [-4, 1, 0], neck: [9, 0, 0], head: [2, 0, 0],
      leftClavicle: [3, 2, -2], rightClavicle: [-3, -2, 2],
      leftShoulder: [48, 0, -8], rightShoulder: [-55, 0, 8],
      leftElbow: [-72, 0, 0], rightElbow: [-82, 0, 0], leftWrist: [8, 0, 0], rightWrist: [8, 0, 0],
      leftHip: [-58, 0, -3], rightHip: [38, 0, 3],
      leftKnee: [82, 0, 0], rightKnee: [58, 0, 0],
      leftAnkle: [-18, 0, 0], rightAnkle: [10, 0, 0], leftToe: [12, 0, 0], rightToe: [-16, 0, 0],
      ...handShape("left", "soft-fist"), ...handShape("right", "soft-fist"),
    }),
  },
  {
    id: "sit",
    label: "坐姿",
    description: "骨盆落座、脊柱保持自然曲线，双手落向大腿且双脚平放",
    joints: pose({
      pelvis: [7, 0, 0], spine: [4, 0, 0], spineMiddle: [1, 0, 0], chest: [-3, 0, 0], neck: [1, 0, 0], head: [1, 0, 0],
      leftClavicle: [-1, 0, -1], rightClavicle: [-1, 0, 1],
      leftShoulder: [-18, 0, -9], rightShoulder: [-18, 0, 9],
      leftElbow: [-28, 0, 0], rightElbow: [-28, 0, 0], leftWrist: [12, 0, 1], rightWrist: [12, 0, -1],
      leftHip: [-88, 0, 0], rightHip: [-88, 0, 0],
      leftKnee: [88, 0, 0], rightKnee: [88, 0, 0],
      leftAnkle: [0, 0, 0], rightAnkle: [0, 0, 0], leftToe: [0, 0, 0], rightToe: [0, 0, 0],
      ...handShape("left", "waist"), ...handShape("right", "waist"),
    }),
  },
  {
    id: "crouch",
    label: "下蹲",
    description: "骨盆向后下沉、膝踝联动，双臂前伸平衡且双脚完整着地",
    joints: pose({
      pelvis: [-18, 0, 0], spine: [-12, 0, 0], spineMiddle: [-5, 0, 0], chest: [7, 0, 0], neck: [8, 0, 0], head: [2, 0, 0],
      leftClavicle: [-2, 0, -2], rightClavicle: [-2, 0, 2],
      leftShoulder: [-42, 0, -12], rightShoulder: [-42, 0, 12],
      leftElbow: [-30, 0, 0], rightElbow: [-30, 0, 0], leftWrist: [14, 0, 1], rightWrist: [14, 0, -1],
      leftHip: [-66, 0, -7], rightHip: [-66, 0, 7],
      leftKnee: [116, 0, 0], rightKnee: [116, 0, 0],
      leftAnkle: [-48, 0, 0], rightAnkle: [-48, 0, 0], leftToe: [6, 0, 0], rightToe: [6, 0, 0],
      ...handShape("left", "open"), ...handShape("right", "open"),
    }),
  },
  {
    id: "wave",
    label: "挥手",
    description: "重心落在一侧，锁骨抬起右臂，掌指张开形成清晰问候手型",
    joints: pose({
      pelvis: [0, 3, 2], spine: [0, -2, -1], spineMiddle: [0, -2, 1], chest: [0, -5, 0], neck: [0, 3, 0], head: [0, 6, 0],
      leftClavicle: [0, 0, -1], rightClavicle: [2, -2, 7],
      leftShoulder: [-4, 0, -8], leftElbow: [-8, 0, 0], leftWrist: [2, 0, 1],
      rightShoulder: [-7, -8, 89], rightElbow: [-18, 0, 82], rightWrist: [0, 10, 2],
      leftHip: [2, 0, -2], rightHip: [-3, 0, 2],
      leftKnee: [3, 0, 0], rightKnee: [7, 0, 0], leftAnkle: [-1, 0, 0], rightAnkle: [1, 0, 0],
      ...handShape("right", "open"),
    }),
  },
  {
    id: "point",
    label: "指向",
    description: "骨盆胸廓共同转向目标，锁骨送肩，食指伸直且其余手指分节收拢",
    joints: pose({
      pelvis: [0, -4, 1], spine: [0, -4, -1], spineMiddle: [0, -3, 1], chest: [0, -8, 0], neck: [0, 3, 0], head: [0, -5, 0],
      leftClavicle: [0, 0, -1], rightClavicle: [-1, -3, 5],
      leftShoulder: [-4, 0, -8], leftElbow: [-8, 0, 0], leftWrist: [2, 0, 1],
      rightShoulder: [-18, -5, 83], rightElbow: [-7, 0, 0], rightWrist: [2, 0, -2],
      leftHip: [2, 0, -2], rightHip: [-4, 0, 3], leftKnee: [3, 0, 0], rightKnee: [7, 0, 0],
      ...handShape("right", "point"),
    }),
  },
  {
    id: "hands-hips",
    label: "叉腰",
    description: "骨盆稳定、双肘外展，掌面贴近腰胯外侧而手指保持在身体之外",
    joints: pose({
      pelvis: [0, 0, 1], spine: [0, 0, -1], spineMiddle: [0, 0, 1], chest: [0, 0, 1], neck: [0, 0, 0], head: [1, 0, 0],
      leftClavicle: [0, 0, -3], rightClavicle: [0, 0, 3],
      leftShoulder: [-6, 12, -52], rightShoulder: [-6, -12, 52],
      leftElbow: [-12, 0, 108], rightElbow: [-12, 0, -108],
      leftWrist: [6, -10, -50], rightWrist: [6, 10, 50],
      leftHip: [1, 0, -4], rightHip: [-2, 0, 4], leftKnee: [4, 0, 0], rightKnee: [7, 0, 0],
      leftAnkle: [-1, 0, 0], rightAnkle: [1, 0, 0], leftToe: [1, 0, 0], rightToe: [0, 0, 0],
      ...handShape("left", "waist"), ...handShape("right", "waist"),
    }),
  },
  {
    id: "open-arms",
    label: "展开双臂",
    description: "锁骨打开胸廓，肘腕形成柔和弧线，双掌与分节手指朝向观众",
    joints: pose({
      pelvis: [0, 0, 1], spine: [-1, 0, -1], spineMiddle: [-1, 0, 1], chest: [-2, 0, 0], neck: [1, 0, 0], head: [1, 0, 0],
      leftClavicle: [1, 0, -4], rightClavicle: [1, 0, 4],
      leftShoulder: [-16, 0, -54], rightShoulder: [-16, 0, 54],
      leftElbow: [-18, 0, 14], rightElbow: [-18, 0, -14],
      leftWrist: [8, 0, 4], rightWrist: [8, 0, -4],
      leftHip: [2, 0, -3], rightHip: [-3, 0, 3],
      leftKnee: [3, 0, 0], rightKnee: [6, 0, 0], leftAnkle: [-1, 0, 0], rightAnkle: [1, 0, 0],
      ...handShape("left", "open"), ...handShape("right", "open"),
    }),
  },
  {
    id: "explain",
    label: "讲解",
    description: "骨盆与胸廓转向听者，一侧掌心摊开，另一侧保持自然松弛",
    joints: pose({
      pelvis: [0, 3, 1], spine: [0, -3, -1], spineMiddle: [0, -2, 1], chest: [0, -5, 0], neck: [0, 3, 0], head: [0, 4, 0],
      leftClavicle: [0, 0, -1], rightClavicle: [-1, -2, 3],
      leftShoulder: [-5, 0, -9], leftElbow: [-10, 0, -2], leftWrist: [3, 0, 1],
      rightShoulder: [-35, -10, 45], rightElbow: [-35, 0, 35], rightWrist: [20, 12, 5],
      leftHip: [2, 0, -2], rightHip: [-4, 0, 3],
      leftKnee: [3, 0, 0], rightKnee: [7, 0, 0], leftAnkle: [-1, 0, 0], rightAnkle: [1, 0, 0],
      ...handShape("right", "open"),
    }),
  },
  {
    id: "hands-back",
    label: "背手站立",
    description: "肩臂向后展开，双手在腰后交叠，胸廓保持舒展",
    joints: pose({
      pelvis: [0, 0, 1], spine: [1, 0, -1], spineMiddle: [-1, 0, 1], chest: [-1, 0, 1], neck: [1, 0, 0], head: [1, 0, 0],
      leftClavicle: [2, 2, -2], rightClavicle: [2, -2, 2],
      leftShoulder: [28, 10, -18], rightShoulder: [28, -10, 18],
      leftElbow: [-58, 0, 46], rightElbow: [-58, 0, -46],
      leftWrist: [8, -10, -20], rightWrist: [8, 10, 20],
      leftHip: [2, 0, -2], rightHip: [-3, 0, 2],
      leftKnee: [3, 0, 0], rightKnee: [6, 0, 0], leftAnkle: [-1, 0, 0], rightAnkle: [1, 0, 0],
      ...handShape("left", "clasp"), ...handShape("right", "clasp"),
    }),
  },
  {
    id: "look-back",
    label: "回身看",
    description: "骨盆、三段脊柱、颈部和头部逐级扭转，双脚维持反向支撑",
    joints: pose({
      pelvis: [0, -10, 1], spine: [0, 14, -1], spineMiddle: [0, 14, 1], chest: [0, 16, -1], neck: [0, 12, 0], head: [0, 16, 0],
      leftClavicle: [1, 2, -1], rightClavicle: [-1, -2, 1],
      leftShoulder: [8, 0, -10], rightShoulder: [-12, 0, 9],
      leftElbow: [-14, 0, -2], rightElbow: [-18, 0, 2], leftWrist: [3, 0, 1], rightWrist: [3, 0, -1],
      leftHip: [5, -8, -3], rightHip: [-8, 8, 3],
      leftKnee: [8, 0, 0], rightKnee: [12, 0, 0],
      leftAnkle: [-2, 0, -2], rightAnkle: [2, 0, 2], leftToe: [2, 0, 0], rightToe: [-2, 0, 0],
    }),
  },
  {
    id: "salute",
    label: "抬手示意",
    description: "锁骨抬肩、肘部外展，手腕校正后五指并拢停在头侧",
    joints: pose({
      pelvis: [0, 1, 0], spine: [0, -1, 0], spineMiddle: [0, -1, 0], chest: [0, -2, 0], neck: [0, 2, 0], head: [0, 3, 0],
      leftClavicle: [0, 0, -1], rightClavicle: [2, -2, 7],
      leftShoulder: [0, 0, -4], leftElbow: [-6, 0, 0], leftWrist: [1, 0, 1],
      rightShoulder: [-50, -4, 44], rightElbow: [-119, -21, 12], rightWrist: [0, 10, -24],
      leftHip: [1, 0, -2], rightHip: [-2, 0, 2], leftKnee: [2, 0, 0], rightKnee: [5, 0, 0],
      ...handShape("right", "straight"),
    }),
  },
  {
    id: "celebrate",
    label: "举手欢呼",
    description: "胸廓上提、锁骨参与举臂，双拳分节收紧并由腿部稳定重心",
    joints: pose({
      pelvis: [-2, 0, 1], spine: [-2, 0, -1], spineMiddle: [-2, 0, 1], chest: [-4, 0, 0], neck: [2, 0, 0], head: [3, 0, 0],
      leftClavicle: [3, 0, -8], rightClavicle: [3, 0, 8],
      leftShoulder: [6, 0, -134], rightShoulder: [6, 0, 134],
      leftElbow: [-24, 0, 18], rightElbow: [-24, 0, -18],
      leftWrist: [8, 0, 0], rightWrist: [8, 0, 0],
      leftHip: [4, 0, -3], rightHip: [-5, 0, 3],
      leftKnee: [8, 0, 0], rightKnee: [5, 0, 0],
      leftAnkle: [-2, 0, 0], rightAnkle: [1, 0, 0], leftToe: [2, 0, 0], rightToe: [0, 0, 0],
      ...handShape("left", "fist"), ...handShape("right", "fist"),
    }),
  },
  {
    id: "lunge",
    label: "前弓步",
    description: "骨盆压向前腿、脊柱保持发力线，后脚踝与前脚掌共同蹬地",
    joints: pose({
      pelvis: [-6, 0, 1], spine: [-6, 0, -1], spineMiddle: [-3, 0, 1], chest: [-3, 0, 0], neck: [7, 0, 0], head: [1, 0, 0],
      leftClavicle: [-2, 0, -2], rightClavicle: [-2, 0, 2],
      leftShoulder: [-28, 0, -22], rightShoulder: [-34, 0, 22],
      leftElbow: [-42, 0, 16], rightElbow: [-48, 0, -16], leftWrist: [8, 0, 0], rightWrist: [8, 0, 0],
      leftHip: [-35, 0, -6], rightHip: [44, 0, 6],
      leftKnee: [45, 0, 0], rightKnee: [0, 0, 0],
      leftAnkle: [-9, 0, 0], rightAnkle: [12, 0, 0], leftToe: [5, 0, 0], rightToe: [-18, 0, 0],
      ...handShape("left", "soft-fist"), ...handShape("right", "soft-fist"),
    }),
  },
  {
    id: "high-step",
    label: "高抬腿",
    description: "支撑侧骨盆稳定，抬腿侧髋膝踝趾依次屈曲并配合反向摆臂",
    joints: pose({
      pelvis: [-3, -2, 2], spine: [-3, 1, -1], spineMiddle: [-2, 1, 1], chest: [-2, 1, 0], neck: [5, 0, 0], head: [1, 0, 0],
      leftClavicle: [2, 1, -1], rightClavicle: [-2, -1, 1],
      leftShoulder: [28, 0, -8], rightShoulder: [-32, 0, 8],
      leftElbow: [-24, 0, 0], rightElbow: [-28, 0, 0], leftWrist: [5, 0, 0], rightWrist: [5, 0, 0],
      leftHip: [-75, 0, -5], rightHip: [3, 0, 4],
      leftKnee: [88, 0, 0], rightKnee: [5, 0, 0],
      leftAnkle: [-12, 0, 0], rightAnkle: [1, 0, 0], leftToe: [18, 0, 0], rightToe: [0, 0, 0],
      ...handShape("left", "soft-fist"), ...handShape("right", "soft-fist"),
    }),
  },
]

export interface DirectorMannequinPoseDefinition {
  id: Exclude<DirectorMannequinPosePreset, "custom">
  label: string
  category: DirectorMannequinPoseCategory
  description: string
  keywords: string[]
  ground_contact: "feet" | "knees" | "pelvis"
  joints: Record<DirectorMannequinJoint, [number, number, number]>
}

const CORE_POSE_METADATA: Record<
  DirectorMannequinCorePosePreset,
  { category: DirectorMannequinPoseCategory; keywords: string[] }
> = {
  relaxed: { category: "基础站姿", keywords: ["自然", "站立", "默认"] },
  attention: { category: "基础站姿", keywords: ["立正", "正式", "军姿"] },
  "a-pose": { category: "骨骼基准", keywords: ["绑定", "基准", "校准"] },
  "t-pose": { category: "骨骼基准", keywords: ["绑定", "基准", "校准"] },
  walk: { category: "行走运动", keywords: ["走路", "步行", "路过"] },
  run: { category: "行走运动", keywords: ["跑步", "追赶", "逃跑"] },
  sit: { category: "日常生活", keywords: ["坐下", "椅子", "沙发"] },
  crouch: { category: "日常生活", keywords: ["蹲下", "下蹲", "查看"] },
  wave: { category: "沟通交流", keywords: ["挥手", "再见", "打招呼"] },
  point: { category: "沟通交流", keywords: ["指向", "指路", "指责"] },
  "hands-hips": { category: "基础站姿", keywords: ["叉腰", "不满", "等待"] },
  "open-arms": { category: "沟通交流", keywords: ["欢迎", "展开", "拥抱"] },
  explain: { category: "沟通交流", keywords: ["讲解", "介绍", "说话"] },
  "hands-back": { category: "基础站姿", keywords: ["背手", "领导", "巡视"] },
  "look-back": { category: "基础站姿", keywords: ["回头", "转身", "回望"] },
  salute: { category: "沟通交流", keywords: ["示意", "敬礼", "问候"] },
  celebrate: { category: "情绪表演", keywords: ["庆祝", "欢呼", "胜利"] },
  lunge: { category: "行走运动", keywords: ["弓步", "发力", "向前"] },
  "high-step": { category: "行走运动", keywords: ["抬腿", "跨越", "上台阶"] },
}

const corePosePresets: DirectorMannequinPoseDefinition[] = DIRECTOR_MANNEQUIN_CORE_POSE_PRESETS.map((preset) => ({
  ...preset,
  ...CORE_POSE_METADATA[preset.id],
  ground_contact: "feet",
}))

const shortDramaPosePresets = DIRECTOR_SHORT_DRAMA_POSE_DEFINITIONS.reduce<DirectorMannequinPoseDefinition[]>(
  (presets, definition) => {
    const poseDefinition: DirectorShortDramaPoseDefinition = definition
    const base = [...corePosePresets, ...presets].find((preset) => preset.id === poseDefinition.base)
      || corePosePresets[0]
    const handValues: DirectorMannequinJointValues = {
      ...(poseDefinition.hands?.left
        ? handShape("left", poseDefinition.hands.left as DirectorShortDramaHandShape)
        : {}),
      ...(poseDefinition.hands?.right
        ? handShape("right", poseDefinition.hands.right as DirectorShortDramaHandShape)
        : {}),
    }
    presets.push({
      id: poseDefinition.id as DirectorShortDramaPoseId,
      label: poseDefinition.label,
      category: poseDefinition.category,
      description: poseDefinition.description,
      keywords: [...poseDefinition.keywords],
      ground_contact: poseDefinition.ground_contact || "feet",
      joints: pose({ ...base.joints, ...handValues, ...poseDefinition.joints }),
    })
    return presets
  },
  [],
)

export const DIRECTOR_MANNEQUIN_POSE_PRESETS: DirectorMannequinPoseDefinition[] = [
  ...corePosePresets,
  ...shortDramaPosePresets,
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

function jointRotation(
  joint: DirectorMannequinJoint,
  value: unknown,
  fallback: [number, number, number],
): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) return [...fallback]
  const limits = DIRECTOR_MANNEQUIN_JOINT_LIMITS[joint]
  return [
    clamp(value[0], limits[0][0], limits[0][1], fallback[0]),
    clamp(value[1], limits[1][0], limits[1][1], fallback[1]),
    clamp(value[2], limits[2][0], limits[2][1], fallback[2]),
  ]
}

export function defaultDirectorMannequin(): DirectorMannequinState {
  const body = DIRECTOR_MANNEQUIN_BODY_PRESETS.find((item) => item.id === "standard")!
  const posture = DIRECTOR_MANNEQUIN_POSE_PRESETS.find((item) => item.id === "relaxed")!
  return {
    anatomy: "masculine",
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
  const anatomy = source.anatomy === "feminine" ? "feminine" : "masculine"
  const resolvedPosePreset = (posePreset === "custom" || POSE_PRESET_IDS.has(posePreset)
    ? posePreset
    : fallback.pose_preset) as DirectorMannequinPosePreset
  const currentPreset = resolvedPosePreset === "custom"
    ? null
    : DIRECTOR_MANNEQUIN_POSE_PRESETS.find((item) => item.id === resolvedPosePreset)
  // A named preset is versioned application data. Reload its current joint
  // definition so pose fixes also repair scenes saved by an older release.
  const storedPose = currentPreset?.joints ?? rawJoints
  return {
    anatomy,
    body_preset: (bodyPreset === "custom" || BODY_PRESET_IDS.has(bodyPreset) ? bodyPreset : fallback.body_preset) as DirectorMannequinBodyPreset,
    pose_preset: resolvedPosePreset,
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
      DIRECTOR_MANNEQUIN_JOINTS.map((joint) => [
        joint,
        jointRotation(joint, storedPose[joint], fallback.joints[joint]),
      ]),
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
