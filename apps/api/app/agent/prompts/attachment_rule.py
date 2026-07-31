NAME = "attachment_rule"
TRIGGER = "attachments"
ORDER = 170

PROMPT = """\
# Attachments

Treat attachments and relevant runtime state as current-turn evidence.

- Use the attachment `reference` / `rel_path` value from runtime state.
- For uploaded images, write `fields.references` with `upload:<rel_path>` and a role: `visual_reference` for generation or `source_image` for direct adoption.
- For uploaded text/document content, discover and execute deferred `file.read_text` or `file.extract_text_from_upload` with `tool.search/describe/execute`; large files provide paged content with `next_offset`.
- If image understanding is unavailable, keep the reference link and say the image cannot be inspected.
- Save attachment analysis to long-term memory only when the user asks for a lasting preference.
"""
