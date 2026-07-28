import * as THREE from "three"
import type { DirectorBundledModelAsset } from "@/lib/directorBundledModels"

type Vector3Tuple = [number, number, number]

interface SourcePropDefinition {
  id: string
  name: string
  category: string
  keywords: string[]
  summary: string
}

const SOURCE_PROP_DEFINITIONS: SourcePropDefinition[] = [
  { id: "smartphone", name: "智能手机", category: "随身物品", keywords: ["手机", "电话", "phone"], summary: "现代短剧常用手持智能手机" },
  { id: "tablet", name: "平板电脑", category: "随身物品", keywords: ["平板", "电脑", "tablet"], summary: "便携平板电脑与亮屏" },
  { id: "handbag", name: "手提包", category: "随身物品", keywords: ["女包", "包", "handbag"], summary: "带提手的日常手提包" },
  { id: "backpack", name: "双肩背包", category: "随身物品", keywords: ["书包", "背包", "backpack"], summary: "带肩带和前袋的双肩包" },
  { id: "suitcase", name: "旅行箱", category: "随身物品", keywords: ["行李箱", "拉杆箱", "suitcase"], summary: "带拉杆与滚轮的旅行箱" },
  { id: "umbrella", name: "长柄雨伞", category: "随身物品", keywords: ["伞", "雨具", "umbrella"], summary: "收拢状态的长柄雨伞" },
  { id: "printer", name: "办公打印机", category: "办公电子", keywords: ["打印", "复印", "printer"], summary: "桌面激光打印机与出纸托盘" },
  { id: "cash-register", name: "收银机", category: "商业零售", keywords: ["收银台", "支付", "cash-register"], summary: "带显示屏和钱箱的商用收银机" },
  { id: "shopping-cart", name: "购物车", category: "商业零售", keywords: ["超市", "推车", "shopping-cart"], summary: "金属篮筐超市购物车" },
  { id: "vending-machine", name: "自动售货机", category: "商业零售", keywords: ["饮料机", "售货", "vending-machine"], summary: "带商品窗和取货口的售货机" },
  { id: "reception-desk", name: "前台接待桌", category: "商业零售", keywords: ["前台", "接待", "reception"], summary: "酒店与公司的转角接待台" },
  { id: "wheelchair", name: "轮椅", category: "医疗教育", keywords: ["医院", "无障碍", "wheelchair"], summary: "大轮与脚踏齐全的医用轮椅" },
  { id: "hospital-bed", name: "医用病床", category: "医疗教育", keywords: ["医院", "病床", "hospital-bed"], summary: "带护栏和脚轮的标准病床" },
  { id: "iv-stand", name: "输液架", category: "医疗教育", keywords: ["医院", "输液", "iv-stand"], summary: "双挂钩移动输液架" },
  { id: "stretcher", name: "急救担架", category: "医疗教育", keywords: ["医院", "急救", "stretcher"], summary: "带折叠支架的急救担架" },
  { id: "medicine-cabinet", name: "医疗器械柜", category: "医疗教育", keywords: ["医院", "药柜", "cabinet"], summary: "玻璃门医用器械储物柜" },
  { id: "school-desk", name: "学生课桌", category: "医疗教育", keywords: ["学校", "教室", "school-desk"], summary: "单人课桌与下层书架" },
  { id: "whiteboard", name: "移动白板", category: "医疗教育", keywords: ["学校", "会议", "whiteboard"], summary: "带滚轮支架的双面白板" },
  { id: "cinema-camera", name: "电影摄影机", category: "拍摄器材", keywords: ["摄影机", "摄像机", "cinema-camera"], summary: "带镜头、遮光斗与顶部提手的摄影机" },
  { id: "camera-tripod", name: "摄影机三脚架", category: "拍摄器材", keywords: ["相机", "脚架", "tripod"], summary: "带云台的专业摄影三脚架" },
  { id: "softbox", name: "柔光箱", category: "拍摄器材", keywords: ["灯光", "柔光", "softbox"], summary: "摄影棚方形柔光箱与灯架" },
  { id: "boom-microphone", name: "挑杆麦克风", category: "拍摄器材", keywords: ["录音", "麦克风", "boom-mic"], summary: "长挑杆与枪式麦克风" },
  { id: "clapperboard", name: "场记板", category: "拍摄器材", keywords: ["打板", "场记", "clapperboard"], summary: "电影拍摄黑白场记板" },
  { id: "reflector", name: "圆形反光板", category: "拍摄器材", keywords: ["灯光", "反光", "reflector"], summary: "带支架的大号圆形反光板" },
  { id: "director-chair", name: "导演椅", category: "拍摄器材", keywords: ["片场", "椅子", "director-chair"], summary: "可折叠高脚导演椅" },
  { id: "fire-extinguisher", name: "灭火器", category: "工具杂物", keywords: ["消防", "安全", "extinguisher"], summary: "带软管和压力表的消防灭火器" },
  { id: "broom", name: "扫帚", category: "工具杂物", keywords: ["清洁", "扫地", "broom"], summary: "家用长柄扫帚" },
  { id: "mop-bucket", name: "拖把与水桶", category: "工具杂物", keywords: ["清洁", "拖地", "mop"], summary: "清洁拖把和带提手水桶" },
  { id: "ladder", name: "折叠梯", category: "工具杂物", keywords: ["梯子", "施工", "ladder"], summary: "双侧可攀爬折叠梯" },
  { id: "toolbox", name: "工具箱", category: "工具杂物", keywords: ["维修", "工具", "toolbox"], summary: "带提手的硬壳工具箱" },
  { id: "hammer", name: "羊角锤", category: "工具杂物", keywords: ["维修", "锤子", "hammer"], summary: "木柄金属羊角锤" },
  { id: "traffic-bollard", name: "隔离柱", category: "道路设施", keywords: ["路桩", "隔离", "bollard"], summary: "带反光带的道路隔离柱" },
]

