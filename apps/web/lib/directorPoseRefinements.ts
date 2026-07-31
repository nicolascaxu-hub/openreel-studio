import * as THREE from "three"

export type DirectorPoseRotation = [number, number, number]
export type DirectorPoseDirection = readonly [number, number, number]
export type DirectorPoseJointValues = Partial<Record<string, DirectorPoseRotation>>
export type DirectorHandPoseName = "relaxed" | "straight" | "open" | "soft-fist" | "fist" | "point" | "waist" | "clasp"
export type DirectorLegRole =
  | "planted"
  | "lead-step"
  | "trailing-step"
  | "running-swing"
  | "running-drive"
  | "raised-knee"
  | "kneeling-front"
  | "kneeling-rear"
  | "forward-kick"

function directorFingerPose(
  side: "left" | "right",
  finger: "Thumb" | "Index" | "Middle" | "Ring" | "Pinky",
  curl: DirectorPoseRotation,
  spread = 0,
): DirectorPoseJointValues {
  return {
    [`${side}${finger}1`]: [curl[0], 0, spread],
    [`${side}${finger}2`]: [curl[1], 0, 0],
    [`${side}${finger}3`]: [curl[2], 0, 0],
  }
}

/** A hand module always expands to all 15 phalanx controls on one side. */
export function directorHandPose(
  side: "left" | "right",
  shape: DirectorHandPoseName,
): DirectorPoseJointValues {
  const mirrorSide = side === "left" ? -1 : 1
  const fingers = (
    index: DirectorPoseRotation,
    middle: DirectorPoseRotation,
    ring: DirectorPoseRotation,
    pinky: DirectorPoseRotation,
    spread = 0,
  ): DirectorPoseJointValues => ({
    ...directorFingerPose(side, "Index", index, -spread * mirrorSide),
    ...directorFingerPose(side, "Middle", middle, -spread * .3 * mirrorSide),
    ...directorFingerPose(side, "Ring", ring, spread * .35 * mirrorSide),
    ...directorFingerPose(side, "Pinky", pinky, spread * mirrorSide),
  })

  if (shape === "straight") return {
    ...directorFingerPose(side, "Thumb", [2, 3, 2], 2 * mirrorSide),
    ...fingers([0, 1, 0], [0, 1, 0], [1, 2, 1], [2, 3, 2]),
  }
  if (shape === "open") return {
    ...directorFingerPose(side, "Thumb", [-5, 4, 2], 8 * mirrorSide),
    ...fingers([0, 1, 1], [0, 1, 1], [1, 2, 1], [2, 3, 2], 5),
  }
  if (shape === "soft-fist") return {
    ...directorFingerPose(side, "Thumb", [18, 18, 10], 3 * mirrorSide),
    ...fingers([34, 48, 30], [38, 52, 34], [42, 56, 38], [46, 60, 42], 1),
  }
  if (shape === "fist") return {
    ...directorFingerPose(side, "Thumb", [30, 34, 20], 1 * mirrorSide),
    ...fingers([58, 84, 64], [62, 88, 68], [64, 90, 70], [66, 92, 72]),
  }
  if (shape === "point") return {
    ...directorFingerPose(side, "Thumb", [30, 34, 20], 1 * mirrorSide),
    ...directorFingerPose(side, "Index", [0, 1, 1]),
    ...directorFingerPose(side, "Middle", [62, 86, 66]),
    ...directorFingerPose(side, "Ring", [66, 90, 70]),
    ...directorFingerPose(side, "Pinky", [68, 92, 72]),
  }
  if (shape === "waist") return {
    ...directorFingerPose(side, "Thumb", [8, 10, 6], 3 * mirrorSide),
    ...fingers([12, 20, 12], [14, 23, 14], [16, 25, 16], [18, 28, 18], 1.5),
  }
  if (shape === "clasp") return {
    ...directorFingerPose(side, "Thumb", [20, 24, 14], 1 * mirrorSide),
    ...fingers([26, 38, 24], [30, 42, 27], [34, 46, 30], [38, 50, 34]),
  }
  return {
    ...directorFingerPose(side, "Thumb", [7, 9, 5], 3 * mirrorSide),
    ...fingers([5, 8, 5], [7, 10, 7], [9, 12, 8], [12, 15, 10], 1.5),
  }
}

const DOWN = new THREE.Vector3(0, -1, 0)

function directionQuaternion(direction: DirectorPoseDirection): THREE.Quaternion {
  const target = new THREE.Vector3(...direction)
  if (target.lengthSq() < 0.000001) target.copy(DOWN)
  return new THREE.Quaternion().setFromUnitVectors(DOWN, target.normalize())
}

