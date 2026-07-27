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
export type DirectorMannequinPosePreset =
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
  | "custom"

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

function handCurl(
  side: "left" | "right",
  base = 5,
  middle = 8,
  tip = 5,
): DirectorMannequinJointValues {
  const values: DirectorMannequinJointValues = {}
  for (const finger of ["Index", "Middle", "Ring", "Pinky"] as const) {
    values[`${side}${finger}1`] = [base, 0, 0]
    values[`${side}${finger}2`] = [middle, 0, 0]
    values[`${side}${finger}3`] = [tip, 0, 0]
  }
  return values
}

function pose(
  values: DirectorMannequinJointValues,
): Record<DirectorMannequinJoint, [number, number, number]> {
  return {
    ...emptyJointMap(),
    ...handCurl("left"),
    ...handCurl("right"),
    ...values,
  }
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
    joints: pose({
      leftShoulder: [0, 0, -34], rightShoulder: [0, 0, 34],
      ...handCurl("left", 0, 0, 0), ...handCurl("right", 0, 0, 0),
    }),
  },
  {
    id: "t-pose",
    label: "T Pose",
    description: "手臂水平展开",
    joints: pose({
      leftShoulder: [0, 0, -90], rightShoulder: [0, 0, 90],
      ...handCurl("left", 0, 0, 0), ...handCurl("right", 0, 0, 0),
    }),
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
    description: "髋膝约九十度、双脚平放，适合搭配椅凳",
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
    description: "重心下沉、双脚完整着地的稳定深蹲",
    joints: pose({
      spine: [-17, 0, 0], chest: [7, 0, 0], neck: [8, 0, 0],
      leftShoulder: [-25, 0, -14], rightShoulder: [-25, 0, 14],
      leftElbow: [-24, 0, 0], rightElbow: [-24, 0, 0],
      leftHip: [-58, 0, -5], rightHip: [-58, 0, 5],
      leftKnee: [110, 0, 0], rightKnee: [110, 0, 0],
      leftAnkle: [-50, 0, 0], rightAnkle: [-50, 0, 0],
    }),
  },
  {
    id: "wave",
    label: "挥手",
    description: "右手举起打招呼",
    joints: pose({
      chest: [0, -7, 0], head: [0, 8, 0],
      leftShoulder: [-4, 0, -8], leftElbow: [-8, 0, 0],
      rightShoulder: [-7, -8, 96], rightElbow: [-18, 0, 82], rightWrist: [0, 10, 2],
      leftHip: [2, 0, -2], rightHip: [-3, 0, 2],
      ...handCurl("right", 0, 0, 0),
    }),
  },
  {
    id: "point",
    label: "指向",
    description: "右臂向前指示",
    joints: pose({
      chest: [0, -12, 0], head: [0, -8, 0],
      leftShoulder: [-4, 0, -8], rightShoulder: [-18, -6, 88],
      rightElbow: [-7, 0, 0], rightWrist: [2, 0, 0],
      ...handCurl("right", 62, 86, 66),
      rightIndex1: [0, 0, 0], rightIndex2: [0, 0, 0], rightIndex3: [0, 0, 0],
    }),
  },
  {
    id: "hands-hips",
    label: "叉腰",
    description: "抬高双肘，手掌自然落在腰胯外侧",
    joints: pose({
      chest: [0, 0, 1],
      leftShoulder: [-6, 12, -52], rightShoulder: [-6, -12, 52],
      leftElbow: [-12, 0, 108], rightElbow: [-12, 0, -108],
      leftWrist: [2, -8, -56], rightWrist: [2, 8, 56],
    }),
  },
  {
    id: "open-arms",
    label: "展开双臂",
    description: "双臂舒展，适合欢迎、展示和开放式交流",
    joints: pose({
      chest: [-2, 0, 0], head: [1, 0, 0],
      leftShoulder: [-16, 0, -58], rightShoulder: [-16, 0, 58],
      leftElbow: [-18, 0, 14], rightElbow: [-18, 0, -14],
      leftWrist: [8, 0, 4], rightWrist: [8, 0, -4],
      leftHip: [2, 0, -3], rightHip: [-3, 0, 3],
      ...handCurl("left", 0, 0, 0), ...handCurl("right", 0, 0, 0),
    }),
  },
  {
    id: "explain",
    label: "讲解",
    description: "一手向前摊开，适合介绍和对话调度",
    joints: pose({
      chest: [0, -8, 0], head: [0, 7, 0],
      leftShoulder: [-5, 0, -9], leftElbow: [-10, 0, -2],
      rightShoulder: [-35, -10, 48], rightElbow: [-35, 0, 35], rightWrist: [20, 12, 5],
      leftHip: [2, 0, -2], rightHip: [-4, 0, 3],
      ...handCurl("right", 0, 0, 0),
    }),
  },
  {
    id: "hands-back",
    label: "背手站立",
    description: "双手收在身后，适合观察、等待和长辈姿态",
    joints: pose({
      chest: [0, 0, 1], head: [1, 0, 0],
      leftShoulder: [18, 10, -18], rightShoulder: [18, -10, 18],
      leftElbow: [-58, 0, 48], rightElbow: [-58, 0, -48],
      leftWrist: [12, -12, -28], rightWrist: [12, 12, 28],
      leftHip: [2, 0, -2], rightHip: [-3, 0, 2],
    }),
  },
  {
    id: "look-back",
    label: "回身看",
    description: "胸肩与头部错位回望，适合反应镜头",
    joints: pose({
      spine: [0, 18, 1], chest: [0, 22, -1], neck: [0, 14, 0], head: [0, 18, 0],
      leftShoulder: [8, 0, -10], rightShoulder: [-12, 0, 9],
      leftElbow: [-14, 0, -2], rightElbow: [-18, 0, 2],
      leftHip: [5, -8, -3], rightHip: [-8, 8, 3],
      leftKnee: [8, 0, 0], rightKnee: [12, 0, 0],
    }),
  },
  {
    id: "salute",
    label: "抬手示意",
    description: "右手抬至头侧，适合回应、示意停下和报告",
    joints: pose({
      chest: [0, -4, 0], head: [0, 4, 0],
      leftShoulder: [0, 0, -4], leftElbow: [-6, 0, 0],
      rightShoulder: [-5, -8, 110], rightElbow: [-15, 0, 115], rightWrist: [0, 10, -45],
      ...handCurl("right", 0, 0, 0),
    }),
  },
  {
    id: "celebrate",
    label: "举手欢呼",
    description: "双臂高举并略微屈肘，适合胜利和欢呼",
    joints: pose({
      spine: [-3, 0, 0], chest: [-5, 0, 0], head: [3, 0, 0],
      leftShoulder: [6, 0, -142], rightShoulder: [6, 0, 142],
      leftElbow: [-24, 0, 18], rightElbow: [-24, 0, -18],
      leftWrist: [8, 0, 0], rightWrist: [8, 0, 0],
      leftHip: [4, 0, -3], rightHip: [-5, 0, 3],
      leftKnee: [8, 0, 0], rightKnee: [5, 0, 0],
      ...handCurl("left", 0, 0, 0), ...handCurl("right", 0, 0, 0),
    }),
  },
  {
    id: "lunge",
    label: "前弓步",
    description: "前脚整掌支撑、后脚尖着地，适合对峙和发力",
    joints: pose({
      spine: [-8, 0, 0], chest: [-4, 0, 0], neck: [7, 0, 0],
      leftShoulder: [-28, 0, -22], rightShoulder: [-34, 0, 22],
      leftElbow: [-42, 0, 16], rightElbow: [-48, 0, -16],
      leftHip: [-35, 0, -6], rightHip: [44, 0, 6],
      leftKnee: [45, 0, 0], rightKnee: [0, 0, 0],
      leftAnkle: [-10, 0, 0], rightAnkle: [10, 0, 0],
    }),
  },
  {
    id: "high-step",
    label: "高抬腿",
    description: "单腿抬起并配合摆臂，适合跨越和动作起势",
    joints: pose({
      spine: [-5, 0, 0], chest: [-2, 0, 0], neck: [5, 0, 0],
      leftShoulder: [28, 0, -8], rightShoulder: [-32, 0, 8],
      leftElbow: [-24, 0, 0], rightElbow: [-28, 0, 0],
      leftHip: [-75, 0, -5], rightHip: [3, 0, 4],
      leftKnee: [88, 0, 0], rightKnee: [5, 0, 0],
      leftAnkle: [-8, 0, 0], rightAnkle: [2, 0, 0],
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
