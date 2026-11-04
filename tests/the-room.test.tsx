// 0.11 "the room": system cards, group chat, Claude asks, welcome, footer pills, the background
// hint, and agents (hand-off card, report bubble, counts, the strip above the prompt).
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41) // 3:41 PM at UTC+8

type Agent = { id: string; type: string; description: string; status: string; teammateId?: string }
function machine(on: any, opts: { agents?: () => Agent[]; sessions?: unknown } = {}) {
  const store: Record<string, unknown> = { sessions: opts.sessions }
  const copies: string[] = []
  const placed: string[] = []
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1234' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.root', () => ({ value: '/work' }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('env.get', (_: any, e: any) => ({ value: ({ HOME: '/home/u', TMPDIR: '/tmp' } as Record<string, string>)[e.name ?? e] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('store.get', (_: any, e: any) => ({ value: store[e.key] }))
  on('store.set', (_: any, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.copy', (_: any, e: any) => { copies.push(e.text); return { value: { isCopied: true } } })
  on('ui.place', (_: any, e: any) => { placed.push(e.id); return { value: { isPlaced: true, requestId: 'placed-' + e.id } } })
  on('agent.list', () => ({ value: opts.agents?.() ?? [] }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.submit', (_: any, e: any) => e)
  const calls: string[] = [] // tool_use_ids, in order
  // An Agent call launches in the background, as Claude Code does by default.
  on('tool.call', (_: any, e: any) => { calls.push(e.tool_use_id); return { result: e.tool === 'Agent' ? { isAsync: true, status: 'async_launched', agentId: 'ag9' } : 'ok' } })
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  // Claude Code's own drawing; shows a rewritten background hint so a test can read it.
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props?.hint !== undefined ? 'HINT:' + e.props.hint : 'ENGINE'}</Text>
  })
  return { store, copies, placed, calls }
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
const mount = ($: any, component: string, props: object, requestId = 'r') => $.ui.mount({ plugin: P, surface: 'terminal', component, requestId, props, viewport: { columns: 100, rows: 40 } } as any)
const texts = async (ui: any) => ((await ui.findAll({ type: 'Text' })) as any[]).map(t => t.text as string)

test('10. a command\'s output is a system card: the command, [ copy ], the text', async ($, on) => {
  const { copies } = machine(on)
  await start($)
  const ui = await mount($, 'CommandOutput', { command: 'cost', args: '', text: 'Total cost: $1.20', isErrored: false })
  const all = await texts(ui)
  expect(all).toContain('/cost')
  expect(all).toContain('Total cost: $1.20')
  expect(all).not.toContain('ENGINE')
  const copy = ((await ui.findAll({ type: 'Button' })) as any[]).find(b => b.props.label === '[ copy ]')
  await $.ui.press({ plugin: P, key: copy.key, requestId: 'r' })
  expect(copies).toEqual(['Total cost: $1.20'])
  await ui.unmount()
})

test('10. a failed command\'s card has a red frame and ✗', async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'CommandOutput', { command: 'undertone-export', args: '/root/x.md', text: 'Export failed: EACCES', isErrored: true })
  expect(await texts(ui)).toContain('✗ /undertone-export /root/x.md')
  expect(((await ui.findAll({ type: 'Box' })) as any[]).some(b => b.props.borderColor === 'error')).toBe(true)
  await ui.unmount()
})

test('11. a message from an agent is its own bubble with its name', async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'UserMessage', { text: 'Review done: 2 nits.', origin: { kind: 'peer-send-message' }, from: { name: 'code-reviewer' }, isExpanded: false })
  const all = await texts(ui)
  expect(all.some(t => t.startsWith('◆ code-reviewer'))).toBe(true)
  expect(all).toContain('Review done: 2 nits.')
  expect(all).toContain('session') // not one of this session's agents
  await ui.unmount()
})

test('11. a message from one of this session\'s agents is tagged subagent', async ($, on) => {
  machine(on, { agents: () => [{ id: 'ag2', type: 'general-purpose', teammateId: 'scout@demo', description: 'count', status: 'running' }] })
  await start($)
  const ui = await mount($, 'UserMessage', { text: 'Found 16.', origin: { kind: 'peer' }, from: { name: 'scout' }, isExpanded: false })
  expect(await texts(ui)).toContain('subagent')
  await ui.unmount()
  const ch = await mount($, 'UserMessage', { text: 'hi', origin: { kind: 'channel', server: 'slack' }, from: { name: 'ana' }, isExpanded: false }, 'r2')
  expect(await texts(ch)).toContain('slack')
  await ch.unmount()
})

test('11. a finished agent task is a chip with the agent\'s type', async ($, on) => {
  machine(on, { agents: () => [{ id: 'ag1', type: 'Explore', description: 'find the config', status: 'completed' }] })
  await start($)
  const ui = await mount($, 'UserMessage', { text: 'Found it', origin: { kind: 'task-notification' }, task: { id: 'ag1', status: 'completed' }, isExpanded: false })
  expect((await texts(ui)).some(t => /✓ Explore finished\s+Found it/.test(t))).toBe(true)
  await ui.unmount()
})

// 12 (the "Claude asks" card) wraps the engine's own dialog node, which the test runner cannot
// make; it is checked in a real terminal instead.

test('14. the welcome row: greeting, nth session today, when the last one ended', async ($, on) => {
  const { placed } = machine(on, { sessions: [{ start: NOW - 3 * 3_600_000, end: NOW - 2 * 3_600_000 }] })
  await start($)
  expect(placed).toEqual(['welcome'])
  const ui = await mount($, 'Placed', { id: 'welcome', plugin: 'undertone' })
  expect((await texts(ui)).some(t => t.includes('Good afternoon · 2nd session today · last one ended 2h ago'))).toBe(true)
  await ui.unmount()
})

test('14. a reload (session.start again, same session) does not count as another session', async ($, on) => {
  const { store } = machine(on, { sessions: [{ id: 'old', start: NOW - 3 * 3_600_000, end: NOW - 2 * 3_600_000 }] })
  await start($)
  await start($)
  expect((store.sessions as unknown[]).length).toBe(2)
  const ui = await mount($, 'Placed', { id: 'welcome', plugin: 'undertone' })
  expect((await texts(ui)).some(t => t.includes('2nd session today'))).toBe(true)
  await ui.unmount()
})

test('14. no welcome row when it is turned off', { options: { welcome: false } }, async ($, on) => {
  const { placed } = machine(on)
  await start($)
  expect(placed).toEqual([])
})

test('15. footer mode labels become pills', async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'SessionMode', { modes: ['focus', 'memory paused'] })
  const pills = ((await ui.findAll({ type: 'Text' })) as any[]).filter(t => t.props.backgroundColor)
  expect(pills.map(p => p.text)).toEqual([' focus ', ' memory paused '])
  await ui.unmount()
})