function orientationQuaternion(
  direction: DirectorPoseDirection,
  facing: DirectorPoseDirection,
  baselineFacing: DirectorPoseDirection,
): THREE.Quaternion {
  const sourcePrimary = DOWN.clone()
  const targetPrimary = new THREE.Vector3(...direction).normalize()
  const swing = new THREE.Quaternion().setFromUnitVectors(sourcePrimary, targetPrimary)
  const swungFacing = new THREE.Vector3(...baselineFacing).applyQuaternion(swing)
  swungFacing.addScaledVector(targetPrimary, -swungFacing.dot(targetPrimary)).normalize()
  const targetFacing = new THREE.Vector3(...facing)
  targetFacing.addScaledVector(targetPrimary, -targetFacing.dot(targetPrimary)).normalize()
  const signedAngle = Math.atan2(
    targetPrimary.dot(swungFacing.clone().cross(targetFacing)),
    THREE.MathUtils.clamp(swungFacing.dot(targetFacing), -1, 1),
  )
  return new THREE.Quaternion().setFromAxisAngle(targetPrimary, signedAngle).multiply(swing)
}

function stableLimbFacing(
  direction: DirectorPoseDirection,
  preferred: DirectorPoseDirection = [0, 0, 1],
): DirectorPoseDirection {
  const primary = new THREE.Vector3(...direction).normalize()
  const facing = new THREE.Vector3(...preferred)
    .addScaledVector(primary, -new THREE.Vector3(...preferred).dot(primary))
  if (facing.lengthSq() < 0.000001) {
    facing.set(0, 1, 0).addScaledVector(primary, -primary.y)
  }
  if (facing.lengthSq() < 0.000001) {
    facing.set(1, 0, 0).addScaledVector(primary, -primary.x)
  }
  return facing.normalize().toArray() as DirectorPoseDirection
}

/**
 * A bone direction alone leaves its roll around the bone axis undefined.
 * Preserve the body's forward-facing plane as the secondary axis so the
 * shoulder surface, elbow crease and kneecap do not corkscrew in side/rear
 * views while keeping the authored joint positions unchanged.
 */
function stableLimbQuaternion(direction: DirectorPoseDirection): THREE.Quaternion {
  return orientationQuaternion(direction, stableLimbFacing(direction), [0, 0, 1])
}

function rotationFromQuaternion(quaternion: THREE.Quaternion): DirectorPoseRotation {
  const euler = new THREE.Euler().setFromQuaternion(quaternion.normalize(), "XYZ")
  return [euler.x, euler.y, euler.z].map((value) =>
    Number(THREE.MathUtils.radToDeg(value).toFixed(2)),
  ) as DirectorPoseRotation
}

/**
 * Authors an arm from anatomical directions instead of guessing three linked
 * Euler rotations. Directions live in the chest frame: +X stage right, +Y up
 * and +Z forward. The returned rotations are the exact shoulder/elbow/wrist
 * controls consumed by the standard rig adapter.
 */
export function directorArmChain(
  side: "left" | "right",
  upperArm: DirectorPoseDirection,
  forearm: DirectorPoseDirection,
  hand: DirectorPoseDirection = forearm,
  palmFacing?: DirectorPoseDirection,
): DirectorPoseJointValues {
  const shoulderWorld = stableLimbQuaternion(upperArm)
  const elbowWorld = stableLimbQuaternion(forearm)
  const handWorld = palmFacing
    ? orientationQuaternion(hand, palmFacing, [side === "left" ? 1 : -1, 0, 0])
    : directionQuaternion(hand)
  const elbowLocal = shoulderWorld.clone().invert().multiply(elbowWorld)
  const wristLocal = elbowWorld.clone().invert().multiply(handWorld)
  const prefix = side
  return {
    [`${prefix}Shoulder`]: rotationFromQuaternion(shoulderWorld),
    [`${prefix}Elbow`]: rotationFromQuaternion(elbowLocal),
    [`${prefix}Wrist`]: rotationFromQuaternion(wristLocal),
  }
}

function mirror(direction: DirectorPoseDirection): DirectorPoseDirection {
  return [-direction[0], direction[1], direction[2]]
}

function offsetDepth(
  direction: DirectorPoseDirection,
  amount: number,
): DirectorPoseDirection {
  const value = new THREE.Vector3(direction[0], direction[1], direction[2] + amount).normalize()
  return value.toArray() as DirectorPoseDirection
}

export function directorSymmetricArms(
  leftUpperArm: DirectorPoseDirection,
  leftForearm: DirectorPoseDirection,
  leftHand: DirectorPoseDirection = leftForearm,
  leftPalmFacing?: DirectorPoseDirection,
): DirectorPoseJointValues {
  return {
    ...directorArmChain("left", leftUpperArm, leftForearm, leftHand, leftPalmFacing),
    ...directorArmChain(
      "right",
      mirror(leftUpperArm),
      mirror(leftForearm),
      mirror(leftHand),
      leftPalmFacing ? mirror(leftPalmFacing) : undefined,
    ),
  }
}

/**
 * Give non-contact bilateral gestures a small front/back stagger. Perfectly
 * twinned limbs collapse into one silhouette from the side and can occupy the
 * same skin volume around the ribs; this keeps both chains readable without
 * changing the action's front-facing composition.
 */
