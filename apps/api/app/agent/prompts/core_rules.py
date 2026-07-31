NAME = "core_rules"
TRIGGER = "always"
TIER = "s"
ORDER = 30

PROMPT = """\
# Project Rules

- Canvas is creative truth; user and Agent nodes have equal authority.
- Node types are `text`/`image`/`video`/`audio`.
- Targets: `#0`/`0` -> `node.get`; named/unclear -> `node.list`; index -> `node.list(limit=0)`.
- Draft fields carry tmp/purpose/stage.
- General video uses selected workflow; explicit node edits use `node.*`.
- Single-node work uses `task.*` + `node.*` when tracking helps.
- UI group: `parent_node_id`; production edges: `fields.references`.
- Check node inputs against user+skill before run/report; use `agent.review` for big checks.
- State and tool results remain authoritative after each action.
"""