for (const [how, want] of [['compact', 'HINT:↧ ctrl+b · background'], ['hidden', 'HINT:'], ['engine', 'HINT:(ctrl+b to run in background)']] as const)
  test(`16. the run-in-background hint: ${how}`, { options: { backgroundHint: how } }, async ($, on) => {
    machine(on)
    await start($)
    const ui = await mount($, 'ToolProgress', { tool_use_id: 't1', kind: 'background_hint', hint: '(ctrl+b to run in background)' })
    expect(await texts(ui)).toContain(want)
    await ui.unmount()
  })

const agentCall = (over: object) => ({ tool_use_id: 'ag1', tool: 'Agent', input: { subagent_type: 'Explore', description: 'find the config', prompt: 'look' }, isRunning: true, isErrored: false, isInterrupted: false, ...over })

test('18. Claude handing work to an agent is a hand-off line with its status', async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'ToolUse', agentCall({}))
  expect((await texts(ui)).some(t => /↳ Claude → Explore: find the config\s+◌ working/.test(t))).toBe(true)
  await ui.unmount()
})

test('18. a background agent\'s line says so, then ✓ done when the agent\'s own turn ends', async ($, on) => {
  const { calls } = machine(on)
  await start($)
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Agent', subagent_type: 'Explore', description: 'list docs', prompt: 'x' } as any)
  const id = calls.at(-1)!
  const row = () => mount($, 'ToolUse', agentCall({ tool_use_id: id, input: { subagent_type: 'Explore', description: 'list docs', prompt: 'x' }, isRunning: true }))
  let ui = await row()
  expect((await texts(ui)).some(t => /↳ Claude → Explore: list docs\s+↗ in background/.test(t))).toBe(true)
  await ui.unmount()
  await $.turn.complete({ answer: 'listed', durationMs: 9000, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'ag9' } as any)
  ui = await row()
  expect((await texts(ui)).some(t => /↳ Claude → Explore: list docs\s+✓ done/.test(t))).toBe(true)
  await ui.unmount()
})

