// 0.17: coloured numbers and paths, right to left, side-by-side tables and pictures, gantt.
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
const OPTS = { foldLines: 200, buttons: 'hover' }
const mount = ($: any, text: string, columns = 120) => $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text, isFirstOfReply: true }, viewport: { columns, rows: 60, isFullscreen: true } } as any)
const all = async (ui: any, type: string) => (await ui.findAll({ type })) as any[]
const ink = async (ui: any, text: string) => (await all(ui, 'Text')).find(t => t.text === text)?.props.color

test('numbers, versions, durations and percentages in amber; paths in their colour', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'Build v2.14.0 took 250ms, 99.9% passed; logs in ~/src/app.log and ./out/report.md.')
  for (const n of ['v2.14.0', '250ms', '99.9%']) expect(await ink(ui, n)).toBe('warning')
  for (const p of ['~/src/app.log', './out/report.md']) expect(await ink(ui, p)).toBe('permission')
  expect(await ink(ui, 'Build')).not.toBe('warning')
  expect((await all(ui, 'Markdown')).length).toBe(0)
  await ui.unmount()
})

test('a paragraph with a link stays Claude Code\'s Markdown, so the link is clickable', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'See [the docs](https://example.com) for 42 more.')
  expect((await all(ui, 'Markdown')).map(m => m.props.text)).toContain('See [the docs](https://example.com) for 42 more.')
  await ui.unmount()
})

test('~~strikethrough~~ draws struck through', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'It was ~~broken~~ fixed.')
  expect((await all(ui, 'Text')).find(t => t.text === 'broken')?.props.strikethrough).toBe(true)
  await ui.unmount()
})

test('colorText off: Claude Code draws the paragraph', { options: { ...OPTS, colorText: false } }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'Took 250ms.')
  expect((await all(ui, 'Markdown')).map(m => m.props.text)).toContain('Took 250ms.')
  await ui.unmount()
})

test('right to left: a Hebrew paragraph is right-aligned; a list item has its marker on the right', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'שלום עולם, זו פסקה.\n\n- פריט ראשון')
  const boxes = await all(ui, 'Box')
  expect(boxes.some(b => b.props.justifyContent === 'flex-end' && /שלום/.test(JSON.stringify(b)))).toBe(true)
  expect((await all(ui, 'Text')).some(t => t.props.dir === 'rtl')).toBe(true)
  expect((await all(ui, 'Text')).map(t => t.text)).toContain(' •') // the bullet after the text
  await ui.unmount()
})

const SMALL = (h: string) => `| ${h} | n |\n|---|---|\n| a | 1 |`
test('back-to-back small tables share a row; wide ones stack', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  let ui = await mount($, SMALL('Env') + '\n\n' + SMALL('Region'))
  expect((await all(ui, 'Box')).some(b => b.props.columnGap === 3)).toBe(true)
  await ui.unmount()
  const wide = (h: string) => `| ${h} | ${'x'.repeat(70)} |\n|---|---|\n| a | ${'y'.repeat(70)} |`
  ui = await mount($, wide('A') + '\n\n' + wide('B'))
  expect((await all(ui, 'Box')).some(b => b.props.columnGap === 3)).toBe(false)
  await ui.unmount()
})

test('gantt: a bar per task on a shared date axis, sections, done in green and critical in red', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, '```mermaid\ngantt\n  title Release\n  dateFormat YYYY-MM-DD\n  section Build\n  Code :done, a1, 2026-11-01, 3d\n  Test :a2, after a1, 2d\n  section Ship\n  Release :crit, 2026-11-07, 1d\n```')
  const texts = await all(ui, 'Text')
  expect(texts.some(t => t.text === 'Release' && t.props.bold)).toBe(true)
  expect(texts.some(t => /^11-01 +11-08$/.test(t.text))).toBe(true)
  expect(texts.find(t => /^█/.test(t.text) && t.props.color === 'success')).toBeDefined() // Code, done
  expect(texts.find(t => /^█/.test(t.text) && t.props.color === 'error')).toBeDefined() // Release, critical
  expect((await all(ui, 'Code')).length).toBe(0)
  await ui.unmount()
})
