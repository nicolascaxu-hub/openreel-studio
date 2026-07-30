import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js"
import {
  DIRECTOR_MANNEQUIN_JOINTS,
  DIRECTOR_MANNEQUIN_POSE_PRESETS,
  normalizeDirectorMannequin,
  type DirectorMannequinJoint,
  type DirectorMannequinState,
} from "@/lib/directorMannequin"

const MODEL_FILES = {
  masculine: "human-base.glb",
  feminine: "human-female.glb",
} as const

// Sink the generated sole just far enough into the stage to avoid a bright
// contact seam without making the ankle look buried.
const GROUND_CONTACT_DEPTH = 0.004

// Director state predates the imported rig and names the screen-left limb
// "left". Mesh2Motion follows anatomical left/right, which appears mirrored
// to a front-facing viewer, so the standard-rig adapter deliberately swaps
// side suffixes. Without this adapter, symmetric actions cross through the
// torso before reaching their intended pose.
const JOINT_BONES: Record<DirectorMannequinJoint, string> = {
  pelvis: "pelvis",
  spine: "spine_01",
  spineMiddle: "spine_02",
  chest: "spine_03",
  neck: "neck_01",
  head: "head",
  leftClavicle: "clavicle_r",
  leftShoulder: "upperarm_r",
  leftElbow: "lowerarm_r",
  leftWrist: "hand_r",
  leftThumb1: "thumb_01_r",
  leftThumb2: "thumb_02_r",
  leftThumb3: "thumb_03_r",
  leftIndex1: "index_01_r",
  leftIndex2: "index_02_r",
  leftIndex3: "index_03_r",
  leftMiddle1: "middle_01_r",
  leftMiddle2: "middle_02_r",
  leftMiddle3: "middle_03_r",
  leftRing1: "ring_01_r",
  leftRing2: "ring_02_r",
  leftRing3: "ring_03_r",
  leftPinky1: "pinky_01_r",
  leftPinky2: "pinky_02_r",
  leftPinky3: "pinky_03_r",
  rightClavicle: "clavicle_l",
  rightShoulder: "upperarm_l",
  rightElbow: "lowerarm_l",
  rightWrist: "hand_l",
  rightThumb1: "thumb_01_l",
  rightThumb2: "thumb_02_l",
  rightThumb3: "thumb_03_l",
  rightIndex1: "index_01_l",
  rightIndex2: "index_02_l",
  rightIndex3: "index_03_l",
  rightMiddle1: "middle_01_l",
  rightMiddle2: "middle_02_l",
  rightMiddle3: "middle_03_l",
  rightRing1: "ring_01_l",
  rightRing2: "ring_02_l",
  rightRing3: "ring_03_l",
  rightPinky1: "pinky_01_l",
  rightPinky2: "pinky_02_l",
  rightPinky3: "pinky_03_l",
  leftHip: "thigh_r",
  leftKnee: "calf_r",
  leftAnkle: "foot_r",
  leftToe: "ball_r",
  rightHip: "thigh_l",
  rightKnee: "calf_l",
  rightAnkle: "foot_l",
  rightToe: "ball_l",
}

interface BoneFrame {
  bone: THREE.Bone
  baseWorld: THREE.Quaternion
  baseLocal: THREE.Quaternion
}

export type DirectorRigJointBones = Partial<
  Record<DirectorMannequinJoint, string | THREE.Bone>
>

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

function soleMaterial(color: string): THREE.MeshStandardMaterial {
  const material = mannequinMaterial(color)
  material.color.offsetHSL(0, -0.02, -0.035)
  material.roughness = 0.82
  return material
}

function prepareClone(template: THREE.Object3D, color: string): THREE.Object3D {
  const model = SkeletonUtils.clone(template)
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    // Geometry is immutable and shared with the cached GLB template. Pose
    // switches only need fresh bones and materials, so cloning every vertex
    // buffer here made each preset change needlessly expensive.
    child.userData.directorSharedModelGeometry = true
    child.material = mannequinMaterial(color)
    child.castShadow = true
    child.receiveShadow = true
    child.frustumCulled = false
  })
  return model
}

