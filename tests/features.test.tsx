import { expect, test } from 'claude-code/testing'

const NOW = Date.UTC(2026, 10, 3, 7, 41)
const base = (on: any) => {
  on('clock.now', () => ({ value: NOW }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('state.get', () => ({ value: { value: undefined, version: 0 } }))
}

test('the ocean theme from the options colours the You bubble', { options: { theme: 'ocean' } }, async ($, on) => {
  base(on)
  const ui = await $.ui.mount({
    plugin: 'undertone', surface: 'terminal', component: 'UserMessage', requestId: 'r1',
    props: { text: 'hi', origin: { kind: 'composer' as const }, isExpanded: true },
  })
  const you = await ui.find({ type: 'Text', text: /^You$/ })
  expect(JSON.stringify(you)).toContain('#4FC3F7')
  await ui.unmount()
})

test('a failed tool call shows its output without a click', async ($, on) => {
  base(on)
  const ui = await $.ui.mount({
    plugin: 'undertone', surface: 'terminal', component: 'ToolUse', requestId: 'tu1',
    props: { tool_use_id: 'tu1', tool: 'Bash', input: { command: 'false' }, isRunning: false, isErrored: true, isInterrupted: false, output: 'boom: exit 1' },
  })
  expect((await ui.find({ type: 'Text', text: /boom: exit 1/ }))?.text).toContain('boom')
  await ui.unmount()
})

test('a successful tool call stays folded', async ($, on) => {
  base(on)
  const ui = await $.ui.mount({
    plugin: 'undertone', surface: 'terminal', component: 'ToolUse', requestId: 'tu2',
    props: { tool_use_id: 'tu2', tool: 'Bash', input: { command: 'true' }, isRunning: false, isErrored: false, isInterrupted: false, output: 'all good' },
  })
  expect(await ui.find({ type: 'Text', text: /all good/ })).toBeUndefined()
  await ui.unmount()
})

test('/undertone-pins draws a header and one entry per pin', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('state.get', (_: any, e: any) => ({
    value: e.key === 'pins'
      ? { value: { a: { who: 'You', text: 'This is a test', ms: NOW }, b: { who: 'Claude', text: 'All six are built.', ms: NOW + 60_000 } }, version: 1 }
      : { value: undefined, version: 0 },
  }))
  const ui = await $.ui.mount({
    plugin: 'undertone', surface: 'terminal', component: 'CommandOutput', requestId: 'c1',
    props: { command: 'undertone-pins', args: '', text: 'x', isErrored: false },
  })
  expect((await ui.find({ type: 'Text', text: /Pinned messages \(2\)/ }))?.text).toContain('(2)')
  expect((await ui.find({ type: 'Text', text: /All six are built/ }))?.text).toContain('All six')
  await ui.unmount()
})

const stateOf = (vals: Record<string, unknown>) => (_: any, e: any) => ({
  value: e.key in vals ? { value: vals[e.key], version: 1 } : { value: undefined, version: 0 },
})

test('turns before the fold point are hidden; the fold point shows the marker', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  // times are looked up by requestId in the transcript index
  on('state.get', stateOf({ times: { old1: NOW - 600_000, cut1: NOW - 60_000 }, cutoff: { ms: NOW - 60_000, hidden: 7 } }))
  const mount = (requestId: string) => $.ui.mount({
    plugin: 'undertone', surface: 'terminal', component: 'UserMessage', requestId,
    props: { text: 'p ' + requestId, origin: { kind: 'composer' as const }, isExpanded: false },
  })
  const old = await mount('old1')
  expect(await old.find({ type: 'Text', text: /p old1/ })).toBeUndefined()
  await old.unmount()
  const cut = await mount('cut1')
  expect((await cut.find({ type: 'Text', text: /7 earlier turns/ }))?.text).toContain('7 earlier turns')
  expect((await cut.find({ type: 'Text', text: /p cut1/ }))?.text).toContain('p cut1')
  await cut.unmount()
})

test('the turn summary shows failures', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('state.get', stateOf({ turns: { '42000': { tools: 5, failed: 2, inTok: 38000, outTok: 1200, endMs: NOW } } }))
  const ui = await $.ui.mount({
    plugin: 'undertone', surface: 'terminal', component: 'TurnDuration', requestId: 't1',
    props: { word: 'Baked', durationMs: 42000 },
  })
  expect((await ui.find({ type: 'Text', text: /2 failed/ }))?.text).toContain('2 failed')
  expect((await ui.find({ type: 'Text', text: /5 tools/ }))?.text).toContain('38k in')
  await ui.unmount()
})
