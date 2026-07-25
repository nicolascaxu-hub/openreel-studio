# External agents and OpenReel Agent Plugin

English · [简体中文](../zh-CN/agent-integrations.md) · [Documentation home](../README.en.md)

## Compatibility summary

The external control repository is named
[OpenReel Agent Plugin](https://github.com/yutianxiao6/openreel-agent-plugin),
but it contains two distinct layers:

1. A complete plugin installation layer: Codex marketplace currently
   distributes `.codex-plugin/plugin.json` and the `openreel-director` skill.
2. A standard MCP tool layer: `openreel-mcp.mjs --stdio`, which exposes
   projects, canvas operations, nodes, the asset library, and runs as MCP tools
   backed by a running OpenReel API.

Different agents do not necessarily support the same plugin packaging format,
but many developer agents that support local stdio MCP servers can connect to
the same underlying tool bridge.

| Client | Integration | Current support level |
| --- | --- | --- |
| Codex CLI / Codex desktop host | Install the complete Agent Plugin | Includes the skill and MCP tools |
| Claude Code | Configure a local stdio MCP server | Protocol-compatible |
| Cursor Agent | Configure a local stdio MCP server | Protocol-compatible |
| VS Code / GitHub Copilot Agent | Configure a local stdio MCP server | Protocol-compatible |
| Gemini CLI | Configure a local stdio MCP server | Protocol-compatible |
| Windsurf Cascade | Configure a local stdio MCP server | Protocol-compatible |
| Web-only agents that cannot launch local processes | Cannot use the current bridge directly | Requires a separate remote MCP or API adapter |

“Protocol-compatible” means that the client officially supports stdio MCP and
that the OpenReel bridge completes standard MCP initialization and tool
discovery. It does not claim the same end-to-end validation as the Codex path.
The Codex path has complete installation coverage; other clients use their own
MCP configuration format.

## Complete installation in Codex

Start OpenReel Studio, then add the plugin repository as a Codex marketplace:

```bash
codex plugin marketplace add https://github.com/yutianxiao6/openreel-agent-plugin.git
codex plugin add openreel-studio@openreel-agent
```

Start a new Codex session after installation or an update, then make the
connection request explicit:

> Connect to my local OpenReel, list projects, select “Product Demo,” and
> summarize the current canvas.

This installation loads the manifest, the `openreel-director` skill, and the
MCP server configuration together. Codex therefore receives the complete
project-selection, deferred-discovery, safety-confirmation, and media
generation workflow. See the
[plugin documentation](https://github.com/yutianxiao6/openreel-agent-plugin/tree/main/plugins/openreel-studio)
for the full tool surface.

## Connect another agent directly through MCP

### Prepare the bridge

The agent host needs Node.js 20 or later and network access to OpenReel:

```bash
git clone https://github.com/yutianxiao6/openreel-agent-plugin.git
```

The bridge entry point is:

```text
/absolute/path/openreel-agent-plugin/plugins/openreel-studio/scripts/openreel-mcp.mjs
```

For a desktop or source installation on the same machine, connection variables
can be omitted and the bridge discovers supported local ports. For Docker or a
remote deployment, set at least `OPENREEL_BASE_URL`, then set either
`OPENREEL_TOKEN` or both `OPENREEL_USERNAME` and `OPENREEL_PASSWORD` as required
by the deployment.

### Claude Code, Cursor, Gemini CLI, and Windsurf

These clients accept local-process definitions under an `mcpServers` root.
Place the following entry in the appropriate user or project configuration and
replace the script path with a real absolute path:

```json
{
  "mcpServers": {
    "openreel-studio": {
      "command": "node",
      "args": [
        "/absolute/path/openreel-agent-plugin/plugins/openreel-studio/scripts/openreel-mcp.mjs",
        "--stdio"
      ],
      "env": {
        "OPENREEL_BASE_URL": "https://example.com/studio",
        "OPENREEL_TOKEN": "read-from-your-private-secret-store"
      }
    }
  }
}
```

Common configuration locations:

| Client | Project or user location |
| --- | --- |
| Claude Code | Project `.mcp.json`, or use `claude mcp add` for local/user configuration |
| Cursor | Project `.cursor/mcp.json`, or user `~/.cursor/mcp.json` |
| Gemini CLI | Project `.gemini/settings.json`, or user `~/.gemini/settings.json` |
| Windsurf | User `~/.codeium/windsurf/mcp_config.json` |

Delete the entire `env` object when local OpenReel requires no authentication.
Never commit real passwords or tokens in a project configuration. Environment
expansion and secure-input syntax differ by client, so follow that client's
official documentation and keep credentials in user configuration or a secret
store.

### VS Code and GitHub Copilot Agent

VS Code uses a `servers` root and an explicit stdio type:

```json
{
  "servers": {
    "openreel-studio": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/openreel-agent-plugin/plugins/openreel-studio/scripts/openreel-mcp.mjs",
        "--stdio"
      ]
    }
  }
}
```

Store workspace configuration in `.vscode/mcp.json`, or run
`MCP: Open User Configuration` from the Command Palette for user-level setup.

## Differences outside Codex

- A direct MCP connection exposes tools but does not automatically load the
  bundled `openreel-director` skill. The client should
  connect, list projects, select an exact project, and only then read or mutate
  the canvas.
- When the host provides an image generation service that returns a local file
  readable by the MCP bridge, prefer host generation followed by
  `openreel_publish_generated_image`. When no suitable host service exists, use
  the OpenReel image node contract and `create → run`. An explicit user
  provider choice always wins.
- The current bridge is a local stdio process, not a remote MCP URL. It must run
  on the same host as the agent, and that host must be able to reach OpenReel.
- Project selection lives in the current MCP process. Confirm the connection
  and target project in every new session; use a project UUID when titles are
  duplicated.
- Tool approval behavior differs among clients. Project, node, and edge
  deletion or snapshot restoration still requires explicit user authorization
  and the structured confirmation fields required by the tool.
- Do not copy the plugin's bundled `.mcp.json` verbatim into another client. It
  uses the Codex installation host's `env_vars` forwarding and plugin
  working-directory semantics;
  configure `env`, paths, and secrets in the target client's own format.

## Verify the connection

Ask the agent to perform these operations in order:

1. Run `openreel_connection_info`.
2. Run `openreel_list_projects`.
3. Select a unique title or UUID with `openreel_select_project`.
4. Read the canvas with `openreel_get_canvas`.
5. Complete a read-only query before creating or running a node.

If discovery fails, test the same bridge directly:

```bash
node /absolute/path/openreel-mcp.mjs --check
```

For a remote deployment, also verify that the URL points to the site root or
the `/studio` root, that the credentials belong to that same service, and that
the proxy permits long-running node requests.

## Official compatibility references

- [OpenAI: Plugins](https://learn.chatgpt.com/docs/plugins)
- [OpenAI: Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp)
- [Anthropic: Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Cursor: Model Context Protocol](https://docs.cursor.com/context/model-context-protocol)
- [VS Code: MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
- [Google: Gemini CLI MCP servers](https://geminicli.com/docs/tools/mcp-server/)
- [Windsurf: Cascade MCP](https://docs.windsurf.com/windsurf/cascade/mcp)