export function directorReadableSymmetricArms(
  leftUpperArm: DirectorPoseDirection,
  leftForearm: DirectorPoseDirection,
  leftHand: DirectorPoseDirection = leftForearm,
  leftPalmFacing?: DirectorPoseDirection,
  depthSeparation = .055,
): DirectorPoseJointValues {
  return {
    ...directorArmChain(
      "left",
      offsetDepth(leftUpperArm, depthSeparation),
      offsetDepth(leftForearm, depthSeparation),
      offsetDepth(leftHand, depthSeparation),
      leftPalmFacing,
    ),
    ...directorArmChain(
      "right",
      offsetDepth(mirror(leftUpperArm), -depthSeparation),
      offsetDepth(mirror(leftForearm), -depthSeparation),
      offsetDepth(mirror(leftHand), -depthSeparation),
      leftPalmFacing ? mirror(leftPalmFacing) : undefined,
    ),
  }
}

export function directorLegChain(
  side: "left" | "right",
  thigh: DirectorPoseDirection,
  calf: DirectorPoseDirection,
  foot: DirectorPoseRotation = [0, 0, 0],
): DirectorPoseJointValues {
  const hipWorld = stableLimbQuaternion(thigh)
  const kneeWorld = stableLimbQuaternion(calf)
  const kneeLocal = hipWorld.clone().invert().multiply(kneeWorld)
  return {
    [`${side}Hip`]: rotationFromQuaternion(hipWorld),
    [`${side}Knee`]: rotationFromQuaternion(kneeLocal),
    // Foot rotations are world-level controls in the renderer. Zero means a
    // flat authored foot even when the hip and knee are deeply flexed.
    [`${side}Ankle`]: foot,
    [`${side}Toe`]: [0, 0, 0],
  }
}

function assertDirectorLegRole(
  role: DirectorLegRole,
  thighDirection: DirectorPoseDirection,
  calfDirection: DirectorPoseDirection,
): void {
  const thigh = new THREE.Vector3(...thighDirection).normalize()
  const calf = new THREE.Vector3(...calfDirection).normalize()
  const kneeAngle = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(thigh.dot(calf), -1, 1)))
  const valid = role === "planted"
    ? thigh.y < -.9 && calf.y < -.9
    : role === "lead-step"
      ? thigh.z > .25 && calf.z < 0
      : role === "trailing-step"
        ? thigh.z < -.25 && calf.z > 0
        : role === "running-swing"
          ? thigh.z > .5 && calf.z < -.5 && kneeAngle > 50
          : role === "running-drive"
            ? thigh.z < -.4 && calf.z < -.2 && thigh.y < -.5 && calf.y < -.5
            : role === "raised-knee"
              ? thigh.z > .8 && calf.y < -.6 && calf.z < 0
              : role === "kneeling-front"
                ? thigh.z > .8 && Math.abs(thigh.y) < .25 && calf.y < -.75 && calf.z < 0
                : role === "kneeling-rear"
                  ? thigh.y < -.75 && thigh.z < 0 && calf.y > 0 && calf.z < -.75
                  : thigh.z > .8 && calf.z > .75 && kneeAngle >= 10
  if (!valid) {
    throw new Error(`导演腿型 ${role} 的髋膝踝方向不符合人体折叠规则`)
  }
}

function directorLegRole(
  side: "left" | "right",
  role: DirectorLegRole,
  thigh: DirectorPoseDirection,
  calf: DirectorPoseDirection,
  foot: DirectorPoseRotation = [0, 0, 0],
): DirectorPoseJointValues {
  assertDirectorLegRole(role, thigh, calf)
  return directorLegChain(side, thigh, calf, foot)
}

export function directorSymmetricLegs(
  leftThigh: DirectorPoseDirection,
  leftCalf: DirectorPoseDirection,
  foot: DirectorPoseRotation = [0, 0, 0],
): DirectorPoseJointValues {
  return {
    ...directorLegChain("left", leftThigh, leftCalf, foot),
    ...directorLegChain("right", mirror(leftThigh), mirror(leftCalf), foot),
  }
}

function legDirection(
  side: "left" | "right",
  down: number,
  forward: number,
  lateral = .025,
): DirectorPoseDirection {
  return [side === "left" ? -lateral : lateral, down, forward]
}

function plantedLeg(side: "left" | "right"): DirectorPoseJointValues {
  return directorLegRole(
    side,
    "planted",
    legDirection(side, -1, .018, .02),
    legDirection(side, -1, 0, .012),
  )
}

