import type { ElementTable, EngineInterface, Register, RenderInput, RenderSurface } from 'claude-code'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STAMPS = { plugin: 'undertone', key: 'stamps' } as const
const TIMES = { plugin: 'undertone', key: 'times' } as const
const OPEN = { plugin: 'undertone', key: 'open' } as const
const IMAGES = { plugin: 'undertone', key: 'images' } as const
const MORE = { plugin: 'undertone', key: 'more' } as const
const PREV = { plugin: 'undertone', key: 'prev' } as const
const PINS = { plugin: 'undertone', key: 'pins' } as const
const THEME_NAME = { plugin: 'undertone', key: 'themeName' } as const
const TURNS = { plugin: 'undertone', key: 'turns' } as const
const VIEW_FILE = { plugin: 'undertone', key: 'viewFile' } as const
const TURN_TOOLS = { plugin: 'undertone', key: 'turnTools' } as const
// The running turn's counts live in session state, so a reload mid-turn doesn't reset them.
const TURN = { plugin: 'undertone', key: 'turn' } as const
const CTX = { plugin: 'undertone', key: 'ctx' } as const
const CUTOFF = { plugin: 'undertone', key: 'cutoff' } as const
const SHOW_OLD = { plugin: 'undertone', key: 'showOld' } as const
const FILE_PANE = 'undertone-file'
const ENABLED = { plugin: 'undertone', key: 'enabled' } as const
const SETUP = { plugin: 'undertone', key: 'setup' } as const
const SETUP_PANE = 'undertone-setup'
const REACTIONS = { plugin: 'undertone', key: 'reactions' } as const
const REACT_OPEN = { plugin: 'undertone', key: 'reactOpen' } as const
// Your latest prompt and whether Claude has started on it (read receipts, quick replies).
const LAST_PROMPT = { plugin: 'undertone', key: 'lastPrompt' } as const
// A background agent's run, by the tool_use_id that started it: the engine never redraws that
// row when the agent ends, so the row reads this and the write redraws it.
const AGENT_RUN = { plugin: 'undertone', key: 'agentRun' } as const

// ---------- Theme system ----------
// A theme is a full "look": per side (you / Claude) a bubble shape, border, label, fill,
// text colour, name and icon; plus padding, spacing, alignment, divider and chip colours.
// Presets bundle looks; every knob can be overridden from /config (empty / "preset" = keep).
type Shape = 'round' | 'single' | 'double' | 'bold' | 'dashed' | 'classic' | 'quote' | 'none'
// Friendly names → the terminal's border styles.
const SHAPES: Record<string, Shape> = { rounded: 'round', sharp: 'single', double: 'double', bold: 'bold', dashed: 'dashed', ascii: 'classic', bar: 'quote', none: 'none', chevron: 'none' }
type Side = { shape: Shape; border: string; label: string; fill?: string; text?: string; name: string; icon: string; chevron?: boolean }
type Look = { desc: string; user: Side; claude: Side; padding: number; spacing: number; userAlign: 'right' | 'left'; divider: string; chip: string; chipHover: string }
const side = (shape: Shape, color: string, name: string, extra: Partial<Side> = {}): Side => ({ shape, border: color, label: color, name, icon: '', ...extra })
const look = (desc: string, user: Side, claude: Side, extra: Partial<Look> = {}): Look =>
  ({ desc, user, claude, padding: 1, spacing: 1, userAlign: 'right', divider: '─', chip: user.border, chipHover: claude.border, ...extra })
const THEMES: Record<string, Look> = {
  // Shapes — your terminal's own colours, so they follow its light/dark theme.
  default: look('Rounded bubbles in Claude Code colours', side('round', 'suggestion', 'You'), side('round', 'claude', 'Claude'), { chipHover: 'permission' }),
  sharp: look('Square corners, same colours', side('single', 'suggestion', 'You'), side('single', 'claude', 'Claude'), { chipHover: 'permission' }),
  double: look('Double-line frames, formal', side('double', 'suggestion', 'You'), side('double', 'claude', 'Claude'), { chipHover: 'permission' }),
  bold: look('Heavy frames, high contrast', side('bold', '#FFD54F', 'You'), side('bold', '#FF7A70', 'Claude'), { chip: '#B8860B' }),
  dashed: look('Light dashed frames', side('dashed', 'suggestion', 'You'), side('dashed', 'claude', 'Claude'), { chipHover: 'permission' }),
  minimal: look('A coloured bar on the left, nothing else', side('quote', 'suggestion', 'you', { icon: '›' }), side('quote', 'claude', 'claude', { icon: '✻' }), { padding: 1, chipHover: 'permission' }),
  terminal: look('ASCII frames, one column, like a log', side('classic', 'text', 'you', { icon: '$' }), side('classic', 'subtle', 'claude', { icon: '#' }), { userAlign: 'left', divider: '-', chip: 'subtle', chipHover: 'text' }),
  mono: look('No colour at all', side('round', 'text', 'You'), side('round', 'subtle', 'Claude'), { chip: 'subtle', chipHover: 'text' }),
  // Filled bubbles, like a messaging app (best on dark terminals).
  messenger: look('Filled bubbles, no frames — dark', side('none', '#FFFFFF', 'You', { fill: '#1F6FEB', text: '#FFFFFF' }), side('none', '#E8C4A8', 'Claude', { fill: '#2B2D31', text: '#E6E6E6' }), { chip: '#0B4FB3', chipHover: '#3B8BFF' }),
  'messenger-light': look('Filled bubbles, no frames — light', side('none', '#FFFFFF', 'You', { fill: '#1F6FEB', text: '#FFFFFF' }), side('none', '#8A3B12', 'Claude', { fill: '#ECEBE8', text: '#1F1F1F' }), { chip: '#0B4FB3', chipHover: '#3B8BFF' }),
}

// Colour presets inspired by popular editor / terminal themes:
// [name, description, you, Claude, surface (bubble fill), text, shape?, divider?]
// "you"/"Claude" are the theme's two signature accents; surface/text drive the filled style.
type PaletteRow = [string, string, string, string, string, string, Shape?, string?]
const PALETTES: PaletteRow[] = [
  ['dracula', 'Purple night', '#BD93F9', '#FF79C6', '#44475A', '#F8F8F2'],
  ['catppuccin-mocha', 'Pastel, dark', '#89B4FA', '#F5C2E7', '#313244', '#CDD6F4'],
  ['catppuccin-macchiato', 'Pastel, dusk', '#8AADF4', '#F5BDE6', '#363A4F', '#CAD3F5'],
  ['catppuccin-latte', 'Pastel, light', '#1E66F5', '#EA76CB', '#DCE0E8', '#4C4F69'],
  ['tokyo-night', 'Neon city blues', '#7AA2F7', '#BB9AF7', '#24283B', '#C0CAF5'],
  ['nord', 'Arctic, muted', '#88C0D0', '#B48EAD', '#3B4252', '#ECEFF4'],
  ['gruvbox', 'Retro warm, dark', '#83A598', '#FE8019', '#3C3836', '#EBDBB2', 'single'],
  ['gruvbox-light', 'Retro warm, light', '#076678', '#AF3A03', '#EBDBB2', '#3C3836', 'single'],
  ['solarized-dark', 'Solarized accents, dark', '#268BD2', '#CB4B16', '#073642', '#EEE8D5'],
  ['solarized-light', 'Solarized accents, light', '#268BD2', '#CB4B16', '#EEE8D5', '#073642'],
  ['one-dark', 'Atom One Dark', '#61AFEF', '#C678DD', '#2C313A', '#ABB2BF'],
  ['monokai', 'Classic Monokai', '#66D9EF', '#F92672', '#3E3D32', '#F8F8F2', 'single'],
  ['github-dark', 'GitHub dark', '#58A6FF', '#D2A8FF', '#21262D', '#C9D1D9'],
  ['github-light', 'GitHub light', '#0969DA', '#8250DF', '#EAEEF2', '#24292F'],
  ['rose-pine', 'Rosé Pine, soho vibes', '#9CCFD8', '#EBBCBA', '#26233A', '#E0DEF4', 'round', '·'],
  ['rose-pine-dawn', 'Rosé Pine, dawn', '#56949F', '#D7827E', '#F2E9E1', '#575279', 'round', '·'],
  ['everforest', 'Soft forest greens', '#7FBBB3', '#DBBC7F', '#374145', '#D3C6AA'],
  ['kanagawa', 'Ink-wash wave', '#7E9CD8', '#E46876', '#2A2A37', '#DCD7BA'],
  ['ayu', 'Ayu Mirage', '#73D0FF', '#FFAD66', '#2A3546', '#CCCAC2'],
  ['night-owl', 'For night coders', '#82AAFF', '#C792EA', '#1D3B53', '#D6DEEB'],
  ['palenight', 'Material Palenight', '#82AAFF', '#C792EA', '#34324A', '#A6ACCD'],
  ['synthwave-84', 'Retro neon', '#36F9F6', '#FF7EDB', '#34294F', '#FFFFFF', 'double'],
  ['cobalt2', 'Cobalt2 by Wes Bos', '#0088FF', '#FFC600', '#1F4662', '#FFFFFF', 'bold'],
  ['horizon', 'Warm horizon', '#25B0BC', '#E95678', '#2E303E', '#D5D8DA'],
  ['material', 'Material ocean', '#82AAFF', '#F78C6C', '#263238', '#EEFFFF'],
  ['tomorrow-night', 'Tomorrow Night', '#81A2BE', '#B294BB', '#373B41', '#C5C8C6'],
  ['ocean', 'Calm blues and teal', '#4FC3F7', '#26A69A', '#123642', '#E0F7FA', 'round', '≈'],
  ['forest', 'Greens and bark', '#81C784', '#D4A373', '#25331F', '#E8F5E9'],
  ['sunset', 'Warm coral and violet', '#FF8A65', '#BA68C8', '#3A2433', '#FFE0D6'],
]
const SURFACE: Record<string, { surface: string; text: string }> = {}
for (const [name, desc, you, claude, surface, text, shape = 'round', divider = '─'] of PALETTES) {
  THEMES[name] = look(desc, side(shape, you, 'You'), side(shape, claude, 'Claude'), { chip: you, chipHover: claude, divider })
  SURFACE[name] = { surface, text }
}

// Light and dark versions of one look, for "Light by day, dark by night".
const DAY_NIGHT: [day: string, night: string][] = [
  ['messenger-light', 'messenger'], ['catppuccin-latte', 'catppuccin-mocha'], ['gruvbox-light', 'gruvbox'],
  ['solarized-light', 'solarized-dark'], ['github-light', 'github-dark'], ['rose-pine-dawn', 'rose-pine'],
]
// The pair's day or night side for the local hour; hours "7-19" = day from 07:00 to 18:59 (and "20-6" wraps).
function dayOrNight(name: string, nowMs: number, offMin: number, hours: string) {
  const pair = DAY_NIGHT.find(p => p.includes(name))
  if (!pair) return name
  const m = /^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/.exec(hours)
  const [a, b] = m ? [Number(m[1]) % 24, Number(m[2]) % 24] : [7, 19]
  const h = new Date(nowMs + offMin * 60_000).getUTCHours()
  return (a <= b ? h >= a && h < b : h >= a || h < b) ? pair[0] : pair[1]
}

type Theme = Look & { tableStyle: TableStyle; name: string; userShare: number; claudeShare: number; foldLines: number; gapMs: number; preciseTime: boolean; foldTurns: number }
let opts: Readonly<Record<string, unknown>> = {}
// An option reader; `mkOpt(draft)` layers unsaved /undertone setup choices over the options.
type Opt = <T>(k: string, fallback: T) => T
const mkOpt = (d?: Record<string, unknown>): Opt => <T,>(k: string, fallback: T): T => {
  const v = d && k in d ? d[k] : opts[k]
  return v === undefined || v === '' || v === 'preset' ? fallback : (v as T)
}
const opt: Opt = mkOpt()

