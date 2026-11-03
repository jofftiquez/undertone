// 0.18: rich copies (HTML with a text twin, PNG of the drawing) and diff cards.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41)
type Run = { argv: string[]; stdin?: string }
function machine(on: any, opts: { env?: Record<string, string>; exit?: number } = {}) {
  const runs: Run[] = []
  const copies: string[] = []
  const toasts: string[] = []
  const env: Record<string, string> = { HOME: '/home/u', TMPDIR: '/tmp', ...opts.env }
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1234' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.root', () => ({ value: '/work' }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('env.get', (_: any, e: any) => ({ value: env[e.name ?? e] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('store.get', () => ({ value: undefined }))
  on('ui.toast', (_: any, e: any) => { toasts.push(typeof e === 'string' ? e : e.text); return { value: undefined } })
  on('ui.copy', (_: any, e: any) => { copies.push(e.text); return { value: { isCopied: true } } })
  on('process.run', (_: any, e: any) => {
    const argv: string[] = e.argv ?? []
    runs.push({ argv, stdin: e.init?.stdin })
    const rich = /osascript|copyq|Clipboard/.test(argv.join(' '))
    return { value: { exitCode: rich ? opts.exit ?? 0 : 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE</Text> })
  return { runs, copies, toasts }
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
const OPTS = { foldLines: 200, buttons: 'inline' }
const TABLE = '| Env | Up |\n|:---|---:|\n| **prod** | 99.9% |'
const mount = ($: any, text: string) => $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text, isFirstOfReply: true }, viewport: { columns: 100, rows: 40 } } as any)
const press = async ($: any, ui: any, label: string) => {
  const b = ((await ui.findAll({ type: 'Button' })) as any[]).find(x => x.props.label === label)
  expect(b).toBeDefined()
  await $.ui.press({ plugin: P, key: b.key, requestId: 'a1' })
}

test('a table\'s copy row: md, cells, html, art, png', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, TABLE)
  const labels = ((await ui.findAll({ type: 'Button' })) as any[]).map(b => b.props.label)
  for (const l of ['[ md ]', '[ cells ]', '[ html ]', '[ art ]', '[ png ]']) expect(labels).toContain(l)
  await ui.unmount()
})

test('[ html ] on macOS puts the HTML table and its text twin on the clipboard', { options: OPTS }, async ($, on) => {
  const { runs, toasts } = machine(on)
  await start($)
  const ui = await mount($, TABLE)
  await press($, ui, '[ html ]')
  const r = runs.find(x => x.argv.join(' ').includes('osascript'))!
  expect(r.argv[4]).toContain('public.html') // the script
  const html = r.argv[5]
  expect(html).toBe('<table><thead><tr><th>Env</th><th style="text-align:right">Up</th></tr></thead><tbody><tr><td><strong>prod</strong></td><td style="text-align:right">99.9%</td></tr></tbody></table>')
  expect(r.argv[6]).toBe('Env\tUp\nprod\t99.9%') // the plain-text twin
  expect(toasts.at(-1)).toContain('HTML and text')
  await ui.unmount()
})

test('[ html ] with no rich clipboard (Linux without CopyQ) copies the text and says why', { options: OPTS }, async ($, on) => {
  const { copies, toasts } = machine(on, { exit: 127 })
  await start($)
  const ui = await mount($, TABLE)
  await press($, ui, '[ html ]')
  expect(copies.at(-1)).toBe('Env\tUp\nprod\t99.9%')
  expect(toasts.at(-1)).toContain('CopyQ')
  await ui.unmount()
})

test('over SSH, [ html ] and [ png ] copy text: only text reaches the local clipboard', { options: OPTS }, async ($, on) => {
  const { runs, copies } = machine(on, { env: { SSH_CONNECTION: '1 2 3 4' } })
  await start($)
  const ui = await mount($, TABLE)
  await press($, ui, '[ html ]')
  expect(copies.at(-1)).toBe('Env\tUp\nprod\t99.9%')
  await press($, ui, '[ png ]')
  expect(copies.at(-1)).toMatch(/^┌/)
  expect(runs.some(r => /osascript/.test(r.argv.join(' ')))).toBe(false)
  await ui.unmount()
})

test('[ png ] on macOS draws the boxed table into a picture with AppKit, in the theme\'s colours', { options: { ...OPTS, theme: 'dracula' } }, async ($, on) => {
  const { runs, toasts } = machine(on)
  await start($)
  const ui = await mount($, TABLE)
  await press($, ui, '[ png ]')
  const r = runs.find(x => x.argv.join(' ').includes('osascript -l JavaScript'))!
  expect(r.argv[4]).toContain('NSPasteboard') // the script
  expect(r.argv[5]).toMatch(/^┌.*\n│ Env/) // the art
  expect([r.argv[6], r.argv[7]]).toEqual(['#F8F8F2', '#44475A']) // dracula's text on its surface
  expect(toasts.at(-1)).toContain('as a picture')
  await ui.unmount()
})

test('pictures get [ png ] too', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, '```mermaid\npie\n  "a" : 1\n  "b" : 2\n```')
  const labels = ((await ui.findAll({ type: 'Button' })) as any[]).map(b => b.props.label)
  expect(labels).toEqual(expect.arrayContaining(['[ source ]', '[ art ]', '[ png ]']))
  await ui.unmount()
})

test('an opened edit is a diff card: the file and +/− counts over the change', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const call = { tool_use_id: 'ed1', tool: 'Edit', input: { file_path: '/work/src/app.ts', old_string: 'a\nb', new_string: 'a\nc\nd' }, isRunning: false, isErrored: false, isInterrupted: false }
  const row = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolUse', requestId: 'ed1', props: call } as any)
  await $.ui.press({ plugin: P, key: 't0', requestId: 'ed1' }) // open it
  await row.unmount()
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'ToolUse', requestId: 'ed1', props: call } as any)
  const texts = ((await ui.findAll({ type: 'Text' })) as any[]).map(t => t.text)
  expect(texts).toContain('src/app.ts  ')
  expect(texts).toContain('+3')
  expect(texts).toContain(' −2')
  expect(((await ui.findAll({ type: 'Box' })) as any[]).some(b => b.props.borderStyle === 'round')).toBe(true)
  await ui.unmount()
})