const relaxedArms = () => directorReadableSymmetricArms([-.10, -.99, .06], [-.03, -1, .02])
const attentionArms = () => directorReadableSymmetricArms([-.025, -1, .015], [-.015, -1, .01])
const standingLegs = () => ({ ...plantedLeg("left"), ...plantedLeg("right") })
const handsFront = () => directorSymmetricArms(
  [-.30, -.62, .72], [.58, .08, .81], [.05, -.20, .98], [1, 0, 0],
)
const handsChest = () => directorSymmetricArms(
  [-.38, -.40, .83], [.82, .20, .54], [0, 1, .04], [1, 0, 0],
)
const handsHips = () => directorSymmetricArms(
  [-.58, -.62, .53], [.52, -.72, -.25], [-.20, -.98, 0], [1, 0, 0],
)
const handsBack = () => directorSymmetricArms(
  [-.36, -.72, -.59], [.76, -.30, -.58], [.05, -.82, -.57], [0, 0, -1],
)
const openArms = () => directorReadableSymmetricArms(
  [-.78, -.16, .61], [-.84, -.10, .53], [-.62, .42, .66], [0, .78, .62],
)
const shrugArms = () => directorReadableSymmetricArms(
  [-.62, -.28, .73], [-.78, .25, .57], [-.80, .18, .57], [0, 1, 0],
)
const hugArms = () => directorSymmetricArms(
  [-.72, -.10, .69], [.80, -.02, .60], [0, 1, .04], [1, 0, 0],
)
const carryArms = () => directorSymmetricArms(
  [-.46, -.42, .78], [.62, -.08, .78], [0, -1, .06], [1, 0, 0],
)
const faceArms = () => directorSymmetricArms(
  [-.64, -.30, .71], [.84, .42, .34], [1, .04, 0], [0, 0, -1],
)
const guardArms = () => directorReadableSymmetricArms(
  [-.58, .08, .81], [.58, .72, .38], [0, 1, .10], [0, 0, 1],
)
const raisedArms = () => directorReadableSymmetricArms(
  [-.58, .69, .43], [-.14, .98, .12], [0, 1, .04], [0, 0, 1],
)
const victoryArms = () => directorReadableSymmetricArms(
  [-.52, .78, .34], [-.46, .82, .34], [-.08, .99, .08], [0, 0, 1],
)
const seatedLegs = () => directorSymmetricLegs([-.06, -.08, 1], [-.03, -.98, -.20])
const crouchedLegs = () => directorSymmetricLegs([-.09, -.38, .92], [-.04, -.83, -.56])
const deepCrouchedLegs = () => directorSymmetricLegs([-.12, -.42, .90], [-.05, -.43, -.90])
const lungeLegs = () => ({
  // Lead knee travels forward while its ankle stays behind the knee; the rear
  // knee travels backward while its ankle returns toward the body. This keeps
  // both knees folding toward the toes instead of reversing either hinge.
  ...directorLegRole("left", "lead-step", legDirection("left", -.78, .63, .05), legDirection("left", -.98, -.20, .02)),
  ...directorLegRole("right", "trailing-step", legDirection("right", -.72, -.69, .05), legDirection("right", -.96, .28, .02)),
})
const highStepLegs = () => ({
  // A lifted thigh leads the motion; the shin hangs behind the knee rather
  // than continuing forward and making the lower leg look reversed.
  ...directorLegRole("left", "raised-knee", legDirection("left", .05, 1, .04), legDirection("left", -.96, -.28, .02)),
  ...plantedLeg("right"),
})
const walkLegs = () => ({
  ...directorLegRole("left", "lead-step", legDirection("left", -.72, .69, .04), legDirection("left", -.99, -.12, .02)),
  ...directorLegRole("right", "trailing-step", legDirection("right", -.88, -.47, .04), legDirection("right", -.99, .10, .02)),
})
const runLegs = () => ({
  ...directorLegRole("left", "running-swing", legDirection("left", -.45, .89, .04), legDirection("left", -.22, -.98, .02)),
  ...directorLegRole("right", "running-drive", legDirection("right", -.72, -.69, .04), legDirection("right", -.88, -.48, .02)),
})
const kneelingLegs = () => ({
  // Proposal-style kneel: the lead thigh is almost horizontal and the shin
  // drops to a planted foot; the rear shin folds backward from the grounded
  // right knee, with the ankle lifted behind it instead of under the torso.
  ...directorLegRole("left", "kneeling-front", legDirection("left", -.10, 1, .04), legDirection("left", -.96, -.28, .02)),
  ...directorLegRole("right", "kneeling-rear", legDirection("right", -.98, -.20, .04), legDirection("right", .18, -.98, .02), [22, 0, 0]),
})
const kickLegs = () => ({
  // Keep a visible, forward-folding knee instead of locking the complete leg
  // into a hyperextended line; the support chain remains vertical and flat.
  ...directorLegRole("left", "forward-kick", legDirection("left", -.08, 1, .04), legDirection("left", -.30, .95, .02)),
  ...plantedLeg("right"),
})
const sneakStepLegs = () => ({
  ...directorLegRole("left", "lead-step", legDirection("left", -.48, .87, .06), legDirection("left", -.91, -.42, .03)),
  ...directorLegRole("right", "trailing-step", legDirection("right", -.62, -.78, .06), legDirection("right", -.95, .31, .03)),
})
const recoveryStepLegs = () => ({
  ...directorLegRole("left", "lead-step", legDirection("left", -.78, .62, .10), legDirection("left", -.99, -.08, .05)),
  ...directorLegRole("right", "trailing-step", legDirection("right", -.86, -.50, .06), legDirection("right", -.98, .18, .04)),
})