function bone(root: THREE.Object3D, binding: string | THREE.Bone | undefined): THREE.Bone | null {
  if (binding instanceof THREE.Bone) return binding
  if (!binding) return null
  const value = root.getObjectByName(binding)
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
  boneName: string | THREE.Bone | undefined,
  childName: string | THREE.Bone | undefined,
  baselineDirection: THREE.Vector3,
): BoneFrame | null {
  const target = bone(root, boneName)
  const child = bone(root, childName)
  if (!target || !child) return null

  const restWorld = target.getWorldQuaternion(new THREE.Quaternion())
  const restDirection = child.getWorldPosition(new THREE.Vector3())
    .sub(target.getWorldPosition(new THREE.Vector3()))
    .normalize()
  const alignment = new THREE.Quaternion().setFromUnitVectors(
    restDirection.normalize(),
    baselineDirection.clone().normalize(),
  )
  return {
    bone: target,
    baseWorld: alignment.multiply(restWorld),
    baseLocal: target.quaternion.clone(),
  }
}

function constrainedDirectionAlignment(
  sourcePrimaryValue: THREE.Vector3,
  sourceSecondaryValue: THREE.Vector3,
  targetPrimaryValue: THREE.Vector3,
  targetSecondaryValue: THREE.Vector3,
): THREE.Quaternion {
  const sourcePrimary = sourcePrimaryValue.clone().normalize()
  const targetPrimary = targetPrimaryValue.clone().normalize()
  const swing = new THREE.Quaternion().setFromUnitVectors(sourcePrimary, targetPrimary)
  const swungSecondary = sourceSecondaryValue.clone().applyQuaternion(swing)
  swungSecondary.addScaledVector(targetPrimary, -swungSecondary.dot(targetPrimary)).normalize()
  const targetSecondary = targetSecondaryValue.clone()
    .addScaledVector(targetPrimary, -targetSecondaryValue.dot(targetPrimary))
    .normalize()
  const signedAngle = Math.atan2(
    targetPrimary.dot(swungSecondary.clone().cross(targetSecondary)),
    THREE.MathUtils.clamp(swungSecondary.dot(targetSecondary), -1, 1),
  )
  const twist = new THREE.Quaternion().setFromAxisAngle(targetPrimary, signedAngle)
  return twist.multiply(swing)
}

/**
 * Calibrate the imported T-pose wrist with both finger and palm directions.
 * A one-vector alignment leaves an unconstrained 180° roll, which is why one
 * hand used to flip inside the body in clap, surrender and hand-to-face poses.
 */
function captureWristFrame(
  root: THREE.Object3D,
  wristName: string | THREE.Bone | undefined,
  middleName: string | THREE.Bone | undefined,
  indexName: string | THREE.Bone | undefined,
  pinkyName: string | THREE.Bone | undefined,
  baselinePalmDirection: THREE.Vector3,
): BoneFrame | null {
  const wrist = bone(root, wristName)
  const middle = bone(root, middleName)
  const index = bone(root, indexName)
  const pinky = bone(root, pinkyName)
  if (!wrist || !middle || !index || !pinky) return null

  const wristPosition = wrist.getWorldPosition(new THREE.Vector3())
  const fingerDirection = middle.getWorldPosition(new THREE.Vector3())
    .sub(wristPosition)
    .normalize()
  const indexDirection = index.getWorldPosition(new THREE.Vector3()).sub(wristPosition)
  const pinkyDirection = pinky.getWorldPosition(new THREE.Vector3()).sub(wristPosition)
  const palmDirection = indexDirection.cross(pinkyDirection).normalize()
  // Mesh2Motion's reference rig is a palms-down T pose. Normalize both sides
  // to that same surface before mapping them to their viewer-side inward axes.
  if (palmDirection.y > 0) palmDirection.negate()

  const alignment = constrainedDirectionAlignment(
    fingerDirection,
    palmDirection,
    new THREE.Vector3(0, -1, 0),
    baselinePalmDirection,
  )
  return {
    bone: wrist,
    baseWorld: alignment.multiply(wrist.getWorldQuaternion(new THREE.Quaternion())),
    baseLocal: wrist.quaternion.clone(),
  }
}

function captureRestBoneFrame(
  root: THREE.Object3D,
  boneName: string | THREE.Bone | undefined,
  worldCorrection = new THREE.Quaternion(),
): BoneFrame | null {
  const target = bone(root, boneName)
  if (!target) return null
  return {
    bone: target,
    baseWorld: worldCorrection.clone().multiply(target.getWorldQuaternion(new THREE.Quaternion())),
    baseLocal: target.quaternion.clone(),
  }
}

