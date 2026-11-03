export type Stamp = number

declare module 'claude-code' {
  interface PluginState {
    'undertone': { stamps: StateFamily<number>; open: StateFamily<boolean>; times: Record<string, number> | null; images: Record<string, { path: string; w?: number; h?: number }> | null; more: StateFamily<boolean>; prev: Record<string, number> | null
      pins: Record<string, { who: string; text: string; ms?: number }> | null
      themeName: string | null
      turns: Record<string, { tools: number; failed: number; inTok: number; outTok: number; usd?: number; endMs: number; agents?: number; agentTools?: number; tests?: 'pass' | 'fail'; byTool?: Record<string, number> }> | null
      viewFile: string | null
      turnTools: number | null
      ctx: number | null
      cutoff: { ms: number; hidden: number } | null
      showOld: boolean | null
      enabled: boolean | null
      turn: { tools: number; failed: number; usdStart: number | null; agents?: number; agentTools?: number; tests?: 'pass' | 'fail'; byTool?: Record<string, number> } | null
      setup: { step: number; draft: Record<string, string> } | null
      reactions: Record<string, string[]> | null
      reactOpen: StateFamily<boolean>
      lastPrompt: { key: string; read: boolean } | null
      agentRun: StateFamily<{ status: 'background' | 'done' | 'stopped' }>
    }
  }
}
