// 0.25: the desktop app sets art in its monospaced face, in the room that face really has.
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
  return { copies, sent }
}
const start = ($: any, surface = 'terminal') => $.session.start({ cwd: '/work', surface, isInteractive: true })
const OPTS = { foldLines: 200, buttons: 'inline' }
const mount = ($: any, text: string, surface = 'terminal', requestId = 'a1', columns = 100) => $.ui.mount({ plugin: P, surface, component: 'AssistantMessage', requestId, props: { text, isFirstOfReply: true }, viewport: { columns, rows: 60 } } as any)
const texts = async (ui: any) => ((await ui.findAll({ type: 'Text' })) as any[])
const PIE = fence('mermaid', 'pie title Build time\n  "Tests" : 46\n  "Bundling" : 28\n  "Type check" : 16\n  "Lint" : 10')
const widest = async (ui: any) => Math.max(...(await texts(ui)).filter(t => t.props.mono).map(t => [...(t.text as string)].length))

test('desktop: pictures, tables and own-coloured code draw in the monospaced face', { options: { ...OPTS, codeCommandColor: '#c00001' } }, async ($, on) => {
  machine(on); await start($, 'desktop')
  const ui = await mount($, PIE + '\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n' + fence('ts', 'f(x)'), 'desktop')
  const mono = (await texts(ui)).filter(t => t.props.mono).map(t => t.text as string)
  expect(mono.some(t => /Tests/.test(t) && /█/.test(t))).toBe(true) // a pie bar
  expect(mono.some(t => /^─+\s+─+$/.test(t))).toBe(true) // the table's rule
  expect(mono).toContain('f(x)')
  await ui.unmount()
})

test('desktop: art is laid out to the room the monospaced face has (84% of the reported columns)', { options: OPTS }, async ($, on) => {
  machine(on); await start($, 'desktop')
  const desk = await mount($, PIE, 'desktop', 'd', 80)
  const deskW = await widest(desk)
  await desk.unmount()
  const term = await mount($, PIE, 'terminal', 't', 80)
  const termW = await widest(term)
  await term.unmount()
  expect(deskW).toBeLessThan(termW)
  expect(deskW).toBeLessThanOrEqual(Math.floor(80 * 0.84))
})

test('alerts and quotes back to back keep a line between them', { options: { ...OPTS, buttons: 'hover' } }, async ($, on) => {
  machine(on); await start($)
  const long = 'long enough that the two cannot sit side by side in one row of the bubble, so they stack.'
  // hover buttons (a fullscreen view, as the desktop app's): no copy row above to keep them apart
  const ui = await $.ui.mount({ plugin: P, surface: 'desktop', component: 'AssistantMessage', requestId: 'q', props: { text: `> A quote, ${long}\n\n> [!NOTE]\n> A note, ${long}\n\n> [!TIP]\n> A tip, ${long}`, isFirstOfReply: true }, viewport: { columns: 100, rows: 60, isFullscreen: true } } as any)
  const boxes = ((await ui.findAll({ type: 'Box' })) as any[]).filter(b => b.props.marginTop === 1)
  expect(boxes.length).toBeGreaterThanOrEqual(2)
  await ui.unmount()
})

test('[ more ] stays open when the reply is drawn again under a new requestId', { options: { foldLines: 5, buttons: 'inline' } }, async ($, on) => {
  machine(on); await start($, 'desktop')
  const long = Array.from({ length: 12 }, (_, k) => `Line ${k + 1}.`).join('\n\n')
  const ui = await mount($, long, 'desktop', 'r1')
  const more = ((await ui.findAll({ type: 'Button' })) as any[]).find(b => /more ·/.test(b.props.label))
  await $.ui.press({ plugin: P, key: more.key, requestId: 'r1' } as any)
  await ui.unmount()
  const again = await mount($, long, 'desktop', 'r2')
  expect(((await again.findAll({ type: 'Button' })) as any[]).some(b => b.props.label === '[ less ]')).toBe(true)
  await again.unmount()
})