function createSoleGeometry(width: number, length: number): THREE.ExtrudeGeometry {
  const halfWidth = width / 2
  const heel = -length * 0.47
  const waist = -length * 0.12
  const ball = length * 0.22
  const toe = length * 0.53
  const shape = new THREE.Shape()
  shape.moveTo(-halfWidth * 0.66, heel)
  shape.quadraticCurveTo(-halfWidth * 0.94, heel, -halfWidth, waist)
  shape.quadraticCurveTo(-halfWidth * 1.05, ball, -halfWidth * 0.76, toe)
  shape.quadraticCurveTo(0, toe + length * 0.035, halfWidth * 0.76, toe)
  shape.quadraticCurveTo(halfWidth * 1.05, ball, halfWidth, waist)
  shape.quadraticCurveTo(halfWidth * 0.94, heel, halfWidth * 0.66, heel)
  shape.quadraticCurveTo(0, heel - length * 0.015, -halfWidth * 0.66, heel)

  const height = Math.max(0.014, length * 0.052)
  const bevel = Math.min(width * 0.035, 0.004)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 8,
  })
  // Extrusion starts along +Z. Rotate it into a flat, +Y-thick sole whose
  // longitudinal axis follows the mannequin's +Z stage direction.
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, height + bevel, 0)
  geometry.computeVertexNormals()
  return geometry
}

function addFootSoles(model: THREE.Object3D, color: string): void {
  model.updateMatrixWorld(true)
  for (const side of ["l", "r"] as const) {
    const foot = bone(model, `foot_${side}`)
    const ball = bone(model, `ball_${side}`)
    if (!foot || !ball) continue

    const heelPosition = foot.getWorldPosition(new THREE.Vector3())
    const ballPosition = ball.getWorldPosition(new THREE.Vector3())
    const forward = ballPosition.clone().sub(heelPosition)
    forward.y = 0
    const footAxisLength = forward.length()
    if (footAxisLength < 0.001) continue
    forward.normalize()

    const length = THREE.MathUtils.clamp(footAxisLength * 1.86, 0.265, 0.33)
    const width = THREE.MathUtils.clamp(length * 0.39, 0.108, 0.128)
    const sole = new THREE.Mesh(createSoleGeometry(width, length), soleMaterial(color))
    sole.name = `OpenReel refined sole ${side}`
    sole.userData.directorMannequinSole = true
    sole.castShadow = true
    sole.receiveShadow = true

    const center = heelPosition.clone().addScaledVector(forward, footAxisLength * 0.64)
    center.y = 0
    sole.position.copy(center)
    sole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward)
    model.add(sole)
    model.updateMatrixWorld(true)
    // Preserve the rest-pose world transform while making the sole follow the
    // ankle for every director pose.
    foot.attach(sole)
  }
}

function applyBoneFrame(frame: BoneFrame | null, control: THREE.Quaternion): void {
  if (!frame || !frame.bone.parent) return
  const parentWorld = frame.bone.parent.getWorldQuaternion(new THREE.Quaternion())
  const targetWorld = control.clone().multiply(frame.baseWorld)
  frame.bone.quaternion.copy(parentWorld.invert().multiply(targetWorld))
  frame.bone.updateWorldMatrix(false, true)
}

function applyLocalBoneRotation(
  frame: BoneFrame | null,
  rotation: [number, number, number],
): void {
  if (!frame) return
  frame.bone.quaternion.copy(frame.baseLocal).multiply(eulerQuaternion(rotation))
  frame.bone.updateWorldMatrix(false, true)
}

