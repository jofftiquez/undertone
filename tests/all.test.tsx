// End-to-end checks for every undertone feature, against the test kit's engine.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const NOW = Date.UTC(2026, 10, 3, 8, 0) // 4:00 PM at UTC+8
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const line = (o: object) => JSON.stringify(o)

// A small fake transcript: three prompts (1h10m apart, then 2m), one reply, one pasted image.
const TRANSCRIPT = [
  line({ type: 'user', uuid: 'u1', promptId: 'p1', promptSource: 'typed', timestamp: iso(80 * 60_000), message: { role: 'user', content: 'first prompt' } }),
  line({ type: 'assistant', uuid: 'a1', timestamp: iso(79 * 60_000), message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'first reply' }] } }),
  line({ type: 'user', uuid: 'u2', promptId: 'p2', promptSource: 'typed', timestamp: iso(10 * 60_000), message: { role: 'user', content: [{ type: 'text', text: 'look [Image #1]' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }] } }),
  line({ type: 'user', uuid: 'u3', promptId: 'p3', promptSource: 'typed', timestamp: iso(8 * 60_000), message: { role: 'user', content: 'third prompt' } }),
].join('\n') + '\n'

type Run = { argv: readonly string[]; stdin?: string }
function engine(on: any, opts: { transcript?: string; cwd?: string; sid?: () => string } = {}) {
  const runs: Run[] = []
  const toasts: string[] = []
  const writes: Record<string, string> = {}
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: opts.sid?.() ?? 'sess-1234-abcd' }))
  on('session.root', () => ({ value: opts.cwd ?? '/work/proj' }))
  on('session.cwd', () => ({ value: opts.cwd ?? '/work/proj' }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  const win = (opts.cwd ?? '').match(/^[A-Z]:/)
  const ENV: Record<string, string> = win
    ? { OS: 'Windows_NT', SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\u', TEMP: 'C:\\T' }
    : { HOME: '/home/u', TMPDIR: '/tmp/' }
  on('env.get', (_: any, e: any) => ({ value: ENV[e.name ?? e] }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', () => ({ value: [] }))
  on('fs.stat', () => ({ value: { kind: 'file', size: (opts.transcript ?? '').length, mtimeMs: 0, isLink: false } }))
  on('fs.write', (_: any, e: any) => { writes[e.path] = e.text; return { value: undefined } })
  on('ui.toast', (_: any, e: any) => { toasts.push(typeof e === 'string' ? e : e.text); return { value: undefined } })
  const copies: string[] = []
  on('ui.copy', (_: any, e: any) => { copies.push(e.text); return { value: { isCopied: true } } })
  on('process.run', (_: any, e: any) => {
    const argv: string[] = e.argv ?? e[0] ?? []
    const stdin: string | undefined = e.stdin ?? e.init?.stdin
    runs.push({ argv, stdin })
    const script = argv.join(' ')
    let stdout = ''
    // Windows helpers take their payload as JSON on stdin
    if (script.includes('IO.File]::Open') && stdin) { const q = JSON.parse(stdin); stdout = (opts.transcript ?? '').slice(q.offset, q.offset + q.size) }
    else if (script.includes('WriteAllBytes') && stdin) stdout = JSON.parse(stdin).path
    else if (script.includes('date')) stdout = '+0800\n'
    else if (script.includes("ToString('zzz')")) stdout = '+08:00\n'
    else if (script.includes('CLAUDE_CONFIG_DIR')) stdout = '/home/u/.claude'
    else if (script.includes('tail -c')) {
      const off = Number(argv[argv.length - 2]) - 1
      stdout = (opts.transcript ?? '').slice(off)
    } else if (script.includes('base64 -d')) stdout = `${argv[argv.length - 2]}/undertone-501/${argv[argv.length - 1]}`
    else if (script.includes('HOME')) stdout = '/home/u'
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return { runs, toasts, writes, copies }
}
const start = ($: any) => $.session.start({ cwd: '/work/proj', surface: 'terminal', isInteractive: true })
const prompt = (requestId: string, text: string) => ({
  plugin: P, surface: 'terminal' as const, component: 'UserMessage' as const, requestId,
  props: { text, origin: { kind: 'composer' as const }, isExpanded: false },
})
const reply = (requestId: string, text: string) => ({
  plugin: P, surface: 'terminal' as const, component: 'AssistantMessage' as const, requestId,
  props: { text, isFirstOfReply: true },
})

// ---------- transcript pipeline: times, dividers, images ----------
test('times come from the transcript: precise format with timezone', async ($, on) => {
  engine(on, { transcript: TRANSCRIPT })
  await start($)
  const ui = await $.ui.mount(prompt('p3', 'third prompt'))
  expect((await ui.find({ type: 'Text', text: /3:52:00\.000 PM UTC\+8/ }))?.text).toContain('UTC+8')
  await ui.unmount()
})

test('a long pause draws a "later" divider; a short one does not', async ($, on) => {
  engine(on, { transcript: TRANSCRIPT })
  await start($)
  const gap = await $.ui.mount(prompt('p2', 'look [Image #1]'))
  expect((await gap.find({ type: 'Text', text: /1h 10m later/ }))?.text).toContain('later')
  await gap.unmount()
  const close = await $.ui.mount(prompt('p3', 'third prompt'))
  expect(await close.find({ type: 'Text', text: /later/ })).toBeUndefined()
  await close.unmount()
})

test('the first prompt of the day gets "Today"', async ($, on) => {
  engine(on, { transcript: TRANSCRIPT })
  await start($)
  const ui = await $.ui.mount(prompt('p1', 'first prompt'))
  expect((await ui.find({ type: 'Text', text: /Today/ }))?.text).toContain('Today')
  await ui.unmount()
})

test('a pasted image becomes a chip that opens the saved file', async ($, on) => {
  const { runs } = engine(on, { transcript: TRANSCRIPT })
  await start($)
  const ui = await $.ui.mount(prompt('p2', 'look [Image #1]'))
  expect(await ui.find({ key: 'img1' })).toBeDefined()
  await $.ui.press({ plugin: P, key: 'img1', requestId: 'p2' })
  expect(runs.some(r => r.argv.join(' ').includes('open'))).toBe(true)
  await ui.unmount()
})

test('a pasted PNG is drawn as a picture in your bubble, above its chip', async ($, on) => {
  // A real PNG header (800×400) so undertone can size the picture.
  const head = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 3, 0x20, 0, 0, 1, 0x90, 8, 6, 0, 0, 0]
  const png = btoa(String.fromCharCode(...head))
  engine(on, { transcript: TRANSCRIPT.replace('iVBORw0KGgo=', png) })
  await start($)
  const ui = await $.ui.mount(prompt('p2', 'look [Image #1]'))
  const pic = (await ui.findAll({ type: 'Image' }))[0] as any
  expect(pic?.props.source.format).toBe('png')
  expect(pic?.props.source.file).toMatch(/undertone-501\/sess-123-1\.png$/)
  expect(pic?.props.rows).toBe(Math.round(pic?.props.columns / 4)) // 2:1 picture, cells twice as tall as wide
  expect(await ui.find({ key: 'img1' })).toBeDefined() // the chip stays, to open it full size
  await ui.unmount()
})

test('pasted images are saved to a private, per-user folder', async ($, on) => {
  const { runs } = engine(on, { transcript: TRANSCRIPT })
  await start($)
  const ui = await $.ui.mount(prompt('p2', 'look [Image #1]'))
  await ui.unmount()
  const save = runs.find(r => r.argv.join(' ').includes('base64 -d'))!.argv.join(' ')
  expect(save).toContain('umask 077')
  expect(save).toContain('undertone-$(id -u)')
  expect(save).toContain('[ ! -L "$d" ]')
})

test('after /clear or a resume the index follows the new session', async ($, on) => {
  let sid = 'sess-1234-abcd'
  engine(on, { transcript: TRANSCRIPT, sid: () => sid })
  const store: Record<string, unknown> = {} // pins are kept per session id
  on('store.get', (_: any, e: any) => ({ value: store[e.key] }))
  on('store.set', (_: any, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  await start($)
  const doctor = async () => JSON.stringify(await $.command.run({ command: 'undertone-doctor', args: '', ...CMD }))
  expect(await doctor()).toContain('sess-1234-abcd.jsonl')
  const pins = async () => JSON.stringify(await $.command.run({ command: 'undertone-pins', args: '', ...CMD }))
  const ui = await $.ui.mount(reply('r1', 'pin me'))
  const star = (await ui.findAll({ type: 'Button' })).find((b: any) => String(b.props.label).includes('☆'))!
  await $.ui.press({ plugin: P, key: star.key!, requestId: 'r1' })
  await ui.unmount()
  expect(await pins()).toContain('pin me')
  // /clear: same process, new session id, no session.start
  sid = 'sess-5678-efgh'
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' })
  expect(await doctor()).toContain('sess-5678-efgh.jsonl')
  expect(await pins()).not.toContain('pin me')
})

test('session end deletes the saved images', async ($, on) => {
  const { runs } = engine(on, { transcript: TRANSCRIPT })
  on('session.end', () => ({ sessionId: 'sess-1234-abcd' }))
  await start($)
  await $.session.end({ reason: 'other', sessionId: 'sess-1234', resume: { id: 'sess-1234' } })
  expect(runs.some(r => r.argv.join(' ').includes('rm -f'))).toBe(true)
})

// ---------- folding old turns ----------
test('with foldTurns=2 the oldest turn folds behind a marker', { options: { foldTurns: 2 } }, async ($, on) => {
  engine(on, { transcript: TRANSCRIPT })
  await start($)
  const old = await $.ui.mount(prompt('p1', 'first prompt'))
  expect(await old.find({ type: 'Text', text: /first prompt/ })).toBeUndefined()
  await old.unmount()
  const cut = await $.ui.mount(prompt('p2', 'look [Image #1]'))
  expect((await cut.find({ type: 'Text', text: /1 earlier turn/ }))?.text).toContain('1 earlier turn')
  await $.ui.press({ plugin: P, key: 'fold-old', requestId: 'p2' })
  await cut.unmount()
  const shown = await $.ui.mount(prompt('p1', 'first prompt'))
  expect((await shown.find({ type: 'Text', text: /first prompt/ }))?.text).toContain('first prompt')
  await shown.unmount()
})

// ---------- Claude bubble: copy, fold, pins ----------
const LONG = ['Intro', '', '> a quote', '> line two', '', '```ts', 'const x = 1', '```', ...Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)].join('\n')

test('copy buttons copy the whole reply, the code only, the quote only', async ($, on) => {
  const { copies, toasts } = engine(on)
  await start($)
  const ui = await $.ui.mount(reply('r1', LONG))
  await $.ui.press({ plugin: P, key: 'copy-all', requestId: 'r1' })
  expect(copies.at(-1)).toBe(LONG)
  await $.ui.press({ plugin: P, key: 'copy-1', requestId: 'r1' }) // quote is part 1
  expect(copies.at(-1)).toBe('a quote\nline two')
  await $.ui.press({ plugin: P, key: 'copy-2', requestId: 'r1' }) // code is part 2 (the blank line between is not a part)
  expect(copies.at(-1)).toBe('const x = 1')
  expect(toasts).toContain('Copied code')
  await ui.unmount()
})

test('a long reply folds behind [ more ] and opens on press', async ($, on) => {
  engine(on)
  await start($)
  const ui = await $.ui.mount(reply('r2', LONG))
  expect(await ui.find({ type: 'Text', text: /line 20/ })).toBeUndefined()
  expect((await ui.find({ key: 'fold' }))?.props.label).toMatch(/more · \d+ lines/)
  await $.ui.press({ plugin: P, key: 'fold', requestId: 'r2' })
  expect(JSON.stringify(await ui.find({ type: 'Markdown', text: /line 20/ }) ?? await ui.find({ text: /line 20/ }))).toContain('line 20')
  await ui.unmount()
})

test('☆ pins a bubble and /undertone-pins lists it', async ($, on) => {
  engine(on)
  on('store.set', () => ({ value: undefined }))
  await start($)
  const ui = await $.ui.mount(reply('r3', 'pin me please'))
  const star = (await ui.findAll({ type: 'Button' })).find(b => String(b.props.label).includes('☆'))
  expect(star).toBeDefined()
  await $.ui.press({ plugin: P, key: star!.key!, requestId: 'r3' })
  const out = await $.command.run({ command: 'undertone-pins', args: '', ...CMD })
  expect(JSON.stringify(out)).toContain('pin me please')
  await ui.unmount()
})

// ---------- themes ----------
test('/undertone-theme switches the palette', async ($, on) => {
  engine(on)
  on('store.set', () => ({ value: undefined }))
  await start($)
  const out = await $.command.run({ command: 'undertone-theme', args: 'sunset', ...CMD })
  expect(JSON.stringify(out)).toContain('sunset')
  const ui = await $.ui.mount(prompt('x', 'hello'))
  expect(JSON.stringify(await ui.find({ type: 'Text', text: /^You$/ }))).toContain('#FF8A65')
  await ui.unmount()
})

// ---------- tool rows, turn summary, spinner, notifications ----------
test('a failing tool call is counted, summarised in red and notified on a long turn', async ($, on) => {
  const { runs, toasts } = engine(on)
  on('prompt.submit', (_: any, e: any) => e)
  on('tool.call', () => ({ result: 'boom', isError: true }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200000 }, rateLimits: [] } }))
  // Stand-in for the engine's own spinner drawing: shows the message it is handed.
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>{e.props.message ?? e.props.word}</Text> })
  await start($)
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  const spin = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'Spinner', requestId: 's', props: { word: 'Sauteing', message: null, suffix: '…', mode: 'tool-use' } })
  expect((await spin.find({ type: 'Text', text: /Sauteing · 1 tool/ }))?.text).toBe('Sauteing · 1 tool')
  await spin.unmount()
  await $.turn.complete({ answer: 'done', durationMs: 45000, isAborted: false, turnId: 't1', reason: 'answer', usage: { model: 'm', input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } })
  const row = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'TurnDuration', requestId: 'td', props: { word: 'Baked', durationMs: 45000 } })
  expect((await row.findAll({ type: 'Text', text: /1 failed/ })).some(x => x.props.color === 'error')).toBe(true)
  expect((await row.find({ type: 'Text', text: /1 tool/ }))?.text).toContain('1k in')
  await row.unmount()
  expect(toasts.some(t => /finished in 45s/.test(t))).toBe(true)
  expect(runs.some(r => r.argv.join(' ').includes('osascript'))).toBe(true)
})