const rightFace = () => directorArmChain("right", [.64, -.30, .71], [-.90, .38, .20], [-.99, .08, .03], [0, 0, -1])
const rightTemple = () => directorArmChain("right", [.75, -.08, .65], [-.55, .82, .18], [-.12, .98, .13], [0, 0, -1])
const rightEar = () => directorArmChain("right", [.74, -.27, .62], [-.48, .86, .17], [-.12, .98, .13], [-1, 0, 0])
const rightDrink = () => directorArmChain("right", [.69, -.45, .57], [-.76, .58, .29], [0, 1, .05], [-1, 0, 0])
const rightWhisper = () => directorArmChain("right", [.70, -.35, .62], [-.68, .66, .32], [0, 1, .05], [0, 0, -1])
const rightWave = () => directorArmChain("right", [.52, .43, .74], [-.08, .99, .12], [-.05, .99, .08], [0, 0, 1])
const rightForward = () => directorArmChain("right", [.18, -.18, .97], [.04, -.05, 1], [.02, .05, 1], [0, -1, 0])
const rightStop = () => directorArmChain("right", [.18, -.18, .97], [.04, -.05, 1], [0, 1, .04], [0, 0, 1])
const rightLowForward = () => directorArmChain("right", [.31, -.58, .75], [-.08, -.06, 1], [.02, .08, 1], [-1, 0, 0])
const rightExplain = () => directorArmChain("right", [.48, -.45, .75], [.40, .20, .89], [.20, .10, .97], [0, 1, 0])
const rightRelaxed = () => directorArmChain("right", [.10, -.99, .06], [.03, -1, .02])
const leftRelaxed = () => directorArmChain("left", [-.10, -.99, .06], [-.03, -1, .02])

/**
 * Reusable, region-scoped motion modules. A module owns only its body region,
 * so swapping an arm gesture cannot rewrite the torso or legs and changing a
 * stance cannot alter the hands. The final preset materializer still expands
 * every composition into the complete 52-joint state.
 */
const DIRECTOR_POSE_MODULES = Object.freeze({
  torso: Object.freeze({
    neutral: () => ({ pelvis: [0, 0, 0], spine: [0, 0, 0], spineMiddle: [0, 0, 0], chest: [0, 0, 0] } satisfies DirectorPoseJointValues),
    forwardLean: () => ({ pelvis: [5, 0, 0], spine: [7, 0, 0], spineMiddle: [5, 0, 0], chest: [3, 0, 0] } satisfies DirectorPoseJointValues),
    deepForwardLean: () => ({ pelvis: [12, 0, 0], spine: [18, 0, 0], spineMiddle: [12, 0, 0], chest: [8, 0, 0] } satisfies DirectorPoseJointValues),
    recoil: () => ({ pelvis: [-4, 0, 0], spine: [-7, 0, 0], spineMiddle: [-5, 0, 0], chest: [-8, 0, 0] } satisfies DirectorPoseJointValues),
    lifted: () => ({ pelvis: [-2, 0, 0], spine: [-2, 0, 0], spineMiddle: [-2, 0, 0], chest: [-4, 0, 0] } satisfies DirectorPoseJointValues),
  }),
  head: Object.freeze({
    neutral: () => ({ neck: [0, 0, 0], head: [0, 0, 0] } satisfies DirectorPoseJointValues),
    down: () => ({ neck: [10, 0, 0], head: [14, 0, 0] } satisfies DirectorPoseJointValues),
    up: () => ({ neck: [-4, 0, 0], head: [-8, 0, 0] } satisfies DirectorPoseJointValues),
    listenRight: () => ({ neck: [0, 5, 8], head: [0, 8, 12] } satisfies DirectorPoseJointValues),
  }),
  arms: Object.freeze({
    relaxed: relaxedArms,
    attention: attentionArms,
    handsFront,
    handsChest,
    handsHips,
    handsBack,
    open: openArms,
    shrug: shrugArms,
    hug: hugArms,
    carry: carryArms,
    face: faceArms,
    guard: guardArms,
    raised: raisedArms,
    victory: victoryArms,
    rightFace,
    rightTemple,
    rightEar,
    rightDrink,
    rightWhisper,
    rightWave,
    rightForward,
    rightStop,
    rightLowForward,
    rightExplain,
    rightRelaxed,
    leftRelaxed,
  }),
  legs: Object.freeze({
    standing: standingLegs,
    seated: seatedLegs,
    crouched: crouchedLegs,
    deepCrouched: deepCrouchedLegs,
    lunge: lungeLegs,
    highStep: highStepLegs,
    walk: walkLegs,
    run: runLegs,
    kneeling: kneelingLegs,
    kick: kickLegs,
    sneakStep: sneakStepLegs,
    recoveryStep: recoveryStepLegs,
  }),
  hands: Object.freeze({
    relaxed: (side: "left" | "right") => directorHandPose(side, "relaxed"),
    straight: (side: "left" | "right") => directorHandPose(side, "straight"),
    open: (side: "left" | "right") => directorHandPose(side, "open"),
    softFist: (side: "left" | "right") => directorHandPose(side, "soft-fist"),
    fist: (side: "left" | "right") => directorHandPose(side, "fist"),
    point: (side: "left" | "right") => directorHandPose(side, "point"),
    waist: (side: "left" | "right") => directorHandPose(side, "waist"),
    clasp: (side: "left" | "right") => directorHandPose(side, "clasp"),
  }),
})

