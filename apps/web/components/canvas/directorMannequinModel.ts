import * as THREE from "three"
import {
  normalizeDirectorMannequin,
  type DirectorMannequinJoint,
  type DirectorMannequinState,
} from "@/lib/directorMannequin"

interface ProfileRing {
  point: THREE.Vector3
  radiusX: number
  radiusZ: number
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

interface LimbRig {
  upper: THREE.Group
  middle: THREE.Group
  end: THREE.Group
  options: LimbOptions
}

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

function addOrientedEllipsoid(
  parent: THREE.Object3D,
  material: THREE.Material,
  center: THREE.Vector3,
  scale: [number, number, number],
  quaternion?: THREE.Quaternion,
  segments = 24,
): THREE.Mesh {
  const mesh = addMesh(
    parent,
    new THREE.SphereGeometry(1, segments, Math.max(12, Math.round(segments * 0.66))),
    material,
    center.toArray() as [number, number, number],
    [0, 0, 0],
    scale,
  )
  if (quaternion) mesh.quaternion.copy(quaternion)
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

function colorMaterial(color: string, lightnessOffset = 0): THREE.MeshStandardMaterial {
  const resolved = new THREE.Color(color)
  resolved.offsetHSL(0, -0.055, lightnessOffset)
  return new THREE.MeshStandardMaterial({
    color: resolved,
    roughness: 0.76,
    metalness: 0.015,
  })
}

function createLimbRig(
  parent: THREE.Object3D,
  options: LimbOptions,
  state: DirectorMannequinState,
): LimbRig {
  const upper = jointGroup(parent, options.upperJoint, options.anchor, state)
  const middle = jointGroup(upper, options.middleJoint, [0, -options.upperLength, 0], state)
  const end = jointGroup(middle, options.endJoint, [0, -options.lowerLength, 0], state)
  return { upper, middle, end, options }
}

function shellGeometry(rings: ProfileRing[], radialSegments = 28): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []

  for (const ring of rings) {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2
      positions.push(
        ring.point.x + Math.cos(angle) * ring.radiusX,
        ring.point.y,
        ring.point.z + Math.sin(angle) * ring.radiusZ,
      )
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments
      const a = ring * radialSegments + side
      const b = ring * radialSegments + nextSide
      const c = (ring + 1) * radialSegments + side
      const d = (ring + 1) * radialSegments + nextSide
      indices.push(a, c, b, b, c, d)
    }
  }

  const startCenter = positions.length / 3
  positions.push(rings[0].point.x, rings[0].point.y, rings[0].point.z)
  const endCenter = positions.length / 3
  const last = rings[rings.length - 1]
  positions.push(last.point.x, last.point.y, last.point.z)
  const lastRingOffset = (rings.length - 1) * radialSegments
  for (let side = 0; side < radialSegments; side += 1) {
    const nextSide = (side + 1) % radialSegments
    indices.push(startCenter, nextSide, side)
    indices.push(endCenter, lastRingOffset + side, lastRingOffset + nextSide)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function sweptGeometry(rings: ProfileRing[], radialSegments = 20): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const tangents = rings.map((ring, index) => {
    if (index === 0) return rings[1].point.clone().sub(ring.point).normalize()
    if (index === rings.length - 1) return ring.point.clone().sub(rings[index - 1].point).normalize()
    return rings[index + 1].point.clone().sub(rings[index - 1].point).normalize()
  })
  const normals: THREE.Vector3[] = []
  const binormals: THREE.Vector3[] = []
  const startAxis = Math.abs(tangents[0].dot(new THREE.Vector3(0, 0, 1))) < 0.9
    ? new THREE.Vector3(0, 0, 1)
    : new THREE.Vector3(1, 0, 0)
  normals.push(new THREE.Vector3().crossVectors(tangents[0], startAxis).normalize())
  binormals.push(new THREE.Vector3().crossVectors(tangents[0], normals[0]).normalize())
  for (let index = 1; index < rings.length; index += 1) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(tangents[index - 1], tangents[index])
    const normal = normals[index - 1].clone().applyQuaternion(rotation)
    normal.addScaledVector(tangents[index], -normal.dot(tangents[index])).normalize()
    normals.push(normal)
    binormals.push(new THREE.Vector3().crossVectors(tangents[index], normal).normalize())
  }

