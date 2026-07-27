import * as THREE from "three"
import {
  normalizeDirectorMannequin,
  type DirectorMannequinJoint,
  type DirectorMannequinState,
} from "@/lib/directorMannequin"

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  meshMaterial: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, meshMaterial)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.scale.set(...scale)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function jointGroup(
  parent: THREE.Object3D,
  name: DirectorMannequinJoint,
  position: [number, number, number],
  state: DirectorMannequinState,
): THREE.Group {
  const group = new THREE.Group()
  const rotation = state.joints[name]
  group.name = `mannequin-joint:${name}`
  group.userData.mannequinJoint = name
  group.position.set(...position)
  group.rotation.set(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
    "XYZ",
  )
  parent.add(group)
  return group
}

function capsule(
  parent: THREE.Object3D,
  length: number,
  radius: number,
  meshMaterial: THREE.Material,
  widthScale = 1,
  depthScale = 1,
): THREE.Mesh {
  const safeRadius = Math.max(0.012, radius)
  const bodyLength = Math.max(0.01, length - safeRadius * 2)
  return addMesh(
    parent,
    new THREE.CapsuleGeometry(safeRadius, bodyLength, 8, 18),
    meshMaterial,
    [0, -length / 2, 0],
    [0, 0, 0],
    [widthScale, 1, depthScale],
  )
}

function colorMaterial(color: string, lightnessOffset = 0): THREE.MeshStandardMaterial {
  const resolved = new THREE.Color(color)
  resolved.offsetHSL(0, -0.04, lightnessOffset)
  return new THREE.MeshStandardMaterial({
    color: resolved,
    roughness: 0.72,
    metalness: 0.025,
  })
}

interface LimbOptions {
  upperJoint: "leftShoulder" | "rightShoulder" | "leftHip" | "rightHip"
  middleJoint: "leftElbow" | "rightElbow" | "leftKnee" | "rightKnee"
  endJoint: "leftWrist" | "rightWrist" | "leftAnkle" | "rightAnkle"
  upperLength: number
  lowerLength: number
  upperRadius: number
  lowerRadius: number
  anchor: [number, number, number]
  isLeg: boolean
}

function addLimb(
  parent: THREE.Object3D,
  options: LimbOptions,
  state: DirectorMannequinState,
  surface: THREE.Material,
  jointSurface: THREE.Material,
): void {
  const upper = jointGroup(parent, options.upperJoint, options.anchor, state)
  addMesh(
    upper,
    new THREE.SphereGeometry(options.upperRadius * 1.07, 20, 14),
    jointSurface,
    [0, 0, 0],
    [0, 0, 0],
    [1, options.isLeg ? 0.88 : 1, options.isLeg ? 1.08 : 1],
  )
  capsule(upper, options.upperLength, options.upperRadius, surface, options.isLeg ? 1.08 : 1, 1.02)

  const middle = jointGroup(upper, options.middleJoint, [0, -options.upperLength, 0], state)
  addMesh(
    middle,
    new THREE.SphereGeometry(options.lowerRadius * 1.12, 18, 12),
    jointSurface,
    [0, 0, 0],
    [0, 0, 0],
    [options.isLeg ? 1.06 : 1, 0.9, 1],
  )
  capsule(middle, options.lowerLength, options.lowerRadius, surface, 0.96, 0.98)

  const end = jointGroup(middle, options.endJoint, [0, -options.lowerLength, 0], state)
  addMesh(
    end,
    new THREE.SphereGeometry(options.lowerRadius * 0.92, 16, 10),
    jointSurface,
    [0, 0, 0],
    [0, 0, 0],
    [1, 0.82, 1],
  )

  if (options.isLeg) {
    const footLength = options.lowerLength * 0.34
    addMesh(
      end,
      new THREE.CapsuleGeometry(options.lowerRadius * 0.94, Math.max(0.02, footLength - options.lowerRadius * 1.4), 6, 14),
      surface,
      [0, -options.lowerRadius * 0.34, footLength * 0.42],
      [Math.PI / 2, 0, 0],
      [1.06, 1, 0.88],
    )
  } else {
    const handLength = options.lowerLength * 0.29
    addMesh(
      end,
      new THREE.CapsuleGeometry(options.lowerRadius * 0.68, Math.max(0.015, handLength - options.lowerRadius * 1.2), 6, 14),
      surface,
      [0, -handLength * 0.42, 0],
      [0, 0, 0],
      [0.82, 1, 0.72],
    )
  }
}

