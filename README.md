# DevOps MultiBot Command Center

Universal smart model routing and multi-agent orchestration via OpenRouter. Deployed on Cloudflare Pages, backed by Cloudflare Workers + D1 + KV.

## Features

- **16 OpenRouter models** with tiered pricing (Free to Premium)
- **Smart routing**: L3 Free, L2 Ultra-Low, L1 Budget, L0 Standard, Critical Premium
- **Agent fleet management** (7 core agents with model mapping)
- **Kanban task board** with agent assignment and persistent storage
- **Cloudflare infrastructure** status panel (Workers, D1, KV)
- **Cost simulator** with monthly projections and tier breakdowns
- **Real-time dashboard** with auto-refresh from Worker API

## Quick Start

```bash
git clone https://github.com/MasterPlayspots/devops-command-center.git
cd devops-command-center
npm install
npm run dev
```

## Deploy to Cloudflare Pages

**Option A: GitHub Integration (Recommended)**

1. Connect repo in Cloudflare Dashboard > Workers & Pages > Create > Pages > Git
2. Build settings: `npm run build` / Output: `dist`

**Option B: Direct Deploy**

```bash
export CLOUDFLARE_API_TOKEN=your-token
npm run deploy
```

## Architecture

```
devops-command-center/
├── src/
│   ├── DevOpsCommandCenter.tsx  <- Main React component (7 tabs)
│   ├── App.tsx                  <- App wrapper
│   └── main.tsx                 <- Entry point
├── public/
│   ├── _headers                 <- Security headers (CSP, X-Frame, etc.)
│   └── _redirects               <- SPA routing
├── models-config.json           <- OpenRouter model catalog & n8n workflow
├── vite.config.ts               <- Vite build config
├── wrangler.toml                <- Cloudflare Pages config
└── package.json                 <- Dependencies & scripts
```

## Model Routing Tiers

| Level | Tier | Use Case | Example Models |
|-------|------|----------|----------------|
| L3 | Free | Micro tasks | xiaomi/mimo-v2-flash, mistral/devstral-2-2512:free |
| L2 | Ultra-Low | Specialist tasks | deepseek/v3.2, minimax/m2.1 |
| L1 | Budget | Role agents | google/gemini-3-flash-preview, bytedance/seed-1.6 |
| L0 | Standard | Orchestrator | anthropic/claude-sonnet-4, openai/gpt-5.2 |
| Critical | Premium | Review | anthropic/claude-opus-4.6, openai/gpt-5.2-pro |

## Agent Model Mapping

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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | Worker API URL (default: `https://cf-ai-workspace.ourark.workers.dev`) |

## License

MIT
