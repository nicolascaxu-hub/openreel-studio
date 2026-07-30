import {
  DIRECTOR_UNIVERSAL_ACTION_MANNEQUIN_ASSET_ID,
  type DirectorModelAnalysis,
  type DirectorModelAsset,
} from "@/lib/directorDesk"
import { DIRECTOR_UNIVERSAL_HUMAN_MOTIONS } from "@/lib/directorHumanMotions"
import { DIRECTOR_MANNEQUIN_JOINTS, type DirectorMannequinJoint } from "@/lib/directorMannequin"
import commonModelCatalog from "@/lib/directorCommonModels.json"
import { DIRECTOR_SOURCE_PROP_ASSETS } from "@/lib/directorSourceProps"

export interface DirectorBundledModelStats {
  node_count: number
  mesh_count: number
  material_count: number
  bone_count: number
  animation_count: number
}

export interface DirectorBundledModelAsset extends DirectorModelAsset {
  summary: string
  license: string
  category: string
  keywords: string[]
  source_kind: "glb" | "source"
  display_size: number
  stats: DirectorBundledModelStats
  animation_urls?: string[]
}

const modelBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "")

function modelUrl(fileName: string): string {
  return `${modelBasePath}/director/models/${fileName}`
}

function mannequinUrl(fileName: string): string {
  return `${modelBasePath}/director/mannequins/${fileName}`
}

function genericHumanoid(): DirectorModelAnalysis["humanoid"] {
  return {
    recognized: false,
    profile: "generic",
    confidence: 0,
    mapped_joint_count: 0,
    joint_count: DIRECTOR_MANNEQUIN_JOINTS.length,
    joint_map: {},
    joint_node_map: {},
    missing_joints: [...DIRECTOR_MANNEQUIN_JOINTS],
  }
}

const riggedFigureJointMap: Partial<Record<DirectorMannequinJoint, string>> = {
  pelvis: "torso_joint_1",
  spine: "torso_joint_2",
  chest: "torso_joint_3",
  neck: "neck_joint_1",
  head: "neck_joint_2",
  leftShoulder: "arm_joint_L_1",
  leftElbow: "arm_joint_L_2",
  leftWrist: "arm_joint_L_3",
  leftHip: "leg_joint_L_1",
  leftKnee: "leg_joint_L_2",
  leftAnkle: "leg_joint_L_3",
  leftToe: "leg_joint_L_5",
  rightShoulder: "arm_joint_R_1",
  rightElbow: "arm_joint_R_2",
  rightWrist: "arm_joint_R_3",
  rightHip: "leg_joint_R_1",
  rightKnee: "leg_joint_R_2",
  rightAnkle: "leg_joint_R_3",
  rightToe: "leg_joint_R_5",
}

const riggedFigureJointNodeMap: Partial<Record<DirectorMannequinJoint, number>> = {
  pelvis: 2,
  spine: 11,
  chest: 12,
  neck: 19,
  head: 20,
  leftShoulder: 16,
  leftElbow: 17,
  leftWrist: 18,
  leftHip: 7,
  leftKnee: 8,
  leftAnkle: 9,
  leftToe: 10,
  rightShoulder: 13,
  rightElbow: 14,
  rightWrist: 15,
  rightHip: 3,
  rightKnee: 4,
  rightAnkle: 5,
  rightToe: 6,
}

