import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js"
import {
  normalizeDirectorMannequin,
  type DirectorMannequinJoint,
  type DirectorMannequinState,
} from "@/lib/directorMannequin"

const MODEL_FILES = {
  masculine: "human-base.glb",
  feminine: "human-female.glb",
} as const

// A mathematically exact mesh bound leaves the lowest toe vertex touching the
// plane while the visible sole and its shadow can still read as floating.
// Sink the standard model by a small real-world contact depth after posing.
const GROUND_CONTACT_DEPTH = 0.015

// Director state predates the imported rig and names the screen-left limb
// "left". Mesh2Motion follows anatomical left/right, which appears mirrored
// to a front-facing viewer, so the standard-rig adapter deliberately swaps
// side suffixes. Without this adapter, symmetric actions cross through the
// torso before reaching their intended pose.
const JOINT_BONES: Record<DirectorMannequinJoint, string> = {
  spine: "spine_01",
  chest: "spine_03",
  neck: "neck_01",
  head: "head",
  leftShoulder: "upperarm_r",
  leftElbow: "lowerarm_r",
  leftWrist: "hand_r",
  rightShoulder: "upperarm_l",
  rightElbow: "lowerarm_l",
  rightWrist: "hand_l",
  leftHip: "thigh_r",
  leftKnee: "calf_r",
  leftAnkle: "foot_r",
  rightHip: "thigh_l",
  rightKnee: "calf_l",
  rightAnkle: "foot_l",
}

interface BoneFrame {
  bone: THREE.Bone
  baseWorld: THREE.Quaternion
}

const templateCache = new Map<DirectorMannequinState["anatomy"], Promise<THREE.Object3D>>()

function modelUrl(anatomy: DirectorMannequinState["anatomy"]): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "")
  return `${basePath}/director/mannequins/${MODEL_FILES[anatomy]}`
}

function loadTemplate(anatomy: DirectorMannequinState["anatomy"]): Promise<THREE.Object3D> {
  const cached = templateCache.get(anatomy)
  if (cached) return cached
  const pending = new GLTFLoader().loadAsync(modelUrl(anatomy)).then((gltf) => gltf.scene)
  templateCache.set(anatomy, pending)
  void pending.catch(() => templateCache.delete(anatomy))
  return pending
}

function mannequinMaterial(color: string): THREE.MeshStandardMaterial {
  const resolved = new THREE.Color(color)
  resolved.offsetHSL(0, -0.055, 0.07)
  return new THREE.MeshStandardMaterial({
    color: resolved,
    roughness: 0.72,
    metalness: 0.018,
  })
}

function prepareClone(template: THREE.Object3D, color: string): THREE.Object3D {
  const model = SkeletonUtils.clone(template)
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry = child.geometry.clone()
    child.material = mannequinMaterial(color)
    child.castShadow = true
    child.receiveShadow = true
    child.frustumCulled = false
  })
  return model
}

function bone(root: THREE.Object3D, name: string): THREE.Bone | null {
  const value = root.getObjectByName(name)
  return value instanceof THREE.Bone ? value : null
}

function scaleBoneOffset(root: THREE.Object3D, name: string, factor: number): void {
  const value = bone(root, name)
  if (value) value.position.multiplyScalar(factor)
}

function spreadBonePair(
  root: THREE.Object3D,
  leftName: string,
  rightName: string,
  factor: number,
): void {
  const left = bone(root, leftName)
  const right = bone(root, rightName)
  if (!left || !right || left.parent !== right.parent) return
  const midpoint = left.position.clone().add(right.position).multiplyScalar(0.5)
  left.position.copy(midpoint.clone().add(left.position.clone().sub(midpoint).multiplyScalar(factor)))
  right.position.copy(midpoint.clone().add(right.position.clone().sub(midpoint).multiplyScalar(factor)))
}

