// 0.27 save as: copy rows turn into save rows; code and formulas get [ save ]; /undertone save.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41)
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
type Run = { argv: string[] }
function machine(on: any, opts: { env?: Record<string, string>; taken?: RegExp; messages?: object[] } = {}) {
  const runs: Run[] = []
  const writes: Record<string, string> = {}
  const toasts: string[] = []
  const env: Record<string, string> = { HOME: '/home/u', TMPDIR: '/tmp', ...opts.env }
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1234' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.root', () => ({ value: '/work' }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.messages', () => ({ value: opts.messages ?? [] }))
  on('env.get', (_: any, e: any) => ({ value: env[e.name ?? e] }))
  on('fs.exists', (_: any, e: any) => { const path = String(e.path ?? e); return { value: path === '/home/u/Downloads' || path in writes || !!opts.taken?.test(path) } })
  on('fs.write', (_: any, e: any) => { writes[e.path] = e.text; return { value: undefined } })
  on('fs.list', () => ({ value: [] }))
  on('store.get', () => ({ value: undefined }))
  on('ui.toast', (_: any, e: any) => { toasts.push(typeof e === 'string' ? e : e.text); return { value: undefined } })
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('process.run', (_: any, e: any) => {
    runs.push({ argv: e.argv ?? [] })
    return { value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE</Text> })
  return { runs, writes, toasts }
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
const OPTS = { foldLines: 200, buttons: 'inline' }
const TABLE = '| Item | Note |\n|---|---|\n| a,b | =SUM(A1) |\n| -42 | say "hi" |'
const mount = ($: any, text: string, surface = 'terminal') => $.ui.mount({ plugin: P, surface, component: 'AssistantMessage', requestId: 'a1', props: { text, isFirstOfReply: true }, viewport: { columns: 100, rows: 40 } } as any)
const labels = async (ui: any) => ((await ui.findAll({ type: 'Button' })) as any[]).map(b => b.props.label as string)
const press = async ($: any, ui: any, label: string) => {
  const b = ((await ui.findAll({ type: 'Button' })) as any[]).find(x => x.props.label === label)
  expect(b).toBeDefined()
  await $.ui.press({ plugin: P, key: b.key, requestId: 'a1' })
}
const STAMP = /\d{4}-\d{2}-\d{2}-\d{4}/

test('[ save… ] turns a table\'s copy row into a save row, and [ copy… ] back', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  let ui = await mount($, TABLE)
  expect(await labels(ui)).toContain('[ save… ]')
  await press($, ui, '[ save… ]')
  await ui.unmount()
  ui = await mount($, TABLE)
  const l = await labels(ui)
  for (const x of ['[ md ]', '[ csv ]', '[ html ]', '[ art ]', '[ png ]', '[ copy… ]']) expect(l).toContain(x)
  expect(l).not.toContain('[ cells ]')
  await press($, ui, '[ copy… ]')
  await ui.unmount()
  ui = await mount($, TABLE)
  expect(await labels(ui)).toContain('[ cells ]')
  await ui.unmount()
})

test('save csv: quoted cells, formulas kept from running, into Downloads', { options: OPTS }, async ($, on) => {
  const { writes, toasts } = machine(on)
  await start($)
  let ui = await mount($, TABLE)
  await press($, ui, '[ save… ]')
  await ui.unmount()
  ui = await mount($, TABLE)
  await press($, ui, '[ csv ]')
  const [path, text] = Object.entries(writes)[0]!
  expect(path).toMatch(new RegExp('^/home/u/Downloads/table-' + STAMP.source + '\\.csv$'))
  expect(text).toBe('Item,Note\r\n"a,b",\'=SUM(A1)\r\n-42,"say ""hi"""\r\n')
  expect(toasts.at(-1)).toBe('Saved ' + path)
  await press($, ui, '[ html ]')
  const html = Object.entries(writes).find(([p]) => p.endsWith('.html'))![1]
  expect(html).toMatch(/^<!doctype html>/)
  expect(html).toContain('<td>a,b</td>')
  await ui.unmount()
})

test('save png hands the helper a file to write instead of the clipboard', { options: OPTS }, async ($, on) => {
  const { runs, toasts } = machine(on)
  await start($)
  let ui = await mount($, TABLE)
  await press($, ui, '[ save… ]')
  await ui.unmount()
  ui = await mount($, TABLE)
  await press($, ui, '[ png ]')
  const r = runs.find(x => x.argv.join(' ').includes('osascript'))!
  expect(r.argv[4]).toContain('writeToFileAtomically') // the script
  expect(JSON.parse(r.argv[5]!).out).toMatch(new RegExp('^/home/u/Downloads/table-' + STAMP.source + '\\.png$'))
  expect(toasts.at(-1)).toMatch(/^Saved .*\.png$/)
  await ui.unmount()
})

test('a code block saves under its language\'s extension; a taken name gets -2', { options: OPTS }, async ($, on) => {
  const { writes } = machine(on, { taken: /\/code-\d{4}-\d{2}-\d{2}-\d{4}\.ts$/ })
  await start($)
  const ui = await mount($, '```typescript\nconst v = 1\n```')
  await press($, ui, '[ save ]')
  const [path, text] = Object.entries(writes)[0]!
  expect(path).toMatch(new RegExp('/code-' + STAMP.source + '-2\\.ts$'))
  expect(text).toBe('const v = 1\n')
  await ui.unmount()
})

test('a diagram\'s save row saves its source as .mmd', { options: OPTS }, async ($, on) => {
  const { writes } = machine(on)
  await start($)
  const src = 'graph LR\n  A --> B'
  let ui = await mount($, '```mermaid\n' + src + '\n```')
  await press($, ui, '[ save… ]')
  await ui.unmount()
  ui = await mount($, '```mermaid\n' + src + '\n```')
  await press($, ui, '[ source ]')
  const [path, text] = Object.entries(writes)[0]!
  expect(path).toMatch(/\/diagram-[\d-]+\.mmd$/)
  expect(text).toBe(src)
  await ui.unmount()
})

test('no save over SSH: the file would land on the other machine', { options: OPTS }, async ($, on) => {
  machine(on, { env: { SSH_CONNECTION: '10.0.0.2 5000 10.0.0.1 22' } })
  await start($)
  const ui = await mount($, TABLE + '\n\n```sh\nls\n```')
  expect((await labels(ui)).some(l => /save/.test(l))).toBe(false)
  await ui.unmount()
})

test('no save on the phone', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, TABLE + '\n\n```sh\nls\n```', 'mobile')
  expect((await labels(ui)).some(l => /save/.test(l))).toBe(false)
  await ui.unmount()
})

test('/undertone save and /undertone save code, without the mouse', async ($, on) => {
  const { writes } = machine(on, { messages: [
    { role: 'user', text: 'hi', toolUses: [] },
    { role: 'assistant', text: 'Run this:\n```py\nprint(1)\n```', toolUses: [] },
  ] })
  await start($)
  expect(JSON.stringify(await $.command.run({ command: 'undertone', args: 'save', ...CMD }))).toContain('Saved the last reply to /home/u/Downloads/reply-')
  expect(JSON.stringify(await $.command.run({ command: 'undertone', args: 'save code', ...CMD }))).toContain('Saved the last code block')
  expect(Object.entries(writes).find(([p]) => p.endsWith('.py'))?.[1]).toBe('print(1)\n')
  expect(Object.entries(writes).find(([p]) => p.endsWith('.md'))?.[1]).toContain('Run this:')
})
