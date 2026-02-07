# DevOps MultiBot Command Center

Universal smart model routing and multi-agent orchestration via OpenRouter.

## Features

- **16 OpenRouter models** with tiered pricing (Free → Premium)
- **Smart routing**: L3→Free, L2→Ultra-Low, L1→Budget, L0→Standard, Critical→Premium
- **Agent fleet management** (7 core agents, 187 total hierarchy)
- **Kanban task board** with agent assignment
- **Reverse learning** knowledge capture
- **Skill progression tracking**
- **Cloudflare infrastructure** status panel
- **Persistent storage** across sessions
- **Cost simulator** with monthly projections

## File Structure

```
devops-command-center/
├── README.md
├── DevOpsCommandCenter.tsx    ← Main React component
├── package.json               ← Dependencies
└── models-config.json         ← OpenRouter model catalog & n8n workflow
```

## Quick Start

```bash
git clone https://github.com/MasterPlayspots/devops-command-center.git
cd devops-command-center
npm install
# Import DevOpsCommandCenter.tsx into your React app
```

## Model Routing Tiers

| Level | Tier | Use Case | Example Models |
|-------|------|----------|----------------|
| L3 | Free | Micro tasks | xiaomi/mimo-v2-flash, mistral/devstral-2-2512:free |
| L2 | Ultra-Low | Specialist tasks | deepseek/v3.2, minimax/m2.1 |
| L1 | Budget | Role agents | google/gemini-3-flash-preview, bytedance/seed-1.6 |
| L0 | Standard | Orchestrator | anthropic/claude-sonnet-4, openai/gpt-5.2 |
| Critical | Premium | Review | anthropic/claude-opus-4.6, openai/gpt-5.2-pro |

## Agent → Model Mapping

| Agent | Default Tier |
|-------|-------------|
| Orchestrator | Standard |
| Product | Budget |
| Architect | Standard |
| Backend | Ultra-Low |
| Frontend | Ultra-Low |
| QA | Budget |
| DevOps | Ultra-Low |

## Cost Optimization Targets

- 70% Free tier usage
- 20% Ultra-Low tier usage
- 10% Premium tier usage

## n8n Integration

The `models-config.json` includes a complete n8n Smart-Model-Router workflow template with webhook trigger, complexity classifier, and per-tier HTTP request nodes for OpenRouter.

## License

MIT
