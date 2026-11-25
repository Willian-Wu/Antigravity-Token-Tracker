# Antigravity Token Tracker

> Track and visualize token consumption (**Input**, **Output**, **Cache Read**) for every [Antigravity](https://antigravity.google/) task and conversation.

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## Screenshots

### Sidecar Analytics Panel
![Token Tracker Side Panel](./assets/screenshot-panel.png)

### Plugin Overview & Quick Entry
![Antigravity Plugin Overview](./assets/screenshot-plugin.png)

![Extensions Menu Entry](./assets/screenshot-extensions.png)

## Features

- **Per-Turn Summary Hook (`PostInvocation`)**: Automatically appends a concise token & estimated API cost summary (`Total`, `USD Cost`, `Input`, `Output`, `Cache Read`, model name, and session total) after each turn, with a one-click link to open the side panel.
- **Per-Step Model API Cost Estimation (USD)**:
  - Automatically identifies the model used for each step (`step.model`, with fallback to `Model Selection` changes and Swarm member metadata for older logs).
  - Built-in official 2026 API pricing table for Gemini 4 (Carbon, Argon, Neon, Hydrogen), Gemini 3.8/3.6/3.5 Flash, and Claude 5.5/4.6 (Opus, Sonnet, Haiku), including date-aware promotional vs. standard pricing and prompt-caching savings calculation.
  - Editable per-model price overrides (`$/1M tokens`) saved locally in `settings.json`.
- **Sidecar Web UI Panel**:
  - **Current Task View**: Inspect estimated USD spend, cache savings, total/input/output/cache tokens, per-model breakdown, interactive context growth chart with per-step cost, and per-turn breakdown.
  - **All Tasks View**: Aggregate token consumption and USD spend across all local conversations with 7-day daily / 24-hour hourly trend charts (switchable between Total, Non-cached, and Cost `$`), global model cost distribution, keyword/model search, and sorting (recent, highest cost, total tokens, or non-cached tokens).
  - **Subagent & Swarm Aggregation**: Automatically detects and rolls up token usage and API costs from spawned subagents and swarm members into their parent task.
  - **Configurable Hook & Pricing Settings**: Toggle cumulative session total, Hook cost display, automatic promotional pricing, and custom per-model rates directly in the panel.
- **Built-in Skill**: Ask Antigravity in natural language to summarize token usage and estimated API cost for the current or past conversations, or to open the Token Tracker side panel.

## Directory Structure

```text
token-tracker/
├── plugin.json                 # Plugin metadata & suggested prompts
├── hooks.json                  # PostInvocation hook configuration
├── assets/
│   └── logo.svg                # Plugin icon
├── hooks/
│   └── report-tokens.mjs       # Hook script that prints per-turn token summaries
├── lib/
│   ├── pricing.mjs             # Official model API pricing catalog & per-step USD cost calculator
│   └── tokens.mjs              # transcript.jsonl parser, subagent aggregation & time-series stats
├── sidecars/
│   └── token_panel/            # Sidecar Web UI
│       ├── sidecar.json
│       ├── package.json
│       ├── main.mjs
│       ├── index.html
│       ├── app.js
│       └── styles.css
└── skills/
    └── token-tracker/
        └── SKILL.md            # Agent skill instructions
```

## Installation

Clone this repository into Antigravity's plugin directory `~/.gemini/config/plugins/token-tracker`:

```bash
git clone https://github.com/Willian-Wu/Antigravity-Token-Tracker.git ~/.gemini/config/plugins/token-tracker
```

Make sure **Node.js 18+** (with ES Module support) is installed, then enable `token-tracker` in Antigravity.

## Data & Privacy

- Reads only local transcript files under `~/.gemini/antigravity/brain/<conversationId>/.system_generated/logs/transcript.jsonl` (as well as `ANTIGRAVITY_APP_DATA`, `antigravity-ide`, and `antigravity-cli` directories if present).
- All parsing and visualization run 100% locally — no data is sent to external servers.
- Panel preferences are saved locally in `settings.json` (git-ignored).

---

<a id="中文"></a>

## 中文文档

一个用于 [Antigravity](https://antigravity.google/) 的轻量级插件，用于统计、追踪并可视化每个任务与会话的 Token 消耗（Input、Output、Cache Read）。

### 功能特性

- **每轮自动摘要（PostInvocation Hook）**：每次对话轮次结束后，自动在聊天中展示本轮 Token 消耗、预估美元费用（USD）、模型名称及当前会话累计消耗与花费，并附带一键打开详情面板的链接。
- **逐 Step 模型 API 费用估算（USD）**：
  - 自动识别每次模型调用使用的具体模型（读取 `step.model`，旧日志自动回溯 `Model Selection` 切换记录与 Swarm 成员配置）。
  - 内置 2026 官方 Standard Paid Tier 单价表（覆盖 Gemini 4 Carbon / Argon / Neon / Hydrogen、Gemini 3.8/3.6/3.5 Flash、Claude Opus/Sonnet 5.5 & 4.6 等），支持按调用日期自动切换促销价/标准价，并计算缓存节省金额。
  - 支持在面板设置中随时自定义任意模型的 Input / Output / Cache Read 单价（`$/1M tokens`）并持久化到本地 `settings.json`。
- **侧边栏可视化面板（Sidecar Web UI）**：
  - **当前任务视图**：查看当前会话的估算费用与缓存省钱额、总计/输入/输出/缓存统计、多模型拆分、上下文增长曲线（含单步模型与费用）以及按轮次（Turn）拆分的明细。
  - **全部任务视图**：汇总所有历史会话的 Token 消耗与美元花费，支持 7 天按日 / 24 小时按小时趋势图（可切换总计 / 非缓存 / 费用 `$`）、全局模型费用分布、关键词/模型搜索以及按最近更新 / 花费最高 / 总 Token / 非缓存 Token 排序。
  - **子代理与 Swarm 聚合**：自动识别并合并当前任务派生出的 Subagent 与 Swarm 成员的 Token 消耗与 API 费用。
  - **Hook 与计价设置**：支持在面板右上角开关「显示本会话累计」「Hook 摘要显示费用」「促销期内按促销价计费」及编辑自定义模型单价。
- **内置 Skill**：支持通过自然语言直接让 Agent 汇总当前会话或历史任务的 Token 与费用消耗，或唤起 Token Tracker 侧边栏面板。

### 安装方式

将本仓库克隆到 Antigravity 的插件目录 `~/.gemini/config/plugins/token-tracker`：

```bash
git clone https://github.com/Willian-Wu/Antigravity-Token-Tracker.git ~/.gemini/config/plugins/token-tracker
```

确保系统已安装 Node.js（支持 ES Module，建议 Node 18+），然后在 Antigravity 中启用 `token-tracker` 插件即可。

### 数据来源与隐私

- 插件仅读取本地 `~/.gemini/antigravity/brain/<conversationId>/.system_generated/logs/transcript.jsonl`（以及 `ANTIGRAVITY_APP_DATA` 环境变量指定目录、`antigravity-ide`、`antigravity-cli` 目录下的对应文件）。
- 所有统计与可视化均在本地完成，不会向任何外部服务器发送数据。
- 用户在面板中修改的配置会保存在插件根目录的 `settings.json` 中（已加入 `.gitignore`，不会提交到仓库）。

## License

[MIT](./LICENSE)