// ---------- Colours ----------
// A colour setting is a hex code, rgb(), ansi256(), a terminal colour name, or one of Claude
// Code's theme keys. Anything else (a typo) is ignored: an invalid colour would make Claude
// Code refuse the whole bubble.
const THEME_KEYS = ['text', 'inverseText', 'inactive', 'subtle', 'suggestion', 'remember', 'success', 'error', 'warning', 'merged', 'claude', 'permission', 'planMode', 'autoAccept', 'promptBorder', 'bashBorder', 'ide']
const COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|ansi256\(\d{1,3}\)|(black|red|green|yellow|blue|magenta|cyan|white|gray|grey)(Bright)?)$/i
const isColor = (v: unknown): v is string => typeof v === 'string' && (COLOR_RE.test(v.trim()) || THEME_KEYS.includes(v.trim()))
const optColor = (k: string, fallback: string | undefined, o: Opt = opt) => { const v = o<unknown>(k, undefined); return isColor(v) ? v.trim() : fallback }
// Relative lightness of a hex / rgb() colour, 0..1; undefined for names and theme keys.
function luma(c: string | undefined) {
  if (!c) return undefined
  let rgb: number[] | undefined
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  if (h) { const x = h[1]!.length === 3 ? h[1]!.split('').map(d => d + d).join('') : h[1]!; rgb = [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)) }
  const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(c)
  if (m) rgb = [m[1], m[2], m[3]].map(Number)
  return rgb ? (0.299 * rgb[0]! + 0.587 * rgb[1]! + 0.114 * rgb[2]!) / 255 : undefined
}
// Ink that reads on a fill: keep `color` when it contrasts enough, else black or white.
function readableOn(fill: string | undefined, color: string | undefined) {
  const f = luma(fill)
  if (f === undefined) return color
  const c = luma(color)
  if (c !== undefined && Math.abs(c - f) >= 0.4) return color
  return f > 0.55 ? '#111111' : '#FFFFFF'
}
const PADDING: Record<string, number> = { compact: 0, normal: 1, roomy: 2 }
const SPACING: Record<string, number> = { tight: 0, normal: 1, airy: 2 }
// Side overrides from /config: <prefix>Shape, <prefix>Color, <prefix>Fill, <prefix>TextColor, <prefix>Label, <prefix>Icon.
function overrideSide(base: Side, prefix: 'user' | 'claude', o: Opt = opt): Side {
  const color = optColor(prefix + 'Color', undefined, o)
  const fill = o<string>(prefix + 'Fill', '') === 'none' ? undefined : optColor(prefix + 'Fill', base.fill, o)
  const ownText = optColor(prefix + 'TextColor', undefined, o)
  // Text and label you didn't set yourself are adjusted to stay readable on the fill.
  const text = ownText ?? (fill ? readableOn(fill, base.text) : base.text)
  return {
    shape: SHAPES[o<string>(prefix + 'Shape', '')] ?? base.shape,
    chevron: o<string>(prefix + 'Shape', '') === 'chevron',
    border: color ?? base.border,
    label: fill ? readableOn(fill, color ?? base.label) ?? text ?? base.label : color ?? base.label,
    fill,
    text,
    name: String(o(prefix + 'Label', base.name)).slice(0, 24),
    icon: String(o(prefix + 'Icon', base.icon)).slice(0, 2),
  }
}
// `random` picks a dark preset once per load (session start or reload).
let randomTheme: string | undefined
function lookOf(name: string, o: Opt = opt): Look {
  const base = THEMES[name] ?? THEMES.default!
  const style = o<string>('bubbleStyle', 'preset')
  if (style === 'filled') {
    // Your bubble: solid accent with dark ink; Claude's: the theme's surface with its text colour.
    const sf = SURFACE[name] ?? { surface: '#2B2D31', text: '#E6E6E6' }
    return { ...base, user: { ...base.user, shape: 'none', fill: base.user.border, text: undefined }, claude: { ...base.claude, shape: 'none', fill: sf.surface, text: sf.text } }
  }
  if (style === 'framed') return { ...base, user: { ...base.user, fill: undefined, text: undefined, shape: base.user.shape === 'none' ? 'round' : base.user.shape }, claude: { ...base.claude, fill: undefined, text: undefined, shape: base.claude.shape === 'none' ? 'round' : base.claude.shape } }
  return base
}
async function themeOf($: EngineInterface, d?: Record<string, unknown>): Promise<Theme> {
  const o = mkOpt(d)
  let picked = (d?.theme as string | undefined) ?? (await $.state.get(THEME_NAME)).value ?? o('theme', 'default')
  if (picked === 'random') { const dark = Object.keys(THEMES).filter(n => !/light|latte|dawn|mono|terminal/.test(n)); picked = (randomTheme ??= dark[Math.floor(Math.random() * dark.length)]!) }
  let name = picked in THEMES ? picked : 'default'
  if (o<unknown>('dayNight', false) === true && offsetMin !== undefined) name = dayOrNight(name, await $.clock.now(), offsetMin, String(o('dayHours', '7-19')))
  const base = lookOf(name, o)
  const pct = (k: string, dflt: number) => Math.min(100, Math.max(20, Number(o(k, dflt)))) / 100
  const labelsOff = o<string>('bubbleLabels', 'on') === 'off' // frames and times, no "You" / "Claude"
  const labels = labelsOff ? { name: '', icon: '' } : o<string>('bubbleLabels', 'on') === 'small' ? { icon: '' } : {} // small: the name, no icon
  const user = { ...overrideSide(base.user, 'user', o), ...labels }
  return {
    ...base,
    name,
    user,
    claude: { ...overrideSide(base.claude, 'claude', o), ...labels },
    chip: optColor('userColor', base.chip, o)!,
    padding: PADDING[o<string>('padding', '')] ?? base.padding,
    spacing: SPACING[o<string>('spacing', '')] ?? base.spacing,
    userAlign: (o<string>('userAlign', base.userAlign) === 'left' ? 'left' : 'right'),
    divider: o<string>('dividerChar', base.divider).slice(0, 1) || '─',
    userShare: pct('userBubbleWidth', 70),
    claudeShare: pct('claudeBubbleWidth', 90),
    foldLines: Math.max(3, Number(o('foldLines', 15))),
    gapMs: Math.max(1, Number(o('gapMinutes', 60))) * 60_000,
    preciseTime: !['short', '24h'].includes(o<string>('timeFormat', 'precise')),
    foldTurns: Math.max(0, Number(o('foldTurns', 10))),
    tableStyle: (o<string>('tableStyle', 'rules') === 'grid' ? 'box' : ['box', 'rules', 'minimal'].includes(o<string>('tableStyle', 'rules')) ? o<string>('tableStyle', 'rules') : 'rules') as TableStyle, // grid: box is a full grid
  }
}
// The Box props that draw one side's bubble.
function bubbleBox(s: Side, padding: number) {
  return {
    flexDirection: 'column' as const,
    ...(s.shape === 'none' ? {} : { borderStyle: s.shape, borderColor: s.border }),
    ...(s.fill ? { backgroundColor: s.fill } : {}),
    paddingX: s.shape === 'quote' ? Math.max(1, padding) : padding,
  }
}
// Cells a bubble adds around its text: borders (0 for none, 1 for the left bar, 2 otherwise) + padding.
const chrome = (s: Side, padding: number) => (s.shape === 'none' ? 0 : s.shape === 'quote' ? 1 : 2) + 2 * (s.shape === 'quote' ? Math.max(1, padding) : padding)
// A timestamp's ink: dim on a plain bubble; on a filled one, the bubble's own text colour
// (a dimmed default would vanish into the fill).
const timeInk = (s: Side) => (s.fill ? { color: s.text ?? readableOn(s.fill, undefined) } : { dimColor: true as const })
const sideLabel = (s: Side) => (s.icon ? s.icon + ' ' : '') + s.name
const rule = (ch: string, n = 6) => ch.repeat(n)
const IMAGE_TOKEN = /\[Image #(\d+)\]/g
// A slash command named in a prompt ("try /undertone-theme"). Only names the engine lists count,
// so a path like /tmp or /Users/me stays plain. ponytail: the list is fetched per row, no cache.
const SLASH = /(^|[\s([{"'`])\/([A-Za-z][\w:.-]*)/g
function slashParts(text: string, names: ReadonlySet<string>): { text: string; cmd?: true }[] {
  const parts: { text: string; cmd?: true }[] = []
  let last = 0
  for (const m of text.matchAll(SLASH)) {
    const name = m[2]!.replace(/[.:-]+$/, '') // "/undertone-theme." ends a sentence
    const start = m.index! + m[1]!.length
    const end = start + 1 + name.length
    if (!names.has(name) || text[end] === '/') continue // not a command, or a path that starts like one
    if (start > last) parts.push({ text: text.slice(last, start) })
    parts.push({ text: '/' + name, cmd: true })
    last = end
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}
// The first field that says what a call did (Bash command, file path, pattern, ...).
// ---------- Tool rows in plain words ----------
// "Ran gh pr view 12", "Read ~/src/app.ts", "Searched src for "todo"". Paths are shown
// relative to the project, or with ~ for home.
const where = { cwd: '', home: '' }
function shortPath(p: string) {
  const norm = (x: string) => x.replace(/\\/g, '/')
  const path = norm(p), cwd = norm(where.cwd), home = norm(where.home)
  if (cwd && (path === cwd || path.startsWith(cwd + '/'))) return path.slice(cwd.length + 1) || '.'
  if (home && path.startsWith(home + '/')) return '~' + path.slice(home.length)
  return path
}
const VERBS: Record<string, string> = { Bash: 'Ran', PowerShell: 'Ran', Read: 'Read', Write: 'Wrote', Edit: 'Edited', MultiEdit: 'Edited', NotebookEdit: 'Edited', WebFetch: 'Fetched', Agent: 'Delegated', Task: 'Delegated' }
function describe(call: { tool: string; input: unknown }) {
  const i = (call.input ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : '')
  const firstLine = (x: string) => x.split('\n')[0]!.trim()
  switch (call.tool) {
    case 'Bash': case 'PowerShell': return `Ran ${firstLine(str('command')) || str('description')}`
    case 'Read': return `Read ${shortPath(str('file_path'))}${typeof i.offset === 'number' ? ` from line ${i.offset}` : ''}`
    case 'Write': case 'Edit': case 'MultiEdit': return `${VERBS[call.tool]} ${shortPath(str('file_path'))}`
    case 'NotebookEdit': return `Edited ${shortPath(str('notebook_path'))}`
    case 'Grep': return `Searched ${str('path') ? shortPath(str('path')) : '.'} for "${str('pattern')}"`
    case 'Glob': return `Listed ${str('pattern')}${str('path') ? ' in ' + shortPath(str('path')) : ''}`
    case 'WebFetch': return `Fetched ${str('url').replace(/^https?:\/\//, '')}`
    case 'WebSearch': return `Searched the web for "${str('query')}"`
    case 'Agent': case 'Task': return `Delegated: ${str('description') || firstLine(str('prompt'))}`
    case 'Skill': return `Loaded skill ${str('skill')}`
    case 'TodoWrite': return 'Updated the todo list'
    case 'AskUserQuestion': { const q = (i.questions as { question?: string }[] | undefined)?.[0]?.question; return q ? `Asked: ${firstLine(q)}` : 'Asked you a question' }
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(call.tool)
  const what = summarize(call.input)
  return mcp ? `${mcp[1]} ${mcp[2]!.replace(/_/g, ' ')}${what ? ': ' + what : ''}` : `${call.tool}${what ? ' ' + what : ''}`
}
// A run of calls in plain words: "ran 3 commands, read 2 files, searched 1 pattern".
function sumUp(calls: readonly { tool: string }[]) {
  const kinds: [RegExp, string, string][] = [
    [/^(Bash|PowerShell)$/, 'ran', 'command'], [/^Read$/, 'read', 'file'], [/^(Edit|MultiEdit|Write|NotebookEdit)$/, 'changed', 'file'],
    [/^Grep$/, 'searched', 'pattern'], [/^Glob$/, 'listed', 'pattern'], [/^Web/, 'fetched', 'page'], [/^(Agent|Task)$/, 'delegated', 'task'],
  ]
  const counts = new Map<string, number>()
  for (const c of calls) {
    const k = kinds.find(([re]) => re.test(c.tool))
    const label = k ? `${k[1]}|${k[2]}` : `used|${c.tool.replace(/^mcp__(.+?)__.*/, '$1')} tool`
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const out = [...counts].map(([label, n]) => { const [verb, noun] = label.split('|'); return `${verb} ${n} ${noun}${n === 1 ? '' : 's'}` }).join(', ')
  return out.charAt(0).toUpperCase() + out.slice(1)
}

const SUMMARY_KEYS = ['description', 'command', 'file_path', 'path', 'pattern', 'skill', 'url', 'query', 'prompt']
function summarize(input: unknown) {
  if (!input || typeof input !== 'object') return ''
  const o = input as Record<string, unknown>
  const k = SUMMARY_KEYS.find(k => typeof o[k] === 'string')
  return k ? String(o[k]) : JSON.stringify(o)
}
const clip = (s: string, n: number) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? one.slice(0, n - 1) + '…' : one
}
// Still running: Claude Code can leave isRunning set on a call whose output has arrived (an Edit
// row), and draws that row once, so a call with its output counts as finished.
const running = (c: { isRunning: boolean; output?: unknown }) => c.isRunning && c.output === undefined
function statusOf(p: { isRunning: boolean; isErrored: boolean; isInterrupted: boolean; output?: unknown }) {
  if (running(p)) return { glyph: '◌', color: undefined }
  if (p.isInterrupted) return { glyph: '⊘', color: 'warning' }
  if (p.isErrored) return { glyph: '✗', color: 'error' }
  return { glyph: '✓', color: undefined }
}

// ponytail: the module's Date may not know the user's zone, so ask the OS once (`date +%z`).
let offsetMin: number | undefined = -new Date().getTimezoneOffset()

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
// Local wall-clock time: "2:41 PM" (or "14:41") today, "Nov 2, 2:41 PM" otherwise.
const fmt = (ms: number, now: number, off: number) => {
  const d = new Date(ms + off * 60_000)
  const today = new Date(now + off * 60_000)
  const h = d.getUTCHours()
  const time = opt<string>('timeFormat', 'precise') === '24h' ? `${pad(h)}:${pad(d.getUTCMinutes())}` : `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  const sameDay = d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)
  return sameDay ? time : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${time}`
}
// Bubble time: "4:47:12.345 PM UTC+8" (date prefix when not today).
const zone = (off: number) => 'UTC' + (off < 0 ? '-' : '+') + Math.floor(Math.abs(off) / 60) + (Math.abs(off) % 60 ? ':' + pad(Math.abs(off) % 60) : '')
const fmtPrecise = (ms: number, now: number, off: number) => {
  const d = new Date(ms + off * 60_000)
  const h = d.getUTCHours()
  const time = `${h % 12 || 12}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)} ${h < 12 ? 'AM' : 'PM'} ${zone(off)}`
  const sameDay = d.toISOString().slice(0, 10) === new Date(now + off * 60_000).toISOString().slice(0, 10)
  return sameDay ? time : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${time}`
}

// Bubble look: outline colour per speaker, and the most of the width a bubble may take.

// Shrink-wrap: longest line + border/padding (4), capped at a share of the terminal.
// ponytail: counts chars, not display cells; wide emoji/CJK may wrap a little early.
function bubbleWidth(text: string, header: string, columns = 80, share: number, extra = 4) {
  const longest = Math.max(header.length, ...text.split('\n').map(l => l.length))
  return Math.max(12, Math.min(longest + extra, Math.floor(columns * share)))
}

// Looks up a row's time: first in the transcript index (by id, or by text for
// message bubbles), then in the live stamps the hooks below write.
async function msOf($: EngineInterface, id: string | undefined, text?: string) {
  const times = (await $.state.get(TIMES)).value ?? {}
  let ms = (id && times[id]) || (text && times[textKey(text)]) || undefined
  if (ms === undefined && id) ms = (await $.state.get({ ...STAMPS, id })).value
  if (ms === undefined && text) ms = (await $.state.get({ ...STAMPS, id: textKey(text) })).value
  return ms
}
async function timeOf($: EngineInterface, id: string | undefined, text?: string, precise = false) {
  if (offsetMin === undefined || opt<string>('timeFormat', 'precise') === 'off') return ''
  const ms = await msOf($, id, text)
  return ms === undefined ? '' : (precise ? fmtPrecise : fmt)(ms, await $.clock.now(), offsetMin)
}

// Divider above a prompt: the day when it changes ("Today", "Yesterday", "Mon, Nov 3"),
// or "2h 5m later" after a long pause; '' otherwise.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function dividerOf(ms: number, prevMs: number, now: number, off: number, gapMs: number) {
  const day = (t: number) => Math.floor((t + off * 60_000) / 86_400_000)
  const dayLabel = () => {
    const d = new Date(ms + off * 60_000)
    const ago = day(now) - day(ms)
    return ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  }
  if (!prevMs || day(ms) !== day(prevMs)) return dayLabel()
  if (ms - prevMs >= gapMs) return since(ms - prevMs) + ' later'
  return ''
}
const since = (ms: number) => { const m = Math.floor(ms / 60_000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m` }
const fmtDuration = (ms: number) => (ms >= 60_000 ? since(ms) : `${Math.max(1, Math.round(ms / 1000))}s`)

// Claude Code's transcript file stamps every row: index each row's ids (uuid,
// promptId, API message id, tool_use ids) and text to its time.
// ponytail: whole-file re-read per prompt/turn (~ms for a few MB); tail it if it ever lags.
// A message's text fingerprint: whitespace-normalised, first 200 chars, djb2-hashed + length.
const textKey = (t: string) => {
  const n = t.replace(/\s+/g, ' ').trim().slice(0, 200)
  let h = 5381
  for (let i = 0; i < n.length; i++) h = ((h << 5) + h + n.charCodeAt(i)) | 0
  return 'x' + (h >>> 0).toString(36) + n.length
}
let transcriptPath: string | undefined
// Read incrementally in newline-aligned chunks: $.fs.read and process output both
// cap at 4 MiB, and transcripts with pasted images pass that quickly.
const CHUNK = 3_000_000
let readOffset = 0 // bytes of the transcript already indexed
const idx = { times: {} as Record<string, number>, prev: {} as Record<string, number>, images: {} as Record<string, ImageAt>, lastPrompt: 0, prompts: [] as number[] }
const byteLength = (s: string) => new TextEncoder().encode(s).length
async function readChunk($: EngineInterface, path: string, offset: number) {
  const r = (await windows($))
    ? await ps($, `[Console]::OutputEncoding = [Text.Encoding]::UTF8; $f = [IO.File]::Open($p.path, 'Open', 'Read', 'ReadWrite'); [void]$f.Seek($p.offset, 0); $b = New-Object byte[] $p.size; $n = $f.Read($b, 0, $p.size); $f.Close(); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($b, 0, $n))`, { path, offset, size: CHUNK })
    : await run($, ['sh', '-c', 'tail -c +"$2" "$1" | head -c "$3"', 'sh', path, String(offset + 1), String(CHUNK)])
  return r.stdout
}
function indexLine(line: string) {
  if (line.includes('"image"')) indexImages(line, idx.images)
  if (!line.includes('"timestamp"')) return
  let row: any
  try { row = JSON.parse(line) } catch { return }
  const ms = Date.parse(row.timestamp)
  if (!ms) return
  const { times, prev } = idx
  for (const k of [row.uuid, row.promptId, row.message?.id]) if (typeof k === 'string') times[k] ??= ms
  const content = row.message?.content
  if (row.type === 'user' && !row.isMeta && (row.promptSource || row.turnOrigin === 'human')) {
    const txt = typeof content === 'string' ? content : Array.isArray(content) ? content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n') : ''
    for (const k of [row.uuid, row.promptId, txt && textKey(txt)]) if (k) prev[k] ??= idx.lastPrompt
    idx.lastPrompt = ms
    idx.prompts.push(ms)
  }
  if (typeof content === 'string') times[textKey(content)] ??= ms
  else if (Array.isArray(content)) {
    for (const b of content) {
      if (b?.type === 'tool_use' && typeof b.id === 'string') times[b.id] ??= ms
      if (b?.type === 'text' && typeof b.text === 'string') times[textKey(b.text)] ??= ms
    }
  }
}
// After /clear or a resume the process goes on under a new session id and no session.start
// fires, so the index notices the change itself: it drops the old session's transcript,
// index, pins and turn summaries, and loads the new session's pins.
let indexedSid: string | undefined
async function switchSession($: EngineInterface, sid: string) {
  transcriptPath = undefined
  readOffset = 0
  idx.times = {}; idx.prev = {}; idx.images = {}; idx.lastPrompt = 0; idx.prompts = []
  await $.state.set(PINS, ((await $.store.get('pins:' + sid).catch(() => undefined)) as Record<string, Pin> | undefined) ?? null)
  await $.state.set(TURNS, null)
  await $.state.set(SHOW_OLD, null)
  await $.state.set(REACTIONS, ((await $.store.get('reactions:' + sid).catch(() => undefined)) as Record<string, string[]> | undefined) ?? null)
  await $.state.set(LAST_PROMPT, null)
  tally = undefined
  await $.state.set(TURN, null)
}
async function indexTranscriptInner($: EngineInterface) {
  const sid = await $.session.id()
  if (indexedSid !== undefined && sid !== indexedSid) await switchSession($, sid)
  indexedSid = sid
  if (!transcriptPath) {
    transcriptPath = await findTranscript($)
    if (!transcriptPath) return // not written yet; the next index tries again
  }
  // A file shorter than what was read was replaced or rewritten: start over.
  const size = (await $.fs.stat(transcriptPath).catch(() => ({ size: readOffset }))).size
  if (size < readOffset) { readOffset = 0; idx.times = {}; idx.prev = {}; idx.images = {}; idx.lastPrompt = 0; idx.prompts = [] }
  for (;;) {
    const chunk = await readChunk($, transcriptPath, readOffset)
    if (!chunk) break
    const cut = chunk.lastIndexOf('\n')
    const full = byteLength(chunk) >= CHUNK - 4
    if (cut < 0) {
      // ponytail: one line longer than a chunk (a huge pasted image): skip past it.
      if (full) { readOffset += byteLength(chunk); continue }
      break // a line still being written; the next index finishes it
    }
    const complete = chunk.slice(0, cut + 1)
    readOffset += byteLength(complete)
    for (const line of complete.split('\n')) if (line) indexLine(line)
    if (!full) break
  }
  await $.state.set(TIMES, { ...idx.times })
  await $.state.set(PREV, { ...idx.prev })
  // Fold point: the first of the last N prompts; everything before it folds.
  const n = (await themeOf($)).foldTurns
  const hidden = n > 0 ? Math.max(0, idx.prompts.length - n) : 0
  await $.state.set(CUTOFF, hidden ? { ms: idx.prompts[hidden]!, hidden } : null)
  const saved: Record<string, { path: string; w?: number; h?: number }> = {}
  for (const [n, at] of Object.entries(idx.images)) {
    const path = await saveImage($, n, at).catch(() => undefined)
    if (!path) continue
    if (at.size === undefined) at.size = /png/.test(at.mediaType) ? pngSize(at.data) ?? null : null // before the base64 goes
    saved[n] = { path, ...(at.size ?? {}) }
    at.data = '' // on disk now; don't hold the base64 too
  }
  await $.state.set(IMAGES, saved)
}

let indexing: Promise<void> = Promise.resolve()
function indexTranscript($: EngineInterface) {
  // ponytail: a failed read is retried by the next index; /undertone-doctor shows what it holds.
  indexing = indexing.then(() => indexTranscriptInner($).catch(() => {}))
  return indexing
}

// ---------- OS layer ----------
// Env vars are read directly (no shell). PowerShell runs by its full path (no PATH hijack),
// -NonInteractive and -STA. Windows helpers read ASCII-only JSON
// on stdin (\u escapes), so any text survives whatever code page the console uses.
// Every helper has a timeout: 5 s, 15 s on Windows (PowerShell starts slowly).
let isWindows: boolean | undefined
async function windows($: EngineInterface) {
  return (isWindows ??= (await $.env.get('OS')) === 'Windows_NT' || /^[A-Za-z]:[\\/]/.test(await $.session.cwd()))
}
const sepOf = async ($: EngineInterface) => ((await windows($)) ? '\\' : '/')
async function homeDir($: EngineInterface) {
  return ((await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || '').replace(/[\\/]+$/, '')
}
async function tempDir($: EngineInterface) {
  const win = await windows($)
  const t = win ? (await $.env.get('TEMP')) || (await $.env.get('TMP')) : await $.env.get('TMPDIR')
  return (t || (win ? 'C:\\Windows\\Temp' : '/tmp')).replace(/[\\/]+$/, '')
}
async function configDirs($: EngineInterface) {
  const custom = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = await homeDir($)
  return [...new Set([custom, home && home + (await sepOf($)) + '.claude'].filter((d): d is string => !!d))]
}
const asciiJson = (v: unknown) => JSON.stringify(v).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
async function run($: EngineInterface, argv: string[], stdin?: string) {
  const timeoutMs = (await windows($)) ? 15_000 : 5_000
  return $.process.run(argv, stdin === undefined ? { timeoutMs } : { stdin, timeoutMs })
}
// PowerShell with an optional JSON payload, readable in the script as $p.
async function ps($: EngineInterface, script: string, payload?: unknown) {
  const root = (await $.env.get('SystemRoot')) || 'C:\\Windows'
  const body = payload === undefined ? script : `$p = [Console]::In.ReadToEnd() | ConvertFrom-Json; ${script}`
  return run($, [`${root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`, '-NoProfile', '-NonInteractive', '-STA', '-Command', body], payload === undefined ? undefined : asciiJson(payload))
}

async function findTranscript($: EngineInterface) {
  const id = await $.session.id()
  // Fast path: Claude Code's own folder naming (<config>/projects/<root with non-alphanumerics as ->/<id>.jsonl).
  const sep = await sepOf($)
  const slug = (await $.session.root()).replace(/[^a-zA-Z0-9]/g, '-')
  for (const dir of await configDirs($)) {
    const guess = [dir, 'projects', slug, id + '.jsonl'].join(sep)
    if (await $.fs.exists(guess).catch(() => false)) return guess
  }
  for (const dir of await configDirs($).catch(() => [])) {
    const projects = dir + sep + 'projects'
    for (const entry of await $.fs.list(projects).catch(() => [])) {
      const file = projects + sep + entry.name + sep + id + '.jsonl'
      if (await $.fs.exists(file).catch(() => false)) return file
    }
  }
  return undefined
}
// Writes the image to <temp>/undertone/<session>-<N>.<ext> once; answers its path.
const savedImages = new Map<string, string>()
async function saveImage($: EngineInterface, n: string, at: ImageAt) {
  const name = `${(await $.session.id()).slice(0, 8)}-${n}.${at.mediaType.replace('image/', '').replace('jpeg', 'jpg')}`
  const known = savedImages.get(name)
  if (known) return known
  const tmp = await tempDir($)
  // Windows' %TEMP% is per-user. On Unix the folder is per-user and private (0700), and one
  // we don't own or that is a symlink is refused: /tmp is shared on Linux.
  const r = (await windows($))
    ? await ps($, `New-Item -ItemType Directory -Force (Split-Path $p.path) | Out-Null; [IO.File]::WriteAllBytes($p.path, [Convert]::FromBase64String($p.data)); Write-Output $p.path`, { path: [tmp, 'undertone', name].join('\\'), data: at.data })
    : await run($, ['sh', '-c', 'umask 077; d="$1/undertone-$(id -u)"; mkdir -p "$d" && [ -O "$d" ] && [ ! -L "$d" ] && base64 -d > "$d/$2" && printf %s "$d/$2"', 'sh', tmp, name], at.data)
  const path = r.stdout.trim()
  if (r.exitCode !== 0 || !path) return undefined
  savedImages.set(name, path)
  return path
}

// Deletes this session's saved image copies (screenshots may hold sensitive data).
async function deleteSavedImages($: EngineInterface) {
  const prefix = (await $.session.id()).slice(0, 8) + '-'
  const tmp = await tempDir($)
  if (await windows($)) await ps($, `Get-ChildItem -LiteralPath $p.dir -Filter ($p.prefix + '*') -ErrorAction SilentlyContinue | Remove-Item -Force`, { dir: tmp + '\\undertone', prefix })
  else await run($, ['sh', '-c', 'rm -f "$1/undertone-$(id -u)/$2"*', 'sh', tmp, prefix])
  savedImages.clear()
}

// Opens a pasted image in the OS default app: open (macOS), xdg-open (Linux), Invoke-Item
// (Windows). Only for images undertone saved itself; any other file goes to openInEditor.
async function openImage($: EngineInterface, path: string) {
  if (await windows($)) return ps($, `Invoke-Item -LiteralPath $p.path`, { path })
  return run($, ['sh', '-c', 'if [ "$(uname)" = Darwin ]; then open "$1"; else xdg-open "$1" >/dev/null 2>&1 & fi', 'sh', path])
}

// "Open in editor": always a text editor, never the default app, which would run a .command,
// .app, .bat or .jar that a tool call wrote. macOS: open -t (the default text editor);
// Windows: Notepad by full path; Linux: the default text/plain app through gtk-launch.
async function openInEditor($: EngineInterface, path: string) {
  const r = (await windows($))
    ? await ps($, `Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\\notepad.exe') -ArgumentList ('"' + $p.path + '"')`, { path }).catch(() => ({ exitCode: 1 }))
    : await run($, ['sh', '-c', 'if [ "$(uname)" = Darwin ]; then exec open -t "$1"; fi; ' +
      'app=$(xdg-mime query default text/plain 2>/dev/null); [ -n "$app" ] && command -v gtk-launch >/dev/null || exit 127; ' +
      'gtk-launch "${app%.desktop}" "$1" >/dev/null 2>&1 &', 'sh', path]).catch(() => ({ exitCode: 1 }))
  if (r.exitCode !== 0) $.ui.toast(r.exitCode === 127 ? 'No text editor found: use Copy path' : 'Could not open the file')
}

// ---------- Inline images ----------
// A PNG's size from its header: IHDR's width and height, big-endian, at bytes 16 to 23.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function pngSize(b64: string): { w: number; h: number } | undefined {
  const bytes: number[] = []
  let buf = 0, bits = 0
  for (const ch of b64.slice(0, 44)) {
    const v = B64.indexOf(ch)
    if (v < 0) break
    buf = ((buf << 6) | v) & 0xffffff; bits += 6
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 255) }
  }
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return undefined
  const u32 = (o: number) => ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0
  const w = u32(16), h = u32(20)
  return w && h ? { w, h } : undefined
}
// Cells for a w×h picture at most maxCols × maxRows; a cell is about twice as tall as wide.
function imageCells(w: number, h: number, maxCols: number, maxRows: number) {
  let columns = Math.max(4, Math.min(maxCols, Math.round(w / 10)))
  let rows = Math.max(1, Math.round((columns * h) / w / 2))
  if (rows > maxRows) { rows = maxRows; columns = Math.max(4, Math.min(maxCols, Math.round((rows * 2 * w) / h))) }
  return { columns: Math.min(columns, 255), rows: Math.min(rows, 255) }
}
const inlineImages = () => opt<unknown>('inlineImages', true) !== false
// A PNG Claude read, by path. ponytail: sized once per path; a file rewritten in place keeps its old size.
const pngSizes = new Map<string, { w: number; h: number } | null>()
async function pngFileSize($: EngineInterface, path: string) {
  if (!pngSizes.has(path)) {
    const bytes = await $.fs.read(path, { as: 'bytes' }).catch(() => undefined)
    pngSizes.set(path, bytes && typeof bytes === 'object' && 'base64' in bytes ? pngSize(bytes.base64) ?? null : null)
  }
  return pngSizes.get(path) ?? undefined
}

// ---------- All green ----------
// A test run's verdict from its summary line: "12 passed", "3 failed", "test result: ok.",
// Go's "ok  pkg", "FAIL". Anything else is not a test run.
function testVerdict(text: string): 'pass' | 'fail' | undefined {
  if (/\b[1-9]\d* (failed|failing|failures?|fail)\b/i.test(text) || /^(FAIL|FAILED)\b/m.test(text) || /test result: FAILED/.test(text)) return 'fail'
  if (/\b\d+ (passed|passing|pass)\b/i.test(text) || /test result: ok\./.test(text) || /^ok\s+\S+\s/m.test(text)) return 'pass'
  return undefined
}

// "[Image #N]" in a prompt's text pairs, in order, with the image blocks of that
// row; a mid-turn message (queued_command attachment) names its ids outright.
type ImageAt = { mediaType: string; data: string; size?: { w: number; h: number } | null }
function blocksOfRow(row: any): any[] {
  const c = row?.message?.content ?? row?.attachment?.prompt
  return Array.isArray(c) ? c : []
}
function indexImages(line: string, into: Record<string, ImageAt>) {
  let row: any
  try { row = JSON.parse(line) } catch { return }
  const blocks = blocksOfRow(row)
  const imgs = blocks.map((b, idx) => ({ b, idx })).filter(x => x.b?.type === 'image' && x.b.source?.type === 'base64')
  if (!imgs.length) return
  const ids: number[] = Array.isArray(row.attachment?.imagePasteIds)
    ? row.attachment.imagePasteIds
    : blocks.filter(b => b?.type === 'text').flatMap(b => [...String(b.text).matchAll(IMAGE_TOKEN)].map(m => Number(m[1])))
  ids.forEach((n, k) => {
    const x = imgs[k]
    if (x) into[String(n)] ??= { mediaType: x.b.source.media_type ?? 'image/png', data: String(x.b.source.data ?? '') }
  })
}
type Call = { tool_use_id?: string; tool: string; input: unknown; isRunning: boolean; isErrored: boolean; isInterrupted: boolean; output?: unknown }

// What a call's output says, as plain text (tool outputs differ in shape).
function outputText(out: unknown) {
  if (out === undefined || out === null) return ''
  if (typeof out === 'string') return out
  const blocksText = (b: unknown) => (Array.isArray(b) ? b.filter((x: any) => x?.type === 'text' && typeof x.text === 'string').map((x: any) => x.text as string).join('\n') : '')
  if (Array.isArray(out)) return blocksText(out) || JSON.stringify(out, null, 2)
  const o = out as Record<string, unknown>
  for (const k of ['stdout', 'content', 'text', 'result']) if (typeof o[k] === 'string' && o[k]) return o[k] as string
  if (blocksText(o.content)) return blocksText(o.content)
  const file = o.file as Record<string, unknown> | undefined
  if (file && typeof file.content === 'string') return file.content
  return JSON.stringify(out, null, 2)
}

// What an opened row shows: the call's code (highlighted) and its output.
type Block = { source: string; language?: string; path?: string; startLine?: number; format?: 'diff'; full: string; adds?: number; dels?: number } | { text: string }
const DETAIL_LINES = 20
const head = (src: string) => {
  const lines = src.replace(/\n$/, '').split('\n')
  return lines.length > DETAIL_LINES ? lines.slice(0, DETAIL_LINES).join('\n') + `\n… ${lines.length - DETAIL_LINES} more lines (ctrl+o)` : lines.join('\n')
}
// ponytail: one hunk, no context lines; ctrl+o shows the engine's real diff.
const hunk = (a: string, b: string) => {
  const x = a.split('\n'), y = b.split('\n')
  return `@@ -1,${x.length} +1,${y.length} @@\n` + x.map(l => '-' + l).join('\n') + '\n' + y.map(l => '+' + l).join('\n')
}
function blocksOf(call: Call): Block[] {
  const i = (call.input ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : '')
  const path = str('file_path') || str('path') || undefined
  const out: Block[] = []
  if (call.tool === 'Bash' && str('command')) out.push({ source: head(str('command')), language: 'bash', full: str('command') })
  if (call.tool === 'Edit' && str('old_string')) out.push({ source: hunk(head(str('old_string')), head(str('new_string'))), format: 'diff', full: str('new_string'), path, adds: str('new_string').split('\n').length, dels: str('old_string').split('\n').length })
  if (call.tool === 'Write' && str('content')) out.push({ source: head(str('content')), path, full: str('content') })
  const o = outputText(call.output).trim()
  if (!o || call.tool === 'Edit' || call.tool === 'Write') return out
  if (call.tool === 'Read') out.push({ source: head(o), path, startLine: typeof i.offset === 'number' ? i.offset : 1, full: o })
  else out.push({ text: head(o) })
  return out
}

// One compact row: "[+] ✓ 3:47 PM  Bash  echo hi", plus its blocks when opened.
// Calls that only look: reads, searches, fetches, and shell commands that only read and write nothing.
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'WebFetch', 'WebSearch'])
const READ_SHELL = /^\s*(cd|ls|cat|head|tail|grep|rg|find|pwd|echo|wc|which|file|stat|tree|du|df|git\s+(status|log|diff|show|branch|remote))\b/
function readOnly(call: Call) {
  if (READ_TOOLS.has(call.tool)) return true
  const cmd = call.tool === 'Bash' ? String((call.input as { command?: unknown } | undefined)?.command ?? '') : ''
  const bare = cmd.replace(/\d?>\s*\/dev\/null|2>&1/g, '') // dropping output writes nothing
  return !!bare.trim() && !/>|\$\(|`/.test(bare) && !/&/.test(bare.replace(/&&/g, '')) && bare.split(/&&|\|\||[;|]/).every(c => READ_SHELL.test(c))
}
async function rowOf($: EngineInterface, call: Call, columns = 80) {
  const id = call.tool_use_id ?? ''
  const toggled = id ? (await $.state.get({ ...OPEN, id })).value : undefined
  // toolOutput quiet: what Claude did, not what it read; a read-only call is one row that never opens
  const quiet = opt<string>('toolOutput', 'full') === 'quiet' && readOnly(call) && !call.isErrored
  const isOpen = quiet ? false : toggled ?? (call.isErrored && !call.isInterrupted) // failures open until folded
  const t = await timeOf($, id)
  const st = statusOf(call)
  // runningDot blink: ● on and off every half second (reading the clock redraws the row)
  const { glyph, color } = st.glyph === '◌' && opt<string>('runningDot', 'ring') === 'blink' ? { glyph: Math.floor((await $.clock.now()) / 500) % 2 ? '●' : ' ', color: optColor('diagramColor', undefined) } : st
  if (!where.cwd) { where.cwd = await $.session.cwd().catch(() => ''); where.home = await homeDir($).catch(() => '') }
  const line = (t ? t + '  ' : '') + clip(describe(call), Math.max(20, columns - 16))
  const inp = (call.input ?? {}) as Record<string, unknown>
  const file = typeof inp.file_path === 'string' ? inp.file_path : typeof inp.notebook_path === 'string' ? inp.notebook_path : undefined
  // A PNG Claude read shows as a picture under its row.
  const size = call.tool === 'Read' && file && /\.png$/i.test(file) && !running(call) && !call.isErrored && inlineImages() ? await pngFileSize($, file) : undefined
  const preview = size && file ? { file, ...imageCells(size.w, size.h, Math.max(10, columns - 10), 12) } : undefined
  return { id, isOpen, quiet, glyph, color, line, file, preview, blocks: isOpen ? blocksOf(call) : [] }
}

function drawRows($: EngineInterface, ui: ElementTable, rows: Awaited<ReturnType<typeof rowOf>>[]) {
  const { Box, Text, Button, Code } = ui
  const Image = 'Image' in ui ? ui.Image : undefined // the terminal draws pictures; other surfaces skip them
  const style = opt<string>('toolStyle', 'dim') // dim (default), tree (⎿ under the sentence), bright (full brightness)
  return (
    <Box flexDirection="column" paddingLeft={style === 'tree' ? 1 : 3}>
      {rows.map((r, n) => (
        <Box flexDirection="column">
          <Box>
            {style === 'tree' && <Text dimColor>{'⎿ '}</Text>}
            {r.quiet ? <Text>{'     '}</Text> : <Button key={'t' + n} label={r.isOpen ? '-' : '+'} onPress={() => $.state.set({ ...OPEN, id: r.id }, !r.isOpen)} />}
            <Text dimColor={!r.color} color={r.color} bold={style === 'bright'}>{' ' + r.glyph + ' '}</Text>
            <Text dimColor={style !== 'bright'}>{r.line}</Text>
            {r.file && <Button key={'f' + n} plain dimColor label={' ↗ ' + clip(r.file.split(/[\\/]/).pop() ?? r.file, 40)} onPress={() => viewFile($, r.file!)} />}
          </Box>
          {r.preview && Image && (
            <Box paddingLeft={6}>
              <Image key={'pic' + n} source={{ file: r.preview.file, format: 'png' }} columns={r.preview.columns} rows={r.preview.rows} alt={'🖼 ' + (r.preview.file.split(/[\\/]/).pop() ?? 'image')} />
            </Box>
          )}
          {r.blocks.map((b, k) => (
            <Box paddingLeft={6}>
              {'text' in b ? (
                <Text dimColor>{b.text}</Text>
              ) : (
                b.format === 'diff' && (opt<string>('diffStyle', 'card') === 'marks' || opt<string>('diffStyle', 'card') === 'bar') ? (
                  // marks: only the + and − coloured; bar: a coloured ▌ before each changed line; no tint
                  <Box flexDirection="column">
                    {b.source.split('\n').filter(l => !l.startsWith('@@')).map(l => {
                      const sign = l[0] === '+' ? '+' : l[0] === '-' ? '-' : ' '
                      const ink = sign === '+' ? optColor('diffAddedColor', 'success') : sign === '-' ? optColor('diffRemovedColor', 'error') : undefined
                      return opt<string>('diffStyle', 'card') === 'bar'
                        ? <Text><Text color={ink}>{sign === ' ' ? '  ' : '▌ '}</Text><Text dimColor={sign === '-'}>{l.slice(1)}</Text></Text>
                        : <Text><Text color={ink} bold>{sign === '-' ? '−' : sign}</Text><Text>{' ' + l.slice(1)}</Text></Text>
                    })}
                    <Button key={'copy-' + n + '-' + k} plain dimColor label="[ copy ]" onPress={p => copyText($, b.full, 'code', p.surface)} />
                  </Box>
                ) : b.format === 'diff' && opt<string>('diffStyle', 'card') === 'card' ? (
                  // a diff card: the file and its counts over the changed lines, in a rounded frame
                  <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
                    <Box justifyContent="space-between">
                      <Text>
                        <Text dimColor>{(b.path ? shortPath(b.path) : 'edit') + '  '}</Text>
                        <Text color={optColor('diffAddedColor', 'success')}>{'+' + (b.adds ?? 0)}</Text>
                        <Text color={optColor('diffRemovedColor', 'error')}>{' −' + (b.dels ?? 0)}</Text>
                      </Text>
                      <Button key={'copy-' + n + '-' + k} plain dimColor label="[ copy ]" onPress={p => copyText($, b.full, 'code', p.surface)} />
                    </Box>
                    <Code source={b.source} language={b.language} path={b.path} startLine={b.startLine} format={b.format} wrap="truncate-end" />
                  </Box>
                ) : (
                  <Box flexDirection="column">
                    <Code source={b.source} language={b.language} path={b.path} startLine={b.startLine} format={b.format} wrap="truncate-end" />
                    <Button key={'copy-' + n + '-' + k} plain dimColor label="[ copy ]" onPress={p => copyText($, b.full, 'code', p.surface)} />
                  </Box>
                )
              )}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

// Copies text through Claude Code's own clipboard: the OS tool where there is one, else the
// terminal (OSC 52), so it also works over SSH. `surface` is the one the button was pressed on.
async function copyText($: EngineInterface, text: string, what: string, surface?: RenderSurface) {
  const r = await $.ui.copy({ text: text.replaceAll(FN, ''), surface }).catch(() => ({ isCopied: false }))
  $.ui.toast(r.isCopied ? `Copied ${what}` : 'Copy failed')
}

// ---------- Rich copies ----------
// HTML with a plain-text twin on the clipboard at once (Word, Teams, Docs take the HTML; Slack and
// spreadsheets the text), and the drawn art as a PNG (docs, slides). These need the OS clipboard,
// so over SSH, where only text reaches the local one, they copy the text instead and say so.
const utf8Bytes = (t: string) => [...encodeURIComponent(t).matchAll(/%([0-9A-F]{2})|([^%])/gi)].map(m => (m[1] ? parseInt(m[1], 16) : m[2]!.charCodeAt(0)))
const overSsh = async ($: EngineInterface) => !!((await $.env.get('SSH_CONNECTION')) || (await $.env.get('SSH_TTY')))
async function copyRich($: EngineInterface, html: string, plain: string, what: string, surface?: RenderSurface) {
  if (await overSsh($)) { await copyText($, plain, what + ' as text (a rich copy needs a local clipboard)', surface); return }
  let r: { exitCode: number }
  if (await windows($)) {
    // CF_HTML: a header of byte offsets around the fragment
    const pre = '<html><body><!--StartFragment-->', post = '<!--EndFragment--></body></html>'
    const head = (a: number, b: number, c: number, d: number) => `Version:0.9\r\nStartHTML:${String(a).padStart(10, '0')}\r\nEndHTML:${String(b).padStart(10, '0')}\r\nStartFragment:${String(c).padStart(10, '0')}\r\nEndFragment:${String(d).padStart(10, '0')}\r\n`
    const hl = head(0, 0, 0, 0).length
    const start = hl, fragStart = hl + utf8Bytes(pre).length, fragEnd = fragStart + utf8Bytes(html).length, end = fragEnd + utf8Bytes(post).length
    const cf = head(start, end, fragStart, fragEnd) + pre + html + post
    r = await ps($, 'Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.DataObject; $d.SetData([System.Windows.Forms.DataFormats]::Html, $p.html); $d.SetText($p.text); [System.Windows.Forms.Clipboard]::SetDataObject($d, $true)', { html: cf, text: plain }).catch(() => ({ exitCode: 1 }))
  } else {
    // macOS: HTML_JXA (an ASCII-only script: osascript can misread AppleScript's «» outside a
    // UTF-8 locale); Linux: CopyQ, which serves both formats.
    r = await run($, ['sh', '-c',
      'if [ "$(uname)" = Darwin ]; then osascript -l JavaScript -e "$1" "$2" "$3"; ' +
      'elif command -v copyq >/dev/null; then copyq copy text/html "$2" text/plain "$3" >/dev/null; else exit 127; fi', 'sh', HTML_JXA, html, plain]).catch(() => ({ exitCode: 1 }))
  }
  if (r.exitCode === 0) $.ui.toast(`Copied ${what} (HTML and text)`)
  else { await copyText($, plain, what + ' as text', surface); if (r.exitCode === 127) $.ui.toast('A rich copy on Linux needs CopyQ running; copied text') }
}
// The drawn art as a PNG on the clipboard, set in the OS's monospaced font.
async function copyPng($: EngineInterface, art: string, th: Theme, what: string, surface?: RenderSurface) {
  if (await overSsh($)) { await copyText($, art, what + ' as text (a picture copy needs a local clipboard)', surface); return }
  const light = /light|latte|dawn/.test(th.name)
  const fg = /^#[0-9a-f]{6}$/i.test(th.claude.text ?? '') ? th.claude.text! : SURFACE[th.name]?.text ?? (light ? '#24292f' : '#d7dae0')
  const bg = optColor('pngBackgroundColor', SURFACE[th.name]?.surface ?? (light ? '#f6f8fa' : '#1e2027'))!
  const r = (await windows($))
    ? await ps($, 'Add-Type -AssemblyName System.Windows.Forms, System.Drawing; $f = New-Object System.Drawing.Font("Consolas", 11); $m = [System.Drawing.Graphics]::FromImage((New-Object System.Drawing.Bitmap 1, 1)).MeasureString($p.text, $f); ' +
      '$b = New-Object System.Drawing.Bitmap ([int]$m.Width + 48), ([int]$m.Height + 48); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.ColorTranslator]::FromHtml($p.bg)); $g.TextRenderingHint = "AntiAliasGridFit"; ' +
      '$g.DrawString($p.text, $f, (New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($p.fg))), 24, 24); [System.Windows.Forms.Clipboard]::SetImage($b)', { text: art, fg, bg }).catch(() => ({ exitCode: 1 }))
    : await run($, ['sh', '-c', '[ "$(uname)" = Darwin ] || exit 127; osascript -l JavaScript -e "$1" "$2" "$3" "$4"', 'sh', PNG_JXA, art, fg, bg]).catch(() => ({ exitCode: 1 }))
  if (r.exitCode === 0) $.ui.toast(`Copied ${what} as a picture`)
  else { await copyText($, art, what + ' as text', surface); $.ui.toast(r.exitCode === 127 ? 'A picture copy needs macOS or Windows; copied the text' : 'Could not make the picture; copied the text') }
}
// macOS: HTML and its plain-text twin on the pasteboard.
const HTML_JXA = [
  'function run(argv) {',
  '  ObjC.import("AppKit")',
  '  const pb = $.NSPasteboard.generalPasteboard',
  '  pb.clearContents',
  '  pb.setStringForType($(argv[0]), "public.html")',
  '  pb.setStringForType($(argv[1]), "public.utf8-plain-text")',
  '}',
].join('\n')
// macOS: draw the text into an image with AppKit and put it on the pasteboard.
const PNG_JXA = [
  'function run(argv) {',
  '  ObjC.import("AppKit")',
  '  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)',
  '  const [fr, fg2, fb] = hex(argv[1]), [br, bg2, bb] = hex(argv[2])',
  '  const text = $.NSString.alloc.initWithUTF8String(argv[0])',
  '  const attrs = $.NSMutableDictionary.alloc.init',
  '  attrs.setObjectForKey($.NSFont.monospacedSystemFontOfSizeWeight(15, 0), $.NSFontAttributeName)',
  '  attrs.setObjectForKey($.NSColor.colorWithSRGBRedGreenBlueAlpha(fr, fg2, fb, 1), $.NSForegroundColorAttributeName)',
  '  const size = text.sizeWithAttributes(attrs), pad = 24',
  '  const img = $.NSImage.alloc.initWithSize($.NSMakeSize(size.width + 2 * pad, size.height + 2 * pad))',
  '  img.lockFocus',
  '  $.NSColor.colorWithSRGBRedGreenBlueAlpha(br, bg2, bb, 1).setFill',
  '  $.NSRectFill($.NSMakeRect(0, 0, size.width + 2 * pad, size.height + 2 * pad))',
  '  text.drawAtPointWithAttributes($.NSMakePoint(pad, pad), attrs)',
  '  img.unlockFocus',
  '  const pb = $.NSPasteboard.generalPasteboard',
  '  pb.clearContents',
  '  if (!pb.writeObjects($.NSArray.arrayWithObject(img))) throw new Error("pasteboard")',
  '}',
].join('\n')
// A table as HTML: header, alignment, and bold, italic, code and links in the cells.
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cellHtml = (c: string) => esc(c).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>').replace(/(?<![*\w])\*(?!\s)(.+?)\*(?!\w)/g, '<em>$1</em>').replace(/~~(.+?)~~/g, '<s>$1</s>')
function tableHtml(t: Table) {
  const td = (tag: string, c: string, k: number) => `<${tag}${t.align[k] !== 'left' ? ` style="text-align:${t.align[k]}"` : ''}>${cellHtml(c)}</${tag}>`
  return `<table><thead><tr>${t.head.map((c, k) => td('th', c, k)).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((c, k) => td('td', c, k)).join('')}</tr>`).join('')}</tbody></table>`
}

// ---------- Tables ----------
// Claude Code's Markdown lays tables out for the full terminal width, so inside a bubble
// they wrap and break. Undertone draws them itself, fitted to the bubble: columns get their
// natural width when everything fits, otherwise the room is shared and long cells wrap
// inside their column. Lines are drawn as text, so borders span every wrapped line.
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/
// Cells a character takes: 2 for wide (CJK, emoji) and the ambiguous symbols terminals
// often draw wide (★ ☆ ♥ ○ ● ■ ◆ ① …); 0 for combining marks. Overestimating only pads.
function charWidth(cp: number) {
  if (cp === 0x200d || (cp >= 0x300 && cp <= 0x36f) || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0
  if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)) return 2
  if ((cp >= 0x2460 && cp <= 0x24ff) || (cp >= 0x25a0 && cp <= 0x25ff) || (cp >= 0x2605 && cp <= 0x2606) || (cp >= 0x2660 && cp <= 0x2667) ||
    cp === 0x203b || cp === 0x2614 || cp === 0x2615 || (cp >= 0x2648 && cp <= 0x2653) || cp === 0x26a1 || (cp >= 0x26aa && cp <= 0x26ab) || cp === 0x2705 || cp === 0x270a || cp === 0x270b || cp === 0x2728 || cp === 0x274c || cp === 0x274e || (cp >= 0x2753 && cp <= 0x2755) || cp === 0x2757 || (cp >= 0x2795 && cp <= 0x2797) || cp === 0x27b0 || cp === 0x27bf || cp === 0x2b50) return 2
  return 1
}
const strWidth = (t: string) => { let w = 0; for (const ch of t) w += charWidth(ch.codePointAt(0)!); return w }

type Seg = { text: string; bold?: boolean; code?: boolean; italic?: boolean; link?: boolean; strike?: boolean; num?: boolean; path?: boolean }
// Inline markdown in a cell → styled words: **bold**, *italic*, `code`, [text](url).
function cellWords(cell: string): Seg[] {
  cell = cell.replaceAll(FN, '')
  const segs: Seg[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]*\)|(?<![*\w])\*(?!\s)(.+?)\*(?!\w)|~~(.+?)~~|((?:[^*`[~]|~(?!~))+|[*`[~])/g
  for (const m of cell.matchAll(re)) {
    const [text, style]: [string, Partial<Seg>] = m[1] !== undefined ? [m[1], { bold: true }] : m[2] !== undefined ? [m[2], { code: true }]
      : m[3] !== undefined ? [m[3], { link: true }] : m[4] !== undefined ? [m[4], { italic: true }] : m[5] !== undefined ? [m[5], { strike: true }] : [m[6] ?? m[0], {}]
    // split into words, keeping the style; spaces become their own segments
    for (const part of text.split(/(\s+)/)) if (part) segs.push({ text: /^\s+$/.test(part) ? ' ' : part, ...style })
  }
  return segs
}
// Word-wraps styled segments to `width` cells; words longer than a line are cut.
function wrapSegs(segs: Seg[], width: number): Seg[][] {
  const lines: Seg[][] = [[]]
  let used = 0
  for (const seg of segs) {
    let line = lines[lines.length - 1]!
    if (seg.text === ' ') { if (used > 0 && used < width) { line.push(seg); used++ } continue }
    let rest = seg.text
    while (rest) {
      const w = strWidth(rest)
      if (used + w <= width) { line.push({ ...seg, text: rest }); used += w; break }
      if (used > 0 && w <= width) { lines.push((line = [])); used = 0; continue } // move the word down
      // cut the word at what fits
      let cut = '', cw = 0
      for (const ch of rest) { const c = charWidth(ch.codePointAt(0)!); if (cw + c > width - used) break; cut += ch; cw += c }
      if (!cut) { lines.push((line = [])); used = 0; continue }
      line.push({ ...seg, text: cut }); rest = rest.slice(cut.length)
      lines.push((line = [])); used = 0
    }
  }
  // drop a trailing space on each line
  for (const l of lines) while (l.length && l[l.length - 1]!.text === ' ') l.pop()
  return lines
}
const segsWidth = (segs: Seg[]) => segs.reduce((n, s) => n + strWidth(s.text), 0)
const plainCell = (cell: string) => cellWords(cell).map(s => s.text).join('')
// The table as tab-separated plain text, markup stripped: Slack and spreadsheets (Excel, Google
// Sheets, Numbers) paste it as a real table. ponytail: link URLs drop, as Slack drops them too.
const tableCells = (t: Table) => [t.head, ...t.rows].map(r => r.map(c => plainCell(c.replace(/<br\s*\/?>/gi, ' ')).replace(/\s+/g, ' ').trim()).join('\t')).join('\n')

type Table = { head: string[]; align: ('left' | 'center' | 'right')[]; rows: string[][] }
function splitRow(line: string) {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let cur = '', inCode = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!
    if (ch === '\\' && t[i + 1] === '|') { cur += '|'; i++; continue }
    if (ch === '`') inCode = !inCode
    if (ch === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}
function parseTable(md: string): Table | undefined {
  const lines = md.replaceAll(FN, '').split('\n').filter(l => l.trim())
  if (lines.length < 2 || !TABLE_RULE.test(lines[1]!)) return undefined
  const head = splitRow(lines[0]!)
  const align = splitRow(lines[1]!).map(c => (/^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : 'left') as Table['align'][number])
  const n = head.length
  const rows = lines.slice(2).map(l => { const r = splitRow(l); return Array.from({ length: n }, (_, i) => r[i] ?? '') })
  return { head, align: Array.from({ length: n }, (_, i) => align[i] ?? 'left'), rows }
}
// Column widths that fit `room` cells of content (borders and gaps already taken off).
function fitColumns(natural: number[], room: number): number[] {
  const total = natural.reduce((a, b) => a + b, 0)
  if (total <= room) return natural
  const n = natural.length
  const widths = natural.map(w => Math.min(w, Math.max(3, Math.floor(room / n))))
  let left = room - widths.reduce((a, b) => a + b, 0)
  // hand the rest to the columns that want more, in proportion to what they still want
  while (left > 0) {
    const want = natural.map((w, i) => w - widths[i]!)
    const wanting = want.reduce((a, b) => a + Math.max(0, b), 0)
    if (!wanting) break
    let given = 0
    for (let i = 0; i < n && given < left; i++) {
      if (want[i]! <= 0) continue
      const share = Math.max(1, Math.floor((left * want[i]!) / wanting))
      const g = Math.min(share, want[i]!, left - given)
      widths[i]! += g; given += g
    }
    if (!given) break
    left -= given
  }
  return widths.map(w => Math.max(3, w))
}
type TableStyle = 'box' | 'rules' | 'minimal'
// Overhead of borders/gaps per style, for `cols` columns.
const tableOverhead = (style: TableStyle, cols: number) => (style === 'box' ? 3 * cols + 1 : 2 * (cols - 1))
// The table as lines of segments; `rule` marks border/separator segments.
type Out = (Seg & { rule?: boolean; head?: boolean })[]
function layoutTable(t: Table, room: number, style: TableStyle): Out[] {
  const n = t.head.length
  const natural = Array.from({ length: n }, (_, i) => Math.max(3, strWidth(plainCell(t.head[i]!)), ...t.rows.map(r => strWidth(plainCell(r[i]!)))))
  const widths = fitColumns(natural, Math.max(n * 3, room - tableOverhead(style, n)))
  const out: Out[] = []
  const hline = (l: string, m: string, r: string, fill: string): Out => [{ text: l + widths.map(w => fill.repeat(w + 2)).join(m) + r, rule: true }]
  const row = (cells: string[], head: boolean) => {
    const wrapped = cells.map((c, i) => wrapSegs(cellWords(c), widths[i]!))
    const height = Math.max(...wrapped.map(w => w.length))
    for (let li = 0; li < height; li++) {
      const line: Out = []
      if (style === 'box') line.push({ text: '│ ', rule: true })
      wrapped.forEach((cell, i) => {
        const segs = cell[li] ?? []
        const pad = widths[i]! - segsWidth(segs)
        const a = t.align[i]!
        const lp = a === 'right' ? pad : a === 'center' ? Math.floor(pad / 2) : 0
        if (lp) line.push({ text: ' '.repeat(lp) })
        for (const sg of segs) line.push({ ...sg, head })
        if (pad - lp) line.push({ text: ' '.repeat(pad - lp) })
        if (i < n - 1) line.push(style === 'box' ? { text: ' │ ', rule: true } : { text: '  ' })
      })
      if (style === 'box') line.push({ text: ' │', rule: true })
      out.push(line)
    }
  }
  if (style === 'box') out.push(hline('┌', '┬', '┐', '─'))
  row(t.head, true)
  if (style === 'box') out.push(hline('╞', '╪', '╡', '═'))
  else out.push([{ text: widths.map(w => '─'.repeat(w)).join('  '), rule: true }])
  t.rows.forEach((r, i) => {
    if (i > 0 && style === 'box') out.push(hline('├', '┼', '┤', '─'))
    if (i > 0 && style === 'rules') out.push([{ text: widths.map(w => '·'.repeat(w)).join('  '), rule: true }])
    row(r, false)
  })
  if (style === 'box') out.push(hline('└', '┴', '┘', '─'))
  return out
}

// Splits a reply into markdown runs, fenced code blocks and quotes, each copyable on its own.
type Part = { kind: 'md' | 'code' | 'quote' | 'table' | 'heading' | 'rule' | 'list' | 'math' | 'notes'; md: string; copy: string; level?: number; lang?: string; open?: boolean; notes?: string[] }
// ---------- Math ----------
// LaTeX as readable text: Greek letters and operators as symbols, x^2 as x², x_i as xᵢ,
// \frac{a}{b} as a/b, \sqrt{x} as √x, \mathbb{R} as ℝ. What it can't turn into a symbol it
// leaves as written, so nothing is lost.
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', k: 'ᵏ', m: 'ᵐ', o: 'ᵒ', p: 'ᵖ', t: 'ᵗ', x: 'ˣ', y: 'ʸ', T: 'ᵀ' }
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', x: 'ₓ' }
const superscript = (x: string) => [...x].map(ch => SUP[ch] ?? ch).join('')
const TEX: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡', sim: '∼', propto: '∝',
  infty: '∞', sum: '∑', prod: '∏', int: '∫', oint: '∮', partial: '∂', nabla: '∇', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', iff: '⇔', mapsto: '↦',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', ldots: '…', cdots: '⋯', dots: '…',
  degree: '°', circ: '∘', ell: 'ℓ', hbar: 'ℏ', prime: '′', angle: '∠', perp: '⊥', parallel: '∥',
}
const BB: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ' }
function texToText(src: string): string {
  let i = 0
  const group = (): string => { // {…} or one token
    while (src[i] === ' ') i++
    if (src[i] === '{') { let depth = 0, j = i; for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break } const inner = src.slice(i + 1, j); i = j + 1; return texToText(inner) }
    if (src[i] === '\\') { const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i))!; i += m[0].length; return TEX[m[1]!] ?? m[1]! }
    return src[i++] ?? ''
  }
  const script = (map: Record<string, string>, mark: string) => { const g = group(); return [...g].every(ch => map[ch]) ? [...g].map(ch => map[ch]).join('') : `${mark}(${g})` }
  let out = ''
  while (i < src.length) {
    const ch = src[i]!
    if (ch === '^') { i++; out += script(SUP, '^') }
    else if (ch === '_') { i++; out += script(SUB, '_') }
    else if (ch === '{' || ch === '}') { if (ch === '{') out += group(); else i++ }
    else if (ch === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i))!
      i += m[0].length
      const cmd = m[1]!
      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') { const a = group(), b = group(); const wrap = (x: string) => ([...x].length > 1 && /[^\w.]/.test(x) ? `(${x})` : x); out += `${wrap(a)}/${wrap(b)}` }
      else if (cmd === 'sqrt') { let n = ''; if (src[i] === '[') { const j = src.indexOf(']', i); n = superscript(src.slice(i + 1, j)); i = j + 1 } const g = group(); out += `${n}√${[...g].length > 1 ? `(${g})` : g}` }
      else if (['text', 'mathrm', 'mathbf', 'mathit', 'operatorname', 'textbf', 'mathsf', 'boldsymbol'].includes(cmd)) out += group()
      else if (cmd === 'mathbb') { const g = group(); out += [...g].map(c => BB[c] ?? c).join('') }
      else if (['hat', 'bar', 'vec', 'dot', 'tilde', 'overline'].includes(cmd)) { const g = group(); out += g + ({ hat: '\u0302', bar: '\u0304', vec: '\u20d7', dot: '\u0307', tilde: '\u0303', overline: '\u0305' } as Record<string, string>)[cmd] }
      else if (cmd === 'left' || cmd === 'right' || cmd === 'big' || cmd === 'Big' || cmd === 'displaystyle') { /* sizes: drop */ }
      else if (cmd === ',' || cmd === ';' || cmd === ':' || cmd === ' ' || cmd === 'quad' || cmd === 'qquad') out += ' '
      else if (cmd === '\\') out += '; '
      else out += TEX[cmd] ?? cmd
    } else { out += ch; i++ }
  }
  return out.replace(/\s+/g, ' ').trim()
}
// A formula typeset as a picture by `ratex-render` (on PATH), in a private folder; null when
// there is no renderer, it failed, or this is Windows. ponytail: one render per formula and colour.
const mathPics = new Map<string, { path: string; w: number; h: number } | null>()
let hasRenderer: boolean | undefined
async function mathPicture($: EngineInterface, tex: string, color: string) {
  const key = color + '|' + tex
  if (mathPics.has(key)) return mathPics.get(key) ?? undefined
  if (await windows($)) { mathPics.set(key, null); return undefined }
  hasRenderer ??= (await run($, ['sh', '-c', 'command -v ratex-render >/dev/null']).catch(() => ({ exitCode: 1 }))).exitCode === 0
  if (!hasRenderer) { mathPics.set(key, null); return undefined }
  const r = await run($, ['sh', '-c', 'umask 077; d="$1/undertone-$(id -u)/math/$2"; mkdir -p "$d" && [ -O "$1/undertone-$(id -u)" ] && printf "%s\n" "$3" | ratex-render --output-dir "$d" --color "$4" --background-color transparent --font-size 32 >/dev/null 2>&1 && printf %s "$d/0001.png"',
    'sh', await tempDir($), textKey(key), tex.replace(/\s*\n\s*/g, ' '), /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#d7dae0']).catch(() => ({ exitCode: 1, stdout: '' }))
  const path = r.exitCode === 0 ? r.stdout.trim() : ''
  const size = path ? await pngFileSize($, path) : undefined
  mathPics.set(key, path && size ? { path, ...size } : null)
  return mathPics.get(key) ?? undefined
}

// ---------- Coloured text, right to left ----------
// A plain paragraph (no links, images, HTML or URLs) undertone draws itself, so numbers,
// versions, durations, percentages and paths can take their own colour; one with a link stays
// Claude Code's Markdown, where the link is clickable. Setting: colorText.
const colorText = () => opt<unknown>('colorText', true) !== false
const plainParagraphs = (md: string) => !/\[[^\]]*\]\(|!\[|<[a-z/!]|https?:\/\/|\\[*_`~\[]|^\s*(#|>|\||[-*+]\s|\d+[.)]\s)|^ {4}/im.test(md)
const NUM_WORD = /^([("'\[]*)(v?\d+(?:[.,:]\d+)*(?:%|ms|µs|ns|s|m|h|d|w|x|[KMGT]i?B|[KMGT]i|px)?)([)"'\].,;:!?]*)$/
const PATH_WORD = /^([("'\[]*)((?:~|\.{1,2})\/(?:[\w.@/-]*[\w@/-])?|\/[\w.@-]+\/(?:[\w.@/-]*[\w@/-])?)([)"'\].,;:!?]*)$/
// Words of a run, with numbers and paths marked (inline code, bold and so on keep their style).
function textWords(text: string): Seg[] {
  const out: Seg[] = []
  for (const sg of cellWords(text)) {
    const m = !sg.code && !sg.link ? (NUM_WORD.exec(sg.text) ?? PATH_WORD.exec(sg.text)) : null
    if (!m) { out.push(sg); continue }
    const isNum = NUM_WORD.test(sg.text)
    if (m[1]) out.push({ ...sg, text: m[1] })
    out.push({ ...sg, text: m[2]!, ...(isNum ? { num: true } : { path: true }) })
    if (m[3]) out.push({ ...sg, text: m[3] })
  }
  return out
}
// Mostly Hebrew, Arabic or another right-to-left script.
const isRtl = (t: string) => opt<string>('rtl', 'auto') !== 'off' && (t.match(/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/g) ?? []).length > (t.match(/[A-Za-z]/g) ?? []).length
// A word's colour in text undertone draws: the theme's, or the colour you set for its kind.
const wordInk = (sg: { code?: boolean; num?: boolean; path?: boolean; link?: boolean; bold?: boolean; italic?: boolean }, th: Theme) =>
  sg.code ? optColor('inlineCodeColor', th.user.border) : sg.num ? optColor('numberColor', 'warning') : sg.path ? optColor('pathColor', 'permission')
    : sg.link ? optColor('linkColor', th.claude.text) : sg.bold ? optColor('strongColor', th.claude.text) : sg.italic ? optColor('emphasisColor', th.claude.text) : th.claude.text
function drawWords(ui: ElementTable, th: Theme, text: string, extra: { dim?: boolean } = {}) {
  const { Text } = ui
  text = text.replaceAll(FN, '')
  const rtl = isRtl(text)
  return (
    <Text dir={rtl ? 'rtl' : undefined} dimColor={extra.dim}>
      {textWords(text).map(sg => (
        <Text bold={sg.bold} italic={sg.italic} strikethrough={sg.strike} underline={sg.link}
          color={wordInk(sg, th)}>{sg.text}</Text>
      ))}
    </Text>
  )
}
// A path in text as an absolute path: ~ is your home, ./ and ../ are the project folder's.
function absPath(p: string) {
  if (p.startsWith('~/')) return where.home ? where.home + p.slice(1) : undefined
  if (p.startsWith('/')) return p
  if (!where.cwd) return undefined
  const parts = where.cwd.split('/')
  for (const seg of p.split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg) }
  return parts.join('/')
}
// A paragraph with a path lays out word by word, so the path can be a one-link Markdown that opens
// it in the file viewer on a click (read-only; nothing is run), and the rest keeps its colours.
function drawLinkedWords($: EngineInterface, ui: ElementTable, th: Theme, text: string, key: string) {
  const { Box, Text, Markdown } = ui
  return (
    <Box flexWrap="wrap">
      {textWords(text).map((sg, k) => {
        const abs = sg.path ? absPath(sg.text) : undefined
        if (abs) return <Markdown key={`${key}-${k}`} text={`[${sg.text}](file://${encodeURI(abs)})`} onLinkPress={() => viewFile($, abs)} />
        return <Text bold={sg.bold} italic={sg.italic} strikethrough={sg.strike} color={wordInk(sg, th)}>{sg.text}</Text>
      })}
    </Box>
  )
}
function drawParagraphs($: EngineInterface, ui: ElementTable, th: Theme, md: string, key: string) {
  const { Box } = ui
  const paras = md.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return (
    <Box flexDirection="column">
      {paras.map((p, k) => {
        const flat = p.replace(/\s*\n\s*/g, ' ')
        const linked = opt<unknown>('clickPaths', true) !== false && !isRtl(p) && textWords(flat).some(sg => sg.path && absPath(sg.text))
        return (
          <Box marginTop={k ? 1 : 0} justifyContent={isRtl(p) ? 'flex-end' : 'flex-start'}>
            {linked ? drawLinkedWords($, ui, th, flat, `${key}-${k}`) : drawWords(ui, th, flat)}
          </Box>
        )
      })}
    </Box>
  )
}

