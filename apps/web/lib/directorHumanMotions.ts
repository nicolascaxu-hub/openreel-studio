export interface DirectorHumanMotionDefinition {
  index: number
  name: string
  category: "基础交流" | "日常生活" | "行走运动" | "冲突动作" | "表演特殊"
}

export const DIRECTOR_HUMAN_MOTION_CATEGORIES: DirectorHumanMotionDefinition["category"][] = [
  "基础交流", "日常生活", "行走运动", "冲突动作", "表演特殊",
]

const BASE_MOTION_NAMES = [
  "Chest_Open", "Chop_Tree", "ClimbUp_1m_RM", "Consume", "Crouch_Idle", "Crouch_Walk",
  "Dance_Simple", "Death_D", "Driving", "Farm_Harvest", "Farm_PlantSeed", "Farm_Watering",
  "Fixing_Kneeling", "Hit_Chest", "Hit_Head", "Hit_Knockback", "Hit_Knockback_RM", "Idle_A",
  "Idle_FoldArms", "Idle_Lantern", "Idle_Rail", "Idle_Rail_Call", "Idle_ShakeOff", "Idle_Shield",
  "Idle_Shield_Break", "Idle_Sword", "Idle_Talking", "Idle_TalkingPhone", "Idle_Torch", "Interact",
  "Jog", "Jump_air", "Jump_Land", "Jump_Start", "LayToIdle", "Melee_Hook", "Melee_Hook_Rec",
  "NinjaJump_Idle", "NinjaJump_Land", "NinjaJump_Start", "OverhandThrow", "PickUp_Table",
  "Pistol_Aim_Down", "Pistol_Aim_Neutral", "Pistol_Aim_Up", "Pistol_Idle", "Pistol_Reload",
  "Pistol_Shoot", "Punch_Cross", "Punch_Jab", "Push", "Roll", "Roll_RM", "Shield_Dash_RM",
  "Shield_OneShot", "Sitting_Enter", "Sitting_Exit", "Sitting_Idle", "Sitting_Talking", "Slide",
  "Slide_Exit", "Slide_Start", "Spell_Simple_Enter", "Spell_Simple_Exit", "Spell_Simple_Idle",
  "Spell_Simple_Shoot", "Sprint", "Swim_Fwd", "Swim_Idle", "Sword_Attack", "Sword_Attack_RM",
  "Sword_Block", "Sword_Dash_RM", "Sword_Regular_A", "Sword_Regular_A_Rec", "Sword_Regular_B",
  "Sword_Regular_B_Rec", "Sword_Regular_C", "Sword_Regular_C_RM", "Sword_Regular_Combo", "Walk",
  "Walk_Carry", "Walk_Formal", "Yes", "Zombie_Idle", "Zombie_Scratch", "Zombie_Walk",
] as const

const ADDON_MOTION_NAMES = [
  "Angry", "Attack_Ground_Pound", "Backflip", "Bow", "Bow Pull Back", "Bow Pull Hold",
  "Bow Release", "Climb Ladder", "Climb Wall", "Confused", "Consume Item", "Crawl", "Crawl RM",
  "Dance Body Roll", "Dance Charleston", "Dance Reach Hip", "Death_A", "Death_B", "Death_C",
  "Defend", "Dizzy", "Dodge_back", "Dodge_back_RM", "Dodge_left", "Dodge_left_RM", "Dodge_right",
  "Dodge_right_RM", "Fighting Idle", "Fighting Left Jab", "Fighting Right Jab", "Flying Forward",
  "Flying Forward Super", "Glide", "Greeting", "Head Nod", "Idle Hurt", "Idle Listening",
  "Idle_Subtle", "Jump_2", "Jump_2_RM", "Jumping Jacks", "Kneeling Tired", "Ladder_Idle",
  "Land_Three_Point", "Ledge Hang", "Levitate Entrance", "Levitate Idle", "Meditate", "Pipe Climb",
  "Power Up", "Pushup", "Reject", "Rest Pose", "Run Jump", "Run_Anime", "Run_Female", "Run_Stealth",
  "Shivering", "Sleeping", "Strafe_left", "Strafe_right", "Sword_Attack_Air_Vertical", "Throw Object",
  "Tired Hunched", "Two-hand Blast", "Victory", "Victory Fist Pump", "Walk_Backwards", "Walk_Female",
  "Walk_Large", "Walk_Stealth", "Zombie Yell", "Zombie_Idle_Crouch", "Zombie_Rise", "Zombie_Walk_2",
] as const