function applyPose(
  model: THREE.Object3D,
  state: DirectorMannequinState,
  jointBones: DirectorRigJointBones,
): void {
  const up = new THREE.Vector3(0, 1, 0)
  const down = new THREE.Vector3(0, -1, 0)
  model.updateMatrixWorld(true)

  const frames = Object.fromEntries(
    DIRECTOR_MANNEQUIN_JOINTS.map((joint) => [
      joint,
      captureRestBoneFrame(model, jointBones[joint]),
    ]),
  ) as Record<DirectorMannequinJoint, BoneFrame | null>
  frames.pelvis = captureBoneFrame(model, jointBones.pelvis, jointBones.spine, up)
  frames.spine = captureBoneFrame(model, jointBones.spine, jointBones.spineMiddle, up)
  frames.spineMiddle = captureBoneFrame(model, jointBones.spineMiddle, jointBones.chest, up)
  frames.chest = captureBoneFrame(model, jointBones.chest, jointBones.neck, up)
  frames.neck = captureBoneFrame(model, jointBones.neck, jointBones.head, up)
  frames.head = jointBones === JOINT_BONES
    ? captureBoneFrame(model, jointBones.head, "head_leaf", up)
    : captureRestBoneFrame(model, jointBones.head)

  for (const side of ["left", "right"] as const) {
    const shoulderJoint = `${side}Shoulder` as const
    const elbowJoint = `${side}Elbow` as const
    const wristJoint = `${side}Wrist` as const
    const hipJoint = `${side}Hip` as const
    const kneeJoint = `${side}Knee` as const
    const ankleJoint = `${side}Ankle` as const
    frames[shoulderJoint] = captureBoneFrame(
      model,
      jointBones[shoulderJoint],
      jointBones[elbowJoint],
      down,
    )
    frames[elbowJoint] = captureBoneFrame(
      model,
      jointBones[elbowJoint],
      jointBones[wristJoint],
      down,
    )
    frames[wristJoint] = captureWristFrame(
      model,
      jointBones[wristJoint],
      jointBones[`${side}Middle1`],
      jointBones[`${side}Index1`],
      jointBones[`${side}Pinky1`],
      new THREE.Vector3(side === "left" ? 1 : -1, 0, 0),
    )
    frames[hipJoint] = captureBoneFrame(model, jointBones[hipJoint], jointBones[kneeJoint], down)
    frames[kneeJoint] = captureBoneFrame(model, jointBones[kneeJoint], jointBones[ankleJoint], down)
    // The imported foot is already authored with a flat sole. Preserve that
    // exact rest frame instead of treating the instep bone as the sole axis.
    frames[ankleJoint] = captureRestBoneFrame(model, jointBones[ankleJoint])

    const wristBone = bone(model, jointBones[wristJoint])
    const wristFrame = frames[wristJoint]
    const wristCorrection = wristBone && wristFrame
      ? wristFrame.baseWorld.clone().multiply(
        wristBone.getWorldQuaternion(new THREE.Quaternion()).invert(),
      )
      : new THREE.Quaternion()
    for (const finger of ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const) {
      for (const segment of [1, 2, 3] as const) {
        const fingerJoint = `${side}${finger}${segment}` as DirectorMannequinJoint
        frames[fingerJoint] = captureRestBoneFrame(
          model,
          jointBones[fingerJoint],
          wristCorrection,
        )
      }
    }
  }

  const identity = new THREE.Quaternion()
  const pelvis = combineFrames(identity, state.joints.pelvis)
  const spine = combineFrames(pelvis, state.joints.spine)
  const spineMiddle = combineFrames(spine, state.joints.spineMiddle)
  const chest = combineFrames(spineMiddle, state.joints.chest)
  const neck = combineFrames(chest, state.joints.neck)
  const head = combineFrames(neck, state.joints.head)

  applyBoneFrame(frames.pelvis, pelvis)
  applyBoneFrame(frames.spine, spine)
  applyBoneFrame(frames.spineMiddle, spineMiddle)
  applyBoneFrame(frames.chest, chest)
  applyBoneFrame(frames.neck, neck)
  applyBoneFrame(frames.head, head)

  for (const side of ["left", "right"] as const) {
    const clavicleJoint = `${side}Clavicle` as const
    const shoulderJoint = `${side}Shoulder` as const
    const elbowJoint = `${side}Elbow` as const
    const wristJoint = `${side}Wrist` as const
    const hipJoint = `${side}Hip` as const
    const kneeJoint = `${side}Knee` as const
    const ankleJoint = `${side}Ankle` as const
    const toeJoint = `${side}Toe` as const

    const clavicle = combineFrames(chest, state.joints[clavicleJoint])
    const shoulder = combineFrames(clavicle, state.joints[shoulderJoint])
    const elbow = combineFrames(shoulder, state.joints[elbowJoint])
    const wrist = combineFrames(elbow, state.joints[wristJoint])
    applyBoneFrame(frames[clavicleJoint], clavicle)
    applyBoneFrame(frames[shoulderJoint], shoulder)
    applyBoneFrame(frames[elbowJoint], elbow)
    applyBoneFrame(frames[wristJoint], wrist)

    for (const finger of ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const) {
      for (const segment of [1, 2, 3] as const) {
        const fingerJoint = `${side}${finger}${segment}` as DirectorMannequinJoint
        // Finger flexion is authored in each phalanx's local rest frame. This
        // keeps a fist or pointing hand stable as the shoulder and wrist turn.
        applyLocalBoneRotation(frames[fingerJoint], state.joints[fingerJoint])
      }
    }

    const hip = combineFrames(pelvis, state.joints[hipJoint])
    const knee = combineFrames(hip, state.joints[kneeJoint])
    // Ankles are authored as world-level foot controls. This keeps a zeroed
    // foot flat on the stage after a deep knee bend instead of inheriting the
    // complete hip/knee rotation and pointing the toes into the air.
    const ankle = combineFrames(identity, state.joints[ankleJoint])
    const toe = combineFrames(ankle, state.joints[toeJoint])
    applyBoneFrame(frames[hipJoint], hip)
    applyBoneFrame(frames[kneeJoint], knee)
    applyBoneFrame(frames[ankleJoint], ankle)
    applyBoneFrame(frames[toeJoint], toe)
  }
}

