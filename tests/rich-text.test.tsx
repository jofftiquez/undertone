// 0.13 rich text: headings, lists and task lists, quotes and alerts, code under a header, rules.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41)
const REPLY = [
  '# Release plan',
  'Ships **rich** text.',
  '## Steps',
  '1. Merge the branch',
  '2. Tag it',
  '',
  '- Verify CI',
  '  - the weekly run too',
  '- [x] Bump the version',
  '- [ ] Publish',
  '',
  '> Ship small.',
  '',
  '> [!WARNING]',
  '> Wait for CI.',
  '',
  '```ts',
  'const v = 1',
  '```',
  '---',
  '### Notes',
].join('\n')

function machine(on: any) {
  const copies: string[] = []
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
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE</Text> })
  return { copies }
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
// Folding off (foldLines is long) so the whole reply draws; inline buttons so they can be pressed.
const OPTS = { foldLines: 100, buttons: 'inline' }
const mount = ($: any, text = REPLY) => $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text, isFirstOfReply: true }, viewport: { columns: 90, rows: 60 } } as any)
const all = async (ui: any, type: string) => (await ui.findAll({ type })) as any[]

test('headings: H1 in a box, H2 over a heavy rule, H3 bold', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($)
  expect((await all(ui, 'Box')).filter(b => b.props.borderStyle === 'round').length).toBe(3) // the bubble, the H1 and the alert
  const texts = await all(ui, 'Text')
  expect(texts.some(t => t.text === 'Release plan' && t.props.bold === undefined)).toBe(true) // the heading line
  expect(texts.some(t => /^━{10,}$/.test(t.text))).toBe(true)
  expect(texts.some(t => t.text === 'Notes' && t.props.bold)).toBe(true)
  await ui.unmount()
})

test('lists: numbers kept, • and ◦ by depth, item text through Markdown', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($)
  const marks = (await all(ui, 'Text')).map(t => t.text)
  for (const m of ['1.', '2.', '•', '◦']) expect(marks).toContain(m)
  const words = (await all(ui, 'Text')).map(t => t.text)
  expect(words).toContain('Merge the branch')
  expect(words).toContain('the weekly run too')
  await ui.unmount()
})

test('task lists: [✓] in green with the item dimmed and struck through, [ ] open', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($)
  const texts = await all(ui, 'Text')
  expect(texts.find(t => t.text === '[✓]')?.props.color).toBe('success')
  const done = texts.find(t => t.text === 'Bump the version')
  expect([done?.props.strikethrough, done?.props.dimColor]).toEqual([true, true])
  expect(texts.some(t => t.text === '[ ]')).toBe(true)
  expect((await all(ui, 'Text')).map(t => t.text)).toContain('Publish')
  await ui.unmount()
})

test('task lists, progress style: a done-count bar above the list', { options: { ...OPTS, taskStyle: 'progress' } }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($)
  expect((await all(ui, 'Text')).some(t => /1\/2 done/.test(t.text))).toBe(true)
  await ui.unmount()
})

test('a quote gets an accent bar; a GitHub alert is a coloured box with its label', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($)
  const boxes = await all(ui, 'Box')
  expect(boxes.some(b => b.props.borderStyle === 'quote')).toBe(true)
  expect(boxes.some(b => b.props.borderColor === 'warning')).toBe(true)
  expect((await all(ui, 'Text')).some(t => t.text === 'Warning' && t.props.color === 'warning')).toBe(true)
  expect((await all(ui, 'Markdown')).map(m => m.props.text)).toContain('Wait for CI.')
  await ui.unmount()
})

test('code: a header with the language, the code highlighted, [ copy ] copies just the code', { options: OPTS }, async ($, on) => {
  const { copies } = machine(on)
  await start($)
  const ui = await mount($)
  const code = (await all(ui, 'Code'))[0]
  expect([code?.props.language, code?.props.source]).toEqual(['ts', 'const v = 1'])
  expect((await all(ui, 'Text')).some(t => t.text === 'ts' && t.props.bold)).toBe(true)
  const copy = (await all(ui, 'Button')).find(b => b.props.label === '[ copy code ]')
  await $.ui.press({ plugin: P, key: copy.key, requestId: 'a1' })
  expect(copies.at(-1)).toBe('const v = 1')
  await ui.unmount()
})

test('a rule is a line across the bubble; [ copy list ] copies the list as Markdown', { options: OPTS }, async ($, on) => {
  const { copies } = machine(on)
  await start($)
  const ui = await mount($)
  expect((await all(ui, 'Text')).some(t => /^─{10,}$/.test(t.text))).toBe(true)
  const copy = (await all(ui, 'Button')).find(b => b.props.label === '[ copy list ]')
  await $.ui.press({ plugin: P, key: copy.key, requestId: 'a1' })
  expect(copies.at(-1)).toBe('1. Merge the branch\n2. Tag it')
  await ui.unmount()
})

test('headingStyle underline: H1 and H2 underlined, no box', { options: { ...OPTS, headingStyle: 'underline' } }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($)
  expect((await all(ui, 'Text')).some(t => t.text === 'Release' && t.props.underline)).toBe(true)
  expect((await all(ui, 'Box')).filter(b => b.props.borderStyle === 'round').length).toBe(2) // the bubble and the alert, no H1 box
  await ui.unmount()
})

test('richText off: Claude Code draws the Markdown as before', { options: { ...OPTS, richText: false } }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($)
  expect((await all(ui, 'Markdown')).some(m => /# Release plan/.test(m.props.text))).toBe(true)
  expect((await all(ui, 'Code')).length).toBe(0)
  await ui.unmount()
})

test('a reply with code is 2 cells wider, so its longest code line does not wrap', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const line = 'console.log(greet(ada)) // Hello, Ada! You are on the team plan.'
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text: '```ts\n' + line + '\n```', isFirstOfReply: true }, viewport: { columns: 200, rows: 60 } } as any)
  const bubble = (await all(ui, 'Box')).find(b => b.key === 'bubble')
  expect(bubble.props.width).toBeGreaterThanOrEqual(line.length + 2 + 4) // the line, its indent, border and padding
  await ui.unmount()
})
