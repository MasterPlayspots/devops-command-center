import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, Bot, BarChart3, Cpu, Globe, Zap, Shield, Settings,
  Play, Pause, RotateCcw, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, DollarSign, Layers, Send, ArrowUpRight, ArrowDownRight,
  Workflow, Database, HardDrive, Server, RefreshCw, X, GripVertical,
  Brain, Code2, Palette, TestTube2, Wrench, Package, BookOpen
} from 'lucide-react';
import modelsConfig from '../models-config.json';

// ─── TYPES ──────────────────────────────────────────────────
interface DashboardStats {
  total_users: number;
  total_bots: number;
  total_conversations: number;
  total_messages: number;
  active_bots: number;
  bots_today: number;
  tokens_today: number;
  cost_today_cents: number;
}

interface BotData {
  id: number;
  name: string;
  description: string;
  model: string;
  status: string;
  category: string;
  total_runs: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_cents: number;
  daily_runs: number;
  max_actions_per_hour: number;
  budget_cents_daily: number;
  created_at: string;
}

interface CostData {
  today_cents: number;
  week_cents: number;
  month_cents: number;
  by_model: Record<string, number>;
  by_bot: Record<string, number>;
}

interface HealthData {
  status: string;
  worker: string;
  d1: string;
  kv: string;
  uptime: string;
}

type KanbanStatus = 'backlog' | 'in_progress' | 'review' | 'done';

interface KanbanTask {
  id: string;
  title: string;
  agent: string;
  tier: string;
  status: KanbanStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created: string;
}

type TabId = 'dashboard' | 'models' | 'agents' | 'kanban' | 'costs' | 'infra' | 'settings';

// ─── CONFIG ─────────────────────────────────────────────────
// API-Calls gehen über den Pages Functions Proxy (/api/*)
// Die Worker-URL bleibt serverseitig in env.API_UPSTREAM
const API_BASE = '';

const TIER_COLORS: Record<string, string> = {
  free: '#10b981',
  'ultra-low': '#3b82f6',
  budget: '#8b5cf6',
  standard: '#f59e0b',
  premium: '#ef4444',
};

const TIER_BG: Record<string, string> = {
  free: 'rgba(16,185,129,0.12)',
  'ultra-low': 'rgba(59,130,246,0.12)',
  budget: 'rgba(139,92,246,0.12)',
  standard: 'rgba(245,158,11,0.12)',
  premium: 'rgba(239,68,68,0.12)',
};

const AGENT_ICONS: Record<string, typeof Brain> = {
  orchestrator: Brain,
  product: BookOpen,
  architect: Layers,
  backend: Code2,
  frontend: Palette,
  qa: TestTube2,
  devops: Wrench,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#3b82f6',
  high: '#f59e0b',
  critical: '#ef4444',
};

// ─── HELPER ─────────────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── COMPONENTS ─────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, trend }: {
  icon: typeof Activity; label: string; value: string | number; sub?: string; trend?: 'up' | 'down';
}) {
  return (
    <div style={styles.statCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={styles.statIcon}><Icon size={18} /></div>
        {trend && (
          <span style={{ color: trend === 'up' ? '#10b981' : '#ef4444', fontSize: 13 }}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          </span>
        )}
      </div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
      {sub && <div style={styles.statSub}>{sub}</div>}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span style={{
      background: TIER_BG[tier] || '#1e293b',
      color: TIER_COLORS[tier] || '#94a3b8',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    }}>
      {tier}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: PRIORITY_COLORS[priority] || '#6b7280',
      display: 'inline-block', marginRight: 6,
    }} />
  );
}