export function createDirectorMannequin(
  rawState: DirectorMannequinState | undefined,
  color: string,
): THREE.Group {
  const state = normalizeDirectorMannequin(rawState)
  const group = new THREE.Group()
  group.name = "可调人物白模"
  group.userData.directorMannequin = true

  const { proportions } = state
  const height = proportions.height
  const build = proportions.build
  const footHeight = height * 0.038
  const legLength = height * 0.465 * proportions.leg_length
  const thighLength = legLength * 0.515
  const shinLength = legLength * 0.485
  const torsoLength = height * 0.295 * proportions.torso_length
  const neckLength = height * 0.037
  const headHeight = height * 0.134 * proportions.head_scale
  const armLength = height * 0.35 * proportions.arm_length
  const upperArmLength = armLength * 0.51
  const forearmLength = armLength * 0.49
  const shoulderWidth = height * 0.235 * proportions.shoulder_width * (0.94 + build * 0.06)
  const hipWidth = height * 0.165 * proportions.hip_width * (0.88 + build * 0.12)
  const hipY = footHeight + thighLength + shinLength
  const waistRadius = height * 0.082 * build
  const chestRadius = height * 0.105 * build
  const limbBuild = 0.82 + build * 0.18
  const upperArmRadius = height * 0.033 * limbBuild
  const forearmRadius = height * 0.027 * limbBuild
  const thighRadius = height * 0.052 * limbBuild
  const shinRadius = height * 0.039 * limbBuild

  const surface = colorMaterial(color, 0.08)
  const highlight = colorMaterial(color, 0.16)
  const shade = colorMaterial(color, -0.1)
  const jointSurface = colorMaterial(color, -0.03)

  const pelvis = new THREE.Group()
  pelvis.position.y = hipY
  group.add(pelvis)
  addMesh(
    pelvis,
    new THREE.SphereGeometry(1, 28, 20),
    surface,
    [0, torsoLength * 0.035, 0],
    [0, 0, 0],
    [hipWidth * 0.64, torsoLength * 0.16, waistRadius * 1.12],
  )
  addMesh(
    pelvis,
    new THREE.CapsuleGeometry(waistRadius * 0.82, Math.max(0.015, torsoLength * 0.12), 6, 18),
    shade,
    [0, torsoLength * 0.18, 0],
    [0, 0, 0],
    [1, 1, 0.92],
  )

  const spine = jointGroup(group, "spine", [0, hipY + torsoLength * 0.12, 0], state)
  addMesh(
    spine,
    new THREE.SphereGeometry(1, 28, 20),
    surface,
    [0, torsoLength * 0.24, 0],
    [0, 0, 0],
    [waistRadius * 1.08, torsoLength * 0.28, waistRadius * 0.92],
  )

  const chest = jointGroup(spine, "chest", [0, torsoLength * 0.39, 0], state)
  addMesh(
    chest,
    new THREE.SphereGeometry(1, 30, 22),
    surface,
    [0, torsoLength * 0.235, 0],
    [0, 0, 0],
    [shoulderWidth * 0.46, torsoLength * 0.29, chestRadius],
  )
  addMesh(
    chest,
    new THREE.SphereGeometry(1, 24, 16),
    highlight,
    [0, torsoLength * 0.34, chestRadius * 0.18],
    [0, 0, 0],
    [shoulderWidth * 0.38, torsoLength * 0.12, chestRadius * 0.94],
  )

  const shoulderY = torsoLength * 0.34
  addMesh(
    chest,
    new THREE.CapsuleGeometry(height * 0.024, Math.max(0.01, shoulderWidth - height * 0.048), 6, 18),
    highlight,
    [0, shoulderY, 0],
    [0, 0, Math.PI / 2],
    [1, 1, 0.88],
  )

  const neck = jointGroup(chest, "neck", [0, torsoLength * 0.43, 0], state)
  capsule(neck, neckLength, height * 0.031 * build, surface, 0.92, 0.9).position.y = neckLength / 2
  const head = jointGroup(neck, "head", [0, neckLength, 0], state)
  const headWidth = headHeight * 0.66
  const headDepth = headHeight * 0.72
  addMesh(
    head,
    new THREE.SphereGeometry(1, 32, 24),
    surface,
    [0, headHeight * 0.48, 0],
    [0, 0, 0],
    [headWidth * 0.5, headHeight * 0.5, headDepth * 0.5],
  )
  addMesh(
    head,
    new THREE.SphereGeometry(1, 24, 18),
    shade,
    [0, headHeight * 0.36, headDepth * 0.47],
    [0, 0, 0],
    [headWidth * 0.09, headHeight * 0.1, headDepth * 0.12],
  )
  for (const side of [-1, 1]) {
    addMesh(
      head,
      new THREE.SphereGeometry(1, 16, 10),
      shade,
      [side * headWidth * 0.51, headHeight * 0.5, 0],
      [0, 0, 0],
      [headWidth * 0.07, headHeight * 0.12, headDepth * 0.08],
    )
  }

  addLimb(chest, {
    upperJoint: "leftShoulder",
    middleJoint: "leftElbow",
    endJoint: "leftWrist",
    upperLength: upperArmLength,
    lowerLength: forearmLength,
    upperRadius: upperArmRadius,
    lowerRadius: forearmRadius,
    anchor: [-shoulderWidth / 2, shoulderY, 0],
    isLeg: false,
  }, state, surface, jointSurface)
  addLimb(chest, {
    upperJoint: "rightShoulder",
    middleJoint: "rightElbow",
    endJoint: "rightWrist",
    upperLength: upperArmLength,
    lowerLength: forearmLength,
    upperRadius: upperArmRadius,
    lowerRadius: forearmRadius,
    anchor: [shoulderWidth / 2, shoulderY, 0],
    isLeg: false,
  }, state, surface, jointSurface)
  addLimb(group, {
    upperJoint: "leftHip",
    middleJoint: "leftKnee",
    endJoint: "leftAnkle",
    upperLength: thighLength,
    lowerLength: shinLength,
    upperRadius: thighRadius,
    lowerRadius: shinRadius,
    anchor: [-hipWidth * 0.37, hipY, 0],
    isLeg: true,
  }, state, surface, jointSurface)
  addLimb(group, {
    upperJoint: "rightHip",
    middleJoint: "rightKnee",
    endJoint: "rightAnkle",
    upperLength: thighLength,
    lowerLength: shinLength,
    upperRadius: thighRadius,
    lowerRadius: shinRadius,
    anchor: [hipWidth * 0.37, hipY, 0],
    isLeg: true,
  }, state, surface, jointSurface)

  group.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(group)
  if (Number.isFinite(bounds.min.y)) {
    group.position.y = -bounds.min.y
  }

  return group
}