// ---------- Rich text ----------
// undertone draws a reply's blocks itself: headings, lists and task lists, quotes and GitHub
// alerts, code under a header, rules. Inline text still goes through Claude Code's Markdown, so
// links stay clickable. Setting: richText (off = Claude Code's own drawing).
const richText = () => opt<unknown>('richText', true) !== false
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const ALERTS: Record<string, { label: string; ink: string }> = {
  NOTE: { label: 'Note', ink: 'suggestion' }, TIP: { label: 'Tip', ink: 'success' }, IMPORTANT: { label: 'Important', ink: 'planMode' },
  WARNING: { label: 'Warning', ink: 'warning' }, CAUTION: { label: 'Caution', ink: 'error' },
}
const TASK_MARKS: Record<string, [todo: string, done: string]> = { brackets: ['[ ]', '[✓]'], ticks: ['○', '✓'], box: ['□', '✓'], progress: ['[ ]', '[✓]'] }
const BULLETS = ['•', '◦', '▪']
// A list's kind, so a numbered list and a bullet list after a blank line stay two lists.
const listKind = (line: string) => { const m = LIST_ITEM.exec(line); return !m ? '' : /^\[[ xX]\]\s/.test(m[3]!) ? 'task' : /^\d/.test(m[2]!) ? 'ordered' : 'bullet' }
type Item = { depth: number; marker: string; task?: 'todo' | 'done'; text: string }
function listItems(md: string): Item[] {
  const items: Item[] = []
  for (const line of md.split('\n')) {
    const m = LIST_ITEM.exec(line)
    if (m) {
      let text = m[3]!
      let task: Item['task']
      const t = /^\[([ xX])\]\s+(.*)$/.exec(text)
      if (t) { task = t[1] === ' ' ? 'todo' : 'done'; text = t[2]! }
      items.push({ depth: m[1]!.replace(/\t/g, '    ').length, marker: m[2]!, task, text })
    } else if (items.length && line.trim()) items[items.length - 1]!.text += '\n' + line.trim()
  }
  const levels = [...new Set(items.map(it => it.depth))].sort((a, b) => a - b)
  for (const it of items) it.depth = levels.indexOf(it.depth)
  return items
}
// ---------- Pictures ----------
// ```figure: text drawn as written, with colour roles {accent:…} {warn:…} {ok:…} {note:…}
// {dim:…} {strong:…}. A line that is too wide, holds a tab, or has broken role markup leaves the
// figure as code, with a dim note saying why.
const ROLE = /\{(accent|warn|ok|note|dim|strong):([^{}]*)\}/g
type Seg2 = { text: string; role?: string }
function figureOf(src: string, room: number): { lines: Seg2[][] } | { error: string } {
  const lines: Seg2[][] = []
  const rows = src.replace(/\n+$/, '').split('\n')
  if (rows.length > 80) return { error: 'figure: more than 80 lines' }
  for (const [n, row] of rows.entries()) {
    if (row.includes('\t')) return { error: `figure line ${n + 1}: a tab; use spaces` }
    const segs: Seg2[] = []
    let last = 0
    for (const m of row.matchAll(ROLE)) {
      if (m.index! > last) segs.push({ text: row.slice(last, m.index) })
      segs.push({ text: m[2]!, role: m[1]! })
      last = m.index! + m[0].length
    }
    if (last < row.length) segs.push({ text: row.slice(last) })
    const rest = segs.filter(sg => !sg.role).map(sg => sg.text).join('')
    if (/\{[a-z]+:/i.test(rest)) return { error: `figure line ${n + 1}: role markup is misspelled, nested or left open` }
    if (strWidth(segs.map(sg => sg.text).join('')) > room) return { error: `figure line ${n + 1}: wider than the bubble` }
    lines.push(segs)
  }
  return { lines }
}

// Charts from mermaid: xychart-beta (bar and line series) and pie, as horizontal bars measured
// in eighths of a cell, so close values still draw apart.
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
const barOf = (cells: number) => { const full = Math.floor(cells), rem = Math.round((cells - full) * 8); return '█'.repeat(full) + (rem === 8 ? '█' : EIGHTHS[rem]!) }
const SERIES_INKS = ['suggestion', 'warning', 'success', 'planMode', 'autoAccept', 'permission'] // permission last: in dark themes it is suggestion's blue
const unquote = (x: string) => x.trim().replace(/^"(.*)"$/, '$1')
const listOf = (inner: string) => [...inner.matchAll(/"([^"]*)"|([^,]+)/g)].map(m => (m[1] ?? m[2]!).trim()).filter(Boolean)
type Chart = { title?: string; rows: { label: string; values: number[] }[]; kinds: ('bar' | 'line')[]; pie?: boolean }
function chartOf(src: string): Chart | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  const head = lines[0] ?? ''
  if (/^pie\b/.test(head)) {
    const title = /\btitle\s+(.+)$/.exec(head)?.[1] ?? lines.find(l => l.startsWith('title '))?.slice(6)
    const rows = lines.slice(1).map(l => /^"([^"]+)"\s*:\s*(-?[\d.]+)$/.exec(l)).filter(Boolean).map(m => ({ label: m![1]!, values: [Number(m![2])] }))
    return rows.length ? { title: title && unquote(title), rows: rows.sort((a, b) => b.values[0]! - a.values[0]!), kinds: ['bar'], pie: true } : undefined
  }
  if (!/^xychart(-beta)?\b/.test(head)) return undefined
  let title: string | undefined
  let labels: string[] = []
  const series: { kind: 'bar' | 'line'; values: number[] }[] = []
  for (const l of lines.slice(1)) {
    const t = /^title\s+(.+)$/.exec(l); if (t) { title = unquote(t[1]!); continue }
    const x = /^x-axis\b.*\[(.*)\]\s*$/.exec(l); if (x) { labels = listOf(x[1]!); continue }
    const s2 = /^(bar|line)\s*\[(.*)\]\s*$/.exec(l); if (s2) { series.push({ kind: s2[1] as 'bar' | 'line', values: listOf(s2[2]!).map(Number) }); continue }
  }
  if (!series.length || series.some(sr => sr.values.some(v => !Number.isFinite(v)))) return undefined
  const n = Math.max(...series.map(sr => sr.values.length))
  return { title, kinds: series.map(sr => sr.kind), rows: Array.from({ length: n }, (_, k) => ({ label: labels[k] ?? String(k + 1), values: series.map(sr => sr.values[k] ?? 0) })) }
}
const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1).replace(/\.?0+$/, ''))