const DIRECTOR_FEATURED_MODEL_ASSETS: DirectorBundledModelAsset[] = [
  {
    id: DIRECTOR_UNIVERSAL_ACTION_MANNEQUIN_ASSET_ID,
    name: "通用动作白模",
    file_name: "human-base.glb",
    url: mannequinUrl("human-base.glb"),
    animation_urls: [
      mannequinUrl("human-base-animations.glb"),
      mannequinUrl("human-addon-animations.glb"),
    ],
    size: 11_483_456,
    summary: "66 骨骼通用人物白模，内置 162 组 CC0 专业动作",
    license: "CC0 1.0 · Mesh2Motion / Quaternius",
    category: "角色动作",
    keywords: ["人物", "白模", "动作", "交谈", "坐姿", "走路", "跑步", "格斗", "human", "animation"],
    source_kind: "glb",
    display_size: 1.8,
    stats: { node_count: 68, mesh_count: 1, material_count: 1, bone_count: 66, animation_count: 162 },
    analysis: {
      analysis_version: 2,
      format: "glb2",
      generator: "Khronos glTF Blender I/O v4.5.3",
      node_count: 68,
      mesh_count: 1,
      material_count: 1,
      skin_count: 1,
      skins: [{ index: 0, name: "Human", joint_count: 66, skeleton_node: 1 }],
      bone_count: 66,
      bones: [],
      animation_count: DIRECTOR_UNIVERSAL_HUMAN_MOTIONS.length,
      animations: DIRECTOR_UNIVERSAL_HUMAN_MOTIONS.map((motion) => ({
        index: motion.index,
        name: motion.name,
        duration: null,
        keyframe_count: 0,
        kind: "animation" as const,
        channel_count: 67,
        target_node_count: 67,
        properties: ["rotation", "translation"],
      })),
      // The bundled clips already target this exact skeleton. Keeping manual
      // humanoid remapping disabled prevents the retired hand-authored poses
      // from being offered on the motion-library mannequin.
      humanoid: genericHumanoid(),
    },
  },
  {
    id: "bundled:fox",
    name: "动画狐狸",
    file_name: "Fox.glb",
    url: modelUrl("Fox.glb"),
    size: 162852,
    summary: "24 根骨骼，内置观察、行走、奔跑三段动画",
    license: "模型 CC0；绑定、动画及 glTF 转换 CC BY 4.0",
    category: "角色动作",
    keywords: ["狐狸", "动物", "行走", "奔跑", "fox"],
    source_kind: "glb",
    display_size: 1.2,
    stats: { node_count: 26, mesh_count: 1, material_count: 1, bone_count: 24, animation_count: 3 },
    analysis: {
      analysis_version: 2,
      format: "glb2",
      generator: "",
      node_count: 26,
      mesh_count: 1,
      material_count: 1,
      skin_count: 1,
      skins: [{ index: 0, name: "Skin 1", joint_count: 24, skeleton_node: 2 }],
      bone_count: 24,
      bones: [
        [2, "_rootJoint", 0, "root"],
        [3, "b_Root_00", 2, "_rootJoint"],
        [4, "b_Hip_01", 3, "b_Root_00"],
        [5, "b_Spine01_02", 4, "b_Hip_01"],
        [6, "b_Spine02_03", 5, "b_Spine01_02"],
        [7, "b_Neck_04", 6, "b_Spine02_03"],
        [8, "b_Head_05", 7, "b_Neck_04"],
        [9, "b_RightUpperArm_06", 6, "b_Spine02_03"],
        [10, "b_RightForeArm_07", 9, "b_RightUpperArm_06"],
        [11, "b_RightHand_08", 10, "b_RightForeArm_07"],
        [12, "b_LeftUpperArm_09", 6, "b_Spine02_03"],
        [13, "b_LeftForeArm_010", 12, "b_LeftUpperArm_09"],
        [14, "b_LeftHand_011", 13, "b_LeftForeArm_010"],
        [15, "b_Tail01_012", 4, "b_Hip_01"],
        [16, "b_Tail02_013", 15, "b_Tail01_012"],
        [17, "b_Tail03_014", 16, "b_Tail02_013"],
        [18, "b_LeftLeg01_015", 4, "b_Hip_01"],
        [19, "b_LeftLeg02_016", 18, "b_LeftLeg01_015"],
        [20, "b_LeftFoot01_017", 19, "b_LeftLeg02_016"],
        [21, "b_LeftFoot02_018", 20, "b_LeftFoot01_017"],
        [22, "b_RightLeg01_019", 4, "b_Hip_01"],
        [23, "b_RightLeg02_020", 22, "b_RightLeg01_019"],
        [24, "b_RightFoot01_021", 23, "b_RightLeg02_020"],
        [25, "b_RightFoot02_022", 24, "b_RightFoot01_021"],
      ].map(([node, name, parentNode, parentName]) => ({
        node: node as number,
        name: name as string,
        parent_node: parentNode as number,
        parent_name: parentName as string,
      })),
      animation_count: 3,
      animations: [
        { index: 0, name: "Survey", duration: 3.4167, keyframe_count: 83, kind: "animation", channel_count: 21, target_node_count: 20, properties: ["rotation", "translation"] },
        { index: 1, name: "Walk", duration: 0.7083, keyframe_count: 18, kind: "animation", channel_count: 21, target_node_count: 20, properties: ["rotation", "translation"] },
        { index: 2, name: "Run", duration: 1.1583, keyframe_count: 25, kind: "animation", channel_count: 21, target_node_count: 20, properties: ["rotation", "translation"] },
      ],
      humanoid: genericHumanoid(),
    },
  },
  {
    id: "bundled:rigged-figure",
    name: "骨骼人物",
    file_name: "RiggedFigure.glb",
    url: modelUrl("RiggedFigure.glb"),
    size: 50116,
    summary: "19 根人体骨骼，自动映射躯干、手臂与腿部关节",
    license: "CC BY 4.0 · Cesium",
    category: "角色动作",
    keywords: ["人物", "骨骼", "角色", "human"],
    source_kind: "glb",
    display_size: 1.8,
    stats: { node_count: 22, mesh_count: 1, material_count: 1, bone_count: 19, animation_count: 1 },
    analysis: {
      analysis_version: 2,
      format: "glb2",
      generator: "COLLADA2GLTF",
      node_count: 22,
      mesh_count: 1,
      material_count: 1,
      skin_count: 1,
      skins: [{ index: 0, name: "Armature", joint_count: 19, skeleton_node: 2 }],
      bone_count: 19,
      bones: [
        [2, "torso_joint_1", 21, "Armature"],
        [3, "leg_joint_R_1", 2, "torso_joint_1"],
        [4, "leg_joint_R_2", 3, "leg_joint_R_1"],
        [5, "leg_joint_R_3", 4, "leg_joint_R_2"],
        [6, "leg_joint_R_5", 5, "leg_joint_R_3"],
        [7, "leg_joint_L_1", 2, "torso_joint_1"],
        [8, "leg_joint_L_2", 7, "leg_joint_L_1"],
        [9, "leg_joint_L_3", 8, "leg_joint_L_2"],
        [10, "leg_joint_L_5", 9, "leg_joint_L_3"],
        [11, "torso_joint_2", 2, "torso_joint_1"],
        [12, "torso_joint_3", 11, "torso_joint_2"],
        [13, "arm_joint_R_1", 12, "torso_joint_3"],
        [14, "arm_joint_R_2", 13, "arm_joint_R_1"],
        [15, "arm_joint_R_3", 14, "arm_joint_R_2"],
        [16, "arm_joint_L_1", 12, "torso_joint_3"],
        [17, "arm_joint_L_2", 16, "arm_joint_L_1"],
        [18, "arm_joint_L_3", 17, "arm_joint_L_2"],
        [19, "neck_joint_1", 12, "torso_joint_3"],
        [20, "neck_joint_2", 19, "neck_joint_1"],
      ].map(([node, name, parentNode, parentName]) => ({
        node: node as number,
        name: name as string,
        parent_node: parentNode as number,
        parent_name: parentName as string,
      })),
      animation_count: 1,
      animations: [
        { index: 0, name: "Animation 1", duration: 1.25, keyframe_count: 2, kind: "animation", channel_count: 57, target_node_count: 19, properties: ["rotation", "scale", "translation"] },
      ],
      humanoid: {
        recognized: true,
        profile: "generic",
        confidence: 0.895,
        mapped_joint_count: 19,
        joint_count: DIRECTOR_MANNEQUIN_JOINTS.length,
        joint_map: riggedFigureJointMap,
        joint_node_map: riggedFigureJointNodeMap,
        missing_joints: DIRECTOR_MANNEQUIN_JOINTS.filter((joint) => !(joint in riggedFigureJointMap)),
      },
    },
  },
  {
    id: "bundled:animated-box",
    name: "动画方块",
    file_name: "BoxAnimated.glb",
    url: modelUrl("BoxAnimated.glb"),
    size: 11944,
    summary: "旋转与位移双通道关键帧动画测试模型",
    license: "CC BY 4.0 · Cesium",
    category: "动画测试",
    keywords: ["方块", "关键帧", "动画", "box"],
    source_kind: "glb",
    display_size: 1.2,
    stats: { node_count: 4, mesh_count: 2, material_count: 2, bone_count: 0, animation_count: 1 },
    analysis: {
      analysis_version: 2,
      format: "glb2",
      generator: "COLLADA2GLTF",
      node_count: 4,
      mesh_count: 2,
      material_count: 2,
      skin_count: 0,
      skins: [],
      bone_count: 0,
      bones: [],
      animation_count: 1,
      animations: [
        { index: 0, name: "Animation 1", duration: 3.7083, keyframe_count: 4, kind: "animation", channel_count: 2, target_node_count: 2, properties: ["rotation", "translation"] },
      ],
      humanoid: genericHumanoid(),
    },
  },
  {
    id: "bundled:toy-car",
    name: "玩具车",
    file_name: "ToyCar.glb",
    url: modelUrl("ToyCar.glb"),
    size: 5422412,
    summary: "清漆、透射与织物材质完整展示模型",
    license: "CC0 1.0 · Guido Odendahl / Eric Chadwick",
    category: "交通车辆",
    keywords: ["汽车", "玩具车", "车辆", "car"],
    source_kind: "glb",
    display_size: 4.2,
    stats: { node_count: 11, mesh_count: 3, material_count: 3, bone_count: 0, animation_count: 0 },
    analysis: {
      analysis_version: 2,
      format: "glb2",
      generator: "babylon.js glTF exporter for 3dsmax 2020 v20200721.1",
      node_count: 11,
      mesh_count: 3,
      material_count: 3,
      skin_count: 0,
      skins: [],
      bone_count: 0,
      bones: [],
      animation_count: 0,
      animations: [],
      humanoid: genericHumanoid(),
    },
  },
]

const DIRECTOR_KENNEY_MODEL_ASSETS: DirectorBundledModelAsset[] = commonModelCatalog.models.map((asset) => ({
  id: asset.id,
  name: asset.name,
  file_name: asset.file_name,
  url: modelUrl(asset.file_path),
  size: asset.size,
  summary: asset.summary,
  license: asset.license,
  category: asset.category,
  keywords: asset.keywords,
  source_kind: "glb",
  display_size: asset.display_size,
  stats: asset.stats,
}))

export const DIRECTOR_BUNDLED_MODEL_ASSETS: DirectorBundledModelAsset[] = [
  ...DIRECTOR_FEATURED_MODEL_ASSETS,
  ...DIRECTOR_KENNEY_MODEL_ASSETS,
  ...DIRECTOR_SOURCE_PROP_ASSETS,
]

export const DIRECTOR_BUNDLED_MODEL_BY_ID = new Map(
  DIRECTOR_BUNDLED_MODEL_ASSETS.map((asset) => [asset.id, asset]),
)
