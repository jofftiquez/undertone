// 0.14 pictures: figures, charts (xychart-beta, pie), flowcharts, and the note that tells Claude.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41)
const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

function machine(on: any) {
  const copies: string[] = []
  const sent: { context?: readonly string[] }[] = []
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
  on('ui.copy', (_: any, e: any) => { copies.push(e.text); return { value: { isCopied: true } } })
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200000 }, rateLimits: [] } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.submit', (_: any, e: any) => { sent.push({ context: e.context }); return e })
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE</Text> })
  return { copies, sent }
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
const OPTS = { foldLines: 200, buttons: 'inline' }
const mount = ($: any, text: string) => $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text, isFirstOfReply: true }, viewport: { columns: 100, rows: 60 } } as any)
const texts = async (ui: any) => ((await ui.findAll({ type: 'Text' })) as any[])
const lines = async (ui: any) => (await texts(ui)).map(t => t.text as string)

test('figure: drawn as written, each role in its colour', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, fence('figure', 'retry  {accent:──▏}{warn:✗} timeout\nresult {ok:200 OK} {dim:later}'))
  const all = await texts(ui)
  expect(all.find(t => t.text === '✗')?.props.color).toBe('error')
  expect(all.find(t => t.text === '200 OK')?.props.color).toBe('success')
  expect(all.find(t => t.text === 'later')?.props.dimColor).toBe(true)
  expect(all.some(t => t.text === 'retry  ──▏✗ timeout')).toBe(true) // the line, markup gone
  expect((await ui.findAll({ type: 'Code' })).length).toBe(0)
  await ui.unmount()
})

test('a figure that would not draw as written stays code, with a note saying why', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, fence('figure', 'ok line\nbad {warn:open'))
  expect((await lines(ui)).some(t => /figure line 2: role markup/.test(t))).toBe(true)
  expect(((await ui.findAll({ type: 'Code' })) as any[])[0]?.props.language).toBe('figure')
  await ui.unmount()
})

test('xychart-beta bars: title, a bar per month, the tallest stands out; [ copy art ] copies the drawing', { options: OPTS }, async ($, on) => {
  const { copies } = machine(on)
  await start($)
  const ui = await mount($, fence('mermaid', 'xychart-beta\n  title "Signups"\n  x-axis [Jan, Feb, Mar]\n  bar [10, 40, 20]'))
  const all = await texts(ui)
  expect(all.some(t => t.text === 'Signups' && t.props.bold)).toBe(true)
  const bars = all.filter(t => /^█/.test(t.text))
  expect(bars.length).toBe(3)
  expect(bars.find(t => t.props.bold)?.text.length).toBeGreaterThan(bars[0].text.length) // Feb, the tallest
  const art = ((await ui.findAll({ type: 'Button' })) as any[]).find(b => b.props.label === '[ copy art ]')
  await $.ui.press({ plugin: P, key: art.key, requestId: 'a1' })
  expect(copies.at(-1)).toMatch(/^Signups\nJan █+[▏▎▍▌▋▊▉]? 10\nFeb █+ 40\nMar █+[▏▎▍▌▋▊▉]? 20$/)
  await ui.unmount()
})

test('a line series draws as a dot on a stem', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, fence('mermaid', 'xychart-beta\n  x-axis [a, b]\n  line [1, 2]'))
  expect((await lines(ui)).filter(t => /─*●$/.test(t)).length).toBe(2)
  await ui.unmount()
})

test('pie: slices largest first, with their share', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, fence('mermaid', 'pie title Browsers\n  "Safari" : 20\n  "Chrome" : 60\n  "Firefox" : 20'))
  const rows = (await lines(ui)).filter(t => /^ \d+ · \d+%$/.test(t))
  expect(rows).toEqual([' 60 · 60%', ' 20 · 20%', ' 20 · 20%'])
  expect((await lines(ui)).filter(t => /^(Chrome|Safari|Firefox)\s*$/.test(t)).map(t => t.trim())).toEqual(['Chrome', 'Safari', 'Firefox'])
  await ui.unmount()
})

test('flowchart LR chain: boxes joined by arrows, an edge label on its arrow', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, fence('mermaid', 'graph LR\n  A[Build] -->|artifacts| B[Test]\n  B --> C[Deploy]'))
  const all = await lines(ui)
  expect(new Set(all.filter(t => /^╭─+╮$/.test(t))).size).toBe(3) // Build, Test, Deploy: three box widths
  expect(all).toContain(' ─ artifacts ─▶ ')
  expect(all).toContain('Deploy')
  await ui.unmount()
})

test('flowchart with a branch and a loop: a tree with edge labels and ↺', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, fence('mermaid', 'graph TD\n  S[Start] --> Q{Tests pass?}\n  Q -->|yes| D[Deploy]\n  Q -->|no| F[Fix]\n  F --> Q'))
  const all = await lines(ui)
  expect(all.some(t => t.trim() === '├─')).toBe(true)
  expect(all).toContain(' yes ')
  expect(all).toContain(' ↺')
  expect(all.filter(t => t === 'Tests pass?').length).toBe(2) // once drawn, once named again
  await ui.unmount()
})

test('a mermaid kind undertone does not draw, or a block still streaming, stays code', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  let ui = await mount($, fence('mermaid', 'sequenceDiagram\n  A->>B: hi'))
  expect(((await ui.findAll({ type: 'Code' })) as any[])[0]?.props.language).toBe('mermaid')
  await ui.unmount()
  ui = await mount($, '```mermaid\nxychart-beta\n  bar [1, 2') // no closing fence yet
  expect(((await ui.findAll({ type: 'Code' })) as any[])[0]?.props.language).toBe('mermaid')
  await ui.unmount()
})

test('a fold never cuts a picture in half: it folds whole', { options: { foldLines: 4, buttons: 'inline' } }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'Intro.\n\n' + fence('mermaid', 'xychart-beta\n  x-axis [a, b, c]\n  bar [1, 2, 3]') + '\n\nAfter.')
  expect((await ui.findAll({ type: 'Code' })).length).toBe(0)
  expect((await lines(ui)).some(t => /█/.test(t))).toBe(false)
  expect(((await ui.findAll({ type: 'Button' })) as any[]).some(b => /more ·/.test(b.props.label))).toBe(true)
  await ui.unmount()
})

test('your prompt carries the note about pictures; a slash command does not', async ($, on) => {
  const { sent } = machine(on)
  await start($)
  await $.prompt.submit({ text: 'explain the flow', wait: false, origin: { kind: 'composer' } })
  expect(sent.at(-1)?.context?.some(c => /```figure blocks/.test(c))).toBe(true)
  await $.prompt.submit({ text: '/compact', wait: false, origin: { kind: 'composer' }, command: { name: 'compact', args: '' } } as any)
  expect(sent.at(-1)?.context?.some(c => /```figure blocks/.test(c)) ?? false).toBe(false)
})

test('the note can be turned off', { options: { diagramHints: false } }, async ($, on) => {
  const { sent } = machine(on)
  await start($)
  await $.prompt.submit({ text: 'explain the flow', wait: false, origin: { kind: 'composer' } })
  expect(sent.at(-1)?.context?.some(c => /```figure blocks/.test(c)) ?? false).toBe(false)
})