// Flowcharts (graph / flowchart): a straight chain draws as boxes and arrows; anything else as a
// tree from its roots, with edge labels, and ↺ where it loops back to a node already drawn.
type Flow = { dir: 'LR' | 'TD'; order: string[]; label: Map<string, string>; out: Map<string, { to: string; text?: string }[]> }
function flowOf(src: string): Flow | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  const head = /^(graph|flowchart)\s*(LR|RL|TD|TB|BT)?\b/.exec(lines[0] ?? '')
  if (!head) return undefined
  const flow: Flow = { dir: head[2] === 'LR' || head[2] === 'RL' ? 'LR' : 'TD', order: [], label: new Map(), out: new Map() }
  const NODE = /^([A-Za-z0-9_]+)\s*(?:\[\[(.*?)\]\]|\[\((.*?)\)\]|\(\((.*?)\)\)|\[(.*?)\]|\((.*?)\)|\{(.*?)\}|>(.*?)\])?$/
  const node = (tok: string) => {
    const m = NODE.exec(tok.trim())
    if (!m) return undefined
    const id = m[1]!
    const text = m.slice(2).find(x => x !== undefined)
    if (!flow.label.has(id)) { flow.order.push(id); flow.label.set(id, id) }
    if (text !== undefined) flow.label.set(id, unquote(text) || id)
    return id
  }
  for (const raw of lines.slice(1)) {
    if (/^(subgraph|end|classDef|class|style|linkStyle|click)\b/.test(raw)) { if (/^subgraph\b/.test(raw)) return undefined; continue }
    const line = raw.replace(/;$/, '').replace(/--\s+([^->|]+?)\s+-->/g, '-->|$1|').replace(/==\s+([^=>|]+?)\s+==>/g, '==>|$1|')
    const parts = line.split(/\s*(?:-->|---|-\.->|==>|--x|--o)\s*/)
    const ops = [...line.matchAll(/(?:-->|---|-\.->|==>|--x|--o)\s*(\|[^|]*\|)?/g)].map(m => (m[1] ? m[1].slice(1, -1).trim() : undefined))
    let prev: string | undefined
    for (const [k, part] of parts.entries()) {
      const tok = k > 0 && ops[k - 1] !== undefined ? part.replace(/^\|[^|]*\|\s*/, '') : part
      const id = node(tok)
      if (id === undefined) return undefined
      if (prev !== undefined) { const list = flow.out.get(prev) ?? []; list.push({ to: id, text: ops[k - 1] }); flow.out.set(prev, list) }
      prev = id
    }
  }
  return flow.order.length ? flow : undefined
}

// What the note on your prompts tells Claude (about 130 tokens).
const PICTURE_HINT = [
  'This terminal draws, inside your replies: GitHub-flavoured markdown (headings, nested and task lists, > [!NOTE]/[!TIP]/[!WARNING] alerts);',
  '```mermaid flowcharts (graph LR or TD, no subgraphs), stateDiagram, sequenceDiagram, classDiagram, erDiagram, C4, gantt (YYYY-MM-DD dates), timeline, mindmap, journey, gitGraph, quadrantChart, sankey-beta, xychart-beta bar and line charts, and pie charts;',
  'and ```figure blocks, drawn exactly as written, where {accent:…} {warn:…} {ok:…} {note:…} {dim:…} {strong:…} colour a run',
  '(one-column glyphs only, at most 74 columns). Use a picture when it explains better than prose; keep short answers plain.',
].join(' ')

// Sequence diagrams: a box per participant over its lifeline, a message as an arrow between
// lifelines with its text above (dashed for a reply), notes and loop/alt/opt labels as dim lines.
type Seq = { names: string[]; label: Map<string, string>; steps: ({ from: string; to: string; text: string; dashed: boolean } | { note: string })[] }
function seqOf(src: string): Seq | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (!/^sequenceDiagram\b/.test(lines[0] ?? '')) return undefined
  const seq: Seq = { names: [], label: new Map(), steps: [] }
  const add = (id: string, label?: string) => { if (!seq.label.has(id)) { seq.names.push(id); seq.label.set(id, id) } if (label) seq.label.set(id, label) }
  for (const l of lines.slice(1)) {
    const p = /^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/.exec(l)
    if (p) { add(p[2]!, p[3]?.trim()); continue }
    const m = /^([^\s\-+]+?)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*[+-]?([^\s:]+?)\s*:\s*(.*)$/.exec(l)
    if (m) { add(m[1]!); add(m[3]!); seq.steps.push({ from: m[1]!, to: m[3]!, text: m[4]!.trim(), dashed: m[2]!.startsWith('--') }); continue }
    const n = /^Note\s+(?:over|left of|right of)\s+[^:]+:\s*(.*)$/i.exec(l)
    if (n) { seq.steps.push({ note: '✎ ' + n[1]!.trim() }); continue }
    const b = /^(loop|alt|else|opt|par|and|critical|break|rect)\b\s*(.*)$/.exec(l)
    if (b) { seq.steps.push({ note: `[${b[1]}${b[2] ? ' ' + b[2] : ''}]` }); continue }
    if (/^(end|autonumber|activate|deactivate|title)\b/.test(l)) continue
    return undefined // something this drawing doesn't know: leave it code
  }
  return seq.names.length >= 2 && seq.steps.length ? seq : undefined
}
function seqRows(seq: Seq, room: number): Seg2[][] | undefined {
  const n = seq.names.length
  const names = seq.names.map(id => seq.label.get(id)!)
  const idx = (id: string) => seq.names.indexOf(id)
  // the gap between neighbouring lifelines: room for both boxes and every message between them
  const gaps = Array.from({ length: n - 1 }, (_, k) => Math.ceil((strWidth(names[k]!) + 4) / 2) + Math.ceil((strWidth(names[k + 1]!) + 4) / 2) + 2)
  for (const st of seq.steps) {
    if (!('from' in st)) continue
    const a = Math.min(idx(st.from), idx(st.to)), b = Math.max(idx(st.from), idx(st.to))
    const need = strWidth(st.text) + 4
    if (a === b) { if (a < n - 1) gaps[a] = Math.max(gaps[a]!, need + 3); continue }
    const have = gaps.slice(a, b).reduce((x, y) => x + y, 0)
    if (have < need) gaps[b - 1] = gaps[b - 1]! + need - have
  }
  const left = Math.ceil((strWidth(names[0]!) + 4) / 2)
  const centers = [left]
  for (const g of gaps) centers.push(centers.at(-1)! + g)
  const width = centers.at(-1)! + Math.ceil((strWidth(names[n - 1]!) + 4) / 2) + 1
  if (width > room) return undefined
  // a row as cells; each cell has a role, then runs of one role become segments
  const blank = () => ({ ch: Array<string>(width).fill(' '), role: Array<string | undefined>(width).fill(undefined) })
  const put = (row: ReturnType<typeof blank>, at: number, text: string, role?: string) => { [...text].forEach((c, k) => { if (at + k >= 0 && at + k < width) { row.ch[at + k] = c; row.role[at + k] = role } }) }
  const segs = (row: ReturnType<typeof blank>): Seg2[] => {
    const out: Seg2[] = []
    row.ch.forEach((c, k) => { const last = out.at(-1); if (last && last.role === row.role[k]) last.text += c; else out.push({ text: c, role: row.role[k] }) })
    return out
  }
  const inks = seq.names.map((_, k) => 'ink:' + SERIES_INKS[k % SERIES_INKS.length])
  const lifelines = (row: ReturnType<typeof blank>) => centers.forEach(c => put(row, c, '│', 'dim'))
  const rows: Seg2[][] = []
  const boxes = [blank(), blank(), blank()]
  names.forEach((nm, k) => {
    const w = strWidth(nm) + 2, at = centers[k]! - Math.floor(w / 2) - 1
    put(boxes[0]!, at, '╭' + '─'.repeat(w) + '╮', inks[k]); put(boxes[1]!, at, '│ ', inks[k]); put(boxes[1]!, at + 2, nm, 'strong'); put(boxes[1]!, at + 2 + strWidth(nm), ' │', inks[k]); put(boxes[2]!, at, '╰' + '─'.repeat(w) + '╯', inks[k])
  })
  boxes.forEach(r => rows.push(segs(r)))
  for (const st of seq.steps) {
    if (!('from' in st)) { const r = blank(); lifelines(r); put(r, centers[0]! + 2, st.note, 'dim'); rows.push(segs(r)); continue }
    const a = centers[idx(st.from)]!, b = centers[idx(st.to)]!
    const label = blank(); lifelines(label)
    const arrow = blank(); lifelines(arrow)
    if (a === b) {
      put(label, a + 2, st.text, 'note')
      put(arrow, a, '├─↺', 'accent')
    } else {
      const lo = Math.min(a, b), hi = Math.max(a, b)
      put(label, lo + Math.max(1, Math.floor((hi - lo - strWidth(st.text)) / 2)), st.text, 'note')
      put(arrow, lo + 1, (st.dashed ? '┄' : '─').repeat(hi - lo - 1), 'accent')
      put(arrow, b > a ? hi - 1 : lo + 1, b > a ? '▶' : '◀', 'accent')
    }
    rows.push(segs(label), segs(arrow))
  }
  return rows
}

// Gantt charts: one bar per task on a shared date axis, sections as headers; done tasks green,
// active amber, critical red, a milestone a diamond. Dates as YYYY-MM-DD; durations in d, h, w.
type Gantt = { title?: string; rows: ({ section: string } | { name: string; start: number; end: number; tag?: string })[] }
function ganttOf(src: string): Gantt | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (lines[0] !== 'gantt') return undefined
  const DAY = 86_400_000
  const date = (x: string) => (/^\d{4}-\d{2}-\d{2}$/.test(x) ? Date.parse(x + 'T00:00:00Z') : NaN)
  const span = (x: string) => { const m = /^(\d+(?:\.\d+)?)([dhw])$/.exec(x); return m ? Number(m[1]) * (m[2] === 'h' ? DAY / 24 : m[2] === 'w' ? 7 * DAY : DAY) : NaN }
  const g: Gantt = { rows: [] }
  const ends = new Map<string, number>()
  let last = NaN
  for (const l of lines.slice(1)) {
    if (/^title\s/.test(l)) { g.title = l.slice(6).trim(); continue }
    if (/^dateFormat\s/.test(l)) { if (!/YYYY-MM-DD/.test(l)) return undefined; continue }
    if (/^(axisFormat|excludes|todayMarker|tickInterval|weekday)\b/.test(l)) continue
    if (/^section\s/.test(l)) { g.rows.push({ section: l.slice(8).trim() }); continue }
    const m = /^([^:]+):\s*(.*)$/.exec(l)
    if (!m) return undefined
    const fields = m[2]!.split(',').map(f => f.trim()).filter(Boolean)
    const tags = fields.filter(f => /^(done|active|crit|milestone)$/.test(f))
    const rest = fields.filter(f => !tags.includes(f))
    let id: string | undefined, startF: string | undefined, endF: string
    if (rest.length >= 3) [id, startF, endF] = rest as [string, string, string]
    else if (rest.length === 2) [startF, endF] = rest as [string, string]
    else if (rest.length === 1) endF = rest[0]!
    else return undefined
    const after = startF ? /^after\s+(\S+)/.exec(startF) : null
    const start = after ? ends.get(after[1]!) ?? NaN : startF ? date(startF) : last
    const end = Number.isFinite(date(endF)) ? date(endF) : start + span(endF)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined
    if (id) ends.set(id, end)
    last = end
    g.rows.push({ name: m[1]!.trim(), start, end, tag: tags.includes('milestone') ? 'milestone' : tags.find(t => t !== 'milestone') })
  }
  return g.rows.some(r => 'name' in r) ? g : undefined
}
function ganttRows(g: Gantt, room: number): Seg2[][] | undefined {
  const tasks = g.rows.filter((r): r is { name: string; start: number; end: number; tag?: string } => 'name' in r)
  const t0 = Math.min(...tasks.map(t => t.start)), t1 = Math.max(...tasks.map(t => t.end))
  const labelW = Math.min(24, Math.max(...tasks.map(t => strWidth(t.name)), ...g.rows.map(r => ('section' in r ? strWidth(r.section) : 0))))
  const barRoom = room - labelW - 2
  if (barRoom < 12) return undefined
  const at = (ms: number) => ((ms - t0) / Math.max(1, t1 - t0)) * barRoom
  const day = (ms: number) => new Date(ms).toISOString().slice(5, 10)
  const out: Seg2[][] = []
  if (g.title) out.push([{ text: g.title, role: 'strong' }])
  const a = day(t0), b = day(t1)
  out.push([{ text: ' '.repeat(labelW + 2) }, { text: a + ' '.repeat(Math.max(1, barRoom - a.length - b.length)) + b, role: 'note' }])
  out.push([{ text: ' '.repeat(labelW + 2) }, { text: '▏' + '─'.repeat(Math.max(0, barRoom - 2)) + '▏', role: 'dim' }])
  for (const r of g.rows) {
    if ('section' in r) { out.push([{ text: clip(r.section, labelW + 2), role: 'dim' }]); continue }
    const name = strWidth(r.name) > labelW ? clip(r.name, labelW) : r.name + ' '.repeat(labelW - strWidth(r.name))
    // every bar stays on the axis: a milestone or task at the very end draws in the last cell
    const from = Math.min(barRoom - 1, Math.floor(at(r.start)))
    const ink = r.tag === 'done' ? 'ok' : r.tag === 'active' ? 'note' : r.tag === 'crit' ? 'warn' : 'accent'
    const bar = r.tag === 'milestone' ? '◆' : barOf(Math.min(barRoom - from, Math.max(0.5, at(r.end) - from)))
    out.push([{ text: name + '  ' + ' '.repeat(from) }, { text: bar, role: ink }])
  }
  return out
}

// The width a table or picture draws at (undefined: it is not one, or it doesn't draw).
function naturalWidth(part: Part, room: number, th: Theme): number | undefined {
  if (part.kind === 'table') {
    const table = parseTable(part.md)
    return table ? Math.max(...layoutTable(table, room, th.tableStyle).map(l => l.reduce((n, sg) => n + strWidth(sg.text), 0))) : undefined
  }
  if (part.kind !== 'code' || part.open || (part.lang !== 'figure' && part.lang !== 'mermaid')) return undefined
  let rows: Seg2[][] | undefined
  if (part.lang === 'figure') { const fig = figureOf(part.copy, room); rows = 'lines' in fig ? fig.lines : undefined }
  else {
    const chart = chartOf(part.copy), flow = chart ? undefined : flowOf(part.copy), seq = chart || flow ? undefined : seqOf(part.copy), gantt = chart || flow || seq ? undefined : ganttOf(part.copy)
    const state = chart || flow || seq || gantt ? undefined : stateOf(part.copy), model = chart || flow || seq || gantt || state ? undefined : modelOf(part.copy)
    rows = chart ? chartRows(chart, room) : flow ? flowRows(flow, room) : seq ? seqRows(seq, room) : gantt ? ganttRows(gantt, room) : state ? flowRows(state, room) : model ? modelRows(model, room)
      : mindmapRows(part.copy, room) ?? journeyRows(part.copy, room) ?? gitRows(part.copy, room) ?? quadrantRows(part.copy, room)
        ?? timelineRows(part.copy, room) ?? sankeyRows(part.copy, room) ?? ((c4) => (c4 ? modelRows(c4, room) : undefined))(c4Of(part.copy))
    if (chart) return Math.min(room, Math.max(...(rows ?? []).map(r => strWidth(r.map(sg => sg.text).join('').trimEnd())), 30)) // bars fill what they get
  }
  return rows ? Math.max(...rows.map(r => strWidth(r.map(sg => sg.text).join('').trimEnd()))) : undefined
}
// Back-to-back tables and pictures share a row when they fit side by side; the rest stack.
// The copy buttons above each need their width too, unless they only show on hover.
function sideBySide(ui: ElementTable, els: any[], parts: Part[], room: number, th: Theme, hov: boolean) {
  const { Box } = ui
  const widths = parts.map(part => {
    const w = naturalWidth(part, room, th)
    return w === undefined ? undefined : Math.max(w, hov ? 0 : part.kind === 'table' ? 46 : 32)
  })
  const out: any[] = []
  for (let i = 0; i < els.length;) {
    let j = i
    let used = widths[i] ?? Infinity
    while (j + 1 < els.length && widths[j + 1] !== undefined && used + 3 + widths[j + 1]! <= room) { j++; used += 3 + widths[j]! }
    if (j > i && widths[i] !== undefined) {
      out.push(<Box columnGap={3}>{els.slice(i, j + 1).map((el, k) => <Box width={widths[i + k]!} flexShrink={0} flexDirection="column">{el}</Box>)}</Box>)
    } else out.push(els[i])
    i = j + 1
  }
  return out
}

// State diagrams draw like flowcharts: [*] as a source is the start ●, as a target the end ◉.
function stateOf(src: string): Flow | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (!/^stateDiagram(-v2)?\b/.test(lines[0] ?? '')) return undefined
  const flow: Flow = { dir: 'TD', order: [], label: new Map(), out: new Map() }
  const add = (id: string, label?: string) => { if (!flow.label.has(id)) { flow.order.push(id); flow.label.set(id, label ?? id) } else if (label) flow.label.set(id, label) }
  for (const l of lines.slice(1)) {
    if (/^(direction|note|end note|classDef|class|state\s+\S+\s*\{|\}|--)\b/.test(l) || l === '}') { if (/\{$/.test(l)) return undefined; continue }
    const named = /^state\s+"([^"]+)"\s+as\s+(\S+)$/.exec(l)
    if (named) { add(named[2]!, named[1]); continue }
    const edge = /^(\[\*\]|[\w.-]+)\s*-->\s*(\[\*\]|[\w.-]+)\s*(?::\s*(.*))?$/.exec(l)
    if (edge) {
      const from = edge[1] === '[*]' ? '__start' : edge[1]!, to = edge[2] === '[*]' ? '__end' : edge[2]!
      add(from, from === '__start' ? '●' : undefined); add(to, to === '__end' ? '◉' : undefined)
      const list = flow.out.get(from) ?? []; list.push({ to, text: edge[3]?.trim() || undefined }); flow.out.set(from, list)
      continue
    }
    const desc = /^([\w.-]+)\s*:\s*(.+)$/.exec(l)
    if (desc) { add(desc[1]!, desc[2]!.trim()); continue }
    if (/^[\w.-]+$/.test(l)) { add(l); continue }
    return undefined
  }
  return flow.order.length ? flow : undefined
}

// Class and ER diagrams: a box per class or entity with its members, side by side as they fit,
// and the relations under them in words: "Duck ──▷ Animal  inherits".
type Model = { boxes: { name: string; members: string[] }[]; links: { from: string; to: string; mark: string; text: string }[] }
function modelOf(src: string): Model | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  const kind = /^(classDiagram|erDiagram)\b/.exec(lines[0] ?? '')?.[1]
  if (!kind) return undefined
  const m: Model = { boxes: [], links: [] }
  const box = (name: string) => { let b = m.boxes.find(x => x.name === name); if (!b) { b = { name, members: [] }; m.boxes.push(b) } return b }
  let open: { name: string; members: string[] } | undefined
  for (const l of lines.slice(1)) {
    if (open) { if (l === '}') { open = undefined; continue } open.members.push(l.replace(/\s+/g, ' ')); continue }
    const block = /^(?:class\s+)?([\w-]+)\s*\{$/.exec(l)
    if (block) { open = box(block[1]!); continue }
    if (kind === 'classDiagram') {
      const rel = /^([\w-]+)\s*(?:"[^"]*"\s*)?(<\|--|--\|>|\*--|--\*|o--|--o|-->|<--|\.\.>|<\.\.|\.\.\|>|<\|\.\.|--|\.\.)\s*(?:"[^"]*"\s*)?([\w-]+)\s*(?::\s*(.*))?$/.exec(l)
      if (rel) {
        const [, a, op, b, label] = rel as unknown as [string, string, string, string, string | undefined]
        box(a); box(b)
        const kinds: Record<string, [string, string, boolean]> = { '<|--': ['▷', 'inherits', true], '--|>': ['▷', 'inherits', false], '*--': ['◆', 'contains', true], '--*': ['◆', 'contains', false], 'o--': ['◇', 'has', true], '--o': ['◇', 'has', false], '-->': ['▶', 'uses', false], '<--': ['▶', 'uses', true], '..>': ['▶', 'depends on', false], '<..': ['▶', 'depends on', true], '..|>': ['▷', 'implements', false], '<|..': ['▷', 'implements', true], '--': ['─', 'links', false], '..': ['┄', 'links', false] }
        const [mark, word, flip] = kinds[op]!
        m.links.push(flip ? { from: b, to: a, mark, text: label?.trim() || word } : { from: a, to: b, mark, text: label?.trim() || word })
        continue
      }
      const member = /^([\w-]+)\s*:\s*(.+)$/.exec(l)
      if (member) { box(member[1]!).members.push(member[2]!.trim()); continue }
      if (/^class\s+[\w-]+$/.test(l)) { box(l.slice(6).trim()); continue }
    } else {
      const rel = /^([\w-]+)\s*([|}o]{1,2})(--|\.\.)([|{o]{1,2})\s*([\w-]+)\s*:\s*"?([^"]*)"?$/.exec(l)
      if (rel) {
        const many = (x: string) => (/[{}]/.test(x) ? 'many' : 'one')
        box(rel[1]!); box(rel[5]!)
        m.links.push({ from: rel[1]!, to: rel[5]!, mark: '▶', text: `${rel[6]!.trim() || 'relates to'} (${many(rel[2]!)} to ${many(rel[4]!)})` })
        continue
      }
      if (/^[\w-]+$/.test(l)) { box(l); continue }
    }
    if (/^(direction|note|classDef|style|title)\b/.test(l)) continue
    return undefined
  }
  return m.boxes.length ? m : undefined
}
function modelRows(m: Model, room: number): Seg2[][] | undefined {
  const inks = m.boxes.map((_, k) => 'ink:' + SERIES_INKS[k % SERIES_INKS.length])
  const widths = m.boxes.map(b => Math.max(strWidth(b.name), ...b.members.map(strWidth)) + 4)
  if (Math.max(...widths) > room) return undefined
  const out: Seg2[][] = []
  // boxes in rows that fit
  for (let i = 0; i < m.boxes.length;) {
    let j = i, used = widths[i]!
    while (j + 1 < m.boxes.length && used + 2 + widths[j + 1]! <= room) { j++; used += 2 + widths[j]! }
    const group = m.boxes.slice(i, j + 1)
    const height = Math.max(...group.map(b => b.members.length)) + (group.some(b => b.members.length) ? 1 : 0)
    const lines: Seg2[][] = Array.from({ length: height + 3 }, () => [])
    group.forEach((b, k) => {
      const w = widths[i + k]!, ink = inks[i + k]!, gap = k ? '  ' : ''
      const pad = (t: string) => t + ' '.repeat(Math.max(0, w - 4 - strWidth(t)))
      lines[0]!.push({ text: gap }, { text: '╭' + '─'.repeat(w - 2) + '╮', role: ink })
      lines[1]!.push({ text: gap }, { text: '│ ', role: ink }, { text: pad(b.name), role: 'strong' }, { text: ' │', role: ink })
      for (let r = 0; r < height; r++) {
        const row = lines[2 + r]!
        row.push({ text: gap })
        if (r === 0 && b.members.length) row.push({ text: '├' + '─'.repeat(w - 2) + '┤', role: ink })
        else {
          const member = b.members[r - (b.members.length ? 1 : 0)]
          row.push({ text: '│ ', role: ink }, { text: pad(member ?? ''), role: 'dim' }, { text: ' │', role: ink })
        }
      }
      lines[height + 2]!.push({ text: gap }, { text: '╰' + '─'.repeat(w - 2) + '╯', role: ink })
    })
    out.push(...lines)
    i = j + 1
  }
  for (const ln of m.links) {
    const a = m.boxes.findIndex(b => b.name === ln.from), b = m.boxes.findIndex(x => x.name === ln.to)
    out.push([{ text: ln.from, role: inks[a] }, { text: ` ──${ln.mark} `, role: 'accent' }, { text: ln.to, role: inks[b] }, { text: '  ' + ln.text, role: 'note' }])
  }
  return out.some(r => strWidth(r.map(sg => sg.text).join('')) > room) ? undefined : out
}

// Mindmaps: a tree from the root, each top-level branch in its own colour.
function mindmapRows(src: string, room: number): Seg2[][] | undefined {
  const raw = src.split('\n').filter(l => l.trim() && !l.trim().startsWith('%%'))
  if (raw[0]?.trim() !== 'mindmap') return undefined
  const text = (t: string) => t.trim().replace(/^[\w-]*(\(\(|\)\)|\[|\(|\)|\{\{)(.*?)(\)\)|\(\(|\]|\)|\(|\}\})$/, '$2').replace(/^"(.*)"$/, '$1').replace(/::icon\(.*\)/, '').trim()
  type Node = { label: string; depth: number; kids: Node[] }
  const nodes = raw.slice(1).map(l => ({ label: text(l), depth: l.length - l.trimStart().length, kids: [] as Node[] }))
  if (!nodes.length) return undefined
  const top = nodes[0]!, stack: Node[] = [top]
  for (const n of nodes.slice(1)) {
    while (stack.length > 1 && stack.at(-1)!.depth >= n.depth) stack.pop()
    stack.at(-1)!.kids.push(n)
    stack.push(n)
  }
  const out: Seg2[][] = [[{ text: '◉ ', role: 'accent' }, { text: top.label, role: 'strong' }]]
  const walk = (n: Node, prefix: string, ink: string) => n.kids.forEach((k, i) => {
    const last = i === n.kids.length - 1
    out.push([{ text: prefix + (last ? '└─ ' : '├─ '), role: 'dim' }, { text: k.label, role: ink }])
    walk(k, prefix + (last ? '   ' : '│  '), ink)
  })
  top.kids.forEach((k, i) => {
    const ink = 'ink:' + SERIES_INKS[i % SERIES_INKS.length]
    const last = i === top.kids.length - 1
    out.push([{ text: last ? '└─ ' : '├─ ', role: 'dim' }, { text: k.label, role: 'strong' }])
    walk(k, last ? '   ' : '│  ', ink)
  })
  return out.some(r => strWidth(r.map(sg => sg.text).join('')) > room) ? undefined : out
}

// User journeys: each task's score as a bar, red to green, with who took part.
function journeyRows(src: string, room: number): Seg2[][] | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (lines[0] !== 'journey') return undefined
  const rows: ({ section: string } | { task: string; score: number; who: string })[] = []
  let title: string | undefined
  for (const l of lines.slice(1)) {
    if (/^title\s/.test(l)) { title = l.slice(6).trim(); continue }
    if (/^section\s/.test(l)) { rows.push({ section: l.slice(8).trim() }); continue }
    const m = /^(.+?)\s*:\s*(\d)\s*(?::\s*(.*))?$/.exec(l)
    if (!m) return undefined
    rows.push({ task: m[1]!, score: Math.max(0, Math.min(5, Number(m[2]))), who: m[3]?.trim() ?? '' })
  }
  const tasks = rows.filter((r): r is { task: string; score: number; who: string } => 'task' in r)
  if (!tasks.length) return undefined
  const labelW = Math.min(28, Math.max(...tasks.map(t => strWidth(t.task))))
  const out: Seg2[][] = title ? [[{ text: title, role: 'strong' }]] : []
  for (const r of rows) {
    if ('section' in r) { out.push([{ text: r.section, role: 'dim' }]); continue }
    const ink = r.score <= 2 ? 'warn' : r.score === 3 ? 'note' : 'ok'
    const name = strWidth(r.task) > labelW ? clip(r.task, labelW) : r.task + ' '.repeat(labelW - strWidth(r.task))
    out.push([{ text: '  ' + name + '  ' }, { text: '█'.repeat(r.score * 2) + '·'.repeat((5 - r.score) * 2), role: ink }, { text: ` ${r.score}/5`, role: ink }, { text: r.who ? '  ' + r.who : '', role: 'dim' }])
  }
  return out.some(r => strWidth(r.map(sg => sg.text).join('')) > room) ? undefined : out
}