test('a finished background task is a one-line chip: ✓, who, finished, the first line', async ($, on) => {
  engine(on)
  await start($)
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'UserMessage', requestId: 'n1', props: { text: 'Build finished\nmore detail', origin: { kind: 'task-notification' }, isExpanded: false, task: { status: 'completed', durationMs: 122_000 } } })
  const t = await ui.find({ type: 'Text', text: /✓/ })
  expect(t?.text).toMatch(/✓ task finished · 2m\s+Build finished/)
  expect(t?.text).not.toContain('more detail')
  await ui.unmount()
})

test('a file path in a tool row opens the viewer pane', async ($, on) => {
  engine(on)
  let opened = ''
  on('ui.open', (_: any, e: any) => { opened = e.id; return { value: { isPlaced: true } } })
  on('fs.read', () => ({ value: 'export const a = 1\n' }))
  await start($)
  const row = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolUse', requestId: 'tu9', props: { tool_use_id: 'tu9', tool: 'Read', input: { file_path: '/work/proj/a.ts' }, isRunning: false, isErrored: false, isInterrupted: false } })
  await $.ui.press({ plugin: P, key: 'f0', requestId: 'tu9' })
  expect(opened).toBe('undertone-file')
  await row.unmount()
  const pane = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'Pane', requestId: 'undertone-file', props: { title: 'a.ts', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } })
  expect((await pane.find({ type: 'Code' }))?.props.path).toBe('/work/proj/a.ts')
  await pane.unmount()
})