function applyProportions(model: THREE.Object3D, state: DirectorMannequinState): void {
  const { proportions } = state

  for (const name of ["spine_02", "spine_03", "neck_01"]) {
    scaleBoneOffset(model, name, proportions.torso_length)
  }
  for (const name of ["lowerarm_l", "hand_l", "lowerarm_r", "hand_r"]) {
    scaleBoneOffset(model, name, proportions.arm_length)
  }
  for (const name of ["calf_l", "foot_l", "calf_r", "foot_r"]) {
    scaleBoneOffset(model, name, proportions.leg_length)
  }
  spreadBonePair(model, "clavicle_l", "clavicle_r", proportions.shoulder_width)
  spreadBonePair(model, "thigh_l", "thigh_r", proportions.hip_width)

  const head = bone(model, "head")
  if (head) head.scale.multiplyScalar(proportions.head_scale)
}

function eulerQuaternion(rotation: [number, number, number]): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
    "XYZ",
  ))
}

function combineFrames(
  parent: THREE.Quaternion,
  rotation: [number, number, number],
): THREE.Quaternion {
  return parent.clone().multiply(eulerQuaternion(rotation))
}

function captureBoneFrame(
  root: THREE.Object3D,
  boneName: string,
  childName: string,
  baselineDirection: THREE.Vector3,
): BoneFrame | null {
  const target = bone(root, boneName)
  const child = bone(root, childName)
  if (!target || !child) return null

  const restWorld = target.getWorldQuaternion(new THREE.Quaternion())
  const restDirection = child.position.clone().normalize().applyQuaternion(restWorld)
  const alignment = new THREE.Quaternion().setFromUnitVectors(
    restDirection.normalize(),
    baselineDirection.clone().normalize(),
  )
  return { bone: target, baseWorld: alignment.multiply(restWorld) }
}

function applyBoneFrame(frame: BoneFrame | null, control: THREE.Quaternion): void {
  if (!frame || !frame.bone.parent) return
  const parentWorld = frame.bone.parent.getWorldQuaternion(new THREE.Quaternion())
  const targetWorld = control.clone().multiply(frame.baseWorld)
  frame.bone.quaternion.copy(parentWorld.invert().multiply(targetWorld))
  frame.bone.updateWorldMatrix(false, true)
}