// Git graphs: a lane per branch; ● a commit, ╮ where a branch starts, ╯ where one merges back,
// with each commit's id or tag beside it.
function gitRows(src: string, room: number): Seg2[][] | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (!/^gitGraph\b/.test(lines[0] ?? '')) return undefined
  const lanes = ['main']
  let cur = 0
  const out: Seg2[][] = []
  const inkOf = (k: number) => 'ink:' + SERIES_INKS[k % SERIES_INKS.length]
  const row = (marks: Record<number, string>, label: Seg2[] = []) => {
    const segs: Seg2[] = []
    lanes.forEach((_, k) => {
      const mark = marks[k] ?? '│'
      segs.push({ text: mark, role: marks[k] ? inkOf(k) : 'dim' })
      if (k < lanes.length - 1) segs.push({ text: marks[`${k}+` as unknown as number] ?? ' ', role: 'dim' })
    })
    out.push([...segs, { text: '  ' }, ...label])
  }
  let n = 0
  for (const l of lines.slice(1)) {
    const field = (k: string) => new RegExp(k + ':\\s*"([^"]*)"').exec(l)?.[1]
    if (/^commit\b/.test(l)) {
      n++
      const id = field('id'), tag = field('tag')
      row({ [cur]: '●' }, [{ text: id ?? `${lanes[cur]} ${n}`, role: id ? 'strong' : 'dim' }, ...(tag ? [{ text: `  [${tag}]`, role: 'note' }] : [])])
    } else if (/^branch\s/.test(l)) {
      const name = l.split(/\s+/)[1]!
      if (lanes.includes(name)) return undefined
      lanes.push(name)
      const to = lanes.length - 1
      const marks: Record<string, string> = { [cur]: '├', [to]: '╮' }
      for (let k = cur; k < to; k++) marks[`${k}+`] = '─'
      for (let k = cur + 1; k < to; k++) marks[k] = '┼'
      row(marks as unknown as Record<number, string>, [{ text: name, role: inkOf(to) }])
      cur = to
    } else if (/^(checkout|switch)\s/.test(l)) {
      const k = lanes.indexOf(l.split(/\s+/)[1]!)
      if (k < 0) return undefined
      cur = k
    } else if (/^merge\s/.test(l)) {
      const from = lanes.indexOf(l.split(/\s+/)[1]!)
      if (from < 0) return undefined
      n++
      const lo = Math.min(from, cur), hi = Math.max(from, cur)
      const marks: Record<string, string> = { [cur]: '●', [from]: from > cur ? '╯' : '╰' }
      for (let k = lo; k < hi; k++) marks[`${k}+`] = '─'
      row(marks as unknown as Record<number, string>, [{ text: `merge ${lanes[from]}`, role: 'dim' }, ...(field('tag') ? [{ text: `  [${field('tag')}]`, role: 'note' }] : [])])
    } else if (/^cherry-pick\b/.test(l)) { n++; row({ [cur]: '●' }, [{ text: 'cherry-pick ' + (field('id') ?? ''), role: 'dim' }]) }
    else return undefined
  }
  return out.length && !out.some(r => strWidth(r.map(sg => sg.text).join('')) > room) ? out : undefined
}

// Quadrant charts: a grid split in four with each quadrant's label, the points plotted as numbered
// dots, and a legend under it.
function quadrantRows(src: string, room: number): Seg2[][] | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (lines[0] !== 'quadrantChart') return undefined
  let title: string | undefined, xa = ['', ''], ya = ['', '']
  const quads: string[] = ['', '', '', '']
  const points: { name: string; x: number; y: number }[] = []
  for (const l of lines.slice(1)) {
    const t = /^title\s+(.+)$/.exec(l); if (t) { title = t[1]; continue }
    const ax = /^([xy])-axis\s+(.+?)(?:\s*-->\s*(.+))?$/.exec(l); if (ax) { (ax[1] === 'x' ? xa = [ax[2]!, ax[3] ?? ''] : ya = [ax[2]!, ax[3] ?? '']); continue }
    const q = /^quadrant-([1-4])\s+(.+)$/.exec(l); if (q) { quads[Number(q[1]) - 1] = q[2]!; continue }
    const pt = /^(.+?):\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/.exec(l); if (pt) { points.push({ name: pt[1]!.trim(), x: Number(pt[2]), y: Number(pt[3]) }); continue }
    if (/^(classDef|style)\b/.test(l)) continue
    return undefined
  }
  if (!points.length) return undefined
  const W = Math.min(room - 4, 56) & ~1, H = 12
  if (W < 20) return undefined
  const grid = Array.from({ length: H }, () => Array<string>(W).fill(' '))
  const role = Array.from({ length: H }, () => Array<string | undefined>(W).fill(undefined))
  const put = (r: number, c: number, t: string, ro?: string) => [...t].forEach((ch, k) => { if (r >= 0 && r < H && c + k >= 0 && c + k < W) { grid[r]![c + k] = ch; role[r]![c + k] = ro } })
  for (let r = 0; r < H; r++) put(r, W / 2, '┊', 'dim')
  put(H / 2, 0, '┄'.repeat(W), 'dim'); put(H / 2, W / 2, '┼', 'dim')
  // quadrant 1 top right, 2 top left, 3 bottom left, 4 bottom right
  put(0, W / 2 + 2, clip(quads[0]!, W / 2 - 3), 'note'); put(0, 1, clip(quads[1]!, W / 2 - 3), 'note')
  put(H - 1, 1, clip(quads[2]!, W / 2 - 3), 'note'); put(H - 1, W / 2 + 2, clip(quads[3]!, W / 2 - 3), 'note')
  points.forEach((pt, k) => put(Math.round((1 - Math.min(1, pt.y)) * (H - 1)), Math.round(Math.min(1, pt.x) * (W - 1)), String(k + 1), 'ink:' + SERIES_INKS[k % SERIES_INKS.length]))
  const out: Seg2[][] = title ? [[{ text: title, role: 'strong' }]] : []
  if (ya[1]) out.push([{ text: '  ▲ ' + ya[1], role: 'dim' }])
  grid.forEach((row, r) => {
    const segs: Seg2[] = [{ text: '│ ', role: 'dim' }]
    row.forEach((ch, c) => { const last = segs.at(-1)!; if (last.role === role[r]![c] && segs.length > 1) last.text += ch; else segs.push({ text: ch, role: role[r]![c] }) })
    out.push(segs)
  })
  out.push([{ text: '└' + '─'.repeat(W + 1) + '▶', role: 'dim' }])
  if (xa[0] || xa[1]) out.push([{ text: '  ' + xa[0] + ' '.repeat(Math.max(1, W - strWidth(xa[0]!) - strWidth(xa[1]!))) + xa[1], role: 'dim' }])
  if (ya[0]) out.push([{ text: '  ▼ ' + ya[0], role: 'dim' }])
  points.forEach((pt, k) => out.push([{ text: ` ${k + 1} `, role: 'ink:' + SERIES_INKS[k % SERIES_INKS.length] }, { text: pt.name, role: 'strong' }, { text: `  (${pt.x}, ${pt.y})`, role: 'dim' }]))
  return out.some(r => strWidth(r.map(sg => sg.text).join('')) > room) ? undefined : out
}

// Timelines: each period with its events, sections as headers.
function timelineRows(src: string, room: number): Seg2[][] | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (lines[0] !== 'timeline') return undefined
  const out: Seg2[][] = []
  const periods = lines.slice(1).filter(l => !/^(title|section)\s/.test(l) && !l.startsWith(':'))
  const w = Math.min(16, Math.max(...periods.map(l => strWidth(l.split(':')[0]!.trim())), 4))
  let k = 0
  for (const l of lines.slice(1)) {
    if (/^title\s/.test(l)) { out.push([{ text: l.slice(6).trim(), role: 'strong' }]); continue }
    if (/^section\s/.test(l)) { out.push([{ text: l.slice(8).trim(), role: 'dim' }]); continue }
    const [period, ...events] = l.split(':').map(x => x.trim())
    const ink = 'ink:' + SERIES_INKS[k++ % SERIES_INKS.length]
    if (!period) { out.push([{ text: ' '.repeat(w) + '   │  ' }, { text: events.filter(Boolean).join(' · '), role: 'strong' }]); continue }
    out.push([{ text: (strWidth(period) > w ? clip(period, w) : period + ' '.repeat(w - strWidth(period))) + ' ─', role: ink }, { text: '●', role: ink }, { text: '─ ' }, { text: events.filter(Boolean).join(' · '), role: 'strong' }])
  }
  return out.length && !out.some(r => strWidth(r.map(sg => sg.text).join('')) > room) ? out : undefined
}

// Sankey: each flow as source → target with a bar sized by its value, grouped by source.
function sankeyRows(src: string, room: number): Seg2[][] | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (!/^sankey(-beta)?$/.test(lines[0] ?? '')) return undefined
  const flows = lines.slice(1).map(l => listOf(l)).filter(f => f.length === 3 && Number.isFinite(Number(f[2]))).map(f => ({ from: f[0]!, to: f[1]!, v: Number(f[2]) }))
  if (!flows.length) return undefined
  const fromW = Math.min(18, Math.max(...flows.map(f => strWidth(f.from)))), toW = Math.min(18, Math.max(...flows.map(f => strWidth(f.to))))
  const max = Math.max(...flows.map(f => f.v)), barRoom = room - fromW - toW - 14
  if (barRoom < 6) return undefined
  const order = [...new Set(flows.map(f => f.from))]
  const out: Seg2[][] = []
  order.forEach((src2, k) => flows.filter(f => f.from === src2).forEach((f, j) => {
    const ink = 'ink:' + SERIES_INKS[k % SERIES_INKS.length]
    const pad = (t: string, w: number) => (strWidth(t) > w ? clip(t, w) : t + ' '.repeat(w - strWidth(t)))
    out.push([{ text: j ? ' '.repeat(fromW) : pad(f.from, fromW), role: j ? undefined : 'strong' }, { text: ' ──▶ ', role: 'dim' }, { text: pad(f.to, toW) + ' ' }, { text: barOf((f.v / max) * barRoom), role: ink }, { text: ' ' + fmtNum(f.v), role: 'note' }])
  }))
  return out
}

// C4 diagrams: people and systems as boxes (their kind and description inside), relations in words.
function c4Of(src: string): Model | undefined {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  if (!/^C4(Context|Container|Component|Dynamic|Deployment)\b/.test(lines[0] ?? '')) return undefined
  const m: Model = { boxes: [], links: [] }
  const ids = new Map<string, string>()
  const args = (s2: string) => s2.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x => unquote(x.trim())) // commas outside quotes
  for (const l of lines.slice(1)) {
    const el = /^(Person|Person_Ext|System|System_Ext|SystemDb|SystemDb_Ext|Container|Container_Ext|ContainerDb|Component|ComponentDb)\((.*)\)$/.exec(l)
    if (el) {
      const [id, label, ...rest] = args(el[2]!)
      const kind = el[1]!.replace('_Ext', ' (external)').replace('Db', ' database').replace('Person', 'Person').toLowerCase()
      ids.set(id!, label || id!)
      m.boxes.push({ name: label || id!, members: [kind, ...rest.filter(r => r && !/^\$/.test(r)).slice(0, 2)] })
      continue
    }
    const rel = /^(?:Bi)?Rel(?:_[A-Za-z]+)?\((.*)\)$/.exec(l)
    if (rel) { const [a, b, text, tech] = args(rel[1]!); m.links.push({ from: ids.get(a!) ?? a!, to: ids.get(b!) ?? b!, mark: '▶', text: (text ?? '') + (tech ? ` (${tech})` : '') }); continue }
    if (/^(title|UpdateLayoutConfig|UpdateElementStyle|UpdateRelStyle|LAYOUT_|Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary|\})/.test(l)) continue
    return undefined
  }
  return m.boxes.length ? m : undefined
}

// mermaidAscii: box drawing and blocks as plain ASCII, for terminals or fonts that lack them.
const ASCII: Record<string, string> = { '─': '-', '━': '=', '┄': '.', '│': '|', '┊': ':', '╭': '+', '╮': '+', '╰': '+', '╯': '+', '┌': '+', '┐': '+', '└': '+', '┘': '+', '├': '+', '┤': '+', '┬': '+', '┴': '+', '┼': '+', '▶': '>', '◀': '<', '▷': '>', '◆': '*', '◇': 'o', '●': 'o', '◉': '@', '○': 'o', '▢': '#', '█': '#', '▏': '|', '↺': '^', '·': '.', '✓': 'v', '✗': 'x', '▲': '^', '▼': 'v' }
const asciiArt = (t: string) => [...t.replace(/(?<=█)▏/g, '▉')].map(ch => ASCII[ch] ?? (/[▎▍▌▋▊▉]/.test(ch) ? '#' : ch)).join('')
// pieStyle round: the pie as a circle of coloured cells (a cell is twice as tall as wide), the
// legend beside it, largest slice first.
function pieCircle(chart: Chart, room: number): Seg2[][] | undefined {
  const R = 6, H = 2 * R + 1, W = 4 * R + 2
  const total = chart.rows.reduce((a, r) => a + r.values[0]!, 0) || 1
  const legend = chart.rows.map((r, k) => [{ text: '█ ', role: 'ink:' + SERIES_INKS[k % SERIES_INKS.length] }, { text: r.label, role: 'strong' }, { text: ` ${Math.round((r.values[0]! / total) * 100)}%`, role: 'note' }] as Seg2[])
  if (W + 3 + Math.max(...legend.map(l => strWidth(l.map(sg => sg.text).join('')))) > room) return undefined
  const bounds: number[] = []
  chart.rows.reduce((a, r) => { bounds.push(a + r.values[0]! / total); return a + r.values[0]! / total }, 0)
  const out: Seg2[][] = chart.title ? [[{ text: chart.title, role: 'strong' }]] : []
  for (let y = 0; y < H; y++) {
    const row: Seg2[] = []
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2), dy = (y + 0.5 - H / 2) / (H / 2)
      let role: string | undefined, ch = ' '
      if (dx * dx + dy * dy <= 1) {
        const turn = ((Math.atan2(dx, -dy) / (2 * Math.PI)) + 1) % 1
        const k = bounds.findIndex(b => turn < b)
        role = 'ink:' + SERIES_INKS[(k < 0 ? bounds.length - 1 : k) % SERIES_INKS.length]; ch = '█'
      }
      const last = row.at(-1)
      if (last && last.role === role) last.text += ch; else row.push({ text: ch, role })
    }
    const l = y - Math.floor((H - legend.length) / 2)
    out.push([...row, { text: '   ' }, ...(l >= 0 && l < legend.length ? legend[l]! : [])])
  }
  return out
}

// Code colours. Claude Code's code view has its own; set any code colour and undertone draws code
// blocks itself with a small per-line tokenizer. ponytail: no multi-line comments or strings;
// a grammar-based highlighter if that ever matters.
const CODE_KEYS = ['codeTextColor', 'codeCommandColor', 'codeFlagColor', 'codeStringColor', 'codeCommentColor']
const ownCode = () => CODE_KEYS.some(k => optColor(k, undefined))
const KEYWORDS = new Set('const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw def lambda pass raise with as yield fn pub struct enum impl match use mod func package type interface go defer select public private protected static void true false null None True False nil self this in of is not and or end then elif local'.split(' '))
const isShell = (lang: string) => /^(bash|sh|zsh|fish|shell|console|powershell|ps1|)$/.test(lang)
const CODE_TOKEN = /(\/\/.*$|#.*$|--\s.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(--?[A-Za-z][\w-]*)|([A-Za-z_$][\w$]*)|(\s+|.)/g
type CodeKind = 'text' | 'command' | 'flag' | 'string' | 'comment'
function codeLine(line: string, lang: string): { text: string; kind: CodeKind }[] {
  const shell = isShell(lang)
  const hash = shell || /^(py|python|rb|ruby|yaml|yml|toml|r|perl|make|dockerfile)$/i.test(lang)
  const out: { text: string; kind: CodeKind }[] = []
  let first = true // a shell line's first word is its command; again after | && ; and $
  for (const m of line.matchAll(CODE_TOKEN)) {
    const [t, comment, str, flag, word] = m
    let kind: CodeKind = 'text'
    if (comment && (!comment.startsWith('#') || hash) && (!comment.startsWith('--') || /^(sql|lua|haskell|hs)$/i.test(lang))) {
      out.push({ text: line.slice(m.index), kind: 'comment' }); break
    } else if (str) kind = 'string'
    else if (flag && shell) kind = 'flag'
    else if (word) kind = shell ? (first ? 'command' : 'text') : KEYWORDS.has(word) ? 'flag' : line[m.index + word.length] === '(' || /^[A-Z]/.test(word) ? 'command' : 'text'
    if (shell && !/^\s+$/.test(t)) first = /^(\||&&|;|\$)$/.test(t) || (first && t === '$')
    out.push({ text: t, kind })
  }
  return out
}
function drawCode(ui: ElementTable, th: Theme, src: string, lang: string) {
  const { Box, Text } = ui
  const ink: Record<CodeKind, { color?: string; dimColor?: boolean }> = {
    text: { color: optColor('codeTextColor', th.claude.text) },
    command: { color: optColor('codeCommandColor', th.claude.label) },
    flag: { color: optColor('codeFlagColor', 'warning') },
    string: { color: optColor('codeStringColor', 'success') },
    comment: optColor('codeCommentColor', undefined) ? { color: optColor('codeCommentColor', undefined) } : { dimColor: true },
  }
  return <Box flexDirection="column">{src.split('\n').map(l => <Text>{l ? codeLine(l, lang.toLowerCase()).map(t => <Text {...ink[t.kind]}>{t.text}</Text>) : ' '}</Text>)}</Box>
}

// One rich block, or undefined to leave the part to the drawing it had before.
function richPart($: EngineInterface, ui: ElementTable, part: Part, i: number, th: Theme, room: number, hov: boolean, scope: string) {
  const { Box, Text, Button, Markdown, Code } = ui
  const ink = readableOn(th.claude.fill, th.claude.border)
  const withCopy = (body: any, label: string, what: string, top = false) => {
    if (opt<unknown>('textCopyButtons', true) === false) return body // lists, quotes and alerts without a copy button
    const copy = <Button key={'copy-' + i} plain dimColor label={label} onPress={p => copyText($, part.copy, what, p.surface)} />
    if (hov) return <Box flexDirection="column">{body}{reveal(Box, hov, scope, 'copy-reveal-' + i, copy)}</Box>
    return top ? <Box flexDirection="column"><Box justifyContent="flex-end">{copy}</Box>{body}</Box> : body
  }
  if (part.kind === 'heading') {
    const level = part.level ?? 1
    const style = String(opt('headingStyle', 'banner'))
    const color = optColor('headingColor', level <= 2 ? th.claude.label : level === 3 ? ink : th.claude.text)
    const words = (
      <Text>
        {cellWords(style === 'uppercase' && level === 1 ? part.copy.toUpperCase() : part.copy).map(sg => <Text bold color={sg.code ? th.user.border : color} italic={sg.italic} underline={style === 'underline' && level <= 2}>{sg.text}</Text>)}
      </Text>
    )
    if (style === 'banner' && level === 1) return <Box marginTop={i ? 1 : 0}><Box borderStyle="round" borderColor={th.claude.border} paddingX={1}>{words}</Box></Box>
    if (style === 'banner' && level === 2) return <Box flexDirection="column" marginTop={i ? 1 : 0}>{words}<Text color={th.claude.border}>{'━'.repeat(Math.max(3, room))}</Text></Box>
    return <Box marginTop={i && level <= 3 ? 1 : 0}>{words}</Box>
  }
  if (part.kind === 'md' && colorText() && plainParagraphs(part.md) && !part.md.includes(FN)) return drawParagraphs($, ui, th, part.md, 'p' + i)
  if (part.kind === 'md' && part.md.includes(FN) && part.notes && plainParagraphs(part.md.replaceAll(FN, ''))) {
    const paras = part.md.split(/\n\s*\n/).map(p => p.trim().replace(/\s*\n\s*/g, ' ')).filter(Boolean)
    return <Box flexDirection="column">{paras.map((p, k) => <Box marginTop={k ? 1 : 0}>{drawMarked($, ui, th, p, part.notes!, scope, `fn-${i}-${k}`)}</Box>)}</Box>
  }
  if (part.kind === 'md' && part.md.includes(FN)) return noteMd($, Markdown, part.md, part.notes, 'md-' + i)
  if (part.kind === 'rule') return <Text color={optColor('ruleColor', th.claude.border)} dimColor>{'─'.repeat(Math.max(3, room))}</Text>
  if (part.kind === 'notes') {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={th.claude.border} dimColor>{'─'.repeat(Math.min(12, room))}</Text>
        {part.md.split('\n').map((n, k) => <Box hover={{ scope: noteScope(scope, k + 1), backgroundColor: litBg(th) }}><Markdown text={n} dimColor /></Box>)}
      </Box>
    )
  }
  if (part.kind === 'list') {
    const items = listItems(part.md)
    const style = String(opt('taskStyle', 'brackets'))
    const marks = TASK_MARKS[style] ?? TASK_MARKS.brackets!
    const tasks = items.filter(it => it.task)
    const done = tasks.filter(it => it.task === 'done').length
    const width = Math.max(10, Math.min(20, room - 12))
    const bar = style === 'progress' && tasks.length
      ? <Text><Text color="success">{'▰'.repeat(Math.round((done / tasks.length) * width))}</Text><Text dimColor>{'▱'.repeat(width - Math.round((done / tasks.length) * width)) + `  ${done}/${tasks.length} done`}</Text></Text>
      : null
    const rows = items.map((it, k) => {
      const mark = it.task ? marks[it.task === 'done' ? 1 : 0] : /^\d/.test(it.marker) ? it.marker : opt<string>('listMarker', 'dots') === 'dash' ? '-' : BULLETS[it.depth % BULLETS.length]!
      const plain = colorText() && plainParagraphs(it.text) && !it.text.includes(FN) // marks need Markdown to be clicked
      if (isRtl(it.text)) {
        return (
          <Box justifyContent="flex-end" paddingRight={it.depth * 2}>
            {it.task === 'done' ? <Text dimColor strikethrough dir="rtl">{plainCell(it.text)}</Text> : drawWords(ui, th, it.text.replace(/\s*\n\s*/g, ' '))}
            <Text color={it.task === 'done' ? 'success' : ink}>{' ' + mark}</Text>
          </Box>
        )
      }
      if (plain && it.task !== 'done') {
        return (
          <Box paddingLeft={it.depth * 2}>
            <Box width={[...mark].length + 1} flexShrink={0}><Text color={optColor('bulletColor', ink)}>{mark}</Text></Box>
            <Box flexGrow={1} flexShrink={1}>{drawWords(ui, th, it.text.replace(/\s*\n\s*/g, ' '))}</Box>
          </Box>
        )
      }
      return (
        <Box paddingLeft={it.depth * 2}>
          <Box width={[...mark].length + 1} flexShrink={0}><Text color={it.task === 'done' ? 'success' : optColor('bulletColor', ink)}>{mark}</Text></Box>
          <Box flexGrow={1} flexShrink={1}>
            {it.task === 'done' ? <Text dimColor strikethrough>{plainCell(it.text)}</Text> : noteMd($, Markdown, it.text, part.notes, `li-${i}-${k}`)}
          </Box>
        </Box>
      )
    })
    return withCopy(<Box flexDirection="column" marginTop={i ? 1 : 0}>{bar}{rows}</Box>, '[ copy list ]', 'list', true)
  }
  if (part.kind === 'quote') {
    const inner = part.md.split('\n').map(l => l.replace(/^\s*>\s?/, '')).join('\n') // part.copy without FN
    const alert = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/i.exec(inner)
    if (alert) {
      const base = ALERTS[alert[1]!.toUpperCase()]!
      const a = { ...base, ink: optColor(`alert${base.label}Color`, base.ink)! }
      const rest = inner.slice(alert[0].length).trim()
      return withCopy(
        <Box flexDirection="column" borderStyle="round" borderColor={a.ink} paddingX={1}>
          <Text bold color={a.ink}>{a.label}</Text>
          {rest && noteMd($, Markdown, rest, part.notes, 'alert-' + i)}
        </Box>, '[ copy quote ]', 'quote', true)
    }
    return withCopy(<Box borderStyle="quote" borderColor={optColor('quoteColor', th.claude.border)} paddingLeft={1}>{noteMd($, Markdown, inner, part.notes, 'quote-' + i)}</Box>, '[ copy quote ]', 'quote', true)
  }
  if (part.kind === 'code' && !part.open && (part.lang === 'figure' || part.lang === 'mermaid')) {
    const picture = drawPicture($, ui, part, i, th, room, hov, scope)
    if (picture) return picture
  }
  if (part.kind === 'code') {
    const copy = <Button key={'copy-' + i} plain dimColor label="[ copy code ]" onPress={p => copyText($, part.copy, 'code', p.surface)} />
    return (
      <Box flexDirection="column" marginTop={i ? 1 : 0}>
        <Box justifyContent="space-between">
          <Text bold dimColor>{part.lang || 'code'}</Text>
          {hov ? reveal(Box, hov, scope, 'copy-reveal-' + i, copy) : copy}
        </Box>
        <Box paddingLeft={2}>{ownCode() ? drawCode(ui, th, part.copy, part.lang ?? '') : <Code source={part.copy} language={part.lang || undefined} wrap="wrap" />}</Box>
      </Box>
    )
  }
  return undefined
}

// A figure, chart or flowchart, with [ copy source ] and [ copy art ]; undefined leaves it code.
function drawPicture($: EngineInterface, ui: ElementTable, part: Part, i: number, th: Theme, room: number, hov: boolean, scope: string) {
  const { Box, Text, Button } = ui
  if (part.lang === 'mermaid' && opt<unknown>('mermaid', true) === false) return undefined // mermaid off: the source as code
  const accent = optColor('diagramColor', optColor('accentColor', readableOn(th.claude.fill, th.claude.border)))
  const diagramText = optColor('diagramTextColor', th.claude.text)
  const roleInk: Record<string, { color?: string; dimColor?: true; bold?: true }> = {
    accent: { color: accent }, warn: { color: 'error' }, ok: { color: 'success' }, note: { color: 'warning' },
    dim: { dimColor: true }, strong: { bold: true, color: optColor('diagramTextColor', th.claude.label) },
  }
  let rows: Seg2[][] | undefined
  let note = ''
  if (part.lang === 'figure') {
    const fig = figureOf(part.copy, room)
    if ('error' in fig) note = fig.error
    else rows = fig.lines
  } else {
    const chart = chartOf(part.copy)
    const flow = chart ? undefined : flowOf(part.copy)
    const seq = chart || flow ? undefined : seqOf(part.copy)
    const gantt = chart || flow || seq ? undefined : ganttOf(part.copy)
    const state = chart || flow || seq || gantt ? undefined : stateOf(part.copy)
    const model = chart || flow || seq || gantt || state ? undefined : modelOf(part.copy)
    if (chart) rows = (chart.pie && opt<string>('pieStyle', 'bars') === 'round' ? pieCircle(chart, room) : undefined) ?? chartRows(chart, room)
    else if (flow) rows = flowRows(flow, room)
    else if (seq) rows = seqRows(seq, room)
    else if (gantt) rows = ganttRows(gantt, room)
    else if (state) rows = flowRows(state, room)
    else if (model) rows = modelRows(model, room)
    else rows = mindmapRows(part.copy, room) ?? journeyRows(part.copy, room) ?? gitRows(part.copy, room) ?? quadrantRows(part.copy, room)
      ?? timelineRows(part.copy, room) ?? sankeyRows(part.copy, room) ?? ((c4) => (c4 ? modelRows(c4, room) : undefined))(c4Of(part.copy))
    // a kind undertone does not draw, or one too wide for the bubble: the source stays readable as code
    if (!rows) return undefined
    if (opt<unknown>('mermaidAscii', false) === true) rows = rows.map(r => r.map(sg => ({ ...sg, text: asciiArt(sg.text) })))
  }
  if (!rows) {
    return (
      <Box flexDirection="column">
        <Text dimColor>{note}</Text>
        {richPart($, ui, { ...part, lang: part.lang, open: true }, i, th, room, hov, scope)}
      </Box>
    )
  }
  const art = rows.map(r => r.map(sg => sg.text).join('').trimEnd()).join('\n')
  const copy = (
    <Box columnGap={1}>
      <Text dimColor>copy</Text>
      <Button key={'src-' + i} plain dimColor label="[ source ]" onPress={p => copyText($, part.copy, 'the source', p.surface)} />
      <Button key={'art-' + i} plain dimColor label="[ art ]" onPress={p => copyText($, art, 'the drawing', p.surface)} />
      <Button key={'png-' + i} plain dimColor label="[ png ]" onPress={p => copyPng($, art, th, 'the drawing', p.surface)} />
    </Box>
  )
  const body = (
    <Box flexDirection="column" marginY={1}>
      {rows.map(r => <Text>{r.map(sg => <Text {...(!sg.role ? { color: diagramText } : sg.role.startsWith('ink:') ? { color: sg.role.slice(4) } : roleInk[sg.role] ?? {})}>{sg.text}</Text>)}</Text>)}
    </Box>
  )
  return hov
    ? <Box flexDirection="column">{body}{reveal(Box, hov, scope, 'copy-reveal-' + i, copy)}</Box>
    : <Box flexDirection="column"><Box justifyContent="flex-end">{copy}</Box>{body}</Box>
}
function chartRows(chart: Chart, room: number): Seg2[][] {
  const out: Seg2[][] = []
  if (chart.title) out.push([{ text: chart.title, role: 'strong' }])
  const total = chart.pie ? chart.rows.reduce((a, r) => a + r.values[0]!, 0) || 1 : 0
  const valueText = (v: number) => (chart.pie ? `${fmtNum(v)} · ${Math.round((v / total) * 100)}%` : fmtNum(v))
  const labelW = Math.min(20, Math.max(...chart.rows.map(r => strWidth(r.label))))
  const valueW = Math.max(...chart.rows.flatMap(r => r.values.map(v => valueText(v).length)))
  const max = Math.max(...chart.rows.flatMap(r => r.values), 0) || 1
  const barRoom = Math.max(4, room - labelW - valueW - 3)
  const multi = chart.kinds.length > 1
  const top = Math.max(...chart.rows.map(r => r.values[0]!))
  chart.rows.forEach((r, k) => r.values.forEach((v, sIx) => {
    const cells = Math.max(0, (v / max) * barRoom)
    const label = sIx === 0 ? (strWidth(r.label) > labelW ? clip(r.label, labelW) : r.label + ' '.repeat(labelW - strWidth(r.label))) : ' '.repeat(labelW)
    const ink = multi ? SERIES_INKS[sIx % SERIES_INKS.length]! : !chart.pie && v === top ? 'strong' : chart.pie ? SERIES_INKS[k % SERIES_INKS.length]! : 'accent'
    const mark = chart.kinds[sIx] === 'line' ? '─'.repeat(Math.max(0, Math.round(cells) - 1)) + '●' : barOf(cells)
    out.push([{ text: label + ' ' }, { text: mark, role: ink in { strong: 1, accent: 1 } ? ink : 'ink:' + ink }, { text: ' ' + valueText(v), role: 'note' }])
  }))
  if (multi) out.push(chart.kinds.map((kind, sIx) => ({ text: `${kind === 'line' ? '●' : '█'} series ${sIx + 1}   `, role: 'ink:' + SERIES_INKS[sIx % SERIES_INKS.length] })))
  return out
}
function flowRows(flow: Flow, room: number): Seg2[][] | undefined {
  const ins = new Map<string, number>()
  for (const list of flow.out.values()) for (const ed of list) ins.set(ed.to, (ins.get(ed.to) ?? 0) + 1)
  const inkOf = (id: string) => 'ink:' + SERIES_INKS[flow.order.indexOf(id) % SERIES_INKS.length]
  const roots = flow.order.filter(id => !ins.get(id))
  const edges = [...flow.out.values()].reduce((a, l) => a + l.length, 0)
  const chain = roots.length === 1 && edges === flow.order.length - 1 && flow.order.every(id => (flow.out.get(id)?.length ?? 0) <= 1 && (ins.get(id) ?? 0) <= 1)
  if (chain) {
    const seq: string[] = [roots[0]!]
    while (flow.out.get(seq.at(-1)!)?.[0]) seq.push(flow.out.get(seq.at(-1)!)![0]!.to)
    const boxes = seq.map(id => flow.label.get(id)!)
    const arrows = seq.slice(1).map((id, k) => flow.out.get(seq[k]!)![0]!.text)
    const arrowOf = (t?: string) => (t ? `─ ${t} ─▶` : '──▶')
    const cells = (x: string) => strWidth(x.replace(/▶/g, '>')) // ▶ draws one column wide
    const width = boxes.reduce((a, b) => a + strWidth(b) + 4, 0) + arrows.reduce((a, t) => a + cells(arrowOf(t)) + 2, 0)
    if (flow.dir === 'LR' && width <= room) {
      const top: Seg2[] = [], mid: Seg2[] = [], bot: Seg2[] = []
      boxes.forEach((b, k) => {
        const w = strWidth(b) + 2
        top.push({ text: '╭' + '─'.repeat(w) + '╮', role: inkOf(seq[k]!) })
        mid.push({ text: '│ ', role: inkOf(seq[k]!) }, { text: b, role: 'strong' }, { text: ' │', role: inkOf(seq[k]!) })
        bot.push({ text: '╰' + '─'.repeat(w) + '╯', role: inkOf(seq[k]!) })
        if (k < arrows.length) {
          const a = ' ' + arrowOf(arrows[k]) + ' '
          top.push({ text: ' '.repeat(cells(a)) }); mid.push({ text: a, role: 'dim' }); bot.push({ text: ' '.repeat(cells(a)) })
        }
      })
      return [top, mid, bot]
    }
    const out: Seg2[][] = []
    boxes.forEach((b, k) => {
      const w = strWidth(b) + 2
      if (w + 2 > room) return
      out.push([{ text: '╭' + '─'.repeat(w) + '╮', role: inkOf(seq[k]!) }])
      out.push([{ text: '│ ', role: inkOf(seq[k]!) }, { text: b, role: 'strong' }, { text: ' │', role: inkOf(seq[k]!) }])
      out.push([{ text: '╰' + '─'.repeat(w) + '╯', role: inkOf(seq[k]!) }])
      if (k < arrows.length) { out.push([{ text: '  │' + (arrows[k] ? ' ' + arrows[k] : ''), role: 'dim' }]); out.push([{ text: '  ▼', role: 'dim' }]) }
    })
    return out.length ? out : undefined
  }
  // a tree from each root; a node met again is named with ↺ and not expanded twice
  const out: Seg2[][] = []
  const seen = new Set<string>()
  const walk = (id: string, prefix: string, lead: Seg2[]) => {
    const again = seen.has(id)
    const marker = id === '__start' || id === '__end' // a state diagram's ● start and ◉ end are their own mark
    out.push([...lead, ...(marker ? [] : [{ text: '▢ ', role: inkOf(id) }]), { text: flow.label.get(id)!, role: again ? 'dim' : marker ? 'accent' : 'strong' }, ...(again ? [{ text: ' ↺', role: 'dim' }] : [])])
    if (again) return
    seen.add(id)
    const kids = flow.out.get(id) ?? []
    kids.forEach((ed, k) => {
      const last = k === kids.length - 1
      walk(ed.to, prefix + (last ? '    ' : '│   '), [{ text: prefix + (last ? '└─' : '├─'), role: 'dim' }, { text: ed.text ? ` ${ed.text} ` : '', role: 'note' }, { text: '─▶ ', role: 'dim' }])
    })
  }
  for (const r of roots.length ? roots : [flow.order[0]!]) walk(r, '', [])
  for (const id of flow.order) if (!seen.has(id)) walk(id, '', [])
  return out.some(r => strWidth(r.map(sg => sg.text).join('')) > room) ? undefined : out
}