for (const [os, cwd, path, want, never] of [
  ['macOS/Linux', '/work/proj', '/work/proj/setup.command', 'open -t', 'xdg-open'],
  ['Windows', 'C:\\work\\proj', 'C:\\work\\proj\\fix.bat', 'notepad.exe', 'Invoke-Item'],
] as const) test(`Open in editor uses a text editor, never the default app, on ${os}`, async ($, on) => {
  const { runs } = engine(on, { cwd })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.read', () => ({ value: 'echo hi\n' }))
  await start($)
  const row = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolUse', requestId: 'tu8', props: { tool_use_id: 'tu8', tool: 'Write', input: { file_path: path, content: 'echo hi' }, isRunning: false, isErrored: false, isInterrupted: false } })
  await $.ui.press({ plugin: P, key: 'f0', requestId: 'tu8' })
  await row.unmount()
  const pane = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'Pane', requestId: 'undertone-file', props: { title: 'x', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } })
  await $.ui.press({ plugin: P, key: 'open-ext', requestId: 'undertone-file' })
  await pane.unmount()
  const opener = runs.at(-1)!.argv.join(' ')
  expect(opener).toContain(want)
  expect(opener).not.toContain(never)
})

// ---------- export ----------
test('/undertone-export writes Markdown with timestamps', async ($, on) => {
  const { writes } = engine(on, { transcript: TRANSCRIPT })
  on('session.messages', () => ({ value: [
    { role: 'user', text: 'first prompt', toolUses: [] },
    { role: 'assistant', text: 'first reply', toolUses: [] },
  ] }))
  await start($)
  const out = await $.command.run({ command: 'undertone-export', args: '/tmp/x.md', ...CMD })
  expect(JSON.stringify(out)).toContain('2 with times')
  expect(writes['/tmp/x.md']).toContain('### You · 2:40:00.000 PM UTC+8')
  expect(writes['/tmp/x.md']).toContain('first reply')
})