function applyPose(model: THREE.Object3D, state: DirectorMannequinState): void {
  const up = new THREE.Vector3(0, 1, 0)
  const down = new THREE.Vector3(0, -1, 0)
  // The rig's foot-to-ball axis runs through the instep rather than along the
  // sole. A small downward pitch keeps the visible sole level with the stage.
  const footForward = new THREE.Vector3(0, -0.14, 1).normalize()
  model.updateMatrixWorld(true)

  const frames = {
    spineLower: captureBoneFrame(model, "spine_01", "spine_02", up),
    spineUpper: captureBoneFrame(model, "spine_02", "spine_03", up),
    chest: captureBoneFrame(model, "spine_03", "neck_01", up),
    neck: captureBoneFrame(model, "neck_01", "head", up),
    head: captureBoneFrame(model, "head", "head_leaf", up),
    leftShoulder: captureBoneFrame(model, JOINT_BONES.leftShoulder, JOINT_BONES.leftElbow, down),
    leftElbow: captureBoneFrame(model, JOINT_BONES.leftElbow, JOINT_BONES.leftWrist, down),
    leftWrist: captureBoneFrame(model, JOINT_BONES.leftWrist, "middle_01_r", down),
    rightShoulder: captureBoneFrame(model, JOINT_BONES.rightShoulder, JOINT_BONES.rightElbow, down),
    rightElbow: captureBoneFrame(model, JOINT_BONES.rightElbow, JOINT_BONES.rightWrist, down),
    rightWrist: captureBoneFrame(model, JOINT_BONES.rightWrist, "middle_01_l", down),
    leftHip: captureBoneFrame(model, JOINT_BONES.leftHip, JOINT_BONES.leftKnee, down),
    leftKnee: captureBoneFrame(model, JOINT_BONES.leftKnee, JOINT_BONES.leftAnkle, down),
    leftAnkle: captureBoneFrame(model, JOINT_BONES.leftAnkle, "ball_r", footForward),
    rightHip: captureBoneFrame(model, JOINT_BONES.rightHip, JOINT_BONES.rightKnee, down),
    rightKnee: captureBoneFrame(model, JOINT_BONES.rightKnee, JOINT_BONES.rightAnkle, down),
    rightAnkle: captureBoneFrame(model, JOINT_BONES.rightAnkle, "ball_l", footForward),
  }

  const identity = new THREE.Quaternion()
  const spine = combineFrames(identity, state.joints.spine)
  const chest = combineFrames(spine, state.joints.chest)
  const neck = combineFrames(chest, state.joints.neck)
  const head = combineFrames(neck, state.joints.head)

  applyBoneFrame(frames.spineLower, spine)
  applyBoneFrame(frames.spineUpper, spine)
  applyBoneFrame(frames.chest, chest)
  applyBoneFrame(frames.neck, neck)
  applyBoneFrame(frames.head, head)

  for (const side of ["left", "right"] as const) {
    const shoulderJoint = `${side}Shoulder` as const
    const elbowJoint = `${side}Elbow` as const
    const wristJoint = `${side}Wrist` as const
    const hipJoint = `${side}Hip` as const
    const kneeJoint = `${side}Knee` as const
    const ankleJoint = `${side}Ankle` as const

    const shoulder = combineFrames(chest, state.joints[shoulderJoint])
    const elbow = combineFrames(shoulder, state.joints[elbowJoint])
    const wrist = combineFrames(elbow, state.joints[wristJoint])
    applyBoneFrame(frames[shoulderJoint], shoulder)
    applyBoneFrame(frames[elbowJoint], elbow)
    applyBoneFrame(frames[wristJoint], wrist)

    const hip = combineFrames(identity, state.joints[hipJoint])
    const knee = combineFrames(hip, state.joints[kneeJoint])
    const ankle = combineFrames(knee, state.joints[ankleJoint])
    applyBoneFrame(frames[hipJoint], hip)
    applyBoneFrame(frames[kneeJoint], knee)
    applyBoneFrame(frames[ankleJoint], ankle)
  }
}

function modelScale(
  model: THREE.Object3D,
  state: DirectorMannequinState,
): THREE.Vector3 {
  model.updateMatrixWorld(true)
  const standingBounds = new THREE.Box3().setFromObject(model)
  const standingHeight = Math.max(standingBounds.max.y - standingBounds.min.y, 0.001)
  const heightScale = state.proportions.height / standingHeight
  const widthScale = 0.58 + state.proportions.build * 0.42
  const depthScale = 0.82 + state.proportions.build * 0.18
  return new THREE.Vector3(heightScale * widthScale, heightScale, heightScale * depthScale)
}

export async function createDirectorMannequin(
  rawState: DirectorMannequinState | undefined,
  color: string,
): Promise<THREE.Group> {
  const state = normalizeDirectorMannequin(rawState)
  const template = await loadTemplate(state.anatomy)
  const model = prepareClone(template, color)
  const group = new THREE.Group()
  group.name = "OpenReel 标准人物"
  group.userData.directorMannequin = true
  group.userData.standardModel = true
  group.userData.modelSource = "Mesh2Motion"
  group.userData.modelVariant = state.anatomy
  group.userData.modelLicense = "CC0-1.0"
  group.userData.jointBones = JOINT_BONES
  group.add(model)

  applyProportions(model, state)
  const scale = modelScale(model, state)
  applyPose(model, state)
  group.scale.copy(scale)
  group.updateMatrixWorld(true)

  const bounds = new THREE.Box3().setFromObject(group)
  if (Number.isFinite(bounds.min.y)) group.position.y = -bounds.min.y - GROUND_CONTACT_DEPTH
  return group
}