  for (let ring = 0; ring < rings.length; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2
      const offset = normals[ring].clone().multiplyScalar(Math.cos(angle) * rings[ring].radiusX)
      offset.addScaledVector(binormals[ring], Math.sin(angle) * rings[ring].radiusZ)
      const vertex = rings[ring].point.clone().add(offset)
      positions.push(vertex.x, vertex.y, vertex.z)
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments
      const a = ring * radialSegments + side
      const b = ring * radialSegments + nextSide
      const c = (ring + 1) * radialSegments + side
      const d = (ring + 1) * radialSegments + nextSide
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function limbPoint(root: THREE.Object3D, joint: THREE.Object3D): THREE.Vector3 {
  const point = joint.getWorldPosition(new THREE.Vector3())
  return root.worldToLocal(point)
}

function pointBetween(start: THREE.Vector3, end: THREE.Vector3, amount: number): THREE.Vector3 {
  return start.clone().lerp(end, amount)
}

function localJointQuaternion(root: THREE.Object3D, joint: THREE.Object3D): THREE.Quaternion {
  const jointQuaternion = joint.getWorldQuaternion(new THREE.Quaternion())
  return root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(jointQuaternion)
}

function addHand(
  root: THREE.Group,
  rig: LimbRig,
  wrist: THREE.Vector3,
  surface: THREE.Material,
): void {
  const { lowerLength, lowerRadius, upperJoint } = rig.options
  const quaternion = localJointQuaternion(root, rig.end)
  const handLength = lowerLength * 0.4
  const palmCenter = new THREE.Vector3(0, -handLength * 0.46, 0.008)
    .applyQuaternion(quaternion)
    .add(wrist)
  addOrientedEllipsoid(
    root,
    surface,
    palmCenter,
    [lowerRadius * 0.64, handLength * 0.56, lowerRadius * 0.43],
    quaternion,
    22,
  )

  const side = upperJoint.startsWith("left") ? -1 : 1
  const thumbCenter = new THREE.Vector3(
    side * lowerRadius * 0.58,
    -handLength * 0.23,
    lowerRadius * 0.12,
  ).applyQuaternion(quaternion).add(wrist)
  const thumb = addOrientedEllipsoid(
    root,
    surface,
    thumbCenter,
    [lowerRadius * 0.22, handLength * 0.28, lowerRadius * 0.2],
    quaternion,
    16,
  )
  thumb.rotateZ(side * 0.42)
}

function addFoot(
  root: THREE.Group,
  rig: LimbRig,
  ankle: THREE.Vector3,
  surface: THREE.Material,
): void {
  const { lowerLength, lowerRadius } = rig.options
  const quaternion = localJointQuaternion(root, rig.end)
  const footLength = lowerLength * 0.36
  const footCenter = new THREE.Vector3(0, -lowerRadius * 0.28, footLength * 0.48)
    .applyQuaternion(quaternion)
    .add(ankle)
  addOrientedEllipsoid(
    root,
    surface,
    footCenter,
    [lowerRadius * 0.82, lowerRadius * 0.52, footLength * 0.58],
    quaternion,
    24,
  )
  const heelCenter = new THREE.Vector3(0, -lowerRadius * 0.14, -footLength * 0.04)
    .applyQuaternion(quaternion)
    .add(ankle)
  addOrientedEllipsoid(
    root,
    surface,
    heelCenter,
    [lowerRadius * 0.66, lowerRadius * 0.58, lowerRadius * 0.58],
    quaternion,
    18,
  )
}

function addAnatomicalLimb(
  root: THREE.Group,
  rig: LimbRig,
  surface: THREE.Material,
): void {
  const upper = limbPoint(root, rig.upper)
  const middle = limbPoint(root, rig.middle)
  const end = limbPoint(root, rig.end)
  const { upperRadius, lowerRadius, isLeg } = rig.options
  const rings: ProfileRing[] = isLeg
    ? [
        { point: upper, radiusX: upperRadius * 1.16, radiusZ: upperRadius * 1.04 },
        { point: pointBetween(upper, middle, 0.16), radiusX: upperRadius * 1.15, radiusZ: upperRadius * 1.08 },
        { point: pointBetween(upper, middle, 0.43), radiusX: upperRadius * 1.02, radiusZ: upperRadius * 1.08 },
        { point: pointBetween(upper, middle, 0.75), radiusX: upperRadius * 0.84, radiusZ: upperRadius * 0.9 },
        { point: middle, radiusX: lowerRadius * 0.76, radiusZ: lowerRadius * 0.8 },
        { point: pointBetween(middle, end, 0.18), radiusX: lowerRadius * 0.96, radiusZ: lowerRadius * 1.04 },
        { point: pointBetween(middle, end, 0.43), radiusX: lowerRadius * 1.18, radiusZ: lowerRadius * 1.28 },
        { point: pointBetween(middle, end, 0.72), radiusX: lowerRadius * 0.84, radiusZ: lowerRadius * 0.94 },
        { point: end, radiusX: lowerRadius * 0.62, radiusZ: lowerRadius * 0.66 },
      ]
    : [
        { point: upper, radiusX: upperRadius * 0.94, radiusZ: upperRadius * 0.94 },
        { point: pointBetween(upper, middle, 0.08), radiusX: upperRadius * 1.2, radiusZ: upperRadius * 1.16 },
        { point: pointBetween(upper, middle, 0.2), radiusX: upperRadius * 1.24, radiusZ: upperRadius * 1.18 },
        { point: pointBetween(upper, middle, 0.42), radiusX: upperRadius * 1.05, radiusZ: upperRadius * 1.1 },
        { point: pointBetween(upper, middle, 0.76), radiusX: upperRadius * 0.82, radiusZ: upperRadius * 0.88 },
        { point: middle, radiusX: lowerRadius * 0.7, radiusZ: lowerRadius * 0.74 },
        { point: pointBetween(middle, end, 0.2), radiusX: lowerRadius * 1.06, radiusZ: lowerRadius * 1.12 },
        { point: pointBetween(middle, end, 0.5), radiusX: lowerRadius * 1.12, radiusZ: lowerRadius * 1.04 },
        { point: pointBetween(middle, end, 0.78), radiusX: lowerRadius * 0.82, radiusZ: lowerRadius * 0.78 },
        { point: end, radiusX: lowerRadius * 0.62, radiusZ: lowerRadius * 0.58 },
      ]
  addMesh(root, sweptGeometry(rings), surface)

  if (isLeg) {
    addFoot(root, rig, end, surface)
  } else {
    addHand(root, rig, end, surface)
  }
}

function addHead(
  head: THREE.Group,
  headHeight: number,
  surface: THREE.Material,
  detail: THREE.Material,
): void {
  const headWidth = headHeight * 0.66
  const headDepth = headHeight * 0.72
  addMesh(head, shellGeometry([
    { point: new THREE.Vector3(0, headHeight * 0.02, headDepth * 0.04), radiusX: headWidth * 0.18, radiusZ: headDepth * 0.27 },
    { point: new THREE.Vector3(0, headHeight * 0.1, headDepth * 0.04), radiusX: headWidth * 0.32, radiusZ: headDepth * 0.36 },
    { point: new THREE.Vector3(0, headHeight * 0.21, headDepth * 0.035), radiusX: headWidth * 0.43, radiusZ: headDepth * 0.43 },
    { point: new THREE.Vector3(0, headHeight * 0.36, headDepth * 0.02), radiusX: headWidth * 0.5, radiusZ: headDepth * 0.48 },
    { point: new THREE.Vector3(0, headHeight * 0.55, 0), radiusX: headWidth * 0.51, radiusZ: headDepth * 0.5 },
    { point: new THREE.Vector3(0, headHeight * 0.72, -headDepth * 0.015), radiusX: headWidth * 0.5, radiusZ: headDepth * 0.49 },
    { point: new THREE.Vector3(0, headHeight * 0.86, -headDepth * 0.03), radiusX: headWidth * 0.43, radiusZ: headDepth * 0.43 },
    { point: new THREE.Vector3(0, headHeight * 0.96, -headDepth * 0.04), radiusX: headWidth * 0.27, radiusZ: headDepth * 0.3 },
    { point: new THREE.Vector3(0, headHeight, -headDepth * 0.04), radiusX: headWidth * 0.07, radiusZ: headDepth * 0.08 },
  ], 32), surface)

  const nose = addMesh(
    head,
    new THREE.ConeGeometry(headWidth * 0.07, headDepth * 0.2, 16),
    detail,
    [0, headHeight * 0.45, headDepth * 0.51],
    [Math.PI / 2, 0, 0],
  )
  nose.scale.z = 0.72
  for (const side of [-1, 1]) {
    addOrientedEllipsoid(
      head,
      surface,
      new THREE.Vector3(side * headWidth * 0.51, headHeight * 0.53, -headDepth * 0.015),
      [headWidth * 0.075, headHeight * 0.12, headDepth * 0.085],
      undefined,
      16,
    )
  }
}

export function createDirectorMannequin(
  rawState: DirectorMannequinState | undefined,
  color: string,
): THREE.Group {
  const state = normalizeDirectorMannequin(rawState)
  const group = new THREE.Group()
  group.name = "可调人体素模"
  group.userData.directorMannequin = true

  const { proportions } = state
  const feminine = state.anatomy === "feminine"
  const height = proportions.height
  const build = proportions.build
  const footHeight = height * 0.038
  const legLength = height * 0.465 * proportions.leg_length
  const thighLength = legLength * 0.515
  const shinLength = legLength * 0.485
  const torsoLength = height * 0.295 * proportions.torso_length
  const neckLength = height * 0.038
  const headHeight = height * 0.134 * proportions.head_scale
  const armLength = height * 0.35 * proportions.arm_length
  const upperArmLength = armLength * 0.51
  const forearmLength = armLength * 0.49
  const anatomyShoulder = feminine ? 0.92 : 1.03
  const anatomyHip = feminine ? 1.09 : 0.98
  const shoulderWidth = height * 0.238 * proportions.shoulder_width * anatomyShoulder * (0.94 + build * 0.06)
  const hipWidth = height * 0.168 * proportions.hip_width * anatomyHip * (0.88 + build * 0.12)
  const hipY = footHeight + thighLength + shinLength
  const waistWidth = height * 0.073 * build * (feminine ? 0.91 : 1)
  const chestWidth = shoulderWidth * (feminine ? 0.36 : 0.39)
  const chestDepth = height * 0.106 * build * (feminine ? 0.96 : 1.03)
  const pelvisDepth = height * 0.09 * build * (feminine ? 1.05 : 0.98)
  const limbBuild = (0.82 + build * 0.18) * (feminine ? 0.9 : 1.04)
  const upperArmRadius = height * 0.032 * limbBuild
  const forearmRadius = height * 0.026 * limbBuild
  const thighRadius = height * 0.051 * limbBuild * (feminine ? 1.04 : 1)
  const shinRadius = height * 0.038 * limbBuild

  const surface = colorMaterial(color, 0.07)
  const facialDetail = colorMaterial(color, 0.025)

  const spine = jointGroup(group, "spine", [0, hipY, 0], state)
  const chestPivotY = torsoLength * 0.48
  addMesh(spine, shellGeometry([
    { point: new THREE.Vector3(0, -torsoLength * 0.14, 0), radiusX: hipWidth * 0.34, radiusZ: pelvisDepth * 0.7 },
    { point: new THREE.Vector3(0, -torsoLength * 0.07, -pelvisDepth * 0.025), radiusX: hipWidth * 0.53, radiusZ: pelvisDepth * 0.98 },
    { point: new THREE.Vector3(0, torsoLength * 0.02, -pelvisDepth * 0.02), radiusX: hipWidth * 0.57, radiusZ: pelvisDepth },
    { point: new THREE.Vector3(0, torsoLength * 0.13, 0), radiusX: hipWidth * 0.48, radiusZ: pelvisDepth * 0.84 },
    { point: new THREE.Vector3(0, torsoLength * 0.25, 0), radiusX: waistWidth, radiusZ: chestDepth * 0.68 },
    { point: new THREE.Vector3(0, chestPivotY * 0.82, 0), radiusX: waistWidth * 1.03, radiusZ: chestDepth * 0.72 },
    { point: new THREE.Vector3(0, chestPivotY * 1.06, 0), radiusX: waistWidth * 1.1, radiusZ: chestDepth * 0.76 },
  ], 32), surface)

  const chest = jointGroup(spine, "chest", [0, chestPivotY, 0], state)
  const upperTorsoHeight = torsoLength * 0.5
  addMesh(chest, shellGeometry([
    { point: new THREE.Vector3(0, -upperTorsoHeight * 0.06, 0), radiusX: waistWidth * 1.07, radiusZ: chestDepth * 0.74 },
    { point: new THREE.Vector3(0, upperTorsoHeight * 0.08, feminine ? chestDepth * 0.015 : 0), radiusX: chestWidth * 0.82, radiusZ: chestDepth * 0.86 },
    { point: new THREE.Vector3(0, upperTorsoHeight * 0.34, feminine ? chestDepth * 0.055 : 0), radiusX: chestWidth, radiusZ: chestDepth * (feminine ? 1.08 : 1) },
    { point: new THREE.Vector3(0, upperTorsoHeight * 0.62, -chestDepth * 0.015), radiusX: shoulderWidth * 0.43, radiusZ: chestDepth * 0.98 },
    { point: new THREE.Vector3(0, upperTorsoHeight * 0.74, -chestDepth * 0.025), radiusX: shoulderWidth * 0.48, radiusZ: chestDepth * 0.9 },
    { point: new THREE.Vector3(0, upperTorsoHeight * 0.82, -chestDepth * 0.035), radiusX: shoulderWidth * 0.49, radiusZ: chestDepth * 0.83 },
    { point: new THREE.Vector3(0, upperTorsoHeight * 0.9, -chestDepth * 0.04), radiusX: shoulderWidth * 0.3, radiusZ: chestDepth * 0.66 },
    { point: new THREE.Vector3(0, upperTorsoHeight * 0.97, -chestDepth * 0.045), radiusX: height * 0.036 * build, radiusZ: chestDepth * 0.42 },
  ], 34), surface)

  const shoulderY = upperTorsoHeight * 0.8
  const neck = jointGroup(chest, "neck", [0, upperTorsoHeight * 0.98, -chestDepth * 0.025], state)
  addMesh(
    neck,
    new THREE.CylinderGeometry(height * 0.026 * build, height * 0.032 * build, neckLength * 1.12, 24),
    surface,
    [0, neckLength * 0.5, 0],
  )
  const head = jointGroup(neck, "head", [0, neckLength, 0], state)
  addHead(head, headHeight, surface, facialDetail)

  const leftArm = createLimbRig(chest, {
    upperJoint: "leftShoulder",
    middleJoint: "leftElbow",
    endJoint: "leftWrist",
    upperLength: upperArmLength,
    lowerLength: forearmLength,
    upperRadius: upperArmRadius,
    lowerRadius: forearmRadius,
    anchor: [-shoulderWidth * 0.48, shoulderY, -chestDepth * 0.02],
    isLeg: false,
  }, state)
  const rightArm = createLimbRig(chest, {
    upperJoint: "rightShoulder",
    middleJoint: "rightElbow",
    endJoint: "rightWrist",
    upperLength: upperArmLength,
    lowerLength: forearmLength,
    upperRadius: upperArmRadius,
    lowerRadius: forearmRadius,
    anchor: [shoulderWidth * 0.48, shoulderY, -chestDepth * 0.02],
    isLeg: false,
  }, state)
  const leftLeg = createLimbRig(group, {
    upperJoint: "leftHip",
    middleJoint: "leftKnee",
    endJoint: "leftAnkle",
    upperLength: thighLength,
    lowerLength: shinLength,
    upperRadius: thighRadius,
    lowerRadius: shinRadius,
    anchor: [-hipWidth * 0.3, hipY, -pelvisDepth * 0.025],
    isLeg: true,
  }, state)
  const rightLeg = createLimbRig(group, {
    upperJoint: "rightHip",
    middleJoint: "rightKnee",
    endJoint: "rightAnkle",
    upperLength: thighLength,
    lowerLength: shinLength,
    upperRadius: thighRadius,
    lowerRadius: shinRadius,
    anchor: [hipWidth * 0.3, hipY, -pelvisDepth * 0.025],
    isLeg: true,
  }, state)

  group.updateMatrixWorld(true)
  addAnatomicalLimb(group, leftArm, surface)
  addAnatomicalLimb(group, rightArm, surface)
  addAnatomicalLimb(group, leftLeg, surface)
  addAnatomicalLimb(group, rightLeg, surface)

  group.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(group)
  if (Number.isFinite(bounds.min.y)) group.position.y = -bounds.min.y

  return group
}
