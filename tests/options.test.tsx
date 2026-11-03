// 0.22: the options that tune what undertone draws.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41)
function machine(on: any) {
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1234' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.root', () => ({ value: '/work' }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('env.get', (_: any, e: any) => ({ value: ({ HOME: '/home/u', TMPDIR: '/tmp' } as Record<string, string>)[e.name ?? e] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('store.get', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE</Text> })
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
const BASE = { foldLines: 200, buttons: 'inline' }
const reply = ($: any, text: string) => $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text, isFirstOfReply: true }, viewport: { columns: 100, rows: 60 } } as any)
const texts = async (ui: any) => ((await ui.findAll({ type: 'Text' })) as any[])
const labels = async (ui: any) => ((await ui.findAll({ type: 'Button' })) as any[]).map(b => b.props.label as string)
const opts = (o: object) => ({ options: { ...BASE, ...o } })
const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

test('surfaces: undertone draws only where named; elsewhere Claude Code\'s own look', opts({ surfaces: 'desktop' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, 'hi')
  expect((await texts(ui)).map(t => t.text)).toEqual(['ENGINE'])
  await ui.unmount()
})

test('listMarker dash: - at every level', opts({ listMarker: 'dash' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, '- one\n  - two')
  expect((await texts(ui)).filter(t => t.text === '-').length).toBe(2)
  await ui.unmount()
})

test('headingStyle uppercase: H1 in capitals', opts({ headingStyle: 'uppercase' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, '# Release plan')
  expect((await texts(ui)).some(t => t.text === 'RELEASE PLAN')).toBe(true)
  await ui.unmount()
})

test('folds open: a long reply starts whole, with [ less ]', { options: { buttons: 'inline', folds: 'open', foldLines: 3 } }, async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, 'a\nb\nc\nd\ne\nf')
  expect(await labels(ui)).toContain('[ less ]')
  await ui.unmount()
})

const call = { tool_use_id: 't1', tool: 'Bash', input: { command: 'sleep 9' }, isRunning: true, isErrored: false, isInterrupted: false }
test('toolRows off: Claude Code\'s own tool rows', opts({ toolRows: false }), async ($, on) => {
  machine(on); await start($)
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolUse', requestId: 't1', props: call } as any)
  expect((await texts(ui)).map(t => t.text)).toEqual(['ENGINE'])
  await ui.unmount()
})

test('runningDot blink: ● on and off with the clock', opts({ runningDot: 'blink' }), async ($, on) => {
  machine(on); await start($)
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolUse', requestId: 't1', props: call } as any)
  const want = Math.floor(NOW / 500) % 2 ? ' ● ' : '   '
  expect((await texts(ui)).map(t => t.text)).toContain(want)
  expect((await texts(ui)).map(t => t.text)).not.toContain(' ◌ ')
  await ui.unmount()
})

const MIXED = '| a | b |\n|---|---|\n| 1 | 2 |\n\n- item\n\n' + fence('ts', 'x()')
test('copyButtons off: no copy button anywhere', opts({ copyButtons: false }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, MIXED)
  expect((await labels(ui)).filter(l => /copy|md|cells|html|art|png/.test(l))).toEqual([])
  expect((await texts(ui)).some(t => t.text === 'copy')).toBe(false)
  await ui.unmount()
})

test('textCopyButtons off: lists and quotes lose theirs, code keeps its own', opts({ textCopyButtons: false }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, MIXED)
  const all = await labels(ui)
  expect(all).not.toContain('[ copy list ]')
  expect(all).toContain('[ copy code ]')
  await ui.unmount()
})

const BARS = fence('mermaid', 'xychart-beta\n  x-axis [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20]\n  bar [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]')
test('mermaid off: diagrams stay code', opts({ mermaid: false }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, BARS)
  expect(((await ui.findAll({ type: 'Code' })) as any[])[0]?.props.language).toBe('mermaid')
  await ui.unmount()
})