const MOTION_PRIORITY = [
  "Idle_A", "Idle_Subtle", "Idle Listening", "Idle_Talking", "Idle_FoldArms", "Greeting", "Head Nod",
  "Yes", "Confused", "Angry", "Reject", "Sitting_Idle", "Sitting_Talking", "Walk", "Walk_Formal",
  "Jog", "Sprint", "Run_Female", "PickUp_Table", "Interact", "Push", "Driving",
] as const

const MOTION_LABELS: Record<string, string> = {
  Idle_A: "自然站立",
  Idle_Subtle: "轻微待机",
  "Idle Listening": "站立倾听",
  Idle_Talking: "站立交谈",
  Idle_FoldArms: "抱臂站立",
  Greeting: "挥手问候",
  "Head Nod": "点头",
  Yes: "肯定回应",
  Confused: "困惑",
  Angry: "生气",
  Reject: "拒绝",
  Sitting_Idle: "坐姿待机",
  Sitting_Talking: "坐姿交谈",
  Walk: "自然行走",
  Walk_Formal: "正式行走",
  Jog: "慢跑",
  Sprint: "冲刺",
  Run_Female: "轻盈跑步",
  PickUp_Table: "从桌面拿取",
  Interact: "伸手互动",
  Push: "向前推",
  Driving: "驾驶",
  Crouch_Idle: "蹲姿待机",
  Crouch_Walk: "蹲姿行走",
  Kneeling_Tired: "疲惫跪姿",
  Meditate: "盘坐冥想",
  Sleeping: "睡眠",
  Victory: "胜利",
  "Victory Fist Pump": "振臂庆祝",
}

function motionCategory(name: string): DirectorHumanMotionDefinition["category"] {
  if (/dance|zombie|death|spell|power|levitate|victory|backflip|ninja/i.test(name)) return "表演特殊"
  if (/attack|fight|punch|melee|sword|pistol|bow|shield|defend|dodge|hit|blast/i.test(name)) return "冲突动作"
  if (/walk|run|jog|sprint|jump|climb|crawl|roll|slide|swim|strafe|glide|flying/i.test(name)) return "行走运动"
  if (/idle|talk|greet|nod|yes|confused|angry|reject|shiver|tired/i.test(name)) return "基础交流"
  return "日常生活"
}

const sourceMotions: DirectorHumanMotionDefinition[] = [
  ...BASE_MOTION_NAMES.map((name, index) => ({ index, name, category: motionCategory(name) })),
  ...ADDON_MOTION_NAMES.map((name, index) => ({
    index: BASE_MOTION_NAMES.length + index,
    name,
    category: motionCategory(name),
  })),
]

const priorityByName = new Map<string, number>(MOTION_PRIORITY.map((name, index) => [name, index]))

export const DIRECTOR_UNIVERSAL_HUMAN_MOTIONS = [...sourceMotions].sort((left, right) => {
  const leftPriority = priorityByName.get(left.name) ?? Number.MAX_SAFE_INTEGER
  const rightPriority = priorityByName.get(right.name) ?? Number.MAX_SAFE_INTEGER
  return leftPriority - rightPriority || left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
})

export function directorHumanMotionLabel(name: string): string {
  const translated = MOTION_LABELS[name]
  return translated ? `${translated} · ${name}` : name.replaceAll("_", " ")
}

export function directorHumanMotionCategory(name: string): DirectorHumanMotionDefinition["category"] {
  return motionCategory(name)
}
