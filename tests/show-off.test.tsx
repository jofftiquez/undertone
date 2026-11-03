// 0.12 "show-off": pictures inline, ✨ all green, /undertone-wrapped, /undertone-find, wallpaper.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41) // 3:41 PM at UTC+8
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
// A PNG's first 24 bytes: the signature, then IHDR with this width and height.
function pngHeader(w: number, h: number) {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]
  for (const n of [w, h]) b.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255)
  return btoa(String.fromCharCode(...b))
}

type Msg = { role: 'user' | 'assistant'; text: string; toolUses: { tool?: string }[] }
function machine(on: any, opts: { bashOut?: string; messages?: Msg[]; png?: string } = {}) {
  const backdrops: unknown[] = []
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1234' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.root', () => ({ value: '/work' }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200000 }, rateLimits: [], cost: { usd: 1.25 } } }))
  on('session.messages', () => ({ value: opts.messages ?? [] }))
  on('env.get', (_: any, e: any) => ({ value: ({ HOME: '/home/u', TMPDIR: '/tmp' } as Record<string, string>)[e.name ?? e] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: opts.png ? { base64: opts.png } : 'text' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.place', () => ({ value: { isPlaced: true, requestId: 'w' } }))
  on('ui.backdrop', (_: any, e: any) => { backdrops.push(e); return { value: { isDrawn: true, requestId: 'b' } } })
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.submit', (_: any, e: any) => e)
  on('tool.call', (_: any, e: any) => ({ result: e.tool === 'Bash' ? { stdout: opts.bashOut ?? '', stderr: '' } : 'ok' }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('command.list', () => ({ value: [{ name: 'undertone-wrapped', description: '', source: 'plugin', plugin: 'undertone' }] }))
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE</Text> })
  return { backdrops }
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
const mount = ($: any, component: string, props: object) => $.ui.mount({ plugin: P, surface: 'terminal', component, requestId: 'r', props, viewport: { columns: 100, rows: 40 } } as any)
const texts = async (ui: any) => ((await ui.findAll({ type: 'Text' })) as any[]).map(t => t.text as string)
const run = async ($: any, command: string, args = '') => JSON.stringify(await $.command.run({ command, args, ...CMD }))
const turn = async ($: any, bash: string[]) => {
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  for (const c of bash) await $.tool.call({ tool: 'Bash', command: c })
  await $.turn.complete({ answer: 'ok', durationMs: 4000, isAborted: false, turnId: 't', reason: 'answer' })
}

test('1. a PNG Claude read is drawn under its row, sized to its shape', async ($, on) => {
  machine(on, { png: pngHeader(800, 400) })
  await start($)
  const ui = await mount($, 'ToolUse', { tool_use_id: 'rd', tool: 'Read', input: { file_path: '/work/shot.png' }, isRunning: false, isErrored: false, isInterrupted: false })
  const pic = (await ui.findAll({ type: 'Image' }))[0] as any
  expect(pic?.props.source).toEqual({ file: '/work/shot.png', format: 'png' })
  expect([pic?.props.columns, pic?.props.rows]).toEqual([48, 12]) // 2:1, as tall as 12 rows allow
  expect(pic?.props.alt).toContain('shot.png')
  await ui.unmount()
})

test('1. pictures off: no Image, just the row', { options: { inlineImages: false } }, async ($, on) => {
  machine(on, { png: pngHeader(800, 400) })
  await start($)
  const ui = await mount($, 'ToolUse', { tool_use_id: 'rd', tool: 'Read', input: { file_path: '/work/shot.png' }, isRunning: false, isErrored: false, isInterrupted: false })
  expect((await ui.findAll({ type: 'Image' })).length).toBe(0)
  await ui.unmount()
})

test('6. a turn whose last test run passed gets ✨ all green', async ($, on) => {
  machine(on, { bashOut: ' 213 pass\n 0 fail\nRan 213 tests across 8 files.' })
  await start($)
  await turn($, ['claude plugin test .'])
  const ui = await mount($, 'TurnDuration', { word: 'Baked', durationMs: 4000 })
  expect(await texts(ui)).toContain(' · ✨ all green')
  await ui.unmount()
})

for (const out of ['Tests: 3 failed, 9 passed', 'test result: FAILED. 1 passed; 2 failed', 'just some output'])
  test(`6. no badge for: ${out}`, async ($, on) => {
    machine(on, { bashOut: out })
    await start($)
    await turn($, ['run'])
    const ui = await mount($, 'TurnDuration', { word: 'Baked', durationMs: 4000 })
    expect((await texts(ui)).some(t => t.includes('all green'))).toBe(false)
    await ui.unmount()
  })

test('7. /undertone-wrapped: prompts, tools, top tools, longest turn, cost', async ($, on) => {
  machine(on, {
    bashOut: '12 passed',
    messages: [
      { role: 'user', text: 'first', toolUses: [] }, { role: 'assistant', text: 'ok', toolUses: [] },
      { role: 'user', text: 'second', toolUses: [] }, { role: 'assistant', text: 'done', toolUses: [] },
    ],
  })
  await start($)
  await turn($, ['a', 'b'])
  await $.tool.call({ tool: 'Read', file_path: '/work/a.ts' } as any)
  const out = await run($, 'undertone-wrapped')
  expect(out).toContain('✨ undertone wrapped')
  expect(out).toContain('2 prompts · 3 tool calls · $1.25')
  expect(out).toContain('Top tools      Bash 2 · Read 1')
  expect(out).toContain('Longest turn   4s')
  expect(out).toContain('All green      1 turn ✨')
})

test('8. /undertone-find lists the messages with the words, in context', async ($, on) => {
  machine(on, {
    messages: [
      { role: 'user', text: 'where is the config file?', toolUses: [] },
      { role: 'assistant', text: 'The config lives in settings.json, next to the README.', toolUses: [] },
      { role: 'user', text: 'thanks', toolUses: [] },
    ],
  })
  await start($)
  const out = await run($, 'undertone-find', 'config')
  expect(out).toContain('2 messages contain \\"config\\"')
  expect(out).toContain('You: where is the config file?')
  expect(out).toContain('Claude: The config lives in settings.json')
  expect(await run($, 'undertone-find', 'nothing-like-this')).toContain('No messages contain')
})

test('17. wallpaper: set at session start, drawn in the theme\'s surface colour', { options: { wallpaper: 'theme', theme: 'dracula' } }, async ($, on) => {
  const { backdrops } = machine(on)
  await start($)
  expect(backdrops).toEqual([{ backdrop: { id: 'wallpaper', glass: { blur: 14, opacity: 0.55 } } }])
  const ui = await $.ui.mount({ plugin: P, surface: 'desktop', component: 'Backdrop', requestId: 'b', props: { id: 'wallpaper', plugin: P, glass: { blur: 14, opacity: 0.55 } } } as any)
  expect(((await ui.findAll({ type: 'Box' })) as any[]).some(b => b.props.backgroundColor === '#44475A')).toBe(true)
  await ui.unmount()
})

test('17. no wallpaper unless asked', async ($, on) => {
  const { backdrops } = machine(on)
  await start($)
  expect(backdrops).toEqual([])
})

test('a system card drops Claude Code\'s "<plugin>: " heading; the card already names the command', async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'CommandOutput', { command: 'undertone-wrapped', args: '', text: 'undertone: ✨ undertone wrapped', isErrored: false })
  const all = await texts(ui)
  expect(all).toContain('✨ undertone wrapped')
  expect(all.some(t => t.startsWith('undertone: '))).toBe(false)
  await ui.unmount()
})

test('parallel tool calls are all counted (each counter update waits for the last)', async ($, on) => {
  machine(on)
  await start($)
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await Promise.all([$.tool.call({ tool: 'Bash', command: 'a' }), $.tool.call({ tool: 'Read', file_path: '/w/a' } as any), $.tool.call({ tool: 'Bash', command: 'b' })])
  await $.turn.complete({ answer: 'ok', durationMs: 4000, isAborted: false, turnId: 't', reason: 'answer' })
  const ui = await mount($, 'TurnDuration', { word: 'Baked', durationMs: 4000 })
  expect((await texts(ui)).some(t => t.includes('· 3 tools'))).toBe(true)
  await ui.unmount()
  expect(await run($, 'undertone-wrapped')).toContain('Bash 2 · Read 1')
})

test('✨ counts as two columns, so a card sized around it does not wrap its line', async ($, on) => {
  machine(on)
  await start($)
  const line = '✨ undertone wrapped · this session'
  const ui = await mount($, 'CommandOutput', { command: 'undertone-wrapped', args: '', text: line, isErrored: false })
  const card = ((await ui.findAll({ type: 'Box' })) as any[]).find(b => b.props.borderStyle === 'round')
  expect(card.props.width).toBe(line.length + 1 + 4) // ✨ is one char but two cells; + border and padding
  await ui.unmount()
})