function assertModuleKeys(
  family: string,
  modules: Readonly<Record<string, () => DirectorPoseJointValues>>,
  allowed: RegExp,
): void {
  for (const [name, factory] of Object.entries(modules)) {
    const invalid = Object.keys(factory()).filter((joint) => !allowed.test(joint))
    if (invalid.length) throw new Error(`导演姿势模块 ${family}.${name} 修改了越界关节：${invalid.join(", ")}`)
  }
}

assertModuleKeys("torso", DIRECTOR_POSE_MODULES.torso, /^(pelvis|spine|spineMiddle|chest)$/)
assertModuleKeys("head", DIRECTOR_POSE_MODULES.head, /^(neck|head)$/)
assertModuleKeys("arms", DIRECTOR_POSE_MODULES.arms, /^(left|right)(Shoulder|Elbow|Wrist)$/)
assertModuleKeys("legs", DIRECTOR_POSE_MODULES.legs, /^(left|right)(Hip|Knee|Ankle|Toe)$/)
for (const [name, factory] of Object.entries(DIRECTOR_POSE_MODULES.hands)) {
  for (const side of ["left", "right"] as const) {
    const joints = factory(side)
    const allowed = new RegExp(`^${side}(Thumb|Index|Middle|Ring|Pinky)[123]$`)
    const invalid = Object.keys(joints).filter((joint) => !allowed.test(joint))
    if (invalid.length || Object.keys(joints).length !== 15) {
      throw new Error(`导演手型模块 hands.${name}.${side} 必须且只能输出 15 根指骨`)
    }
  }
}

export function composeDirectorPoseModules(
  ...modules: readonly DirectorPoseJointValues[]
): DirectorPoseJointValues {
  return Object.assign({}, ...modules)
}

/**
 * Every shipped pose has a kinematically authored override. Existing torso
 * acting details remain useful, while all limb chains below are regenerated
 * from explicit directions so a later base-pose edit cannot silently turn a
 * drink, surrender or hug into an unrelated silhouette.
 */
