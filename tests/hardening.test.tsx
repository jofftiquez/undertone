// Hardening and UX: env, PowerShell path, ASCII stdin, contrast,
// colour validation, hover buttons, plain-words rows, setup, timeouts, random + on/off.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const NOW = Date.UTC(2026, 10, 3, 8, 0)
type Run = { argv: string[]; stdin?: string; timeoutMs?: number }
function machine(on: any, env: Record<string, string> = { HOME: '/home/u', TMPDIR: '/tmp' }) {
  const runs: Run[] = []
  const config: Record<string, unknown> = {}
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1234' }))
  on('session.cwd', () => ({ value: '/work/proj' }))
  on('session.root', () => ({ value: '/work/proj' }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('env.get', (_: any, e: any) => ({ value: env[e.name ?? e] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('store.delete', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('config.set', (_: any, e: any) => { config[e.key] = e.value; return { value: e.value } })
  on('process.run', (_: any, e: any) => {
    const argv: string[] = e.argv ?? []
    runs.push({ argv, stdin: e.stdin ?? e.init?.stdin, timeoutMs: e.timeoutMs ?? e.init?.timeoutMs })
    return { value: { exitCode: 0, stdout: argv.join(' ').includes('date') ? '+0800\n' : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // Stand-in for Claude Code's own drawing, reached when undertone hands a row back.
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE</Text> })
  return { runs, config }
}
const start = ($: any) => $.session.start({ cwd: '/work/proj', surface: 'terminal', isInteractive: true })
const you = (text = 'hello', viewport?: { columns: number; rows: number; isFullscreen?: boolean }) => ({ plugin: P, surface: 'terminal' as const, component: 'UserMessage' as const, requestId: 'u1', props: { text, origin: { kind: 'composer' as const }, isExpanded: false }, ...(viewport ? { viewport } : {}) })
const reply = (text = 'a reply\n```ts\nconst a = 1\n```', viewport?: { columns: number; rows: number; isFullscreen?: boolean }) => ({ plugin: P, surface: 'terminal' as const, component: 'AssistantMessage' as const, requestId: 'a1', props: { text, isFirstOfReply: true }, ...(viewport ? { viewport } : {}) })
const tool = (tool: string, input: object) => ({ plugin: P, surface: 'terminal' as const, component: 'ToolUse' as const, requestId: 't-' + tool, props: { tool_use_id: 't-' + tool, tool, input, isRunning: false, isErrored: false, isInterrupted: false } })
const bubbleOf = async (ui: any) => (await ui.findAll({ type: 'Box' })).find((b: any) => b.key === 'bubble')

test('1. paths come from the environment, not a shell', async ($, on) => {
  const { runs } = machine(on)
  await start($)
  const shellLookups = runs.filter(r => /CLAUDE_CONFIG_DIR|printf %s "\$HOME"|\$HOME/.test(r.argv.join(' ')))
  expect(shellLookups).toEqual([])
})

test('9. every helper process has a timeout', async ($, on) => {
  const { runs } = machine(on)
  await start($)
  const ui = await $.ui.mount(reply())
  await $.ui.press({ plugin: P, key: 'copy-all', requestId: 'a1' })
  await ui.unmount()
  expect(runs.length).toBeGreaterThan(0)
  expect(runs.every(r => r.timeoutMs === 5000)).toBe(true)
})

test('4. filled bubbles pick readable text (white on GitHub blue)', { options: { theme: 'github-light', bubbleStyle: 'filled' } }, async ($, on) => {
  machine(on)
  const ui = await $.ui.mount(you('readable?'))
  expect((await ui.find({ type: 'Text', text: /readable\?/ }))?.props.color).toBe('#FFFFFF')
  await ui.unmount()
})

test('4. an explicit text colour is kept even on a fill', { options: { theme: 'messenger', userTextColor: '#FFEE00' } }, async ($, on) => {
  machine(on)
  const ui = await $.ui.mount(you('mine'))
  expect((await ui.find({ type: 'Text', text: /mine/ }))?.props.color).toBe('#FFEE00')
  await ui.unmount()
})

test('5. a mistyped colour is ignored and the bubble still draws', { options: { userColor: 'blu', claudeFill: 'not-a-colour' } }, async ($, on) => {
  machine(on)
  const u = await $.ui.mount(you('still here'))
  expect((await bubbleOf(u))?.props.borderColor).toBe('suggestion')
  await u.unmount()
  const c = await $.ui.mount(reply('fine'))
  expect((await bubbleOf(c))?.props.backgroundColor).toBeUndefined()
  await c.unmount()
})

test('5. rgb() and ansi256() colours are accepted', { options: { userColor: 'rgb(10,200,30)', claudeColor: 'ansi256(114)' } }, async ($, on) => {
  machine(on)
  const u = await $.ui.mount(you()); expect((await bubbleOf(u))?.props.borderColor).toBe('rgb(10,200,30)'); await u.unmount()
  const c = await $.ui.mount(reply('x')); expect((await bubbleOf(c))?.props.borderColor).toBe('ansi256(114)'); await c.unmount()
})

test('6. fullscreen: buttons hide until hover; no extra row for code copy', async ($, on) => {
  machine(on)
  const ui = await $.ui.mount(reply(undefined, { columns: 100, rows: 40, isFullscreen: true }))
  // (the kit reports layout props, not `hover`): two hidden groups, overlaid, keyed
  const hidden = (await ui.findAll({ type: 'Box' })).filter((x: any) => x.props.display === 'none')
  expect(hidden.map((x: any) => x.key).sort()).toEqual(['copy-reveal-1', 'head-reveal'])
  expect(hidden.every((x: any) => x.props.position === 'absolute' && x.props.top === 0 && x.props.right === 0)).toBe(true)
  // the code block's copy no longer takes a row of its own above the code
  expect((await ui.findAll({ type: 'Box' })).some((x: any) => x.props.justifyContent === 'flex-end')).toBe(false)
  await ui.unmount()
})

test('6. not fullscreen (no mouse): buttons stay inline', async ($, on) => {
  machine(on)
  const ui = await $.ui.mount(reply(undefined, { columns: 100, rows: 40, isFullscreen: false }))
  expect((await ui.findAll({ type: 'Box' })).filter((x: any) => x.props.display === 'none')).toEqual([])
  expect(await ui.find({ key: 'copy-all' })).toBeDefined()
  await ui.unmount()
})

test('7. tool rows read in plain words with short paths', async ($, on) => {
  machine(on)
  await start($)
  for (const [t, input, want] of [
    ['Bash', { command: 'gh pr view 12\necho more', description: 'View PR' }, 'Ran gh pr view 12'],
    ['Read', { file_path: '/work/proj/src/app.ts' }, 'Read src/app.ts'],
    ['Edit', { file_path: '/home/u/notes.md', old_string: 'a', new_string: 'b' }, 'Edited ~/notes.md'],
    ['Grep', { pattern: 'todo', path: '/work/proj/src' }, 'Searched src for "todo"'],
    ['mcp__github__create_issue', { title: 'Bug' }, 'github create issue'],
  ] as const) {
    const ui = await $.ui.mount(tool(t, input))
    expect((await ui.find({ type: 'Text', text: new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }))?.text).toContain(want)
    await ui.unmount()
  }
})

test('7. a group of calls is one summary row that opens on press', async ($, on) => {
  machine(on)
  await start($)
  const calls = [
    { tool_use_id: 'g1', tool: 'Bash', input: { command: 'ls' }, isRunning: false, isErrored: false, isInterrupted: false },
    { tool_use_id: 'g2', tool: 'Bash', input: { command: 'pwd' }, isRunning: false, isErrored: false, isInterrupted: false },
    { tool_use_id: 'g3', tool: 'Read', input: { file_path: '/work/proj/a.ts' }, isRunning: false, isErrored: false, isInterrupted: false },
  ]
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolGroup', requestId: 'grp', props: { calls, isActive: false, isExpanded: false } })
  expect((await ui.find({ type: 'Text', text: /Ran 2 commands, read 1 file/ }))?.text).toContain('Ran 2 commands, read 1 file')
  expect(await ui.find({ type: 'Text', text: /Ran pwd/ })).toBeUndefined()
  await $.ui.press({ plugin: P, key: 'group', requestId: 'grp' })
  expect(await ui.find({ type: 'Text', text: /Ran pwd/ })).toBeDefined()
  await ui.unmount()
})

test('8. setup previews a choice and Save writes it to /config', async ($, on) => {
  const { config } = machine(on)
  await start($)
  await $.command.run({ command: 'undertone', args: 'setup', ...CMD })
  const pane = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'Pane', requestId: 'undertone-setup', props: { title: 'Undertone setup', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
  await $.ui.press({ plugin: P, key: 'opt-dracula', requestId: 'undertone-setup' })
  const boxes = await pane.findAll({ type: 'Box' })
  expect(boxes.some((b: any) => b.props.borderColor === '#BD93F9')).toBe(true) // preview shows Dracula
  await $.ui.press({ plugin: P, key: 'next', requestId: 'undertone-setup' })
  await $.ui.press({ plugin: P, key: 'opt-filled', requestId: 'undertone-setup' })
  expect((await pane.findAll({ type: 'Box' })).some((b: any) => b.props.backgroundColor === '#44475A')).toBe(true) // Dracula filled
  await $.ui.press({ plugin: P, key: 'save', requestId: 'undertone-setup' })
  expect(config['undertone.theme']).toBe('dracula')
  expect(config['undertone.bubbleStyle']).toBe('filled')
  await pane.unmount()
})

test('10. random picks a dark preset', { options: { theme: 'random' } }, async ($, on) => {
  machine(on)
  const ui = await $.ui.mount(you())
  // any dark preset may come up, borderless ones (messenger) included: the bubble just has to draw
  expect(await bubbleOf(ui)).toBeDefined()
  await ui.unmount()
  const out = JSON.stringify(await $.command.run({ command: 'undertone-theme', args: '', ...CMD }))
  const current = /current: ([a-z0-9-]+)/.exec(out)?.[1] ?? ''
  expect(current).not.toBe('')
  expect(current).not.toMatch(/light|latte|dawn|mono|terminal/)
})

test('10. enabled=false hands every row back to Claude Code', { options: { enabled: false } }, async ($, on) => {
  machine(on)
  const ui = await $.ui.mount(you('plain please'))
  expect((await ui.find({ type: 'Text' }))?.text).toBe('ENGINE')
  await ui.unmount()
})

test('10. /undertone off and on switch for the session', async ($, on) => {
  machine(on)
  await start($)
  await $.command.run({ command: 'undertone', args: 'off', ...CMD })
  let ui = await $.ui.mount(reply('x'))
  expect((await ui.find({ type: 'Text' }))?.text).toBe('ENGINE')
  await ui.unmount()
  await $.command.run({ command: 'undertone', args: 'on', ...CMD })
  ui = await $.ui.mount(reply('back again'))
  expect(await bubbleOf(ui)).toBeDefined()
  await ui.unmount()
})

test('a prompt that is not yours mid-turn does not reset the tool count', async ($, on) => {
  machine(on)
  on('prompt.submit', (_: any, e: any) => e)
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200000 }, rateLimits: [], cost: { usd: 1 } } }))
  await start($)
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' as const } })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.prompt.submit({ text: 'skills listing', wait: false, origin: { kind: 'plugin', name: 'other' } })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await $.turn.complete({ answer: 'ok', durationMs: 4000, isAborted: false, turnId: 't', reason: 'answer' })
  const row = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'TurnDuration', requestId: 'td', props: { word: 'Baked', durationMs: 4000 } })
  expect((await row.find({ type: 'Text', text: /2 tools/ }))).toBeDefined()
  await row.unmount()
})

test('turns of similar length each get their own summary', async ($, on) => {
  machine(on)
  on('prompt.submit', (_: any, e: any) => e)
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  await start($)
  await $.prompt.submit({ text: 'one', wait: false, origin: { kind: 'composer' as const } })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.turn.complete({ answer: 'ok', durationMs: 4000, isAborted: false, turnId: 't1', reason: 'answer' })
  await $.prompt.submit({ text: 'two', wait: false, origin: { kind: 'composer' as const } })
  for (const c of ['a', 'b', 'c']) await $.tool.call({ tool: 'Bash', command: c })
  await $.turn.complete({ answer: 'ok', durationMs: 4900, isAborted: false, turnId: 't2', reason: 'answer' })
  for (const [ms, want] of [[4000, /1 tool\b/], [4900, /3 tools/]] as const) {
    const row = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'TurnDuration', requestId: 'td' + ms, props: { word: 'Baked', durationMs: ms } })
    expect(await row.find({ type: 'Text', text: want })).toBeDefined()
    await row.unmount()
  }
})