export const DIRECTOR_SOURCE_PROP_ASSETS: DirectorBundledModelAsset[] = SOURCE_PROP_DEFINITIONS.map((item) => ({
  id: `bundled:source:${item.id}`,
  name: item.name,
  file_name: `${item.id}.source`,
  url: `source://${item.id}`,
  size: 0,
  category: item.category,
  keywords: item.keywords,
  summary: item.summary,
  license: "OpenReel 源码自有模型",
  source_kind: "source",
  display_size: 1,
  stats: { node_count: 0, mesh_count: 0, material_count: 0, bone_count: 0, animation_count: 0 },
}))

const palette = {
  dark: "#27272a",
  black: "#09090b",
  white: "#e4e4e7",
  metal: "#a1a1aa",
  blue: "#2563eb",
  cyan: "#0891b2",
  red: "#dc2626",
  orange: "#f97316",
  yellow: "#facc15",
  green: "#16a34a",
  wood: "#92400e",
}

function sourceMaterial(color: string, metalness = 0.04, roughness = 0.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness })
}

function attach(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: string,
  position: Vector3Tuple,
  rotation: Vector3Tuple = [0, 0, 0],
  metalness = 0.04,
  roughness = 0.72,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, sourceMaterial(color, metalness, roughness))
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function box(parent: THREE.Object3D, size: Vector3Tuple, position: Vector3Tuple, color: string, rotation?: Vector3Tuple, metalness?: number): THREE.Mesh {
  return attach(parent, new THREE.BoxGeometry(...size), color, position, rotation, metalness)
}

function cylinder(parent: THREE.Object3D, radius: number, height: number, position: Vector3Tuple, color: string, rotation?: Vector3Tuple, metalness?: number): THREE.Mesh {
  return attach(parent, new THREE.CylinderGeometry(radius, radius, height, 20), color, position, rotation, metalness)
}

function sphere(parent: THREE.Object3D, radius: number, position: Vector3Tuple, color: string, scale: Vector3Tuple = [1, 1, 1]): THREE.Mesh {
  const mesh = attach(parent, new THREE.SphereGeometry(radius, 20, 14), color, position)
  mesh.scale.set(...scale)
  return mesh
}