export const DIRECTOR_POSE_REFINEMENTS: Readonly<Record<string, DirectorPoseJointValues>> = {
  "relaxed": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.relaxed(), DIRECTOR_POSE_MODULES.legs.standing()),
  "attention": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.attention(), DIRECTOR_POSE_MODULES.legs.standing()),
  "a-pose": { ...directorSymmetricArms([-.42, -.91, 0], [-.42, -.91, 0]), ...standingLegs() },
  "t-pose": { ...directorSymmetricArms([-1, -.02, 0], [-1, -.02, 0], [-1, 0, 0]), ...standingLegs() },
  "walk": {
    ...directorArmChain("left", [-.10, -.84, .54], [-.05, -.97, .24]),
    ...directorArmChain("right", [.10, -.88, -.47], [.04, -.99, -.14]),
    ...walkLegs(),
  },
  "run": {
    ...directorArmChain("left", [-.18, -.42, .89], [.05, .34, .94]),
    ...directorArmChain("right", [.18, -.48, -.86], [-.04, .28, -.96]),
    ...runLegs(),
  },
  "sit": { ...handsFront(), ...seatedLegs() },
  "crouch": {
    pelvis: [8, 0, 0], spine: [10, 0, 0], spineMiddle: [6, 0, 0], chest: [2, 0, 0],
    neck: [-7, 0, 0], head: [-4, 0, 0],
    ...directorSymmetricArms([-.30, -.42, .85], [-.12, -.12, .98], [0, .04, 1], [0, -1, 0]),
    ...deepCrouchedLegs(),
  },
  "wave": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.leftRelaxed(), DIRECTOR_POSE_MODULES.arms.rightWave(), DIRECTOR_POSE_MODULES.legs.standing()),
  "point": { ...leftRelaxed(), ...rightForward(), ...standingLegs() },
  "hands-hips": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.handsHips(), DIRECTOR_POSE_MODULES.legs.standing()),
  "open-arms": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.open(), DIRECTOR_POSE_MODULES.legs.standing()),
  "explain": { ...leftRelaxed(), ...rightExplain(), ...standingLegs() },
  "hands-back": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.handsBack(), DIRECTOR_POSE_MODULES.legs.standing()),
  "look-back": { ...relaxedArms(), ...standingLegs() },
  "salute": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.leftRelaxed(), DIRECTOR_POSE_MODULES.arms.rightTemple(), DIRECTOR_POSE_MODULES.legs.standing()),
  "celebrate": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.victory(), DIRECTOR_POSE_MODULES.legs.standing()),
  "lunge": { ...directorSymmetricArms([-.40, -.52, .76], [.12, .28, .95]), ...lungeLegs() },
  "high-step": {
    ...directorArmChain("left", [-.12, -.65, -.75], [-.04, -.92, -.38]),
    ...directorArmChain("right", [.12, -.56, .82], [.04, -.88, .47]),
    ...highStepLegs(),
  },
  "arms-crossed": {
    ...directorSymmetricArms([.03, -.75, .66], [.96, .17, .22], [1, .02, .04], [0, 0, -1]),
    ...standingLegs(),
  },
  "one-hand-hip": { ...leftRelaxed(), ...directorArmChain("right", [.58, -.62, .53], [-.52, -.72, -.25], [.20, -.98, 0], [-1, 0, 0]), ...standingLegs() },
  "hands-front": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.handsFront(), DIRECTOR_POSE_MODULES.legs.standing()),
  "hands-pockets": { ...directorSymmetricArms([-.25, -.82, .52], [.34, -.72, .60], [0, -.99, .08], [1, 0, 0]), ...standingLegs() },
  "lean-wall": { ...relaxedArms(), ...standingLegs() },
  "wait": { ...handsFront(), ...standingLegs() },
  "beckon": { ...leftRelaxed(), ...directorArmChain("right", [.52, -.24, .82], [.18, .61, .77], [0, 1, .04], [0, 0, 1]), ...standingLegs() },
  "stop": { ...leftRelaxed(), ...rightStop(), ...standingLegs() },
  "shrug": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.shrug(), DIRECTOR_POSE_MODULES.legs.standing()),
  "clap": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.handsChest(), DIRECTOR_POSE_MODULES.legs.standing()),
  "greeting-bow": { ...handsFront(), ...standingLegs() },
  "apology-bow": { ...handsFront(), ...standingLegs() },
  "whisper": { ...leftRelaxed(), ...rightWhisper(), ...standingLegs() },
  "listen": { ...leftRelaxed(), ...rightEar(), ...standingLegs() },
  "phone-call": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.leftRelaxed(), DIRECTOR_POSE_MODULES.arms.rightEar(), DIRECTOR_POSE_MODULES.legs.standing()),
  "selfie": { ...leftRelaxed(), ...directorArmChain("right", [.42, -.12, .90], [.18, .12, .98], [0, 1, .04], [0, 0, -1]), ...standingLegs() },
  "read-phone": { ...directorSymmetricArms([-.28, -.67, .69], [.58, .16, .80], [0, 1, .04], [0, 0, -1]), ...standingLegs() },
  "handover": { ...directorSymmetricArms([-.26, -.45, .85], [.12, -.08, .99], [.04, .06, 1], [0, 1, 0]), ...standingLegs() },
  "handshake": { ...leftRelaxed(), ...directorArmChain("right", [.30, -.60, .74], [.12, -.18, .98], [.03, .03, 1], [-1, 0, 0]), ...standingLegs() },
  "hug": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.hug(), DIRECTOR_POSE_MODULES.legs.standing()),
  "present": {
    ...directorArmChain("left", [-.42, -.50, .76], [.74, .08, .67], [.20, .12, .97], [0, 1, 0]),
    ...directorArmChain("right", [.34, -.48, .81], [.38, .10, .92], [.20, .12, .97], [0, 1, 0]),
    ...standingLegs(),
  },
  "surprise": { ...directorSymmetricArms([-.54, -.16, .83], [.26, .67, .70], [0, 1, .04], [0, 0, 1]), ...standingLegs() },
  "fear": { ...guardArms(), ...directorSymmetricLegs([-.09, -.96, .28], [-.04, -.99, -.08]) },
  "angry": { ...directorSymmetricArms([-.42, -.50, .76], [.46, .36, .81], [0, 1, .05], [0, 0, 1]), ...lungeLegs() },
  "argue": {
    ...directorArmChain("left", [-.52, -.42, .75], [-.48, .12, .87], [-.08, .16, .98], [0, 1, 0]),
    ...rightForward(),
    ...standingLegs(),
  },
  "cry": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.face(), DIRECTOR_POSE_MODULES.legs.standing()),
  "wipe-tears": { ...leftRelaxed(), ...rightFace(), ...standingLegs() },
  "laugh": { ...leftRelaxed(), ...directorArmChain("right", [.30, -.70, .65], [-.43, -.20, .88], [-.05, -.05, 1], [0, -1, 0]), ...standingLegs() },
  "shy": { ...handsFront(), ...standingLegs() },
  "plead": { ...handsChest(), ...standingLegs() },
  "disappointed": { ...relaxedArms(), ...standingLegs() },
  "protect-head": { ...guardArms(), ...directorSymmetricLegs([-.08, -.90, .42], [-.03, -.98, -.18]) },
  "surrender": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.raised(), DIRECTOR_POSE_MODULES.legs.standing()),
  "exhausted": { ...directorSymmetricArms([-.34, -.58, .74], [-.08, -.96, .28], [0, 0, 1], [0, -1, 0]), ...crouchedLegs() },
  "cover-mouth": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.leftRelaxed(), DIRECTOR_POSE_MODULES.arms.rightFace(), DIRECTOR_POSE_MODULES.legs.standing()),
  "facepalm": { ...leftRelaxed(), ...rightTemple(), ...standingLegs() },
  "headache": { ...leftRelaxed(), ...rightTemple(), ...standingLegs() },
  "stomachache": { ...handsFront(), ...directorSymmetricLegs([-.06, -.94, .34], [-.03, -.99, -.12]) },
  "drink": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.leftRelaxed(), DIRECTOR_POSE_MODULES.arms.rightDrink(), DIRECTOR_POSE_MODULES.legs.standing()),
  "eat": { ...directorArmChain("left", [-.36, -.66, .66], [.48, -.18, .86], [.06, .04, 1], [0, 1, 0]), ...rightDrink(), ...standingLegs() },
  "carry-box": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.carry(), directorSymmetricLegs([-.05, -.96, .28], [-.02, -1, -.04])),
  "hold-baby": { ...directorSymmetricArms([-.48, -.52, .70], [.64, .04, .77], [.10, .20, .97], [0, 1, 0]), ...standingLegs() },
  "sweep": {
    ...directorArmChain("left", [-.42, -.64, .64], [.30, -.70, .65], [.06, -.72, .69]),
    ...directorArmChain("right", [.34, -.42, .84], [-.24, -.82, .52], [-.06, -.80, .60]),
    ...lungeLegs(),
  },
  "type": { ...directorSymmetricArms([-.34, -.50, .80], [.35, -.38, .86], [.04, -.10, .99], [0, -1, 0]), ...seatedLegs() },
  "write": {
    ...directorArmChain("left", [-.38, -.54, .75], [.42, -.46, .78], [.05, -.14, .99], [0, -1, 0]),
    ...directorArmChain("right", [.34, -.46, .82], [-.24, -.42, .88], [-.03, -.16, .99], [0, -1, 0]),
    ...seatedLegs(),
  },
  "drive": { ...directorSymmetricArms([-.42, -.34, .84], [-.20, -.06, .98], [0, 1, .04], [1, 0, 0]), ...seatedLegs() },
  "pick-up": {
    ...leftRelaxed(),
    ...directorArmChain("right", [.20, -.86, .47], [-.05, -.96, .28], [-.02, -.98, .20]),
    ...crouchedLegs(),
  },
  "bend": { ...relaxedArms(), ...directorSymmetricLegs([-.04, -.94, .34], [-.02, -.99, -.12]) },
  "kneel": {
    ...handsFront(),
    ...kneelingLegs(),
  },
  "sit-cross-legged": {
    ...directorSymmetricArms([-.36, -.64, .68], [-.52, -.62, .58], [-.12, -.20, .97], [0, -1, 0]),
    ...directorLegChain("left", [-.72, -.16, .68], [.68, -.20, -.70]),
    ...directorLegChain("right", [.72, -.16, .68], [-.68, -.20, -.70]),
  },
  "cook": {
    ...directorArmChain("left", [-.38, -.55, .75], [.26, -.28, .92], [.03, -.08, 1], [0, -1, 0]),
    ...directorArmChain("right", [.32, -.46, .83], [-.08, -.12, .99], [.02, .03, 1], [0, -1, 0]),
    ...standingLegs(),
  },
  "sneak": {
    ...directorArmChain("left", [-.34, -.48, .81], [.28, .24, .93], [.05, .32, .95], [0, -1, 0]),
    ...directorArmChain("right", [.38, -.52, .76], [-.26, .18, .95], [-.04, .27, .96], [0, -1, 0]),
    ...sneakStepLegs(),
  },
  "tiptoe": { ...directorSymmetricArms([-.48, -.80, .35], [-.55, -.78, .30], [-.08, -.18, .98], [0, -1, 0]), ...directorSymmetricLegs([-.04, -.98, .18], [-.02, -1, .04], [26, 0, 0]) },
  "stumble": {
    ...directorSymmetricArms([-.78, -.14, .61], [-.88, -.04, .47], [-.08, .08, .99], [0, -1, 0]),
    ...recoveryStepLegs(),
  },
  "fall-back": {
    ...directorSymmetricArms([-.66, -.62, -.42], [-.72, -.58, -.38], [-.08, -.20, .98], [0, -1, 0]),
    ...seatedLegs(),
  },
  "punch": {
    ...directorArmChain("left", [-.18, -.10, .98], [-.04, -.03, 1], [-.02, .02, 1], [0, -1, 0]),
    ...directorArmChain("right", [.46, -.42, .78], [-.34, .46, .82], [-.08, .62, .78], [0, 0, 1]),
    ...lungeLegs(),
  },
  "kick": {
    ...guardArms(),
    ...kickLegs(),
  },
  "block": composeDirectorPoseModules(DIRECTOR_POSE_MODULES.arms.guard(), DIRECTOR_POSE_MODULES.legs.lunge()),
  "push": {
    // Keep the pelvis level so both soles remain planted; the forward drive is
    // carried by the existing spine/chest lean instead of tilting the hips.
    pelvis: [0, 0, 0],
    ...directorSymmetricArms([-.26, -.22, .94], [-.06, -.08, 1], [0, 1, .04], [0, 0, 1]),
    ...lungeLegs(),
  },
  "dodge": { ...guardArms(), ...crouchedLegs() },
  "slap": {
    ...directorArmChain("left", [-.74, -.05, .67], [-.46, .08, .88], [0, 1, .04], [0, 0, 1]),
    ...directorArmChain("right", [.38, -.62, .68], [-.28, .18, .94], [-.05, .22, .97], [0, 0, 1]),
    ...lungeLegs(),
  },
}
