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

interface LimbRig {
  upper: THREE.Group
  middle: THREE.Group
  end: THREE.Group
  options: LimbOptions
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

function taperedLimbGeometry(
  controlPoints: THREE.Vector3[],
  controlRadii: number[],
): THREE.BufferGeometry {
  const radialSegments = 20
  const positions: number[] = []
  const indices: number[] = []
  const points: THREE.Vector3[] = []
  const radii: number[] = []
  const ringsPerSection = 5
  for (let section = 0; section < controlPoints.length - 1; section += 1) {
    for (let step = 0; step < ringsPerSection; step += 1) {
      const mix = step / ringsPerSection
      points.push(controlPoints[section].clone().lerp(controlPoints[section + 1], mix))
      radii.push(THREE.MathUtils.lerp(controlRadii[section], controlRadii[section + 1], mix))
    }
  }
  points.push(controlPoints[controlPoints.length - 1].clone())
  radii.push(controlRadii[controlRadii.length - 1])
  const tangents = points.map((point, index) => {
    if (index === 0) return points[1].clone().sub(point).normalize()
    if (index === points.length - 1) return point.clone().sub(points[index - 1]).normalize()
    return points[index + 1].clone().sub(points[index - 1]).normalize()
  })
  const normals: THREE.Vector3[] = []
  const binormals: THREE.Vector3[] = []
  const startAxis = Math.abs(tangents[0].dot(new THREE.Vector3(0, 0, 1))) < 0.9
    ? new THREE.Vector3(0, 0, 1)
    : new THREE.Vector3(1, 0, 0)
  normals.push(new THREE.Vector3().crossVectors(tangents[0], startAxis).normalize())
  binormals.push(new THREE.Vector3().crossVectors(tangents[0], normals[0]).normalize())
  for (let index = 1; index < points.length; index += 1) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(tangents[index - 1], tangents[index])
    const normal = normals[index - 1].clone().applyQuaternion(rotation)
    normal.addScaledVector(tangents[index], -normal.dot(tangents[index])).normalize()
    normals.push(normal)
    binormals.push(new THREE.Vector3().crossVectors(tangents[index], normal).normalize())
  }
  for (let ring = 0; ring < points.length; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2
      const offset = normals[ring].clone().multiplyScalar(Math.cos(angle) * radii[ring])
      offset.addScaledVector(binormals[ring], Math.sin(angle) * radii[ring])
      const vertex = points[ring].clone().add(offset)
      positions.push(vertex.x, vertex.y, vertex.z)
    }
  }
  for (let ring = 0; ring < points.length - 1; ring += 1) {
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
  positions.push(points[0].x, points[0].y, points[0].z)
  const endCenter = positions.length / 3
  const endPoint = points[points.length - 1]
  positions.push(endPoint.x, endPoint.y, endPoint.z)
  const lastRing = (points.length - 1) * radialSegments
  for (let side = 0; side < radialSegments; side += 1) {
    const nextSide = (side + 1) % radialSegments
    indices.push(startCenter, nextSide, side)
    indices.push(endCenter, lastRing + side, lastRing + nextSide)
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

function addSmoothLimb(
  root: THREE.Group,
  rig: LimbRig,
  surface: THREE.Material,
): void {
  const upper = limbPoint(root, rig.upper)
  const middle = limbPoint(root, rig.middle)
  const end = limbPoint(root, rig.end)
  const upperMiddle = upper.clone().lerp(middle, 0.5)
  const lowerMiddle = middle.clone().lerp(end, 0.52)
  const { upperRadius, lowerRadius, lowerLength, isLeg } = rig.options
  const geometry = taperedLimbGeometry(
    [upper, upperMiddle, middle, lowerMiddle, end],
    isLeg
      ? [upperRadius * 1.08, upperRadius, lowerRadius * 0.92, lowerRadius * 1.12, lowerRadius * 0.72]
      : [upperRadius * 1.08, upperRadius, lowerRadius * 0.9, lowerRadius, lowerRadius * 0.72],
  )
  addMesh(root, geometry, surface)

  if (!isLeg) {
    addMesh(
      root,
      new THREE.SphereGeometry(1, 24, 16),
      surface,
      upper.toArray() as [number, number, number],
      [0, 0, 0],
      [upperRadius * 1.05, upperRadius * 1.24, upperRadius],
    )
  }

  const endQuaternion = rig.end.getWorldQuaternion(new THREE.Quaternion())
  const localQuaternion = root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(endQuaternion)

  if (isLeg) {
    const footLength = lowerLength * 0.35
    const center = new THREE.Vector3(0, -lowerRadius * 0.25, footLength * 0.42)
      .applyQuaternion(localQuaternion)
      .add(end)
    const foot = addMesh(
      root,
      new THREE.SphereGeometry(1, 22, 14),
      surface,
      center.toArray() as [number, number, number],
      [0, 0, 0],
      [lowerRadius * 0.76, lowerRadius * 0.46, footLength * 0.54],
    )
    foot.quaternion.copy(localQuaternion)
  } else {
    const handLength = lowerLength * 0.38
    const center = new THREE.Vector3(0, -handLength * 0.38, 0)
      .applyQuaternion(localQuaternion)
      .add(end)
    const hand = addMesh(
      root,
      new THREE.SphereGeometry(1, 20, 14),
      surface,
      center.toArray() as [number, number, number],
      [0, 0, 0],
      [lowerRadius * 0.62, handLength * 0.58, lowerRadius * 0.5],
    )
    hand.quaternion.copy(localQuaternion)
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
  const waistRadius = height * 0.074 * build
  const chestRadius = height * 0.105 * build
  const limbBuild = 0.82 + build * 0.18
  const upperArmRadius = height * 0.033 * limbBuild
  const forearmRadius = height * 0.027 * limbBuild
  const thighRadius = height * 0.052 * limbBuild
  const shinRadius = height * 0.039 * limbBuild

  const surface = colorMaterial(color, 0.08)
  const facialDetail = colorMaterial(color, -0.045)

  const spine = jointGroup(group, "spine", [0, hipY, 0], state)
  const torsoRadius = shoulderWidth * 0.43
  const torsoGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(hipWidth * 0.48, 0),
    new THREE.Vector2(hipWidth * 0.53, torsoLength * 0.12),
    new THREE.Vector2(hipWidth * 0.48, torsoLength * 0.25),
    new THREE.Vector2(waistRadius * 0.92, torsoLength * 0.4),
    new THREE.Vector2(shoulderWidth * 0.33, torsoLength * 0.62),
    new THREE.Vector2(shoulderWidth * 0.38, torsoLength * 0.76),
    new THREE.Vector2(torsoRadius, torsoLength * 0.86),
    new THREE.Vector2(shoulderWidth * 0.34, torsoLength * 0.96),
  ], 40)
  addMesh(
    spine,
    torsoGeometry,
    surface,
    [0, 0, 0],
    [0, 0, 0],
    [1, 1, chestRadius / torsoRadius],
  )
  addMesh(
    spine,
    new THREE.SphereGeometry(1, 30, 20),
    surface,
    [0, torsoLength * 0.055, 0],
    [0, 0, 0],
    [hipWidth * 0.51, torsoLength * 0.09, chestRadius * 0.72],
  )
  const chest = jointGroup(spine, "chest", [0, torsoLength * 0.58, 0], state)

  const shoulderY = torsoLength * 0.3

  const neck = jointGroup(chest, "neck", [0, torsoLength * 0.39, 0], state)
  addMesh(
    neck,
    new THREE.CylinderGeometry(height * 0.026 * build, height * 0.031 * build, neckLength * 1.1, 24),
    surface,
    [0, neckLength * 0.5, 0],
  )
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
    facialDetail,
    [0, headHeight * 0.36, headDepth * 0.47],
    [0, 0, 0],
    [headWidth * 0.09, headHeight * 0.1, headDepth * 0.12],
  )
  for (const side of [-1, 1]) {
    addMesh(
      head,
      new THREE.SphereGeometry(1, 16, 10),
      surface,
      [side * headWidth * 0.51, headHeight * 0.5, 0],
      [0, 0, 0],
      [headWidth * 0.07, headHeight * 0.12, headDepth * 0.08],
    )
  }

  const leftArm = createLimbRig(chest, {
    upperJoint: "leftShoulder",
    middleJoint: "leftElbow",
    endJoint: "leftWrist",
    upperLength: upperArmLength,
    lowerLength: forearmLength,
    upperRadius: upperArmRadius,
    lowerRadius: forearmRadius,
    anchor: [-shoulderWidth * 0.42, shoulderY, 0],
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
    anchor: [shoulderWidth * 0.42, shoulderY, 0],
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
    anchor: [-hipWidth * 0.31, hipY, 0],
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
    anchor: [hipWidth * 0.31, hipY, 0],
    isLeg: true,
  }, state)

  group.updateMatrixWorld(true)
  addSmoothLimb(group, leftArm, surface)
  addSmoothLimb(group, rightArm, surface)
  addSmoothLimb(group, leftLeg, surface)
  addSmoothLimb(group, rightLeg, surface)

  group.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(group)
  if (Number.isFinite(bounds.min.y)) {
    group.position.y = -bounds.min.y
  }

  return group
}