test('19. the agent\'s report is its own bubble, folded when long', async ($, on) => {
  machine(on)
  await start($)
  const report = ['Found it in a.ts', ...Array.from({ length: 30 }, (_, i) => `line ${i}`)].join('\n')
  const ui = await mount($, 'ToolUse', agentCall({ isRunning: false, output: [{ type: 'text', text: report }] }))
  const all = await texts(ui)
  expect(all.some(t => /✓ done/.test(t))).toBe(true)
  expect(all).toContain('◆ Explore')
  expect(all.some(t => t.startsWith('Found it in a.ts') && !t.includes('line 29'))).toBe(true)
  expect(((await ui.findAll({ type: 'Button' })) as any[]).some(b => /more · \d+ lines/.test(b.props.label))).toBe(true)
  await ui.unmount()
})

test('20. the turn summary counts agents and their tools apart', async ($, on) => {
  machine(on)
  await start($)
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y' } as any)
  for (const c of ['a', 'b', 'c']) await $.tool.call({ tool: 'Bash', command: c, agentId: 'ag1' } as any)
  await $.turn.complete({ answer: 'ok', durationMs: 4000, isAborted: false, turnId: 't', reason: 'answer' })
  const ui = await mount($, 'TurnDuration', { word: 'Baked', durationMs: 4000 })
  expect((await texts(ui)).some(t => t.includes('1 tool · 1 agent (3 tools)'))).toBe(true)
  await ui.unmount()
})

test('21. the strip above the prompt: ● working agents, ○ done until your next prompt', async ($, on) => {
  let status = 'running'
  machine(on, { agents: () => [{ id: 'ag1', type: 'Explore', description: 'find the config', status }] })
  await start($)
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  const band = (isWorking: boolean) => mount($, 'AbovePrompt', { hasSurvey: false, isWorking, maxRows: 6 }, 'band')
  let ui = await band(true)
  expect((await texts(ui)).some(t => t.startsWith('● Explore · find the config'))).toBe(true)
  await ui.unmount()
  status = 'completed'
  ui = await band(true)
  expect((await texts(ui)).some(t => t.startsWith('○ Explore (done)'))).toBe(true)
  await ui.unmount()
  await $.prompt.submit({ text: 'next', wait: false, origin: { kind: 'composer' } })
  ui = await band(true)
  expect((await texts(ui)).some(t => t.includes('Explore'))).toBe(false)
  await ui.unmount()
})

test('12. the question tool\'s row says what was asked, not its JSON', async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'ToolUse', { tool_use_id: 'q1', tool: 'AskUserQuestion', input: { questions: [{ question: 'Pick red or blue?', header: 'Color', options: [] }] }, isRunning: false, isErrored: false, isInterrupted: false })
  const all = await texts(ui)
  expect(all.some(t => t.includes('Asked: Pick red or blue?'))).toBe(true)
  expect(all.some(t => t.includes('{"questions"'))).toBe(false)
  await ui.unmount()
})