test('mermaidAscii: bars and lines in ASCII', opts({ mermaidAscii: true }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, BARS)
  const all = (await texts(ui)).map(t => t.text)
  expect(all.some(t => /^#+$/.test(t))).toBe(true)
  expect(all.some(t => /█/.test(t))).toBe(false)
  expect(all.some(t => /#\|/.test(t))).toBe(false) // a bar's last eighth is #, not |
  await ui.unmount()
})

test('pieStyle round: a circle of coloured cells with a legend', opts({ pieStyle: 'round' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, fence('mermaid', 'pie\n  "a" : 3\n  "b" : 1'))
  const all = (await texts(ui)).map(t => t.text)
  expect(all.filter(t => /^█+$/.test(t)).length).toBeGreaterThan(10) // the circle's runs
  expect(all).toContain(' 75%')
  await ui.unmount()
})

test('bubbleLabels off and timeFormat off: frames only, no "Claude", no time', opts({ bubbleLabels: 'off', timeFormat: 'off' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, 'hello')
  const all = (await texts(ui)).map(t => t.text)
  expect(all.some(t => t.includes('Claude'))).toBe(false)
  expect(all.some(t => /UTC/.test(t))).toBe(false)
  expect(((await ui.findAll({ type: 'Box' })) as any[]).some(b => b.key === 'bubble')).toBe(true)
  await ui.unmount()
})

test('colours: numbers, headings, bullets and alerts take the colours you set', opts({ numberColor: '#ff0000', headingColor: '#00ff00', bulletColor: '#0000ff', alertTipColor: '#123456' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, '# Title\n\nTook 250ms.\n\n- item\n\n> [!TIP]\n> Nice.')
  const all = await texts(ui)
  expect(all.some(t => t.text === '250ms' && t.props.color === '#ff0000')).toBe(true)
  expect(all.some(t => t.text === 'Title' && t.props.color === '#00ff00')).toBe(true)
  expect(all.some(t => t.text === '•' && t.props.color === '#0000ff')).toBe(true)
  expect(all.some(t => t.text === 'Tip' && t.props.color === '#123456')).toBe(true)
  await ui.unmount()
})

test('table colours: header, rules and text take the colours you set', opts({ tableHeaderColor: '#111111', tableRuleColor: '#222222', tableTextColor: '#333333' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, '| name | n |\n|---|---|\n| ada | 1 |')
  const all = await texts(ui)
  expect(all.some(t => t.text === 'name' && t.props.color === '#111111')).toBe(true)
  expect(all.some(t => /─/.test(t.text) && t.props.color === '#222222')).toBe(true)
  expect(all.some(t => t.text === 'ada' && t.props.color === '#333333')).toBe(true)
  await ui.unmount()
})

test('text colours: bold, italic, inline code, quotes, rules and diagram text take the colours you set', opts({ strongColor: '#a00001', emphasisColor: '#a00002', inlineCodeColor: '#a00003', quoteColor: '#a00004', ruleColor: '#a00005', diagramTextColor: '#a00006' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, 'A **bold** and *soft* `x()` here.\n\n---\n\n> quoted\n\n' + fence('figure', 'plain label'))
  const all = await texts(ui)
  for (const [text, color] of [['bold', '#a00001'], ['soft', '#a00002'], ['x()', '#a00003'], ['plain label', '#a00006']]) expect(all.some(t => t.text === text && t.props.color === color)).toBe(true)
  expect(all.some(t => /^─+$/.test(t.text) && t.props.color === '#a00005')).toBe(true)
  expect(((await ui.findAll({ type: 'Box' })) as any[]).some(b => b.props.borderStyle === 'quote' && b.props.borderColor === '#a00004')).toBe(true)
  await ui.unmount()
})

const you = ($: any, text: string) => $.ui.mount({ plugin: P, surface: 'terminal', component: 'UserMessage', requestId: 'p1', props: { text, origin: { kind: 'composer' }, isExpanded: false }, viewport: { columns: 100, rows: 60 } } as any)
test('userShape chevron: ❯ before your prompt, no frame', opts({ userShape: 'chevron' }), async ($, on) => {
  machine(on); await start($)
  const ui = await you($, 'ship it')
  expect((await texts(ui)).some(t => t.text === '❯ ')).toBe(true)
  expect(((await ui.findAll({ type: 'Box' })) as any[]).find(b => b.props.key === 'bubble')?.props.borderStyle).toBeUndefined()
  await ui.unmount()
})

test('bubbleLabels small: the names without icons', opts({ bubbleLabels: 'small', claudeIcon: '✻' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, 'hello')
  const all = (await texts(ui)).map(t => t.text)
  expect(all).toContain('Claude')
  expect(all.some(t => t.includes('✻'))).toBe(false)
  await ui.unmount()
})

test('tableStyle grid: a full grid, as box', opts({ tableStyle: 'grid' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |')
  const all = (await texts(ui)).map(t => t.text)
  expect(all.some(t => t.startsWith('┌'))).toBe(true)
  expect(all.some(t => t.startsWith('├'))).toBe(true)
  await ui.unmount()
})

test('rtl off: a Hebrew list keeps its bullets on the left', opts({ rtl: 'off' }), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, '- שלום עולם')
  expect(((await ui.findAll({ type: 'Text' })) as any[]).some(t => t.props.dir === 'rtl')).toBe(false)
  await ui.unmount()
})

const done = { ...call, isRunning: false, output: 'ok' }
for (const [style, check] of [['tree', (t: any[]) => t.some(x => x.text === '⎿ ')], ['bright', (t: any[]) => t.some(x => /sleep 9/.test(x.text) && !x.props.dimColor)]] as const) {
  test(`toolStyle ${style}`, opts({ toolStyle: style }), async ($, on) => {
    machine(on); await start($)
    const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolUse', requestId: 't1', props: done } as any)
    expect(check(await texts(ui))).toBe(true)
    await ui.unmount()
  })
}

test('toolStyle tree: folded groups hang under the sentence too', opts({ toolStyle: 'tree' }), async ($, on) => {
  machine(on); await start($)
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolGroup', requestId: 'g1', props: { calls: [done, { ...done, tool_use_id: 't2' }], isExpanded: false } } as any)
  expect((await texts(ui)).some(x => x.text === '⎿ ')).toBe(true)
  await ui.unmount()
})
