# 外部智能体与 OpenReel Agent Plugin

[English](../en/agent-integrations.md) · [中文文档首页](../README.md)

## 兼容性结论

OpenReel 的外部控制仓库叫
[OpenReel Agent Plugin](https://github.com/yutianxiao6/openreel-agent-plugin)，
但其中有两层能力：

1. 完整插件安装层：当前通过 Codex marketplace 分发
   `.codex-plugin/plugin.json` 和 `openreel-director` Skill。
2. 标准 MCP 工具层：`openreel-mcp.mjs --stdio`，负责把项目、画布、节点、
   资产库和运行操作转成 MCP 工具，再调用正在运行的 OpenReel API。

因此，**不同智能体不一定支持同一种插件安装格式**；但是很多支持本地 stdio MCP
的开发智能体都可以直接连接同一个底层工具桥。

| 客户端 | 接入方式 | 当前支持级别 |
| --- | --- | --- |
| Codex CLI / Codex 桌面宿主 | 安装完整 Agent Plugin | 包含 Skill 和 MCP 工具 |
| Claude Code | 配置本地 stdio MCP | 协议兼容 |
| Cursor Agent | 配置本地 stdio MCP | 协议兼容 |
| VS Code / GitHub Copilot Agent | 配置本地 stdio MCP | 协议兼容 |
| Gemini CLI | 配置本地 stdio MCP | 协议兼容 |
| Windsurf Cascade | 配置本地 stdio MCP | 协议兼容 |
| 只支持网页聊天、不能启动本地进程的智能体 | 不能直接使用当前桥 | 需要另行提供远程 MCP 或 API 适配 |

这里的“协议兼容”表示客户端官方支持 stdio MCP，而且 OpenReel 桥能完成标准
MCP 初始化和工具发现；它不等于每个客户端都完成了与 Codex 相同的端到端验收。
当前 Codex 路径完成了完整安装测试；其他客户端按各自 MCP 配置格式接入。

## 在 Codex 中完整安装

先启动 OpenReel Studio，再把插件仓库添加为 Codex marketplace：

```bash
codex plugin marketplace add https://github.com/yutianxiao6/openreel-agent-plugin.git
codex plugin add openreel-studio@openreel-agent
```

安装或更新后新建 Codex 会话，然后明确要求连接，例如：

> 连接本机 OpenReel，列出项目，选择“产品演示”，然后概览当前画布。

Codex 安装方式会同时加载插件清单、`openreel-director` Skill 和 MCP 服务配置，
因此能获得完整的项目选择、按需工具发现、安全确认和媒体生成协作规则。工具清单和
详细行为见
[插件仓库文档](https://github.com/yutianxiao6/openreel-agent-plugin/tree/main/plugins/openreel-studio)。

## 让其他智能体直接连接 MCP

### 准备工具桥

外部智能体所在机器需要安装 Node.js 20 或更高版本，并能访问 OpenReel：

```bash
git clone https://github.com/yutianxiao6/openreel-agent-plugin.git
```

工具桥入口是：

```text
/绝对路径/openreel-agent-plugin/plugins/openreel-studio/scripts/openreel-mcp.mjs
```

桌面版或源码版本机运行时可以省略连接环境变量，工具桥会探测受支持的本机端口。
Docker 或远程部署至少设置 `OPENREEL_BASE_URL`，并按部署方式设置
`OPENREEL_TOKEN`，或同时设置 `OPENREEL_USERNAME` 和
`OPENREEL_PASSWORD`。

### Claude Code、Cursor、Gemini CLI 和 Windsurf

这几类客户端都接受以 `mcpServers` 为根的本地进程配置。把下面内容放到对应的
用户级或项目级 MCP 配置文件，并把脚本路径改成真实绝对路径：

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

常见配置位置：

| 客户端 | 项目级或用户级位置 |
| --- | --- |
| Claude Code | 项目 `.mcp.json`，或使用 `claude mcp add` 写入本地/用户配置 |
| Cursor | 项目 `.cursor/mcp.json`，或用户 `~/.cursor/mcp.json` |
| Gemini CLI | 项目 `.gemini/settings.json`，或用户 `~/.gemini/settings.json` |
| Windsurf | 用户 `~/.codeium/windsurf/mcp_config.json` |

如果 OpenReel 在本机运行且不需要认证，可以删除整个 `env`。不要把真实密码或
Token 写进会提交到 Git 的项目配置；各客户端的环境变量展开和私密输入语法不同，
应按其官方文档把凭据放到用户配置或密钥存储中。

### VS Code 与 GitHub Copilot Agent

VS Code 使用 `servers` 作为根字段，并显式声明 stdio 类型：

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

工作区配置放在 `.vscode/mcp.json`。也可以从命令面板运行
`MCP: Open User Configuration` 创建用户级配置。

## 非 Codex 客户端的差异

- MCP 连接只提供工具，不会自动加载安装包中的
  `openreel-director` Skill。智能体需要自行遵循“先连接、列出项目、精确选择项目、
  再读取或修改画布”的顺序。
- 宿主存在图片生成服务、并能返回 MCP 桥可读的本地文件时，优先用宿主生成后调用
  `openreel_publish_generated_image`；宿主没有合适的图片服务时，使用 OpenReel
  图片节点合同执行 `create → run`。用户明确选择的 Provider 始终优先。
- 当前桥是本地 stdio 进程，不是可直接填写 URL 的远程 MCP 服务。MCP 进程必须
  与智能体运行在同一台主机上，并且该主机能够访问 OpenReel。
- 项目选择保存在当前 MCP 进程中。每个新会话都应重新确认连接和目标项目，同名项目
  使用项目 UUID。
- 不同客户端的工具审批策略不同。删除项目、节点、连线或恢复快照前仍需让用户明确
  授权，并保留工具要求的结构化确认字段。
- 不要直接复制插件内的 `.mcp.json` 到其他客户端。它使用 Codex 安装宿主支持的
  `env_vars` 透传和插件工作目录语义；其他客户端应使用自己的 `env`、路径和
  密钥配置格式。

## 连接检查

配置完成后，让智能体依次执行：

1. `openreel_connection_info` 验证目标服务；
2. `openreel_list_projects` 列出项目；
3. `openreel_select_project` 使用唯一标题或 UUID 选择项目；
4. `openreel_get_canvas` 读取画布；
5. 先完成一个只读查询，再尝试创建或运行节点。

如果连接失败，可以在终端直接检查同一个桥：

```bash
node /absolute/path/openreel-mcp.mjs --check
```

远程部署还应确认 URL 指向站点根地址或 `/studio` 根地址，认证信息与该地址属于
同一服务，并且代理允许长时间节点运行请求。

## 官方兼容性资料

- [OpenAI：Plugins](https://learn.chatgpt.com/docs/plugins)
- [OpenAI：Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp)
- [Anthropic：Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Cursor：Model Context Protocol](https://docs.cursor.com/context/model-context-protocol)
- [VS Code：MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
- [Google：Gemini CLI MCP servers](https://geminicli.com/docs/tools/mcp-server/)
- [Windsurf：Cascade MCP](https://docs.windsurf.com/windsurf/cascade/mcp)