function torus(parent: THREE.Object3D, radius: number, tube: number, position: Vector3Tuple, color: string, rotation: Vector3Tuple = [0, 0, 0]): THREE.Mesh {
  return attach(parent, new THREE.TorusGeometry(radius, tube, 10, 28), color, position, rotation, 0.45, 0.45)
}

function rod(parent: THREE.Object3D, from: Vector3Tuple, to: Vector3Tuple, radius: number, color: string): THREE.Mesh {
  const start = new THREE.Vector3(...from)
  const end = new THREE.Vector3(...to)
  const direction = end.clone().sub(start)
  const mesh = attach(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 12), color, start.clone().add(end).multiplyScalar(0.5).toArray() as Vector3Tuple, [0, 0, 0], 0.35)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return mesh
}

function wheel(parent: THREE.Object3D, radius: number, position: Vector3Tuple, rotation: Vector3Tuple = [0, Math.PI / 2, 0]): void {
  torus(parent, radius, Math.max(0.018, radius * 0.08), position, palette.black, rotation)
  cylinder(parent, radius * 0.12, radius * 0.12, position, palette.metal, [0, 0, Math.PI / 2], 0.65)
}

export function createDirectorSourceProp(assetId: string): THREE.Group | null {
  if (!assetId.startsWith("bundled:source:")) return null
  const id = assetId.slice("bundled:source:".length)
  const group = new THREE.Group()
  group.name = SOURCE_PROP_DEFINITIONS.find((item) => item.id === id)?.name || id

  if (id === "smartphone" || id === "tablet") {
    const tablet = id === "tablet"
    const width = tablet ? 0.19 : 0.075
    const height = tablet ? 0.27 : 0.155
    box(group, [width, 0.012, height], [0, 0.006, 0], palette.black)
    box(group, [width * 0.9, 0.004, height * 0.85], [0, 0.014, -height * 0.01], "#0ea5e9", undefined, 0.15)
    cylinder(group, width * 0.035, 0.004, [width * 0.36, 0.015, -height * 0.38], palette.dark, [Math.PI / 2, 0, 0])
  } else if (id === "handbag") {
    box(group, [0.42, 0.3, 0.16], [0, 0.18, 0], "#7c2d12")
    torus(group, 0.15, 0.025, [0, 0.37, 0], "#451a03", [Math.PI / 2, 0, 0])
    box(group, [0.08, 0.035, 0.02], [0, 0.2, -0.09], palette.yellow, undefined, 0.75)
  } else if (id === "backpack") {
    box(group, [0.36, 0.48, 0.2], [0, 0.3, 0], "#334155")
    box(group, [0.28, 0.18, 0.08], [0, 0.18, -0.14], "#475569")
    torus(group, 0.13, 0.025, [0, 0.54, 0.04], palette.dark, [Math.PI / 2, 0, 0])
    for (const x of [-0.13, 0.13]) rod(group, [x, 0.5, 0.12], [x, 0.08, 0.12], 0.018, palette.dark)
  } else if (id === "suitcase") {
    box(group, [0.42, 0.62, 0.24], [0, 0.34, 0], "#1d4ed8")
    for (const x of [-0.15, 0.15]) wheel(group, 0.04, [x, 0.035, 0.08], [0, 0, 0])
    for (const x of [-0.1, 0.1]) rod(group, [x, 0.62, 0.06], [x, 0.92, 0.06], 0.012, palette.metal)
    rod(group, [-0.1, 0.92, 0.06], [0.1, 0.92, 0.06], 0.016, palette.dark)
  } else if (id === "umbrella") {
    rod(group, [0, 0.08, 0], [0, 1.15, 0], 0.018, palette.metal)
    attach(group, new THREE.ConeGeometry(0.13, 0.95, 16), "#7e22ce", [0, 0.72, 0])
    torus(group, 0.1, 0.02, [0.08, 0.05, 0], palette.dark, [Math.PI / 2, 0, 0])
  } else if (id === "printer") {
    box(group, [0.52, 0.28, 0.42], [0, 0.18, 0], palette.white)
    box(group, [0.42, 0.04, 0.28], [0, 0.36, 0.02], palette.dark, [-0.18, 0, 0])
    box(group, [0.34, 0.015, 0.3], [0, 0.15, -0.28], "#fafafa", [0.08, 0, 0])
    box(group, [0.12, 0.02, 0.05], [0.15, 0.37, -0.12], "#0284c7")
  } else if (id === "cash-register") {
    box(group, [0.5, 0.18, 0.38], [0, 0.09, 0], "#52525b")
    box(group, [0.32, 0.3, 0.08], [0, 0.32, 0.07], palette.dark, [-0.28, 0, 0])
    box(group, [0.26, 0.18, 0.015], [0, 0.34, 0.015], "#22d3ee", [-0.28, 0, 0])
    for (const x of [-0.15, -0.05, 0.05, 0.15]) box(group, [0.035, 0.015, 0.035], [x, 0.2, -0.14], palette.white)
  } else if (id === "shopping-cart") {
    for (const x of [-0.34, 0.34]) for (const z of [-0.22, 0.22]) wheel(group, 0.08, [x, 0.08, z], [0, 0, 0])
    rod(group, [-0.36, 0.18, 0.24], [-0.42, 0.95, 0.28], 0.025, palette.metal)
    rod(group, [0.36, 0.18, 0.24], [0.42, 0.95, 0.28], 0.025, palette.metal)
    box(group, [0.78, 0.5, 0.52], [0, 0.68, 0], "#94a3b8", [0, 0, -0.08], 0.7)
    box(group, [0.92, 0.05, 0.05], [0, 1.02, 0.28], palette.red)
  } else if (id === "vending-machine") {
    box(group, [0.9, 1.9, 0.65], [0, 0.95, 0], "#b91c1c")
    box(group, [0.58, 1.0, 0.025], [-0.1, 1.25, -0.34], "#67e8f9", undefined, 0.1)
    for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) cylinder(group, 0.055, 0.16, [-0.28 + col * 0.18, 0.9 + row * 0.25, -0.37], [palette.yellow, palette.green, palette.orange][col], [Math.PI / 2, 0, 0])
    box(group, [0.18, 0.32, 0.03], [0.28, 0.95, -0.35], palette.dark)
    box(group, [0.42, 0.18, 0.05], [0, 0.25, -0.35], palette.black)
  } else if (id === "reception-desk") {
    box(group, [2.1, 1.1, 0.65], [0, 0.55, 0], "#a16207")
    box(group, [2.2, 0.12, 0.78], [0, 1.15, 0], "#fef3c7")
    box(group, [0.9, 0.1, 1.2], [1.0, 0.55, 0.35], "#92400e")
  } else if (id === "wheelchair") {
    for (const x of [-0.34, 0.34]) wheel(group, 0.36, [x, 0.42, 0])
    for (const x of [-0.32, 0.32]) wheel(group, 0.1, [x, 0.1, -0.42])
    box(group, [0.62, 0.08, 0.55], [0, 0.52, -0.08], "#0f766e")
    box(group, [0.62, 0.7, 0.08], [0, 0.9, 0.2], "#115e59", [-0.12, 0, 0])
    for (const x of [-0.34, 0.34]) {
      rod(group, [x, 0.48, 0.1], [x, 1.18, 0.23], 0.018, palette.metal)
      rod(group, [x, 0.62, -0.1], [x, 0.62, -0.52], 0.018, palette.metal)
    }
    box(group, [0.55, 0.035, 0.18], [0, 0.18, -0.55], palette.dark)
  } else if (id === "hospital-bed") {
    box(group, [2.05, 0.16, 0.9], [0, 0.72, 0], palette.white)
    box(group, [2.0, 0.18, 0.86], [0, 0.88, 0], "#bfdbfe")
    box(group, [0.12, 0.75, 0.94], [0.98, 0.85, 0], palette.white)
    box(group, [0.12, 0.55, 0.94], [-0.98, 0.76, 0], palette.white)
    for (const x of [-0.78, 0.78]) for (const z of [-0.35, 0.35]) {
      rod(group, [x, 0.2, z], [x, 0.68, z], 0.025, palette.metal)
      wheel(group, 0.07, [x, 0.08, z], [0, 0, 0])
    }
    for (const z of [-0.48, 0.48]) rod(group, [-0.65, 1.15, z], [0.65, 1.15, z], 0.018, palette.metal)
  } else if (id === "iv-stand") {
    rod(group, [0, 0.1, 0], [0, 2.0, 0], 0.018, palette.metal)
    for (let index = 0; index < 5; index += 1) {
      const angle = index * Math.PI * 0.4
      rod(group, [0, 0.12, 0], [Math.cos(angle) * 0.32, 0.04, Math.sin(angle) * 0.32], 0.014, palette.metal)
      wheel(group, 0.045, [Math.cos(angle) * 0.32, 0.04, Math.sin(angle) * 0.32], [0, 0, 0])
    }
    rod(group, [-0.16, 1.95, 0], [0.16, 1.95, 0], 0.014, palette.metal)
    for (const x of [-0.16, 0.16]) rod(group, [x, 1.95, 0], [x, 1.82, 0], 0.01, palette.metal)
  } else if (id === "stretcher") {
    box(group, [2.0, 0.1, 0.58], [0, 0.58, 0], "#f97316")
    for (const z of [-0.32, 0.32]) rod(group, [-1.12, 0.62, z], [1.12, 0.62, z], 0.025, palette.metal)
    for (const x of [-0.75, 0.75]) {
      rod(group, [x, 0.55, -0.25], [x * 0.75, 0.1, -0.25], 0.018, palette.metal)
      rod(group, [x, 0.55, 0.25], [x * 0.75, 0.1, 0.25], 0.018, palette.metal)
      wheel(group, 0.07, [x * 0.75, 0.07, 0.25], [0, 0, 0])
    }
  } else if (id === "medicine-cabinet") {
    box(group, [1.0, 1.9, 0.45], [0, 0.95, 0], palette.white)
    box(group, [0.43, 1.55, 0.025], [-0.24, 1.05, -0.24], "#bae6fd", undefined, 0.1)
    box(group, [0.43, 1.55, 0.025], [0.24, 1.05, -0.24], "#bae6fd", undefined, 0.1)
    for (const y of [0.55, 1.0, 1.45]) box(group, [0.9, 0.025, 0.38], [0, y, 0], palette.metal, undefined, 0.7)
    for (const x of [-0.04, 0.04]) box(group, [0.018, 0.18, 0.018], [x, 1.05, -0.27], palette.dark)
  } else if (id === "school-desk") {
    box(group, [1.1, 0.09, 0.6], [0, 0.74, 0], "#d97706")
    for (const x of [-0.45, 0.45]) for (const z of [-0.22, 0.22]) rod(group, [x, 0.08, z], [x, 0.7, z], 0.025, palette.dark)
    box(group, [0.9, 0.035, 0.48], [0, 0.3, 0], palette.metal, undefined, 0.45)
  } else if (id === "whiteboard") {
    box(group, [1.8, 1.05, 0.05], [0, 1.25, 0], palette.white)
    box(group, [1.9, 1.15, 0.035], [0, 1.25, 0.035], palette.metal, undefined, 0.7)
    box(group, [1.78, 1.03, 0.02], [0, 1.25, -0.025], palette.white)
    for (const x of [-0.7, 0.7]) rod(group, [x, 0.15, 0], [x, 0.72, 0], 0.025, palette.dark)
    rod(group, [-0.95, 0.14, 0], [0.95, 0.14, 0], 0.025, palette.dark)
    for (const x of [-0.85, 0.85]) wheel(group, 0.06, [x, 0.06, 0], [0, 0, 0])
  } else if (id === "cinema-camera") {
    box(group, [0.58, 0.42, 0.32], [0, 0.35, 0], palette.black)
    cylinder(group, 0.13, 0.42, [0, 0.36, -0.36], palette.dark, [Math.PI / 2, 0, 0])
    box(group, [0.42, 0.28, 0.08], [0, 0.36, -0.6], palette.black)
    torus(group, 0.19, 0.035, [-0.2, 0.67, 0], palette.dark, [0, Math.PI / 2, 0])
    torus(group, 0.15, 0.03, [0.2, 0.64, 0], palette.dark, [0, Math.PI / 2, 0])
    rod(group, [-0.22, 0.62, 0.05], [-0.22, 0.86, 0.05], 0.02, palette.metal)
    rod(group, [-0.22, 0.86, 0.05], [0.22, 0.86, 0.05], 0.025, palette.dark)
  } else if (id === "camera-tripod") {
    for (const target of [[-0.65, 0.02, 0.45], [0.65, 0.02, 0.45], [0, 0.02, -0.72]] as Vector3Tuple[]) rod(group, [0, 1.35, 0], target, 0.025, palette.dark)
    cylinder(group, 0.13, 0.12, [0, 1.42, 0], palette.metal)
    box(group, [0.42, 0.3, 0.28], [0, 1.65, 0], palette.black)
    cylinder(group, 0.09, 0.32, [0, 1.66, -0.3], palette.dark, [Math.PI / 2, 0, 0])
    rod(group, [0.08, 1.42, 0], [0.55, 1.2, 0.3], 0.018, palette.dark)
  } else if (id === "softbox") {
    for (const target of [[-0.45, 0.02, 0.3], [0.45, 0.02, 0.3], [0, 0.02, -0.48]] as Vector3Tuple[]) rod(group, [0, 0.35, 0], target, 0.018, palette.dark)
    rod(group, [0, 0.25, 0], [0, 2.1, 0], 0.025, palette.dark)
    box(group, [0.9, 0.8, 0.18], [0, 2.1, 0], palette.black)
    box(group, [0.76, 0.66, 0.025], [0, 2.1, -0.105], "#fefce8")
  } else if (id === "boom-microphone") {
    rod(group, [-1.3, 0.25, 0], [1.2, 1.9, 0], 0.022, palette.dark)
    cylinder(group, 0.055, 0.52, [1.35, 2.0, 0], palette.black, [0, 0, Math.PI / 2])
    sphere(group, 0.075, [1.63, 2.0, 0], "#3f3f46", [1.25, 1, 1])
  } else if (id === "clapperboard") {
    box(group, [0.72, 0.45, 0.035], [0, 0.28, 0], palette.black)
    for (let index = 0; index < 4; index += 1) box(group, [0.12, 0.04, 0.045], [-0.27 + index * 0.18, 0.35, -0.025], palette.white)
    box(group, [0.74, 0.1, 0.055], [0, 0.57, 0], palette.black, [0, 0, 0.08])
    for (let index = 0; index < 4; index += 1) box(group, [0.1, 0.105, 0.065], [-0.27 + index * 0.18, 0.57, -0.005], palette.white, [0, 0, 0.08])
  } else if (id === "reflector") {
    torus(group, 0.62, 0.025, [0, 1.25, 0], palette.metal)
    attach(group, new THREE.CircleGeometry(0.59, 36), "#fef9c3", [0, 1.25, 0], [0, 0, 0], 0.25, 0.35)
    rod(group, [0, 0.08, 0.08], [0, 0.7, 0.08], 0.022, palette.dark)
    for (const x of [-0.45, 0.45]) rod(group, [0, 0.1, 0.08], [x, 0.02, 0.08], 0.016, palette.dark)
  } else if (id === "director-chair") {
    box(group, [0.7, 0.08, 0.55], [0, 0.72, 0], "#18181b")
    box(group, [0.72, 0.42, 0.05], [0, 1.08, 0.25], "#18181b")
    for (const x of [-0.31, 0.31]) {
      rod(group, [x, 0.05, -0.24], [-x, 1.28, 0.24], 0.025, "#a16207")
      rod(group, [x, 0.05, 0.24], [-x, 1.28, -0.24], 0.025, "#a16207")
    }
    for (const x of [-0.45, 0.45]) rod(group, [x, 0.82, 0], [x, 0.82, 0.42], 0.025, "#a16207")
  } else if (id === "fire-extinguisher") {
    cylinder(group, 0.16, 0.65, [0, 0.36, 0], palette.red)
    sphere(group, 0.16, [0, 0.66, 0], palette.red, [1, 0.55, 1])
    box(group, [0.18, 0.08, 0.1], [0, 0.82, 0], palette.dark)
    rod(group, [0.08, 0.8, 0], [0.32, 0.55, 0], 0.025, palette.black)
    box(group, [0.2, 0.16, 0.012], [0, 0.45, -0.17], palette.white)
  } else if (id === "broom") {
    rod(group, [0, 0.14, 0], [0, 1.55, 0], 0.018, "#a16207")
    attach(group, new THREE.ConeGeometry(0.22, 0.42, 16), "#ca8a04", [0, 0.2, 0], [Math.PI, 0, 0])
  } else if (id === "mop-bucket") {
    cylinder(group, 0.28, 0.42, [-0.28, 0.24, 0], "#0284c7")
    torus(group, 0.28, 0.018, [-0.28, 0.48, 0], palette.metal, [Math.PI / 2, 0, 0])
    rod(group, [0.12, 0.08, 0], [0.52, 1.6, 0], 0.02, palette.metal)
    attach(group, new THREE.ConeGeometry(0.2, 0.38, 16), "#e4e4e7", [0.12, 0.18, 0], [0, 0, -0.25])
  } else if (id === "ladder") {
    rod(group, [-0.35, 0.02, -0.25], [0, 2.0, 0], 0.035, palette.metal)
    rod(group, [0.35, 0.02, -0.25], [0, 2.0, 0], 0.035, palette.metal)
    rod(group, [-0.35, 0.02, 0.25], [0, 2.0, 0], 0.035, palette.metal)
    rod(group, [0.35, 0.02, 0.25], [0, 2.0, 0], 0.035, palette.metal)
    for (let index = 0; index < 6; index += 1) {
      const y = 0.28 + index * 0.27
      rod(group, [-0.3 + index * 0.045, y, -0.2 + index * 0.03], [0.3 - index * 0.045, y, -0.2 + index * 0.03], 0.025, palette.metal)
      rod(group, [-0.3 + index * 0.045, y, 0.2 - index * 0.03], [0.3 - index * 0.045, y, 0.2 - index * 0.03], 0.025, palette.metal)
    }
  } else if (id === "toolbox") {
    box(group, [0.65, 0.32, 0.32], [0, 0.18, 0], palette.red)
    box(group, [0.68, 0.08, 0.35], [0, 0.38, 0], palette.dark)
    torus(group, 0.15, 0.025, [0, 0.52, 0], palette.dark, [Math.PI / 2, 0, 0])
    box(group, [0.12, 0.06, 0.025], [0, 0.32, -0.18], palette.metal, undefined, 0.7)
  } else if (id === "hammer") {
    rod(group, [0, 0.04, 0], [0, 0.78, 0], 0.045, "#92400e")
    box(group, [0.42, 0.16, 0.16], [0, 0.82, 0], palette.dark, undefined, 0.75)
    attach(group, new THREE.ConeGeometry(0.13, 0.22, 4), palette.dark, [0.3, 0.82, 0], [0, 0, -Math.PI / 2], 0.75)
  } else if (id === "traffic-bollard") {
    cylinder(group, 0.12, 0.9, [0, 0.48, 0], palette.orange)
    cylinder(group, 0.125, 0.14, [0, 0.68, 0], palette.white)
    cylinder(group, 0.28, 0.08, [0, 0.04, 0], palette.dark)
  } else {
    return null
  }

  return group
}