// A footnote mark is its superscript number and FN, a word joiner nothing else writes. Drawn
// through Markdown the mark becomes a link a click answers with its note in a toast; anywhere
// else, and in every copy, FN is dropped.
const FN = '\u2060'
const FN_MARK = /([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\u2060/g
const fromSuperscript = (m: string) => Number([...m].map(ch => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch)).join(''))
const noteHref = (n: number) => `file:///footnote/${n}`
function noteMd($: EngineInterface, Markdown: ElementTable['Markdown'], text: string, notes: string[] | undefined, key: string, dim = false) {
  if (!notes?.length || !text.includes(FN)) return <Markdown text={text.replaceAll(FN, '')} dimColor={dim} />
  const hrefs: string[] = []
  const linked = text.replace(FN_MARK, (_, m: string) => { const h = noteHref(fromSuperscript(m)); hrefs.push(h); return `[${m}](${h})` })
  return <Markdown key={key} text={linked} dimColor={dim} pressableLinks={hrefs} onLinkPress={link => {
    const n = Number(/\/footnote\/(\d+)$/.exec(link.href)?.[1])
    const note = notes[n - 1]
    if (note) $.ui.toast(`${superscript(String(n))} ${note}`)
  }} />
}

// A paragraph with footnote marks, word by word: each mark a link (a click shows its note) in a
// Box that lights with its note while either is pointed at.
const noteScope = (scope: string, n: number) => `${scope}-fn${n}`.slice(-64)
// A soft grey behind a lit mark and its note, a step off the background.
const litBg = (th: Theme) => (/light|latte|dawn/.test(th.name) ? '#e4e7ee' : '#3a3f4b')
function drawMarked($: EngineInterface, ui: ElementTable, th: Theme, text: string, notes: string[], scope: string, key: string) {
  const { Box, Text, Markdown } = ui
  const lit = litBg(th)
  const out: JSX.Element[] = []
  text.split(new RegExp(FN_MARK.source)).forEach((piece, j) => {
    if (j % 2) {
      const n = fromSuperscript(piece), href = noteHref(n)
      out.push(
        <Box hover={{ scope: noteScope(scope, n), backgroundColor: lit }}>
          <Markdown key={`${key}-m${j}`} text={`[${piece}](${href})`} pressableLinks={[href]} onLinkPress={() => { if (notes[n - 1]) $.ui.toast(`${superscript(String(n))} ${notes[n - 1]}`) }} />
        </Box>,
      )
      return
    }
    for (const sg of textWords(piece)) for (const w of sg.text.split(/(?<=\s)/)) if (w) out.push(<Text bold={sg.bold} italic={sg.italic} strikethrough={sg.strike} color={wordInk(sg, th)}>{w}</Text>)
  })
  return <Box flexWrap="wrap">{out}</Box>
}

function splitReply(text: string, rich = false): Part[] {
  const parts: Part[] = []
  // Footnotes: [^id] marks become superscript numbers, the notes a block at the end.
  const notes: string[] = []
  if (rich && /\[\^[^\]\s]+\]/.test(text)) {
    const defs = new Map<string, string>()
    text = text.replace(/^\[\^([^\]\s]+)\]:[ \t]*(.*)$/gm, (_, id: string, note: string) => { defs.set(id, note); return '' })
    const order: string[] = []
    text = text.replace(/\[\^([^\]\s]+)\]/g, (m, id: string) => {
      if (!defs.has(id)) return m
      if (!order.includes(id)) order.push(id)
      return superscript(String(order.indexOf(id) + 1)) + FN
    })
    for (const id of order) notes.push(`${superscript(String(order.indexOf(id) + 1))} ${defs.get(id)}`)
  }
  const lines = text.split('\n')
  let md: string[] = []
  const flush = () => { if (md.join('').trim()) { const t = md.join('\n').replace(/\n+$/, ''); parts.push({ kind: 'md', md: t, copy: t }) } md = [] }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fence = line.match(/^\s*(`{3,}|~{3,})/)
    const dollars = rich && /^\s*\$\$/.test(line)
    if (dollars) {
      // $$ … $$ on one line, or opening and closing lines of their own
      const one = /^\s*\$\$(.+)\$\$\s*$/.exec(line)
      const close = one ? i : lines.findIndex((l, j) => j > i && /\$\$\s*$/.test(l))
      const end = close === -1 ? lines.length - 1 : close
      flush()
      const src = one ? one[1]! : lines.slice(i, end + 1).join('\n').replace(/^\s*\$\$/, '').replace(/\$\$\s*$/, '')
      parts.push({ kind: 'math', md: lines.slice(i, end + 1).join('\n'), copy: src.trim(), open: close === -1 })
      i = end
    } else if (fence && rich && /^\s*(`{3,}|~{3,})\s*(math|latex|tex)\s*$/.test(line)) {
      const close = lines.findIndex((l, j) => j > i && l.trim().startsWith(fence[1]!))
      const end = close === -1 ? lines.length - 1 : close
      flush()
      parts.push({ kind: 'math', md: lines.slice(i, end + 1).join('\n'), copy: lines.slice(i + 1, close === -1 ? lines.length : end).join('\n').trim(), open: close === -1 })
      i = end
    } else if (fence) {
      const close = lines.findIndex((l, j) => j > i && l.trim().startsWith(fence[1]!))
      const end = close === -1 ? lines.length - 1 : close
      flush()
      const block = lines.slice(i, end + 1)
      const lang = line.trim().slice(fence[1]!.length).trim().split(/\s+/)[0] ?? ''
      parts.push({ kind: 'code', md: block.join('\n'), copy: lines.slice(i + 1, close === -1 ? lines.length : end).join('\n'), lang, open: close === -1 })
      i = end
    } else if (line.includes('|') && TABLE_RULE.test(lines[i + 1] ?? '')) {
      // header row + alignment row, then every following row that has a pipe
      let end = i + 1
      while (end + 1 < lines.length && lines[end + 1]!.includes('|') && lines[end + 1]!.trim()) end++
      flush()
      const block = lines.slice(i, end + 1).join('\n')
      parts.push({ kind: 'table', md: block, copy: block })
      i = end
    } else if (/^\s*>/.test(line)) {
      let end = i
      while (end + 1 < lines.length && /^\s*>/.test(lines[end + 1]!)) end++
      flush()
      const block = lines.slice(i, end + 1)
      parts.push({ kind: 'quote', md: block.join('\n'), copy: block.map(l => l.replace(/^\s*>\s?/, '')).join('\n') })
      i = end
    } else if (rich && HEADING.test(line)) {
      flush()
      const m = HEADING.exec(line)!
      parts.push({ kind: 'heading', md: line, copy: m[2]!, level: m[1]!.length })
    } else if (rich && RULE.test(line)) {
      flush()
      parts.push({ kind: 'rule', md: line, copy: line })
    } else if (rich && LIST_ITEM.test(line)) {
      // the items, their indented continuation lines, and blank lines between items
      let end = i
      while (end + 1 < lines.length) {
        const next = lines[end + 1]!
        if (LIST_ITEM.test(next) || (/^\s{2,}\S/.test(next) && !/^\s*(`{3,}|~{3,})/.test(next))) end++
        else if (!next.trim() && LIST_ITEM.test(lines[end + 2] ?? '') && listKind(lines[end + 2]!) === listKind(lines[i]!)) end++
        else break
      }
      flush()
      const block = lines.slice(i, end + 1).join('\n')
      parts.push({ kind: 'list', md: block, copy: block })
      i = end
    } else md.push(line)
  }
  flush()
  if (notes.length) {
    const byNumber = notes.map(n => n.replace(/^\S+ /, ''))
    for (const p of parts) { p.notes = byNumber; p.copy = p.copy.replaceAll(FN, '') }
    parts.push({ kind: 'notes', md: notes.join('\n'), copy: notes.join('\n') })
  }
  // Inline $…$ math: italic, symbols as symbols. A price ("$5 and $10") is not math: the text
  // between must start and end with a non-space and not be followed by a digit.
  // The copy keeps what Claude wrote; only the drawn text changes.
  if (rich) for (const part of parts) if (part.kind === 'md' || part.kind === 'list') {
    part.md = part.md.replace(/(^|[^\\$\w])\$(?=[^\s$])([^$\n]*?[^\s\\$])\$(?![\d$\w])/g, (m, pre: string, body: string) => (/[\\^_{}a-zA-Z=<>]/.test(body) ? `${pre}*${texToText(body)}*` : m))
  }
  return parts
}

// ---------- Setup steps ----------
const SHAPE_NAMES = ['preset', 'rounded', 'sharp', 'double', 'bold', 'dashed', 'ascii', 'bar', 'none']
function setupSteps() {
  return [
    { key: 'theme', title: 'Theme', hint: 'Colours (and the default shapes). Pick one to preview it below.', options: [...Object.keys(THEMES), 'random'] },
    { key: 'bubbleStyle', title: 'Bubble style', hint: 'framed = outlined; filled = solid chat-app bubbles; preset = as the theme defines.', options: ['preset', 'framed', 'filled'] },
    { key: 'userShape', title: 'Your bubble shape', hint: 'rounded, sharp corners, double, bold, dashed, ascii (+--+), bar (left line only), none.', options: SHAPE_NAMES },
    { key: 'claudeShape', title: "Claude's bubble shape", hint: 'Same choices as yours.', options: SHAPE_NAMES },
    { key: 'padding', title: 'Padding', hint: 'Space inside bubbles.', options: ['preset', 'compact', 'normal', 'roomy'] },
    { key: 'spacing', title: 'Spacing', hint: 'Blank lines between messages.', options: ['preset', 'tight', 'normal', 'airy'] },
    { key: 'userAlign', title: 'Your bubbles', hint: 'right = chat app; left = one column like a log.', options: ['preset', 'right', 'left'] },
    { key: 'buttons', title: 'Bubble buttons', hint: 'hover = ☆ and copy appear only under the pointer (fullscreen); inline = always shown.', options: ['hover', 'inline'] },
    { key: 'timeFormat', title: 'Time format', hint: 'precise = 4:47:12.345 PM UTC+8; short = 4:47 PM; 24h = 16:47.', options: ['precise', 'short', '24h', 'off'] },
  ]
}

// ---------- On / off ----------
// /undertone off|on for this session; the `enabled` option is the default.
// On for this row: switched on, and drawn on a surface the surfaces setting names ("all", or a
// list like "terminal,vscode"); the rest keep Claude Code's own drawing.
async function isOn($: EngineInterface, e?: { surface?: string }) {
  const v = (await $.state.get(ENABLED)).value
  if (!(v ?? opt<unknown>('enabled', true) !== false)) return false
  const surfaces = String(opt('surfaces', 'all')).toLowerCase().split(/[\s,]+/).filter(Boolean)
  return !e?.surface || surfaces.includes('all') || surfaces.includes(e.surface)
}
// Settings for the parts of a reply undertone draws.
const copyOn = () => opt<unknown>('copyButtons', true) !== false
// Without copy buttons: the drawing with every copy button (and the dim "copy" before a copy row)
// taken out, so no row has to know.
function stripCopies(node: any): any {
  if (Array.isArray(node)) return node.map(stripCopies).filter(x => x !== null)
  if (!node || typeof node !== 'object') return node
  if (node.type === 'Button' && /^(copy|cells|html|art|png|src)-/.test(String(node.props?.key ?? node.key ?? ''))) return null
  if (node.type === 'Text' && node.props?.dimColor && JSON.stringify(node.children) === '["copy"]') return null
  return node.children ? { ...node, children: stripCopies(node.children) } : node
}

// ---------- Fold old turns ----------
// True when a row's time is before the fold point and earlier turns are folded.
async function isFolded($: EngineInterface, ms: number | undefined) {
  if (ms === undefined) return false // unknown time: never hide
  const cut = (await $.state.get(CUTOFF)).value
  if (!cut || (await $.state.get(SHOW_OLD)).value) return false
  return ms < cut.ms
}

// ---------- OS notifications ----------
// macOS: osascript; Linux: notify-send; Windows: a PowerShell toast. Silent when unavailable.
async function notify($: EngineInterface, title: string, body: string) {
  if (await windows($)) {
    return ps($, "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; " +
      "$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); " +
      "$t = $x.GetElementsByTagName('text'); [void]$t.Item(0).AppendChild($x.CreateTextNode($p.title)); [void]$t.Item(1).AppendChild($x.CreateTextNode($p.body)); " +
      "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))",
      { title, body }).catch(() => undefined)
  }
  return run($, ['sh', '-c',
    'if [ "$(uname)" = Darwin ]; then osascript -e "on run argv" -e "display notification (item 2 of argv) with title (item 1 of argv)" -e "end run" "$1" "$2"; ' +
    'elif command -v notify-send >/dev/null; then notify-send "$1" "$2"; fi', 'sh', title, body]).catch(() => undefined)
}

// ---------- File viewer ----------
const VIEW_LINES = 2000
async function viewFile($: EngineInterface, path: string) {
  await $.state.set(VIEW_FILE, path)
  await $.ui.open({ id: FILE_PANE, title: path.split(/[\\/]/).pop() || path, focus: true, closeOnEscape: true })
}

// ponytail: one-time import of pins saved under the pre-rename name (chat-timeline). Delete after 1.0.
async function importLegacyPins($: EngineInterface, sid: string) {
  if (await $.store.get('legacyImported')) return undefined
  await $.store.set('legacyImported', true)
  const sep = (await windows($)) ? '\\' : '/'
  for (const dir of await configDirs($).catch(() => [])) {
    const store = dir + sep + 'plugins' + sep + 'store'
    for (const f of await $.fs.list(store).catch(() => [])) {
      if (!f.name.startsWith('chat-timeline_')) continue
      const old = JSON.parse(await $.fs.read(store + sep + f.name).catch(() => '{}')) as Record<string, unknown>
      for (const [k, v] of Object.entries(old)) if (k.startsWith('pins:') || k === 'theme') await $.store.set(k, v)
      return old['pins:' + sid] as Record<string, Pin> | undefined
    }
  }
  return undefined
}

// ---------- Bookmarks ----------
type Pin = { who: string; text: string; ms?: number }
async function starButton($: EngineInterface, Button: any, who: string, text: string, ms: number | undefined) {
  const key = textKey(text)
  const isPinned = !!((await $.state.get(PINS)).value ?? {})[key]
  // ponytail: ☆/★ are ambiguous-width (2 cells in some terminals, counted as 1), so the hover highlight can cover half; ✧/✦ avoid it but read too small.
  return <Button key={'star-' + key} plain dimColor={!isPinned} label={isPinned ? ' ★ ' : ' ☆ '} onPress={() => togglePin($, key, { who, text, ms })} />
}
async function isPinned($: EngineInterface, text: string) {
  return !!((await $.state.get(PINS)).value ?? {})[textKey(text)]
}
// Buttons shown only while the pointer is over the bubble (scope), overlaid top-right so
// they take no row. Hover needs a terminal that reports the mouse (fullscreen layout);
// elsewhere, or with buttons = inline, they draw in place.
const hoverButtons = (e: { viewport?: { isFullscreen?: boolean } }) => opt<string>('buttons', 'hover') === 'hover' && e.viewport?.isFullscreen === true
function reveal(Box: any, hover: boolean, scope: string, key: string, children: any) {
  if (!hover) return children
  return <Box key={key} position="absolute" top={0} right={0} display="none" hover={{ scope, display: 'flex' }}>{children}</Box>
}
async function togglePin($: EngineInterface, key: string, pin: Pin) {
  const pins = { ...((await $.state.get(PINS)).value ?? {}) }
  if (pins[key]) delete pins[key]
  else pins[key] = pin
  await $.state.set(PINS, pins)
  await $.store.set('pins:' + (await $.session.id()), pins) // survives restart / resume
  $.ui.toast(pins[key] ? 'Pinned' : 'Unpinned')
}
// ---------- Agents ----------
// Each agent keeps one colour, picked from Claude Code's theme keys by its name, so it follows
// the terminal's light or dark palette.
const AGENT_INKS = ['permission', 'success', 'warning', 'planMode', 'autoAccept', 'ide', 'merged']
const agentInk = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0; return AGENT_INKS[h % AGENT_INKS.length]! }
const isAgentTool = (tool: string) => tool === 'Agent' || tool === 'Task'
const ACTIVE = new Set(['pending', 'running', 'waiting', 'idle'])
// Agents seen working since your last prompt, so a finished one still shows (○) until the next.
const turnAgents = new Set<string>()
const agentCalls = new Map<string, string>() // background agent id → the tool_use_id that started it
async function agentStrip($: EngineInterface) {
  const list = await $.agent.list().catch(() => [])
  const out: { glyph: string; ink: string | undefined; label: string; dim: boolean }[] = []
  for (const a of list) {
    const name = a.teammateId?.split('@')[0] || a.type
    if (ACTIVE.has(a.status)) turnAgents.add(a.id)
    else if (!turnAgents.has(a.id)) continue
    const done = !ACTIVE.has(a.status)
    out.push({
      glyph: !done ? '●' : a.status === 'failed' ? '✗' : a.status === 'killed' ? '⊘' : '○',
      ink: !done ? agentInk(name) : a.status === 'failed' ? 'error' : undefined,
      label: done ? `${name} (${a.status === 'completed' ? 'done' : a.status})` : `${name} · ${clip(a.description, 32)}`,
      dim: done,
    })
  }
  return out.slice(-6)
}

// ---------- Reactions ----------
// 💖 rather than ❤️: the heart's variation selector makes terminals misjudge its width.
const REACTION_SET = ['👍', '💖', '😂', '🤯']
async function toggleReaction($: EngineInterface, key: string, emoji: string) {
  const all = { ...((await $.state.get(REACTIONS)).value ?? {}) }
  const mine = all[key] ?? []
  const next = mine.includes(emoji) ? mine.filter(x => x !== emoji) : [...mine, emoji]
  if (next.length) all[key] = next
  else delete all[key]
  await $.state.set(REACTIONS, all)
  await $.state.set({ ...REACT_OPEN, id: key }, false)
  await $.store.set('reactions:' + (await $.session.id()), all).catch(() => {}) // survives restart / resume
}
const reactButton = ($: EngineInterface, Button: any, key: string) =>
  <Button key={'react-' + key} plain dimColor label="[ react ]" onPress={async () => $.state.set({ ...REACT_OPEN, id: key }, !((await $.state.get({ ...REACT_OPEN, id: key })).value ?? false))} />
// The bubble's reactions (press one to take it back), and the picker while [ react ] is open.
async function reactionRow($: EngineInterface, ui: { Box: any; Button: any }, key: string) {
  const { Box, Button } = ui
  const mine = ((await $.state.get(REACTIONS)).value ?? {})[key] ?? []
  const open = (await $.state.get({ ...REACT_OPEN, id: key })).value ?? false
  if (!mine.length && !open) return null
  return (
    <Box columnGap={1} flexWrap="wrap">
      {mine.map(r => <Button key={'had-' + r + key} plain label={r} onPress={() => toggleReaction($, key, r)} />)}
      {open && REACTION_SET.filter(r => !mine.includes(r)).map(r => <Button key={'pick-' + r + key} plain dimColor label={r} onPress={() => toggleReaction($, key, r)} />)}
      {open && <Button key={'pick-x' + key} plain dimColor label="×" onPress={() => $.state.set({ ...REACT_OPEN, id: key }, false)} />}
    </Box>
  )
}

// ---------- Quote-reply ----------
// [ reply ] puts the text you selected in this reply (else its first lines) at the top of the
// prompt as a > quote, above whatever you had typed.
async function quoteReply($: EngineInterface, requestId: string | undefined, text: string) {
  const sel = await $.ui.selection().catch(() => undefined)
  const src = sel && sel.requestId === requestId && sel.text.trim() ? sel.text.trim() : text.trim().split('\n').slice(0, 6).join('\n')
  const quote = src.split('\n').map(l => ('> ' + l).trimEnd()).join('\n') + '\n\n'
  const box = await $.prompt.read().catch(() => ({ text: '' }))
  const r = await $.prompt.fill({ text: quote + box.text }).catch(() => undefined)
  if (!r?.isFilled) $.ui.toast('Could not fill the prompt')
}

// ---------- Read receipts ----------
// A prompt you sent (yours, or a quick reply undertone sent as you) starts unread; Claude's first
// reply or tool call marks it read.
const isYours = (o: { kind: string; name?: string; asUser?: true } | undefined) => o?.kind === 'composer' || (o?.kind === 'plugin' && o.name === 'undertone' && o.asUser === true)
async function markRead($: EngineInterface) {
  const lp = (await $.state.get(LAST_PROMPT)).value
  if (lp && !lp.read) await $.state.set(LAST_PROMPT, { ...lp, read: true })
}
async function sortedPins($: EngineInterface) {
  return Object.values((await $.state.get(PINS)).value ?? {}).sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0))
}
// Plain text, for surfaces that show the command's text as is.
async function pinsText($: EngineInterface) {
  const pins = await sortedPins($)
  if (!pins.length) return 'No pinned messages. Click ☆ on a bubble to pin it.'
  const now = await $.clock.now()
  const lines = [`Pinned messages (${pins.length})`, '']
  for (const p of pins) {
    lines.push(`★ ${p.ms && offsetMin !== undefined ? fmt(p.ms, now, offsetMin) + ' · ' : ''}${p.who}`)
    lines.push('    ' + clip(p.text, 160), '')
  }
  return lines.join('\n').trimEnd()
}

// ---------- Export ----------
// Every row's time, from a fresh full read (independent of the live index).
async function allTimes($: EngineInterface) {
  const path = transcriptPath ?? (await findTranscript($))
  const times: Record<string, number> = {}
  if (!path) return times
  let off = 0
  for (;;) {
    const chunk = await readChunk($, path, off)
    if (!chunk) break
    const cut = chunk.lastIndexOf('\n')
    const full = byteLength(chunk) >= CHUNK - 4
    if (cut < 0) { if (full) { off += byteLength(chunk); continue } break }
    const complete = chunk.slice(0, cut + 1)
    off += byteLength(complete)
    for (const line of complete.split('\n')) {
      if (!line.includes('"timestamp"')) continue
      let row: any
      try { row = JSON.parse(line) } catch { continue }
      const ms = Date.parse(row.timestamp)
      const c = row.message?.content
      if (!ms) continue
      if (typeof c === 'string') times[textKey(c)] ??= ms
      else if (Array.isArray(c)) for (const b of c) if (b?.type === 'text' && typeof b.text === 'string') times[textKey(b.text)] ??= ms
    }
    if (!full) break
  }
  return times
}
async function exportChat($: EngineInterface, target: string) {
  const fresh = await allTimes($).catch(() => ({} as Record<string, number>))
  const msgs = await $.session.messages()
  if ('deny' in msgs) return 'Export refused: ' + String(msgs.deny)
  const now = await $.clock.now()
  const out: string[] = [`# Chat export — ${offsetMin !== undefined ? fmtPrecise(now, now, offsetMin) : new Date(now).toISOString()}`, '']
  let n = 0
  let timed = 0
  for (const m of msgs) {
    const text = m.text.trim()
    if (!text || (m.role === 'user' && m.toolResults?.length)) continue
    const ms = fresh[textKey(text)] ?? idx.times[textKey(text)] ?? ((await $.state.get({ ...STAMPS, id: textKey(text) })).value)
    if (ms) timed++
    const when = ms && offsetMin !== undefined ? ` · ${fmtPrecise(ms, now, offsetMin)}` : ''
    out.push(`### ${m.role === 'user' ? 'You' : 'Claude'}${when}`, '', text, '')
    const reacted = ((await $.state.get(REACTIONS)).value ?? {})[textKey(text)]
    if (reacted?.length) out.push(`<sub>Reactions: ${reacted.join(' ')}</sub>`, '')
    if (m.role === 'assistant' && m.toolUses.length) out.push(`<sub>${m.toolUses.length} tool call(s): ${m.toolUses.map(u => u.tool ?? '').join(', ')}</sub>`, '')
    n++
  }
  const sep = (await windows($)) ? '\\' : '/'
  let path = target.trim()
  if (!path) {
    const home = await homeDir($)
    const dir = (await $.fs.exists(home + sep + 'Downloads').catch(() => false)) ? home + sep + 'Downloads' : home
    path = `${dir}${sep}chat-${new Date(now).toISOString().slice(0, 10)}-${(await $.session.id()).slice(0, 8)}.md`
  }
  await $.fs.write(path, out.join('\n'))
  return `Exported ${n} messages (${timed} with times) to ${path}`
}

// Claude handing work to an agent: "↳ Claude → Explore: find the config ◌ working", then the
// agent's report as its own bubble in its colour, folded when long.
async function drawAgent($: EngineInterface, e: RenderInput<'ToolUse'>) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const call = e.props as Call
  const th = await themeOf($)
  const inp = (call.input ?? {}) as Record<string, unknown>
  const name = (typeof inp.name === 'string' && inp.name) || (typeof inp.subagent_type === 'string' && inp.subagent_type) || 'agent'
  const what = typeof inp.description === 'string' ? inp.description : ''
  // A background agent: its report arrives later as the agent's own message (group chat), and
  // its end comes from turn.complete through AGENT_RUN.
  const run = call.tool_use_id ? (await $.state.get({ ...AGENT_RUN, id: call.tool_use_id })).value : undefined
  const background = !!run || (call.output as { isAsync?: boolean } | undefined)?.isAsync === true
  const ended = run?.status === 'done' || run?.status === 'stopped'
  const { glyph, color } = !background ? statusOf(call)
    : run?.status === 'done' ? statusOf({ isRunning: false, isErrored: false, isInterrupted: false })
    : run?.status === 'stopped' ? statusOf({ isRunning: false, isErrored: true, isInterrupted: true })
    : { glyph: '↗', color: undefined }
  const state = background ? (ended ? (run!.status === 'done' ? 'done' : 'stopped') : 'in background')
    : running(call) ? 'working' : call.isInterrupted ? 'stopped' : call.isErrored ? 'failed' : 'done'
  const report = running(call) || background ? '' : outputText(call.output).trim()
  const cols = e.viewport?.columns ?? 80
  const lines = report.split('\n')
  const foldId = 'agent:' + (call.tool_use_id ?? '')
  const isLong = lines.length > th.foldLines
  const isOpen = isLong && ((await $.state.get({ ...MORE, id: foldId })).value ?? false)
  const shown = isLong && !isOpen ? lines.slice(0, th.foldLines).join('\n') : report
  const ink = agentInk(name)
  return (
    <Box flexDirection="column" paddingLeft={3}>
      <Text>
        <Text dimColor>{'↳ '}</Text>
        <Text bold color={th.claude.label}>{th.claude.name}</Text>
        <Text dimColor>{' → '}</Text>
        <Text bold color={ink}>{name}</Text>
        {what && <Text dimColor>{': ' + clip(what, Math.max(20, cols - name.length - 30))}</Text>}
        <Text dimColor={!color} color={color}>{'  ' + glyph + ' ' + state}</Text>
      </Text>
      {report && (
        <Box marginTop={1}>
          <Box width={bubbleWidth(shown, `◆ ${name}`, cols - 3, th.claudeShare, chrome(th.claude, th.padding))} flexDirection="column" borderStyle={th.claude.shape === 'none' ? 'round' : th.claude.shape} borderColor={ink} paddingX={th.padding}>
            <Text bold color={ink}>{'◆ ' + name}</Text>
            <Text>{shown}</Text>
            {isLong && <Button key={'more-' + foldId} plain dimColor label={isOpen ? '[ less ]' : `[ more · ${lines.length - th.foldLines} lines ]`} onPress={() => $.state.set({ ...MORE, id: foldId }, !isOpen)} />}
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ---------- Welcome ----------
// "Good morning, Pogi · 3rd session today · last one ended 2h ago", from a small log of
// session starts and ends kept in the plugin store (the last 50).
// Keyed by session id: session.start also fires on a reload, which must not count as a session.
type SessionLog = { id?: string; start: number; end?: number }[]
let sessionStart: number | undefined
// A rough "how long ago": 45m, 2h, 3d.
const ago = (ms: number) => { const m = Math.max(1, Math.round(ms / 60_000)); return m < 60 ? `${m}m` : m < 48 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d` }
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
async function welcomeLine($: EngineInterface) {
  if (offsetMin === undefined || sessionStart === undefined || opt<unknown>('welcome', true) === false) return ''
  const log = ((await $.store.get('sessions').catch(() => undefined)) as SessionLog | undefined) ?? []
  const day = (ms: number) => Math.floor((ms + offsetMin! * 60_000) / 86_400_000)
  const h = new Date(sessionStart + offsetMin * 60_000).getUTCHours()
  const hello = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const th = await themeOf($)
  const who = /^you$/i.test(th.user.name) ? '' : ', ' + th.user.name
  const today = log.filter(s => day(s.start) === day(sessionStart!) && s.start <= sessionStart!).length
  const last = log.filter(s => s.end !== undefined && s.end <= sessionStart!).sort((a, b) => b.end! - a.end!)[0]
  const bits = [hello + who]
  if (today > 1) bits.push(`${ordinal(today)} session today`)
  if (last) bits.push(`last one ended ${ago(sessionStart - last.end!)} ago`)
  return bits.join(' · ')
}
async function logSession($: EngineInterface, patch: (log: SessionLog) => SessionLog) {
  const log = ((await $.store.get('sessions').catch(() => undefined)) as SessionLog | undefined) ?? []
  await $.store.set('sessions', patch(log).slice(-50)).catch(() => {})
}

// ---------- /undertone-wrapped ----------
// A recap of this session, as text: the system card frames it with a copy button.
async function wrappedText($: EngineInterface) {
  const got = await $.session.messages().catch(() => undefined)
  const msgs = got && !('deny' in got) ? got : []
  const prompts = msgs.filter(m => m.role === 'user' && !m.toolResults?.length && m.text.trim()).length
  const turns = (await $.state.get(TURNS)).value ?? {}
  // Every finished turn's per-tool counts, and the running turn's (its summary isn't written yet).
  const counts: Record<string, number> = {}
  const running = (await $.state.get(TURN)).value
  const summed = new Set(Object.values(turns))
  for (const t of [...summed, ...(running ? [running] : [])]) for (const [k, n] of Object.entries(t.byTool ?? {})) counts[k] = (counts[k] ?? 0) + n
  const tools = Object.values(counts).reduce((a, b) => a + b, 0)
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(' · ')
  const agents = Object.values(turns).reduce((a, t) => a + (t.agents ?? 0), 0)
  const longest = Math.max(0, ...Object.keys(turns).map(Number))
  const green = Object.values(turns).filter(t => t.tests === 'pass').length
  const usd = (await $.session.usage().catch(() => undefined))?.cost?.usd
  const hours = new Map<number, number>()
  if (offsetMin !== undefined) for (const ms of idx.prompts) { const h = new Date(ms + offsetMin * 60_000).getUTCHours(); hours.set(h, (hours.get(h) ?? 0) + 1) }
  const busiest = [...hours].sort((a, b) => b[1] - a[1])[0]
  const reactions = Object.values((await $.state.get(REACTIONS)).value ?? {}).flat()
  const pins = Object.keys((await $.state.get(PINS)).value ?? {}).length
  const hour12 = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
  const lines = [
    '✨ undertone wrapped · this session',
    '',
    `  ${prompts} prompt${prompts === 1 ? '' : 's'} · ${tools} tool call${tools === 1 ? '' : 's'}${agents ? ` · ${agents} agent${agents === 1 ? '' : 's'}` : ''}${usd !== undefined ? ` · $${usd.toFixed(2)}` : ''}`,
  ]
  if (top) lines.push(`  Top tools      ${top}`)
  if (busiest) lines.push(`  Busiest hour   ${hour12(busiest[0])} (${busiest[1]} prompt${busiest[1] === 1 ? '' : 's'})`)
  if (longest) lines.push(`  Longest turn   ${fmtDuration(longest)}`)
  if (green) lines.push(`  All green      ${green} turn${green === 1 ? '' : 's'} ✨`)
  const tally = REACTION_SET.map(r => [r, reactions.filter(x => x === r).length] as const).filter(([, n]) => n).map(([r, n]) => `${r} ${n}`).join(' · ')
  if (tally) lines.push(`  Reactions      ${tally}`)
  if (pins) lines.push(`  Pins           ${pins}`)
  return lines.join('\n')
}

// ---------- /undertone-find ----------
// Messages that contain the words, with their time and the words in context.
async function findText($: EngineInterface, query: string) {
  const q = query.trim()
  if (!q) return 'Usage: /undertone-find <words>'
  const got = await $.session.messages().catch(() => undefined)
  if (!got || 'deny' in got) return 'Could not read this conversation.'
  const now = await $.clock.now()
  const hits = got.filter(m => !(m.role === 'user' && m.toolResults?.length) && m.text.toLowerCase().includes(q.toLowerCase()))
  if (!hits.length) return `No messages contain "${q}".`
  const out = [`${hits.length} message${hits.length === 1 ? ' contains' : 's contain'} "${q}"${hits.length > 20 ? ' (latest 20)' : ''}:`, '']
  for (const m of hits.slice(-20)) {
    const flat = m.text.replace(/\s+/g, ' ').trim()
    const at = flat.toLowerCase().indexOf(q.toLowerCase())
    const snip = (at > 40 ? '…' : '') + flat.slice(Math.max(0, at - 40), at + q.length + 60) + (at + q.length + 60 < flat.length ? '…' : '')
    const ms = idx.times[textKey(m.text)] ?? (await $.state.get({ ...STAMPS, id: textKey(m.text) })).value
    const when = ms && offsetMin !== undefined ? fmt(ms, now, offsetMin) + ' · ' : ''
    out.push(`• ${when}${m.role === 'user' ? 'You' : 'Claude'}: ${snip}`)
  }
  return out.join('\n')
}

// The running turn's counts. Tool calls that run at the same time don't see each other's state
// writes, so the tally lives here, where every call sees it at once, and is copied to state for
// the rows that draw it and for a reload mid-turn (the first call after one picks it back up).
type Tally = { tools: number; failed: number; usdStart: number | null; agents?: number; agentTools?: number; tests?: 'pass' | 'fail'; byTool?: Record<string, number> }
let tally: Tally | undefined
async function bump($: EngineInterface, change: (t: Tally) => Tally) {
  if (!tally) { const saved = (await $.state.get(TURN)).value; tally ??= saved ?? { tools: 0, failed: 0, usdStart: null } }
  tally = change(tally) // no await between reading and writing the tally
  const snap = tally
  await $.state.set(TURN, snap)
  await $.state.set(TURN_TOOLS, snap.tools)
}

// ---------- Turn summary ----------
type TurnSummary = { tools: number; failed: number; inTok: number; outTok: number; usd?: number; endMs: number; agents?: number; agentTools?: number; tests?: 'pass' | 'fail'; byTool?: Record<string, number> }
const kTok = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n))

export const register: Register = (on, options) => {
  opts = options

  on('session.start', async ($, e, next) => {
    await Promise.all([
      $.command.register({ name: 'undertone', description: 'Undertone: on, off, setup, copy, or help', argumentHint: 'on|off|setup|copy|copy code|help' }),
      $.command.register({ name: 'undertone-theme', description: 'Switch the chat bubble theme', argumentHint: Object.keys(THEMES).join('|') }),
      $.command.register({ name: 'undertone-pins', description: 'List pinned (★) chat bubbles' }),
      $.command.register({ name: 'undertone-doctor', description: 'undertone: show what the time index holds' }),
      $.command.register({ name: 'undertone-export', description: 'Export this chat with timestamps to a Markdown file', argumentHint: '[path]' }),
      $.command.register({ name: 'undertone-wrapped', description: 'A recap of this session: prompts, tools, busiest hour, longest turn' }),
      $.command.register({ name: 'undertone-find', description: 'Find messages in this chat that contain some words', argumentHint: '<words>' }),
    ]).catch(() => {})
    const sid = await $.session.id()
    const savedPins = ((await $.store.get('pins:' + sid).catch(() => undefined)) as Record<string, Pin> | undefined)
      ?? (await importLegacyPins($, sid).catch(() => undefined))
    if (savedPins) await $.state.set(PINS, savedPins)
    const savedReactions = (await $.store.get('reactions:' + sid).catch(() => undefined)) as Record<string, string[]> | undefined
    if (savedReactions) await $.state.set(REACTIONS, savedReactions)
    const savedTheme = await $.store.get('theme').catch(() => undefined)
    if (typeof savedTheme === 'string' && savedTheme in THEMES) await $.state.set(THEME_NAME, savedTheme)
    // UTC offset from the OS: `date +%z` (+0800) on macOS/Linux, Get-Date zzz (+08:00) on Windows.
    const { stdout } = (await windows($))
      ? await ps($, "(Get-Date).ToString('zzz')").catch(() => ({ stdout: '' }))
      : await run($, ['date', '+%z']).catch(() => ({ stdout: '' }))
    const m = stdout.trim().match(/^([+-])(\d\d):?(\d\d)$/)
    if (m) offsetMin = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
    await indexTranscript($).catch(() => {})
    const known = (((await $.store.get('sessions').catch(() => undefined)) as SessionLog | undefined) ?? []).find(s => s.id === sid)
    sessionStart = known?.start ?? (await $.clock.now())
    if (!known) await logSession($, log => [...log, { id: sid, start: sessionStart! }])
    // A reload places the same id again, which answers the row already standing.
    if (opt<unknown>('welcome', true) !== false) await $.ui.place({ id: 'welcome' }).catch(() => undefined)
    // The desktop app's wallpaper, in the theme's colours; other surfaces draw none.
    if (opt<string>('wallpaper', 'off') === 'theme') await $.ui.backdrop({ id: 'wallpaper', glass: { blur: 14, opacity: 0.55 } }).catch(() => undefined)
    return next(e)
  })

  // Live stamps (shown at once), then re-index the transcript once a prompt or reply is stored.
  on('session.append', async ($, e, next) => {
    const now = await $.clock.now()
    await $.state.set({ ...STAMPS, id: e.uuid }, now)
    if (e.door === 'prompt' || e.door === 'response') {
      const text = e.message.content.filter(b => b.type === 'text').map(b => ('text' in b ? String(b.text) : '')).join('\n')
      if (text.trim()) await $.state.set({ ...STAMPS, id: textKey(text) }, now)
    }
    const stored = await next(e)
    if (e.door === 'response' && !e.agentId) await markRead($).catch(() => {})
    if (e.door === 'prompt' || e.door === 'response') {
      void indexTranscript($).catch(() => {})
      // ponytail: the transcript file is flushed a moment after the row is stored; 1s covers it.
      $.clock.after(1000, () => void indexTranscript($).catch(() => {}))
    }
    return stored
  })
  on('session.end', async ($, e, next) => {
    await deleteSavedImages($).catch(() => {})
    const end = await $.clock.now()
    if (sessionStart !== undefined) await logSession($, log => log.map(s => (s.start === sessionStart ? { ...s, end } : s)))
    return next(e)
  })
  on('prompt.submit', async ($, e, next) => {
    // A new turn starts with what you type; prompts the engine or plugins send mid-turn
    // (a skills listing, a queued notice) must not reset the running counts.
    if (!isYours(e.origin)) return next(e)
    await $.state.set(LAST_PROMPT, { key: textKey(e.text), read: false })
    turnAgents.clear()
    tally = { tools: 0, failed: 0, agents: 0, agentTools: 0, usdStart: (await $.session.usage().catch(() => undefined))?.cost?.usd ?? null }
    await $.state.set(TURN, tally)
    await $.state.set(TURN_TOOLS, 0)
    // A note only the model reads, so Claude reaches for a picture when one would help.
    if (!e.command && richText() && opt<unknown>('diagramHints', true) !== false) return next({ ...e, context: [...(e.context ?? []), PICTURE_HINT] })
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    const callId = e.agentId ? agentCalls.get(e.agentId) : undefined
    if (callId) await $.state.set({ ...AGENT_RUN, id: callId }, { status: e.isAborted ? 'stopped' : 'done' })
    if (!e.agentId) {
      const usd = (await $.session.usage().catch(() => undefined))?.cost?.usd
      const cur = tally ?? (await $.state.get(TURN)).value ?? { tools: 0, failed: 0, usdStart: null }
      const turnTools = cur.tools, turnFailed = cur.failed, turnUsdStart = cur.usdStart ?? undefined
      const u = e.usage
      const summary: TurnSummary = {
        tools: turnTools,
        failed: turnFailed,
        ...(cur.agents ? { agents: cur.agents, agentTools: cur.agentTools ?? 0 } : {}),
        ...(cur.tests ? { tests: cur.tests } : {}),
        ...(cur.byTool ? { byTool: cur.byTool } : {}),
        endMs: await $.clock.now(),
        inTok: u ? u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens : 0,
        outTok: u ? u.output_tokens : 0,
        usd: usd !== undefined && turnUsdStart !== undefined ? usd - turnUsdStart : undefined,
      }
      const turns = { ...((await $.state.get(TURNS)).value ?? {}), [String(Math.round(e.durationMs))]: summary }
      // Keep the latest 200; older rows sit far up the fold anyway.
      await $.state.set(TURNS, Object.fromEntries(Object.entries(turns).sort((a, b) => b[1].endMs - a[1].endMs).slice(0, 200)))
      // Its per-tool counts now live in the summary; calls after the turn start a fresh tally.
      if (cur.byTool) await bump($, t => ({ ...t, byTool: {} }))
      const longMs = Math.max(1, Number(opt('notifyAfterSeconds', 30))) * 1000
      if (e.durationMs > longMs && !e.isAborted) {
        const msg = `Finished in ${fmtDuration(e.durationMs)} · ${turnTools} tool${turnTools === 1 ? '' : 's'}${turnFailed ? ` · ${turnFailed} failed` : ''}`
        $.ui.toast('Claude ' + msg.charAt(0).toLowerCase() + msg.slice(1))
        if (opt('notify', true)) void notify($, 'Claude Code', msg)
      }
    }
    await indexTranscript($).catch(() => {})
    return next(e)
  })
  on('tool.call', async ($, e, next) => {
    await $.state.set({ ...STAMPS, id: e.tool_use_id }, await $.clock.now())
    if (e.agentId) { // an agent's own call: counted apart from the main loop's
      await bump($, t => ({ ...t, agentTools: (t.agentTools ?? 0) + 1 }))
      return next(e)
    }
    await markRead($)
    // Per-tool counts ride in the tally too (for /undertone-wrapped).
    await bump($, t => ({ ...t, tools: t.tools + 1, byTool: { ...t.byTool, [e.tool]: (t.byTool?.[e.tool] ?? 0) + 1 }, ...(isAgentTool(e.tool) ? { agents: (t.agents ?? 0) + 1 } : {}) }))
    const r = await next(e)
    const launched = isAgentTool(e.tool) && 'result' in r ? (r.result as { isAsync?: boolean; agentId?: string } | undefined) : undefined
    if (launched?.isAsync && launched.agentId) {
      agentCalls.set(launched.agentId, e.tool_use_id)
      await $.state.set({ ...AGENT_RUN, id: e.tool_use_id }, { status: 'background' })
    }
    // A test run's verdict: the turn's last one decides the ✨ all green badge.
    if (/^(Bash|PowerShell)$/.test(e.tool) && 'result' in r) {
      const out = r.result as { stdout?: string; stderr?: string } | string | undefined
      const verdict = testVerdict(typeof out === 'string' ? out : `${out?.stdout ?? ''}\n${out?.stderr ?? ''}`)
      if (verdict) await bump($, t => ({ ...t, tests: verdict }))
    }
    if ('deny' in r || r.isError) await bump($, t => ({ ...t, failed: t.failed + 1 }))
    return r
  })
  on('session.measure', async ($, e, next) => {
    if (e.context.percent !== undefined) await $.state.set(CTX, e.context.percent)
    return next(e)
  })

  // Your prompt: a right-aligned blue bubble. Notifications/teammate rows keep the engine's look.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!(await isOn($, e))) return next(e) // switched off: Claude Code's own look
    if (!isYours(e.props.origin)) {
      if (e.props.isExpanded) return next(e)
      const { Text, Box: B0 } = $.ui.resolve(e)
      if (await isFolded($, await msOf($, e.requestId, e.props.text))) return <B0 />
      // Group chat: a finished task is a one-line chip; an agent's, teammate's or session's
      // message is its own bubble in its colour.
      const cols = e.viewport?.columns ?? 80
      if (e.props.task) {
        const task = e.props.task
        const info = task.id ? (await $.agent.list().catch(() => [])).find(a => a.id === task.id) : undefined
        const who = e.props.from?.name ?? info?.teammateId?.split('@')[0] ?? info?.type ?? 'task'
        const [glyph, ink, verb] = task.status === 'failed' ? ['✗', 'error', 'failed'] : task.status === 'killed' ? ['⊘', 'warning', 'stopped']
          : task.status === 'completed' ? ['✓', 'success', 'finished'] : ['◌', undefined, task.status ?? 'update']
        return (
          <Text>
            <Text color={ink}>{'   ' + glyph + ' '}</Text>
            <Text bold color={agentInk(who)}>{who}</Text>
            <Text dimColor>{` ${verb}${task.durationMs ? ' · ' + fmtDuration(task.durationMs) : ''}  ` + clip(e.props.text.split('\n')[0] ?? '', Math.max(20, cols - who.length - 30))}</Text>
          </Text>
        )
      }
      if (e.props.from?.name) {
        const { Box: Bx } = $.ui.resolve(e)
        const th = await themeOf($)
        const name = e.props.from.name
        const ink = agentInk(name)
        const t = await timeOf($, e.requestId, e.props.text, th.preciseTime)
        const lines = e.props.text.split('\n')
        const shown = lines.length > th.foldLines ? lines.slice(0, th.foldLines).join('\n') + `\n… ${lines.length - th.foldLines} more lines (ctrl+o)` : e.props.text
        return (
          <Bx marginTop={th.spacing}>
            <Bx width={bubbleWidth(shown, `◆ ${name}  ${t}`, cols, th.claudeShare, chrome(th.claude, th.padding))} flexDirection="column" borderStyle={th.claude.shape === 'none' ? 'round' : th.claude.shape} borderColor={ink} paddingX={th.padding}>
              <Text>
                <Text bold color={ink}>{'◆ ' + name}</Text>
                {t && <Text dimColor>{'  ' + t}</Text>}
              </Text>
              <Text>{shown}</Text>
            </Bx>
          </Bx>
        )
      }
      const who = e.props.origin.kind // anything else (a scheduled prompt, the SDK, a plugin's notice) stays one dim line
      return <Text dimColor>{'   ◦ ' + who + '  ' + clip(e.props.text.split('\n')[0] ?? '', Math.max(20, (e.viewport?.columns ?? 80) - who.length - 10))}</Text>
    }
    const { Box, Text, Button } = $.ui.resolve(e)
    const ui = $.ui.resolve(e)
    const Image = 'Image' in ui ? ui.Image : undefined
    const th = await themeOf($)
    const t = await timeOf($, e.requestId, e.props.text, th.preciseTime)
    // [Image #N] → a button that opens the saved copy in the OS image viewer.
    const saved = (await $.state.get(IMAGES)).value ?? {}
    const imageNos = [...new Set([...e.props.text.matchAll(IMAGE_TOKEN)].map(m => m[1]!))]
    const w = bubbleWidth((th.user.chevron ? '❯ ' : '') + e.props.text, `${sideLabel(th.user)}  ${t} ✓✓   ☆ [ react ]`, e.viewport?.columns, th.userShare, chrome(th.user, th.padding))
    const ms = await msOf($, e.requestId, e.props.text)
    const prevs = (await $.state.get(PREV)).value ?? {}
    const prevMs = (e.requestId ? prevs[e.requestId] : undefined) ?? prevs[textKey(e.props.text)]
    const divider = ms !== undefined && prevMs !== undefined && offsetMin !== undefined ? dividerOf(ms, prevMs, await $.clock.now(), offsetMin, th.gapMs) : ''
    if (!e.props.isExpanded && (await isFolded($, ms))) return <Box />
    const hov = hoverButtons(e)
    const scope = 'p:' + textKey(e.props.text)
    const pinned = await isPinned($, e.props.text)
    const star = await starButton($, Button, 'You', e.props.text, ms)
    const key = textKey(e.props.text)
    const reactions = await reactionRow($, { Box, Button }, key)
    // ✓ sent, ✓✓ once Claude has started on it; only your latest prompt can still be unread.
    const lp = (await $.state.get(LAST_PROMPT)).value
    const unread = !!lp && lp.key === key && !lp.read
    // unreadPrompts: grey, with ● blinking where ✓ goes, until Claude starts on it (reading the clock redraws the row)
    const waiting = unread && opt<unknown>('unreadPrompts', false) === true
    const blinkOn = waiting && Math.floor((await $.clock.now()) / 500) % 2 === 1
    // At the fold point: a marker to show / re-fold the earlier turns.
    const cut = (await $.state.get(CUTOFF)).value
    const showOld = (await $.state.get(SHOW_OLD)).value ?? false
    const marker = cut && ms === cut.ms
      ? (
        <Box justifyContent="center" columnGap={1}>
          <Text dimColor>{showOld ? rule(th.divider) : `${rule(th.divider)}  ${cut.hidden} earlier turn${cut.hidden === 1 ? '' : 's'}`}</Text>
          <Button key="fold-old" plain dimColor label={showOld ? '[ fold earlier turns ]' : '[ show ]'} onPress={() => $.state.set(SHOW_OLD, !showOld)} />
          <Text dimColor>{rule(th.divider)}</Text>
        </Box>
      )
      : null
    return (
      <Box flexDirection="column" marginTop={th.spacing}>
      {marker}
      {divider && (
        <Box justifyContent="center">
          <Text dimColor>{rule(th.divider) + '  ' + divider + '  ' + rule(th.divider)}</Text>
        </Box>
      )}
      <Box justifyContent={th.userAlign === 'right' ? 'flex-end' : 'flex-start'}>
        <Box key="bubble" width={w} {...bubbleBox(th.user, th.padding)} {...(hov ? { hover: { scope } } : {})}>
          <Box justifyContent="space-between">
            <Text>
              <Text bold color={th.user.label}>{sideLabel(th.user)}</Text>
              {t && <Text {...timeInk(th.user)}>{'  ' + t}</Text>}
              {waiting ? <Text {...timeInk(th.user)}>{blinkOn ? ' ●' : '  '}</Text> : unread ? <Text {...timeInk(th.user)}>{' ✓'}</Text> : <Text color={readableOn(th.user.fill, th.claude.border)}>{' ✓✓'}</Text>}
            </Text>
            {hov && pinned && star}
            {reveal(Box, hov, scope, 'star-reveal', <Box columnGap={1}>{!(hov && pinned) && star}{reactButton($, Button, key)}</Box>)}
          </Box>
          <Text color={waiting ? undefined : th.user.text} dimColor={waiting}>
            {th.user.chevron && <Text bold color={th.user.border}>{'❯ '}</Text>}
            {slashParts(e.props.text, new Set((await $.command.list().catch(() => [])).map(c => c.name)))
              .map(p => (p.cmd ? <Text bold color={readableOn(th.user.fill, th.claude.border)}>{p.text}</Text> : p.text))}
          </Text>
          {Image && inlineImages() && imageNos.map(n => {
            const img = saved[n]
            return img?.w && img.h
              ? <Image key={'pic' + n} source={{ file: img.path, format: 'png' }} {...imageCells(img.w, img.h, w - chrome(th.user, th.padding), 16)} alt={'🖼 Image #' + n} />
              : null
          })}
          {imageNos.length > 0 && (
            <Box flexWrap="wrap" columnGap={1}>
              {imageNos.map(n => {
                const file = saved[n]?.path
                return file
                  ? (
                    // Highlighted chip: blue fill, brighter on hover.
                    <Box key={'chip' + n} backgroundColor={th.chip} hover={{ backgroundColor: th.chipHover }}>
                      <Button key={'img' + n} plain label={' 🖼  Image #' + n + ' '} onPress={() => openImage($, file)} />
                    </Box>
                  )
                  : <Text dimColor>{'🖼 Image #' + n + ' (loading…)'}</Text>
              })}
            </Box>
          )}
          {reactions}
        </Box>
      </Box>
      </Box>
    )
  })

  // Claude's reply: each text block in a left-aligned Claude-coloured bubble; label on the first.
  // The engine refuses its own node under a sized Box, so the bubble draws the markdown itself.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await isOn($, e))) return next(e) // switched off: Claude Code's own look
    const { Box, Text, Markdown, Button } = $.ui.resolve(e)
    const text = e.props.text
    const first = e.props.isFirstOfReply
    const th = await themeOf($)
    if (await isFolded($, await msOf($, e.requestId, text))) return <Box />
    const t = first ? await timeOf($, e.requestId, text, th.preciseTime) : ''
    // A picture's source is short and its drawing wide: a reply with one takes its whole share.
    const w = /^\s*(`{3,}|~{3,})\s*(mermaid|figure)\b/m.test(text) && richText()
      ? Math.max(12, Math.floor((e.viewport?.columns ?? 80) * th.claudeShare))
      // code draws indented by 2, so a reply with a code block needs those 2 cells more
      : bubbleWidth(text, `${sideLabel(th.claude)}  ${t}   ☆  [ reply ] [ react ] [ copy ]`, e.viewport?.columns, th.claudeShare, chrome(th.claude, th.padding) + (/^\s*(`{3,}|~{3,})/m.test(text) && richText() ? 2 : 0))
    const FOLD_LINES = th.foldLines
    const lines = text.split('\n')
    const foldId = `${e.requestId ?? ''}:${text.length}`
    const isLong = lines.length > FOLD_LINES
    const isOpen = isLong && ((await $.state.get({ ...MORE, id: foldId })).value ?? opt<string>('folds', 'closed') === 'open')
    let shown = text
    if (isLong && !isOpen) {
      const head = lines.slice(0, FOLD_LINES)
      // A cut inside a fenced block: a picture can't draw half its source, so a figure or mermaid
      // block folds whole; plain code keeps its first lines, closed.
      const fences = head.map((l, k) => (/^\s*(`{3,}|~{3,})/.test(l) ? k : -1)).filter(k => k >= 0)
      if (fences.length % 2 === 1) {
        const open = fences.at(-1)!
        if (/^\s*(`{3,}|~{3,})\s*(figure|mermaid)\b/.test(head[open]!) && open > 0) head.splice(open)
        else head.push('```')
      }
      shown = head.join('\n')
    }
    const rich = richText()
    if (rich && !where.cwd) { where.cwd = await $.session.cwd().catch(() => ''); where.home = await homeDir($).catch(() => '') }
    const parts = splitReply(shown, rich)
    const room = w - chrome(th.claude, th.padding)
    // A typeset formula needs a real colour: the theme's text where it has one, else dark ink on a
    // light theme and light ink otherwise (the terminal's own background can't be read).
    const mathInk = /^#[0-9a-f]{6}$/i.test(th.claude.text ?? '') ? th.claude.text! : /light|latte|dawn/.test(th.name) ? '#333333' : '#d7dae0'
    const pics = new Map<number, { path: string; w: number; h: number }>()
    if (rich && e.surface === 'terminal' && opt<unknown>('latexImages', true) !== false && inlineImages()) {
      for (const [k, part] of parts.entries()) if (part.kind === 'math' && !part.open) { const pic = await mathPicture($, part.copy, mathInk); if (pic) pics.set(k, pic) }
    }
    const hov = hoverButtons(e)
    const scope = 'c:' + foldId
    const pinned = await isPinned($, text)
    const star = await starButton($, Button, 'Claude', text, await msOf($, e.requestId, text))
    const reactions = await reactionRow($, { Box, Button }, textKey(text))
    const reply = (
      <Box marginTop={first ? th.spacing : 0}>
        <Box key="bubble" width={w} {...bubbleBox(th.claude, th.padding)} {...(hov ? { hover: { scope } } : {})}>
          <Box justifyContent="space-between">
            <Text>
              {first && <Text bold color={th.claude.label}>{sideLabel(th.claude)}</Text>}
              {t && <Text {...timeInk(th.claude)}>{'  ' + t}</Text>}
            </Text>
            {hov && pinned && star}
            {reveal(Box, hov, scope, 'head-reveal', (
              <Box columnGap={1}>
                {!(hov && pinned) && star}
                <Button key="reply" plain dimColor label="[ reply ]" onPress={() => quoteReply($, e.requestId, text)} />
                {reactButton($, Button, textKey(text))}
                <Button key="copy-all" plain dimColor label="[ copy ]" onPress={p => copyText($, text, 'message', p.surface)} />
              </Box>
            ))}
          </Box>
          {sideBySide($.ui.resolve(e), parts.map((part, i) => {
            if (part.kind === 'math') {
              const ui = $.ui.resolve(e)
              const Image = 'Image' in ui ? ui.Image : undefined
              const pic = pics.get(i)
              const copy = <Button key={'copy-' + i} plain dimColor label="[ copy latex ]" onPress={p => copyText($, part.copy, 'LaTeX', p.surface)} />
              const body = pic && Image
                ? <Image key={'math' + i} source={{ file: pic.path, format: 'png' }} {...imageCells(pic.w, pic.h, room - 2, 6)} alt={texToText(part.copy)} />
                : <Text italic color={th.claude.text}>{part.copy.split('\n').map(texToText).join('\n')}</Text>
              const block = <Box paddingLeft={2} marginY={1}>{body}</Box>
              return hov ? <Box flexDirection="column">{block}{reveal(Box, hov, scope, 'copy-reveal-' + i, copy)}</Box> : <Box flexDirection="column"><Box justifyContent="flex-end">{copy}</Box>{block}</Box>
            }
            const drawn = rich ? richPart($, $.ui.resolve(e), part, i, th, room, hov, scope) : undefined
            if (drawn) return drawn
            if (part.kind === 'md') return noteMd($, Markdown, part.md, part.notes, 'md-' + i)
            if (part.kind === 'table') {
              const table = parseTable(part.md)
              if (!table) return <Markdown text={part.md} />
              const lines = layoutTable(table, room, th.tableStyle)
              const art = layoutTable(table, room, 'box').map(l => l.map(sg => sg.text).join('').trimEnd()).join('\n')
              const copy = (
                <Box columnGap={1}>
                  <Text dimColor>copy</Text>
                  <Button key={'copy-' + i} plain dimColor label="[ md ]" onPress={p => copyText($, part.copy, 'the table as Markdown', p.surface)} />
                  <Button key={'cells-' + i} plain dimColor label="[ cells ]" onPress={p => copyText($, tableCells(table), 'the table as cells', p.surface)} />
                  <Button key={'html-' + i} plain dimColor label="[ html ]" onPress={p => copyRich($, tableHtml(table), tableCells(table), 'the table', p.surface)} />
                  <Button key={'art-' + i} plain dimColor label="[ art ]" onPress={p => copyText($, art, 'the table as art', p.surface)} />
                  <Button key={'png-' + i} plain dimColor label="[ png ]" onPress={p => copyPng($, art, th, 'the table', p.surface)} />
                </Box>
              )
              const body = (
                <Box flexDirection="column" marginY={1}>
                  {lines.map(line => (
                    <Text>
                      {line.map(sg => sg.rule ? <Text dimColor color={optColor('tableRuleColor', th.claude.border)}>{sg.text}</Text>
                        : <Text bold={sg.head || sg.bold} italic={sg.italic} underline={sg.link} color={sg.head ? optColor('tableHeaderColor', th.claude.label) : sg.code ? optColor('inlineCodeColor', th.user.border) : sg.link ? optColor('linkColor', th.user.border) : sg.bold ? optColor('strongColor', optColor('tableTextColor', th.claude.text)) : sg.italic ? optColor('emphasisColor', optColor('tableTextColor', th.claude.text)) : optColor('tableTextColor', th.claude.text)}>{sg.text}</Text>)}
                    </Text>
                  ))}
                </Box>
              )
              return hov
                ? <Box flexDirection="column">{body}{reveal(Box, hov, scope, 'copy-reveal-' + i, copy)}</Box>
                : <Box flexDirection="column"><Box justifyContent="flex-end">{copy}</Box>{body}</Box>
            }
            const copy = <Button key={'copy-' + i} plain dimColor label={part.kind === 'code' ? '[ copy code ]' : '[ copy quote ]'} onPress={p => copyText($, part.copy, part.kind === 'code' ? 'code' : 'quote', p.surface)} />
            return hov ? (
              <Box flexDirection="column">
                <Markdown text={part.md} />
                {reveal(Box, hov, scope, 'copy-reveal-' + i, copy)}
              </Box>
            ) : (
              <Box flexDirection="column">
                <Box justifyContent="flex-end">{copy}</Box>
                <Markdown text={part.md} />
              </Box>
            )
          }), parts, room, th, hov)}
          {isLong && (
            <Button key="fold" plain dimColor label={isOpen ? '[ less ]' : `[ more · ${lines.length - FOLD_LINES} lines ]`} onPress={() => $.state.set({ ...MORE, id: foldId }, !isOpen)} />
          )}
          {reactions}
        </Box>
      </Box>
    )
    return copyOn() ? reply : stripCopies(reply)
  })

  // Tool calls: one dim line each. [+] opens a row; ctrl+o (isExpanded) shows every row in full.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await isOn($, e))) return next(e) // switched off: Claude Code's own look
    if (opt<unknown>('toolRows', true) === false) return next(e) // Claude Code's own tool rows
    if (e.props.isExpanded) return next(e)
    if (await isFolded($, await msOf($, e.props.tool_use_id))) { const { Box: Bx } = $.ui.resolve(e); return <Bx /> }
    if (isAgentTool(e.props.tool)) return drawAgent($, e)
    const drawn = drawRows($, $.ui.resolve(e), [await rowOf($, e.props, e.viewport?.columns)])
    return copyOn() ? drawn : stripCopies(drawn)
  })
  // Results: the opened row draws the output itself, so this stays hidden unless ctrl+o.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await isOn($, e))) return next(e) // switched off: Claude Code's own look
    if (opt<unknown>('toolRows', true) === false) return next(e) // Claude Code's own tool rows
    if (e.props.isExpanded) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  // Folded runs ("Read 3 files, ran 2 commands") become the same compact rows, one per call.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!(await isOn($, e))) return next(e) // switched off: Claude Code's own look
    if (opt<unknown>('toolRows', true) === false) return next(e) // Claude Code's own tool rows
    if (e.props.isExpanded) return next(e)
    if (await isFolded($, await msOf($, e.props.calls[0]?.tool_use_id))) { const { Box: Bx } = $.ui.resolve(e); return <Bx /> }
    const calls = e.props.calls
    const gid = 'g:' + (calls[0]?.tool_use_id ?? '')
    const anyFailed = calls.some(c => c.isErrored && !c.isInterrupted)
    const isOpen = (await $.state.get({ ...OPEN, id: gid })).value ?? anyFailed
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const t = await timeOf($, calls[0]?.tool_use_id)
    const st = calls.some(running) ? statusOf({ isRunning: true, isErrored: false, isInterrupted: false })
      : anyFailed ? statusOf({ isRunning: false, isErrored: true, isInterrupted: false }) : statusOf({ isRunning: false, isErrored: false, isInterrupted: false })
    const style = opt<string>('toolStyle', 'dim')
    const head = (
      <Box paddingLeft={style === 'tree' ? 1 : 3}>
        {style === 'tree' && <Text dimColor>{'⎿ '}</Text>}
        <Button key="group" label={isOpen ? '-' : '+'} onPress={() => $.state.set({ ...OPEN, id: gid }, !isOpen)} />
        <Text dimColor={!st.color} color={st.color} bold={style === 'bright'}>{' ' + st.glyph + ' '}</Text>
        <Text dimColor={style !== 'bright'}>{(t ? t + '  ' : '') + sumUp(calls)}</Text>
      </Box>
    )
    if (!isOpen) return head
    const rows = await Promise.all(calls.map(c => rowOf($, c, e.viewport?.columns)))
    return (
      <Box flexDirection="column">
        {head}
        <Box paddingLeft={2}>{drawRows($, ui, rows)}</Box>
      </Box>
    )
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (!(await isOn($, e))) return next(e) // switched off: Claude Code's own look
    if (e.props.isExpanded || e.props.waitingFor) return next(e)
    const { Text } = $.ui.resolve(e)
    const turns = (await $.state.get(TURNS)).value ?? {}
    // The row's duration matches the turn.complete one; allow a little drift, and take the
    // closest so turns of similar length don't borrow each other's summary.
    // ponytail: duration is the only link the engine gives this row; key by turn if it ever exposes one.
    const off = (k: string) => Math.abs(Number(k) - e.props.durationMs)
    const key = Object.keys(turns).filter(k => off(k) <= 1500).sort((a, b) => off(a) - off(b))[0]
    const t = key ? turns[key] : undefined
    if (t && (await isFolded($, t.endMs))) { const { Box: Bx } = $.ui.resolve(e); return <Bx /> }
    const bits = ['   · ' + e.props.word + ' ' + fmtDuration(e.props.durationMs)]
    if (t) {
      bits.push(`${t.tools} tool${t.tools === 1 ? '' : 's'}`)
      if (t.agents) bits.push(`${t.agents} agent${t.agents === 1 ? '' : 's'} (${t.agentTools ?? 0} tool${t.agentTools === 1 ? '' : 's'})`)
      if (t.inTok || t.outTok) bits.push(`${kTok(t.inTok)} in / ${kTok(t.outTok)} out`)
      if (t.usd !== undefined && t.usd > 0) bits.push('$' + t.usd.toFixed(t.usd < 0.1 ? 3 : 2))
    }
    const failed = t?.failed ?? 0
    return (
      <Text>
        <Text dimColor>{bits.join(' · ')}</Text>
        {failed > 0 && <Text color="error">{` · ${failed} failed`}</Text>}
        {t?.tests === 'pass' && <Text color="success">{' · ✨ all green'}</Text>}
      </Text>
    )
  })

  on('command.run', { command: 'undertone-theme' }, async ($, e) => {
    const want = e.args.trim().toLowerCase()
    const list = Object.entries(THEMES).map(([n, l]) => `  ${n.padEnd(16)} ${l.desc}`).join('\n')
    if (!want || want === 'list') return { text: `Themes (current: ${(await themeOf($)).name}):\n${list}\n\n/undertone-theme <name> to switch · /undertone-theme reset for the /config default · fine-tune in /config → undertone` }
    if (want === 'reset') {
      await $.state.set(THEME_NAME, null)
      await $.store.delete('theme')
      return { text: `Theme reset to the /config choice (${opt('theme', 'default')}).` }
    }
    if (!(want in THEMES)) return { text: `No theme "${want}".\n${list}` }
    await $.state.set(THEME_NAME, want)
    await $.store.set('theme', want)
    return { text: `Theme: ${want} — ${THEMES[want]!.desc}` }
  })
  on('command.run', { command: 'undertone-pins' }, async $ => ({ text: await pinsText($) }))
  on('command.run', { command: 'undertone-wrapped' }, async $ => ({ text: await wrappedText($) }))
  on('command.run', { command: 'undertone-find' }, async ($, e) => ({ text: await findText($, e.args) }))
  on('command.run', { command: 'undertone-export' }, async ($, e) => ({ text: await exportChat($, e.args).catch(err => 'Export failed: ' + String(err)) }))

  // /undertone-pins output: a header, then each pin as time · sender (theme colour) over an indented snippet.
  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (e.props.command !== 'undertone-pins') return next(e)
    const pins = await sortedPins($)
    if (!pins.length) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const th = await themeOf($)
    const now = await $.clock.now()
    const room = Math.max(30, (e.viewport?.columns ?? 80) - 8)
    return (
      <Box flexDirection="column" marginY={1}>
        <Text bold>{`★ Pinned messages (${pins.length})`}</Text>
        {pins.map(p => (
          <Box flexDirection="column" marginTop={1} paddingLeft={2}>
            <Text>
              <Text color="warning">★ </Text>
              {p.ms !== undefined && offsetMin !== undefined && <Text dimColor>{fmt(p.ms, now, offsetMin) + ' · '}</Text>}
              <Text bold color={p.who === 'You' ? th.user.label : th.claude.label}>{p.who === 'You' ? th.user.name : th.claude.name}</Text>
            </Text>
            <Box paddingLeft={2}>
              <Text dimColor>{clip(p.text, room * 2)}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    )
  })

  on('command.run', { command: 'undertone-doctor' }, async $ => {
    const held = await $.state.get(TIMES)
    const prev = await $.state.get(PREV)
    const size = transcriptPath ? (await $.fs.stat(transcriptPath).catch(() => undefined))?.size : undefined
    return {
      text: [
        `transcript: ${transcriptPath ?? '(not found)'}`,
        `file bytes: ${size ?? '?'}   read up to: ${readOffset}`,
        `module index: ${Object.keys(idx.times).length} times, ${Object.keys(idx.prev).length} prompts`,
        `state TIMES: ${Object.keys(held.value ?? {}).length} (version ${held.version})   state PREV: ${Object.keys(prev.value ?? {}).length} (version ${prev.version})`,
        `timezone offset: ${offsetMin} min   theme: ${(await themeOf($)).name}`,
        `this turn: ${JSON.stringify((await $.state.get(TURN)).value)}   last summaries: ${JSON.stringify(Object.entries((await $.state.get(TURNS)).value ?? {}).slice(-2))}`,
      ].join('\n'),
    }
  })

  // Claude Code's own working line, with the turn's tool count: "Sauteing · 3 tools…".
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!(await isOn($, e))) return next(e) // switched off: Claude Code's own look
    const n = (await $.state.get(TURN_TOOLS)).value ?? 0
    if (!n) return next(e)
    return next({ ...e, props: { ...e.props, message: `${e.props.message ?? e.props.word} · ${n} tool${n === 1 ? '' : 's'}` } })
  })

  // The band above the prompt: who's working ("● Explore · find the config  ○ planner (done)"),
  // then, once Claude has answered, quick replies.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!(await isOn($, e)) || e.props.hasSurvey) return next(e)
    const strip = await agentStrip($)
    const raw = String(opt('quickReplies', 'Go ahead|Explain more|Shorter, please')).trim()
    const replies = raw.toLowerCase() === 'off' ? [] : raw.split('|').map(r => r.trim()).filter(Boolean).slice(0, 6)
    const showReplies = !e.props.isWorking && replies.length > 0 && !!(await $.state.get(LAST_PROMPT)).value?.read
    if (!strip.length && !showReplies) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {strip.length > 0 && (
          <Box columnGap={2} flexWrap="wrap">
            <Text dimColor>Agents</Text>
            {strip.map(a => <Text><Text color={a.ink} dimColor={!a.ink}>{a.glyph + ' '}</Text><Text dimColor={a.dim}>{a.label}</Text></Text>)}
          </Box>
        )}
        {showReplies && (
          <Box columnGap={1} flexWrap="wrap">
            <Text dimColor>Quick reply</Text>
            {replies.map((r, i) => <Button key={'qr' + i} plain dimColor label={`[ ${r} ]`} onPress={() => $.prompt.submit({ text: r, asUser: true })} />)}
          </Box>
        )}
      </Box>
    )
  })

  // Context meter at the end of the hint line under the prompt.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!(await isOn($, e))) return next(e) // switched off: Claude Code's own look
    const pct = (await $.state.get(CTX)).value
    if (pct === null || pct === undefined) return next(e)
    const meter = `ctx ${Math.round(pct)}%${pct >= 85 ? ' ⚠ compact soon' : pct >= 60 ? ' ▲' : ''}`
    return next({ ...e, props: { ...e.props, tail: e.props.tail ? `${e.props.tail}  ${meter}` : meter } })
  })

  // File viewer pane: the file, highlighted, with "Open in editor" (OS default app).
  on('ui.render', { component: 'Pane', requestId: FILE_PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const path = (await $.state.get(VIEW_FILE)).value
    if (!path) return <Text dimColor>No file selected.</Text>
    const buttons = (
      <Box columnGap={1}>
        <Button key="open-ext" label="Open in editor" onPress={() => openInEditor($, path)} />
        <Button key="copy-path" label="Copy path" onPress={p => copyText($, path, 'path', p.surface)} />
        <Button key="close" label="Close" onPress={() => $.ui.close({ id: FILE_PANE })} />
      </Box>
    )
    const stat = await $.fs.stat(path).catch(() => undefined)
    if (!stat) return <Box flexDirection="column">{buttons}<Text dimColor>{path} no longer exists.</Text></Box>
    if (stat.kind === 'dir') return <Box flexDirection="column">{buttons}<Text dimColor>{path} is a folder.</Text></Box>
    if (stat.size > 4_000_000) return <Box flexDirection="column">{buttons}<Text dimColor>{path} is too large to preview ({Math.round(stat.size / 1e6)} MB).</Text></Box>
    const text = await $.fs.read(path).catch(() => undefined)
    if (text === undefined) return <Box flexDirection="column">{buttons}<Text dimColor>Could not read {path}.</Text></Box>
    const lines = text.split('\n')
    const shown = lines.slice(0, VIEW_LINES).join('\n').slice(0, 95_000)
    return (
      <Box flexDirection="column">
        {buttons}
        <Text dimColor>{path + (lines.length > VIEW_LINES ? `  (first ${VIEW_LINES} of ${lines.length} lines)` : '')}</Text>
        <Code source={shown} path={path} startLine={1} wrap="truncate-end" />
      </Box>
    )
  })

  // /undertone-theme with no name: a gallery, one row per preset with a sample of each side.
  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    // The gallery answers the list form only; decided from the command's own reply, since
    // the row's `args` can arrive empty even when a theme name was given.
    if (e.props.command !== 'undertone-theme' || !/(^|: )Themes \(current/.test(e.props.text)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const current = (await themeOf($)).name
    const cols = e.viewport?.columns ?? 100
    const sample = (s: Side, text: string, p: number) => (
      <Box width={Math.min(30, Math.floor((cols - 26) / 2))} {...bubbleBox(s, p)}>
        <Text bold color={s.label}>{sideLabel(s)}</Text>
        <Text color={s.text}>{text}</Text>
      </Box>
    )
    return (
      <Box flexDirection="column" marginY={1}>
        <Text bold>Undertone themes</Text>
        <Text dimColor>/undertone-theme &lt;name&gt; to switch · fine-tune shape, colours, fill, labels in /config → undertone</Text>
        {Object.entries(THEMES).map(([name, l]) => (
          <Box marginTop={1} columnGap={2}>
            <Box width={22} flexDirection="column">
              <Text bold color={name === current ? 'success' : undefined}>{(name === current ? '● ' : '  ') + name}</Text>
              <Text dimColor>{'  ' + l.desc}</Text>
            </Box>
            {sample(l.claude, 'Here is the plan.', l.padding)}
            {sample(l.user, 'Looks good!', l.padding)}
          </Box>
        ))}
      </Box>
    )
  })

  // Every other command's output as a system card: the command in Claude's colour, [ copy ]
  // and the time; a red frame and ✗ when it failed. undertone's own pins and gallery draw above.
  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (!(await isOn($, e)) || !e.props.text.trim()) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const th = await themeOf($)
    const cols = e.viewport?.columns ?? 80
    const bad = e.props.isErrored
    const name = (bad ? '✗ ' : '') + '/' + e.props.command + (e.props.args.trim() ? ' ' + e.props.args.trim() : '')
    const t = await timeOf($, e.requestId, undefined, false)
    // Claude Code heads a plugin command's output with "<plugin>: "; the card's header already names it.
    const owner = (await $.command.list().catch(() => [])).find(c => c.name === e.props.command)?.plugin
    const text = owner && e.props.text.startsWith(owner + ': ') ? e.props.text.slice(owner.length + 2) : e.props.text
    const widest = Math.max(strWidth(name) + 12, ...text.split('\n').map(strWidth), strWidth(t))
    return (
      <Box paddingLeft={2}>
        <Box width={Math.min(cols - 4, widest + 4)} flexDirection="column" borderStyle="round" borderColor={bad ? 'error' : 'subtle'} paddingX={1}>
          <Box justifyContent="space-between">
            <Text bold color={bad ? 'error' : readableOn(undefined, th.claude.border)}>{name}</Text>
            <Button key="copy-out" plain dimColor label="[ copy ]" onPress={p => copyText($, text, 'output', p.surface)} />
          </Box>
          <Text>{text}</Text>
          {t && <Box justifyContent="flex-end"><Text dimColor>{t}</Text></Box>}
        </Box>
      </Box>
    )
  })

  // Claude's question dialog under a "Claude asks" header. No frame: the dialog draws its rules
  // at the full width, and a frame's columns would wrap them.
  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    if (!(await isOn($, e)) || e.surface !== 'terminal') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const th = await themeOf($)
    const dialog = await next(e)
    return (
      <Box flexDirection="column" marginTop={th.spacing}>
        <Text>
          <Text bold color={th.claude.label}>{sideLabel(th.claude)}</Text>
          <Text dimColor>{' asks'}</Text>
        </Text>
        {dialog}
      </Box>
    )
  })

  // The welcome row undertone places when a session starts.
  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (e.props.plugin !== 'undertone' || e.props.id !== 'welcome') return next(e)
    const { Text } = $.ui.resolve(e)
    const line = await welcomeLine($)
    return line ? <Text dimColor>{'  ✻ ' + line}</Text> : next(e)
  })

  // The wallpaper behind the desktop app's conversation: the theme's surface, with a soft block of
  // each side's colour in two corners.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== 'undertone' || e.props.id !== 'wallpaper') return next(e)
    const { Box } = $.ui.resolve(e)
    const th = await themeOf($)
    const surface = SURFACE[th.name]?.surface ?? th.claude.fill ?? '#1E1E2E'
    return (
      <Box flexDirection="column" flexGrow={1} backgroundColor={surface} justifyContent="space-between">
        <Box justifyContent="flex-end"><Box width={24} height={8} backgroundColor={th.user.fill ?? th.user.border} /></Box>
        <Box justifyContent="flex-start"><Box width={24} height={8} backgroundColor={th.claude.fill ?? th.claude.border} /></Box>
      </Box>
    )
  })

  // Footer mode labels as pills in the theme's chip colour.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (!(await isOn($, e)) || !e.props.modes.length) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const th = await themeOf($)
    return <Box columnGap={1}>{e.props.modes.map(m => <Text backgroundColor={th.chip} color={readableOn(th.chip, '#FFFFFF')}>{' ' + m + ' '}</Text>)}</Box>
  })

  // "(ctrl+b to run in background)" under a running tool, quieter: "ctrl+b · background", or none.
  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    const how = String(opt('backgroundHint', 'compact'))
    if (!(await isOn($, e)) || e.props.kind !== 'background_hint' || how === 'engine') return next(e)
    const key = /^\(?(.+?) to run in background\)?$/.exec(e.props.hint.trim())?.[1]
    return next({ ...e, props: { ...e.props, hint: how === 'hidden' ? '' : key ? `↧ ${key} · background` : e.props.hint } })
  })

  on('command.run', { command: 'undertone' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      await $.state.set(ENABLED, arg === 'on')
      return { text: arg === 'on' ? 'Undertone on.' : "Undertone off for this session: Claude Code's own look. /undertone on brings it back." }
    }
    if (arg === 'copy' || arg === 'copy code') {
      const got = await $.session.messages().catch(() => undefined)
      const last = got && !('deny' in got) ? [...got].reverse().find(m => m.role === 'assistant' && m.text.trim()) : undefined
      if (!last) return { text: 'No reply to copy yet.' }
      if (arg === 'copy') { await copyText($, last.text, 'the last reply'); return { text: 'Copied the last reply.' } }
      const code = [...splitReply(last.text)].reverse().find(p => p.kind === 'code')
      if (!code) return { text: 'The last reply has no code block.' }
      await copyText($, code.copy, 'the last code block')
      return { text: 'Copied the last code block.' }
    }
    if (arg === 'setup') {
      await $.state.set(SETUP, { step: 0, draft: {} })
      await $.ui.open({ id: SETUP_PANE, title: 'Undertone setup', focus: true, closeOnEscape: true, rows: 40, columns: 90 })
      return { text: 'Setup opened: pick a style per step, Next to continue, Save to keep it.' }
    }
    return {
      text: [
        'Undertone — the conversation, without the noise.',
        '',
        '  /undertone setup          pick theme, shapes and layout with a live preview',
        '  /undertone off | on       Claude Code\'s own look for this session, and back',
        '  /undertone copy [code]    copy the last reply, or its last code block, without the mouse',
        '  /undertone-theme [name]   theme gallery, or switch theme (reset = /config default)',
        '  /undertone-pins           pinned messages',
        '  /undertone-export [path]  save the chat as Markdown with timestamps',
        '  /undertone-wrapped        a recap of this session',
        '  /undertone-find <words>   messages that contain the words, with their times',
        '  /undertone-doctor         what the time index holds (for bug reports)',
        '',
        'Every setting: /config → undertone',
      ].join('\n'),
    }
  })

  // /undertone setup: one step per choice, a live sample of both bubbles, Save writes /config.
  on('ui.render', { component: 'Pane', requestId: SETUP_PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const st = (await $.state.get(SETUP)).value ?? { step: 0, draft: {} }
    const steps = setupSteps()
    const step = steps[Math.min(st.step, steps.length - 1)]!
    const th = await themeOf($, st.draft)
    const current = String(st.draft[step.key] ?? (step.key === 'theme' ? th.name : opt(step.key, step.options[0]!)))
    const go = (n: number) => $.state.set(SETUP, { ...st, step: Math.max(0, Math.min(steps.length - 1, n)) })
    const pick = (v: string) => $.state.set(SETUP, { ...st, draft: { ...st.draft, [step.key]: v } })
    const save = async () => {
      for (const [k, v] of Object.entries(st.draft)) await $.config.set({ key: 'undertone.' + k, value: v }).catch(() => undefined)
      if ('theme' in st.draft) { await $.state.set(THEME_NAME, null); await $.store.delete('theme') } // /config is the source of truth now
      await $.state.set(SETUP, null)
      $.ui.toast('Undertone settings saved')
      await $.ui.close({ id: SETUP_PANE })
    }
    const cols = Math.max(30, e.props.bodyColumns)
    const half = Math.max(16, Math.floor((cols - 4) / 2))
    const sample = (sd: Side, text: string) => (
      <Box width={half} {...bubbleBox(sd, th.padding)}>
        <Text bold color={sd.label}>{sideLabel(sd)}</Text>
        <Text color={sd.text}>{text}</Text>
      </Box>
    )
    return (
      <Box flexDirection="column">
        <Text bold>{`Undertone setup · ${st.step + 1}/${steps.length} · ${step.title}`}</Text>
        <Text dimColor>{step.hint}</Text>
        <Box marginTop={1} flexWrap="wrap" columnGap={1}>
          {step.options.map(v => (
            <Button key={'opt-' + v} {...(v !== current ? { plain: true as const } : {})} label={(v === current ? '● ' : '') + v} onPress={() => pick(v)} />
          ))}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{`Preview — ${th.name}`}</Text>
          <Box marginTop={th.spacing}>{sample(th.claude, 'Here is the plan: three steps.')}</Box>
          <Box marginTop={th.spacing} justifyContent={th.userAlign === 'right' ? 'flex-end' : 'flex-start'}>{sample(th.user, 'Looks good, go ahead!')}</Box>
        </Box>
        <Box marginTop={1} columnGap={1}>
          {st.step > 0 && <Button key="back" label="← Back" onPress={() => go(st.step - 1)} />}
          {st.step < steps.length - 1 && <Button key="next" label="Next →" onPress={() => go(st.step + 1)} />}
          <Button key="save" label="Save" onPress={save} />
          <Button key="cancel" label="Cancel" onPress={async () => { await $.state.set(SETUP, null); await $.ui.close({ id: SETUP_PANE }) }} />
        </Box>
        <Text dimColor>Tab moves between buttons, Enter picks. Esc closes without saving.</Text>
      </Box>
    )
  })
}
