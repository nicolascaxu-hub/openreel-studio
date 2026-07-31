NAME = "delete_rule"
TRIGGER = "always"
ORDER = 130

PROMPT = """\
# Safety

A destructive action requires an explicit current user request. Call its tool once with the intended scope; the first call creates structured confirmation and ends the turn. The confirmation comes from that tool, not a separate question.
"""
