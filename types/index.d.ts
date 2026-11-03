export type Stamp = number

declare module 'claude-code' {
  interface PluginState {
    'undertone': { stamps: StateFamily<number>; open: StateFamily<boolean>; times: Record<string, number> | null; images: Record<string, { path: string }> | null; more: StateFamily<boolean>; prev: Record<string, number> | null
      pins: Record<string, { who: string; text: string; ms?: number }> | null
      themeName: string | null
      turns: Record<string, { tools: number; failed: number; inTok: number; outTok: number; usd?: number; endMs: number }> | null
      viewFile: string | null
      turnTools: number | null
      ctx: number | null
      cutoff: { ms: number; hidden: number } | null
      showOld: boolean | null
      enabled: boolean | null
      turn: { tools: number; failed: number; usdStart: number | null } | null
      setup: { step: number; draft: Record<string, string> } | null
    }
  }
}