// ─── TAB: DASHBOARD ─────────────────────────────────────────
function DashboardTab({ stats, health }: { stats: DashboardStats | null; health: HealthData | null }) {
  if (!stats) return <LoadingState />;
  return (
    <div>
      <div style={styles.grid4}>
        <StatCard icon={Bot} label="Active Bots" value={stats.active_bots} sub={`${stats.total_bots} total`} trend="up" />
        <StatCard icon={Activity} label="Messages Today" value={stats.total_messages.toLocaleString()} trend="up" />
        <StatCard icon={Zap} label="Tokens Today" value={`${(stats.tokens_today / 1000).toFixed(1)}K`} />
        <StatCard icon={DollarSign} label="Cost Today" value={formatCents(stats.cost_today_cents)} trend="down" />
      </div>

      <h3 style={styles.sectionTitle}>System Health</h3>
      <div style={styles.grid4}>
        {[
          { name: 'Worker', status: health?.worker || 'checking', icon: Server },
          { name: 'D1 Database', status: health?.d1 || 'checking', icon: Database },
          { name: 'KV Store', status: health?.kv || 'checking', icon: HardDrive },
          { name: 'Overall', status: health?.status || 'checking', icon: Shield },
        ].map(s => (
          <div key={s.name} style={{
            ...styles.healthCard,
            borderLeft: `3px solid ${s.status === 'healthy' || s.status === 'ok' ? '#10b981' : s.status === 'checking' ? '#f59e0b' : '#ef4444'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <s.icon size={16} color="#94a3b8" />
              <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{s.name}</span>
            </div>
            <span style={{
              color: s.status === 'healthy' || s.status === 'ok' ? '#10b981' : s.status === 'checking' ? '#f59e0b' : '#ef4444',
              fontSize: 13, fontWeight: 600, textTransform: 'uppercase' as const,
            }}>
              {s.status === 'checking' ? '...' : s.status}
            </span>
          </div>
        ))}
      </div>

      <h3 style={styles.sectionTitle}>Cost Optimization Targets</h3>
      <div style={styles.grid3}>
        {[
          { label: 'Free Tier', target: modelsConfig.cost_optimization.target_free_percentage, color: TIER_COLORS.free },
          { label: 'Ultra-Low', target: modelsConfig.cost_optimization.target_ultra_low_percentage, color: TIER_COLORS['ultra-low'] },
          { label: 'Premium', target: modelsConfig.cost_optimization.target_premium_percentage, color: TIER_COLORS.premium },
        ].map(t => (
          <div key={t.label} style={styles.targetCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#cbd5e1', fontSize: 13 }}>{t.label}</span>
              <span style={{ color: t.color, fontWeight: 700 }}>{t.target}%</span>
            </div>
            <div style={styles.progressBg}>
              <div style={{ ...styles.progressBar, width: `${t.target}%`, background: t.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: MODELS ────────────────────────────────────────────
function ModelsTab() {
  const tiers = Object.entries(modelsConfig.routing_rules);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 24 }}>
        {Object.entries(modelsConfig.cost_optimization).filter(([k]) => !k.startsWith('target')).map(([key, val]) => (
          <span key={key} style={{
            background: val ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: val ? '#10b981' : '#ef4444',
            padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 500,
          }}>
            {key.replace(/_/g, ' ')} {val ? '✓' : '✗'}
          </span>
        ))}
      </div>

      {tiers.map(([key, rule]) => (
        <div key={key} style={styles.modelTierCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TierBadge tier={rule.tier} />
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                {key.replace(/_/g, ' ').replace(/^L\d /, m => m.toUpperCase())}
              </span>
            </div>
            <span style={{ color: '#64748b', fontSize: 12 }}>max {rule.max_tokens.toLocaleString()} tokens</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {rule.models.map((m: string) => (
              <span key={m} style={styles.modelChip}>
                <Cpu size={12} style={{ marginRight: 4 }} />{m.split('/').pop()}
              </span>
            ))}
            {rule.fallback && (
              <span style={{ ...styles.modelChip, borderStyle: 'dashed' }}>
                ↳ fallback: {(rule.fallback as string).split('/').pop()}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TAB: AGENTS ────────────────────────────────────────────
function AgentsTab({ bots }: { bots: BotData[] }) {
  const agentMapping = Object.entries(modelsConfig.agent_model_mapping);
  return (
    <div>
      <h3 style={styles.sectionTitle}>Core Agents (Model Mapping)</h3>
      <div style={styles.grid3}>
        {agentMapping.map(([agent, tier]) => {
          const Icon = AGENT_ICONS[agent] || Bot;
          return (
            <div key={agent} style={styles.agentCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ ...styles.agentIconWrap, background: TIER_BG[tier] }}>
                  <Icon size={18} color={TIER_COLORS[tier]} />
                </div>
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, textTransform: 'capitalize' as const }}>{agent}</div>
                  <TierBadge tier={tier} />
                </div>
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>
                Models: {modelsConfig.routing_rules[
                  Object.keys(modelsConfig.routing_rules).find(k =>
                    modelsConfig.routing_rules[k as keyof typeof modelsConfig.routing_rules].tier === tier
                  ) as keyof typeof modelsConfig.routing_rules
                ]?.models?.length || 0}
              </div>
            </div>
          );
        })}
      </div>

      {bots.length > 0 && (
        <>
          <h3 style={styles.sectionTitle}>Live Bots ({bots.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {bots.slice(0, 10).map(bot => (
              <div key={bot.id} style={styles.botRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: bot.status === 'active' ? '#10b981' : '#64748b',
                  }} />
                  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{bot.name}</span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{bot.model}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#94a3b8' }}>
                  <span>{bot.total_runs} runs</span>
                  <span>{formatCents(bot.total_cost_cents)}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 8,
                    background: bot.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                    color: bot.status === 'active' ? '#10b981' : '#64748b',
                    fontWeight: 500,
                  }}>
                    {bot.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── TAB: KANBAN ────────────────────────────────────────────
function KanbanTab() {
  const [tasks, setTasks] = useState<KanbanTask[]>(() => {
    const stored = localStorage.getItem('devops-kanban');
    return stored ? JSON.parse(stored) : INITIAL_TASKS;
  });
  const [newTask, setNewTask] = useState('');
  const [newAgent, setNewAgent] = useState('orchestrator');

  useEffect(() => {
    localStorage.setItem('devops-kanban', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (!newTask.trim()) return;
    const tier = modelsConfig.agent_model_mapping[newAgent as keyof typeof modelsConfig.agent_model_mapping] || 'budget';
    setTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      title: newTask,
      agent: newAgent,
      tier,
      status: 'backlog',
      priority: 'medium',
      created: new Date().toISOString(),
    }]);
    setNewTask('');
  };

  const moveTask = (id: string, to: KanbanStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: to } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const columns: { id: KanbanStatus; label: string; color: string }[] = [
    { id: 'backlog', label: 'Backlog', color: '#64748b' },
    { id: 'in_progress', label: 'In Progress', color: '#3b82f6' },
    { id: 'review', label: 'Review', color: '#f59e0b' },
    { id: 'done', label: 'Done', color: '#10b981' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          style={styles.input}
          placeholder="New task..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
        />
        <select style={styles.select} value={newAgent} onChange={e => setNewAgent(e.target.value)}>
          {Object.keys(modelsConfig.agent_model_mapping).map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button style={styles.btnPrimary} onClick={addTask}>
          <Send size={14} /> Add
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {columns.map(col => (
          <div key={col.id} style={styles.kanbanCol}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: col.color, fontWeight: 700, fontSize: 13, textTransform: 'uppercase' as const }}>
                {col.label}
              </span>
              <span style={styles.countBadge}>{tasks.filter(t => t.status === col.id).length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, minHeight: 100 }}>
              {tasks.filter(t => t.status === col.id).map(task => (
                <div key={task.id} style={styles.kanbanCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <GripVertical size={12} color="#475569" />
                      <PriorityDot priority={task.priority} />
                    </div>
                    <button style={styles.btnGhost} onClick={() => deleteTask(task.id)}><X size={12} /></button>
                  </div>
                  <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, margin: '6px 0' }}>{task.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: 11, textTransform: 'capitalize' as const }}>{task.agent}</span>
                    <TierBadge tier={task.tier} />
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {columns.filter(c => c.id !== task.status).map(c => (
                      <button key={c.id} style={{ ...styles.btnMini, borderColor: c.color, color: c.color }}
                        onClick={() => moveTask(task.id, c.id)}>
                        {c.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: COSTS ─────────────────────────────────────────────
function CostsTab({ costs }: { costs: CostData | null }) {
  const monthlyProjection = costs ? (costs.month_cents / 100) : 0;
  const dailyAvg = monthlyProjection / 30;
  return (
    <div>
      <div style={styles.grid3}>
        <StatCard icon={DollarSign} label="Today" value={costs ? formatCents(costs.today_cents) : '...'} />
        <StatCard icon={BarChart3} label="This Week" value={costs ? formatCents(costs.week_cents) : '...'} />
        <StatCard icon={Activity} label="This Month" value={costs ? formatCents(costs.month_cents) : '...'} />
      </div>

      <h3 style={styles.sectionTitle}>Monthly Projection</h3>
      <div style={styles.projectionCard}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#e2e8f0' }}>${monthlyProjection.toFixed(2)}</div>
        <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          ~${dailyAvg.toFixed(2)}/day avg • Target: 70% free tier
        </div>
        <div style={{ ...styles.progressBg, marginTop: 16 }}>
          <div style={{ ...styles.progressBar, width: '70%', background: TIER_COLORS.free }} />
          <div style={{ ...styles.progressBar, width: '20%', background: TIER_COLORS['ultra-low'], position: 'absolute' as const, left: '70%' }} />
          <div style={{ ...styles.progressBar, width: '10%', background: TIER_COLORS.premium, position: 'absolute' as const, left: '90%' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#94a3b8' }}>
          <span><span style={{ color: TIER_COLORS.free }}>●</span> Free 70%</span>
          <span><span style={{ color: TIER_COLORS['ultra-low'] }}>●</span> Ultra-Low 20%</span>
          <span><span style={{ color: TIER_COLORS.premium }}>●</span> Premium 10%</span>
        </div>
      </div>

      {costs?.by_model && Object.keys(costs.by_model).length > 0 && (
        <>
          <h3 style={styles.sectionTitle}>Cost by Model</h3>
          {Object.entries(costs.by_model).sort(([, a], [, b]) => b - a).map(([model, cents]) => (
            <div key={model} style={styles.costRow}>
              <span style={{ color: '#cbd5e1', fontSize: 13 }}>{model}</span>
              <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 13 }}>{formatCents(cents)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── TAB: INFRASTRUCTURE ────────────────────────────────────
function InfraTab({ health }: { health: HealthData | null }) {
  return (
    <div>
      <h3 style={styles.sectionTitle}>Cloudflare Stack</h3>
      <div style={styles.grid2}>
        {[
          { name: 'Workers', desc: 'cf-ai-workspace', icon: Server, status: health?.worker || 'checking' },
          { name: 'D1 Database', desc: 'cf-ai-workspace-db (37 tables)', icon: Database, status: health?.d1 || 'checking' },
          { name: 'KV Namespace', desc: 'cf-ai-workspace-SESSIONS', icon: HardDrive, status: health?.kv || 'checking' },
          { name: 'Pages', desc: 'DevOps Command Center', icon: Globe, status: 'deploying' },
        ].map(s => (
          <div key={s.name} style={styles.infraCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={styles.infraIcon}><s.icon size={20} color="#3b82f6" /></div>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{s.name}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{s.desc}</div>
              </div>
            </div>
            <span style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
              background: s.status === 'healthy' || s.status === 'ok' ? 'rgba(16,185,129,0.12)' : s.status === 'deploying' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)',
              color: s.status === 'healthy' || s.status === 'ok' ? '#10b981' : s.status === 'deploying' ? '#3b82f6' : '#f59e0b',
            }}>
              {s.status}
            </span>
          </div>
        ))}
      </div>

      <h3 style={styles.sectionTitle}>OpenRouter Integration</h3>
      <div style={styles.infraCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.infraIcon}><Workflow size={20} color="#8b5cf6" /></div>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 600 }}>OpenRouter API</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>{modelsConfig.openrouter_endpoint}</div>
          </div>
        </div>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>
          {Object.values(modelsConfig.routing_rules).flatMap(r => r.models).length} models configured
        </span>
      </div>

      <h3 style={styles.sectionTitle}>n8n Workflow</h3>
      <div style={styles.infraCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.infraIcon}><Workflow size={20} color="#f59e0b" /></div>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{modelsConfig.n8n_workflow_template.name}</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>
              {modelsConfig.n8n_workflow_template.nodes.length} nodes • Webhook → Classify → Route
            </div>
          </div>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
          background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
        }}>
          TEMPLATE
        </span>
      </div>
    </div>
  );
}

// ─── TAB: SETTINGS ──────────────────────────────────────────
function SettingsTab({ apiBase, setApiBase }: { apiBase: string; setApiBase: (v: string) => void }) {
  return (
    <div>
      <h3 style={styles.sectionTitle}>API Connection</h3>
      <div style={styles.settingRow}>
        <label style={{ color: '#94a3b8', fontSize: 13 }}>Worker API Base URL</label>
        <input style={styles.input} value={apiBase} onChange={e => setApiBase(e.target.value)} />
      </div>

      <h3 style={styles.sectionTitle}>Routing Features</h3>
      {Object.entries(modelsConfig.cost_optimization).map(([key, val]) => (
        <div key={key} style={styles.settingRow}>
          <span style={{ color: '#cbd5e1', fontSize: 13 }}>{key.replace(/_/g, ' ')}</span>
          <span style={{
            color: typeof val === 'boolean' ? (val ? '#10b981' : '#ef4444') : '#f59e0b',
            fontWeight: 600, fontSize: 13,
          }}>
            {typeof val === 'boolean' ? (val ? 'Enabled' : 'Disabled') : `${val}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── LOADING STATE ──────────────────────────────────────────
function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#64748b' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 10 }} />
      Loading data from Worker API...
    </div>
  );
}

// ─── INITIAL KANBAN DATA ────────────────────────────────────
const INITIAL_TASKS: KanbanTask[] = [
  { id: '1', title: 'Fix NEXT_PUBLIC_ env exposure', agent: 'devops', tier: 'ultra-low', status: 'backlog', priority: 'critical', created: new Date().toISOString() },
  { id: '2', title: 'Add localStorage encryption', agent: 'backend', tier: 'ultra-low', status: 'backlog', priority: 'critical', created: new Date().toISOString() },
  { id: '3', title: 'Implement Zod validation', agent: 'backend', tier: 'ultra-low', status: 'backlog', priority: 'high', created: new Date().toISOString() },
  { id: '4', title: 'Set up Vitest + first tests', agent: 'qa', tier: 'budget', status: 'backlog', priority: 'critical', created: new Date().toISOString() },
  { id: '5', title: 'Deploy to Cloudflare Pages', agent: 'devops', tier: 'ultra-low', status: 'in_progress', priority: 'high', created: new Date().toISOString() },
  { id: '6', title: 'Error boundary component', agent: 'frontend', tier: 'ultra-low', status: 'backlog', priority: 'medium', created: new Date().toISOString() },
];

// ─── MAIN COMPONENT ─────────────────────────────────────────
export default function DevOpsCommandCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bots, setBots] = useState<BotData[]>([]);
  const [costs, setCosts] = useState<CostData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [apiBase, setApiBase] = useState(API_BASE);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [statsRes, botsRes, costsRes, healthRes] = await Promise.allSettled([
        apiFetch<DashboardStats>('/api/dashboard'),
        apiFetch<{ bots: BotData[] }>('/api/bots'),
        apiFetch<CostData>('/api/dashboard/costs'),
        apiFetch<HealthData>('/api/dashboard/health'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (botsRes.status === 'fulfilled') setBots(botsRes.value.bots || []);
      if (costsRes.status === 'fulfilled') setCosts(costsRes.value);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'models', label: 'Models', icon: Cpu },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'kanban', label: 'Kanban', icon: Layers },
    { id: 'costs', label: 'Costs', icon: DollarSign },
    { id: 'infra', label: 'Infrastructure', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; background: #0c0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        input:focus, select:focus { outline: none; border-color: #3b82f6; }
      `}</style>

      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.logo}>
            <Zap size={20} color="#3b82f6" />
          </div>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 18 }}>DevOps Command Center</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Smart Model Routing • {Object.values(modelsConfig.routing_rules).flatMap(r => r.models).length} Models • 7 Agents</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {error && (
            <span style={{ color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={14} /> API Error
            </span>
          )}
          <span style={{ color: '#475569', fontSize: 11 }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button style={styles.btnRefresh} onClick={fetchAll}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={styles.tabBar}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={styles.content}>
        {activeTab === 'dashboard' && <DashboardTab stats={stats} health={health} />}
        {activeTab === 'models' && <ModelsTab />}
        {activeTab === 'agents' && <AgentsTab bots={bots} />}
        {activeTab === 'kanban' && <KanbanTab />}
        {activeTab === 'costs' && <CostsTab costs={costs} />}
        {activeTab === 'infra' && <InfraTab health={health} />}
        {activeTab === 'settings' && <SettingsTab apiBase={apiBase} setApiBase={setApiBase} />}
      </div>
    </div>
  );
}

// ─── STYLES ─────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#0c0f1a',
    color: '#e2e8f0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #1e293b',
    background: '#0f1225',
  },
  logo: {
    width: 40, height: 40,
    borderRadius: 10,
    background: 'rgba(59,130,246,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    padding: '0 24px',
    borderBottom: '1px solid #1e293b',
    background: '#0f1225',
    overflowX: 'auto' as const,
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '12px 16px',
    background: 'none', border: 'none',
    color: '#64748b', cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  },
  tabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6',
  },
  content: {
    padding: 24,
    maxWidth: 1200,
    margin: '0 auto',
  },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 },
  statCard: {
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: 16,
  },
  statIcon: {
    width: 32, height: 32, borderRadius: 8,
    background: 'rgba(59,130,246,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#3b82f6',
  },
  statValue: { fontSize: 24, fontWeight: 700, color: '#e2e8f0', marginTop: 10 },
  statLabel: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  statSub: { color: '#475569', fontSize: 11, marginTop: 2 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 12, marginTop: 8 },
  healthCard: {
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  progressBg: { height: 6, borderRadius: 3, background: '#1e293b', position: 'relative' as const, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3, position: 'absolute' as const, top: 0, left: 0, transition: 'width 0.3s' },
  targetCard: { background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 16 },
  modelTierCard: { background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 12 },
  modelChip: {
    display: 'inline-flex', alignItems: 'center',
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 8, padding: '4px 10px',
    color: '#cbd5e1', fontSize: 12, fontWeight: 500,
  },
  agentCard: { background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 16 },
  agentIconWrap: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  botRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#111827', border: '1px solid #1e293b',
    borderRadius: 10, padding: '10px 16px',
  },
  kanbanCol: { background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 12 },
  kanbanCard: { background: '#0c0f1a', border: '1px solid #1e293b', borderRadius: 10, padding: 10 },
  countBadge: {
    background: '#1e293b', color: '#94a3b8',
    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
  },
  input: {
    flex: 1, padding: '8px 12px',
    background: '#111827', border: '1px solid #1e293b',
    borderRadius: 8, color: '#e2e8f0', fontSize: 13,
  },
  select: {
    padding: '8px 12px',
    background: '#111827', border: '1px solid #1e293b',
    borderRadius: 8, color: '#e2e8f0', fontSize: 13,
  },
  btnPrimary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px',
    background: '#3b82f6', border: 'none',
    borderRadius: 8, color: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnGhost: {
    background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2,
  },
  btnMini: {
    background: 'none', border: '1px solid #334155',
    borderRadius: 6, padding: '2px 6px',
    color: '#94a3b8', fontSize: 10, cursor: 'pointer',
  },
  btnRefresh: {
    background: 'rgba(59,130,246,0.12)', border: 'none',
    borderRadius: 8, padding: 8,
    color: '#3b82f6', cursor: 'pointer',
  },
  projectionCard: { background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24, marginBottom: 24 },
  costRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid #1e293b',
  },
  infraCard: {
    background: '#111827', border: '1px solid #1e293b',
    borderRadius: 12, padding: '16px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  infraIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(59,130,246,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  settingRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 0', borderBottom: '1px solid #1e293b',
  },
};