// ---------- Windows: every OS call goes through PowerShell, never sh ----------
test('on Windows the mod uses PowerShell for files, transcript and notifications', async ($, on) => {
  const { runs, copies } = engine(on, { transcript: TRANSCRIPT, cwd: 'C:\\work\\proj' })
  on('prompt.submit', (_: any, e: any) => e)
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200000 }, rateLimits: [] } }))
  on('session.end', () => ({ sessionId: 'sess-1234-abcd' }))
  await start($)
  const r = await $.ui.mount(reply('w1', 'copy me'))
  await $.ui.press({ plugin: P, key: 'copy-all', requestId: 'w1' })
  await r.unmount()
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({ answer: 'ok', durationMs: 60000, isAborted: false, turnId: 't', reason: 'answer' })
  await $.session.end({ reason: 'other', sessionId: 'sess-1234', resume: { id: 'sess-1234' } })
  const isPs = (x: Run) => /powershell\.exe$/i.test(x.argv[0] ?? '')
  const shells = runs.filter(x => !isPs(x)).map(x => x.argv.join(' '))
  // the only sh allowed on Windows is the legacy transcript guess, which fails harmlessly there
  expect(shells.filter(c => !c.includes('CLAUDE_CONFIG_DIR'))).toEqual([])
  const ps = runs.filter(isPs).map(x => x.argv[x.argv.length - 1]!)
  // PowerShell by full path, never through PATH; non-interactive, STA
  expect(runs.filter(isPs).every(x => x.argv[0] === 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' && x.argv.includes('-STA') && x.argv.includes('-NonInteractive'))).toBe(true)
  // stdin is ASCII-only JSON
  expect(runs.filter(isPs).every(x => x.stdin === undefined || /^[\x00-\x7e]*$/.test(x.stdin))).toBe(true)
  expect(copies).toEqual(['copy me']) // the clipboard is Claude Code's, no PowerShell needed
  expect(ps.some(c => c.includes('ToastNotificationManager'))).toBe(true)
  expect(ps.some(c => c.includes('Remove-Item'))).toBe(true)
})