export function applyDirectorRigPose(
  model: THREE.Object3D,
  rawState: Pick<DirectorMannequinState, "pose_preset" | "joints"> | undefined,
  jointBones: DirectorRigJointBones,
): void {
  const state = normalizeDirectorMannequin(rawState)
  applyPose(model, state, jointBones)
}

export interface DirectorRigGroundAnchor {
  y: number
  clearance_ratio: number
}

export function directorRigGroundAnchor(
  model: THREE.Object3D,
  rawState: Pick<DirectorMannequinState, "pose_preset" | "joints"> | undefined,
  jointBones: DirectorRigJointBones,
): DirectorRigGroundAnchor | null {
  const state = normalizeDirectorMannequin(rawState)
  const preset = DIRECTOR_MANNEQUIN_POSE_PRESETS.find((item) => item.id === state.pose_preset)
  const joints = preset?.ground_contact === "left_knee"
    ? [jointBones.leftKnee]
    : preset?.ground_contact === "right_knee"
      ? [jointBones.rightKnee]
    : preset?.ground_contact === "pelvis"
      ? [jointBones.pelvis]
      : []
  if (!joints.length) return null
  model.updateMatrixWorld(true)
  const positions = joints
    .map((joint) => bone(model, joint)?.getWorldPosition(new THREE.Vector3()).y)
    .filter((value): value is number => Number.isFinite(value))
  if (!positions.length) return null
  return {
    y: Math.min(...positions),
    clearance_ratio: preset?.ground_contact.endsWith("_knee") ? 0.044 : 0.11,
  }
}

function groundFromFootSoles(group: THREE.Group): void {
  group.updateMatrixWorld(true)
  let soleFloor = Number.POSITIVE_INFINITY
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.userData.directorMannequinSole) return
    const bounds = new THREE.Box3().setFromObject(child)
    if (Number.isFinite(bounds.min.y)) soleFloor = Math.min(soleFloor, bounds.min.y)
  })
  if (Number.isFinite(soleFloor)) {
    group.position.y = -soleFloor - GROUND_CONTACT_DEPTH
  }
}

function groundFromJoint(
  group: THREE.Group,
  model: THREE.Object3D,
  names: string[],
  clearance: number,
): void {
  group.updateMatrixWorld(true)
  const positions = names
    .map((name) => bone(model, name)?.getWorldPosition(new THREE.Vector3()).y)
    .filter((value): value is number => Number.isFinite(value))
  if (positions.length) {
    group.position.y += clearance - Math.min(...positions)
  }
}

function groundMannequin(
  group: THREE.Group,
  model: THREE.Object3D,
  state: DirectorMannequinState,
): void {
  const preset = DIRECTOR_MANNEQUIN_POSE_PRESETS.find((item) => item.id === state.pose_preset)
  if (preset?.ground_contact === "left_knee") {
    groundFromJoint(group, model, [JOINT_BONES.leftKnee], 0.075)
    return
  }
  if (preset?.ground_contact === "right_knee") {
    groundFromJoint(group, model, [JOINT_BONES.rightKnee], 0.075)
    return
  }
  if (preset?.ground_contact === "pelvis") {
    groundFromJoint(group, model, ["pelvis"], 0.19)
    return
  }
  groundFromFootSoles(group)
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
  addFootSoles(model, color)
  const scale = modelScale(model, state)
  applyPose(model, state, JOINT_BONES)
  group.scale.copy(scale)
  group.updateMatrixWorld(true)
  groundMannequin(group, model, state)
  return group
}
