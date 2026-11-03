// 0.10 "chat app": reactions, quote-reply, read receipts, quick replies, day / night.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41) // 3:41 PM at UTC+8
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

// Everything the mod asks of the engine, answered; `box` is the prompt box, `sent` what was submitted.
function machine(on: any, opts: { selection?: { text: string; requestId?: string }; clock?: number } = {}) {
  const box = { text: '' }
  const sent: { text: string; asUser?: boolean }[] = []
  const store: Record<string, unknown> = {}
  on('clock.now', () => ({ value: opts.clock ?? NOW }))
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
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.selection', () => ({ value: opts.selection }))
  on('prompt.read', () => ({ value: { text: box.text, cursor: box.text.length } }))
  on('prompt.fill', (_: any, e: any) => { box.text = e.text; return { isFilled: true, box: { text: box.text, cursor: box.text.length } } })
  on('prompt.submit', (_: any, e: any) => { sent.push({ text: e.text, asUser: e.origin?.asUser }); return e })
  on('tool.call', () => ({ result: 'ok' }))
  // Stand-in for Claude Code's own drawing, reached when undertone hands a row back.
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>{e.component === 'Spinner' ? 'LINE ' + (e.props.message ?? e.props.word) : 'ENGINE'}</Text> })
  return { box, sent, store }
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
const you = (text: string) => ({ plugin: P, surface: 'terminal' as const, component: 'UserMessage' as const, requestId: 'u-' + text, props: { text, origin: { kind: 'composer' as const }, isExpanded: false } })
const reply = (text: string, requestId = 'a1') => ({ plugin: P, surface: 'terminal' as const, component: 'AssistantMessage' as const, requestId, props: { text, isFirstOfReply: true } })
const buttons = async (ui: any) => (await ui.findAll({ type: 'Button' })) as any[]
const press = async ($: any, ui: any, label: RegExp, requestId: string) => {
  const b = (await buttons(ui)).find(x => label.test(String(x.props.label)))
  expect(b).toBeDefined()
  await $.ui.press({ plugin: P, key: b.key, requestId })
}

test('reactions: [ react ] opens the picker, a pick shows under the bubble, pressing it again takes it back', async ($, on) => {
  const { store } = machine(on)
  await start($)
  let ui = await $.ui.mount(reply('nice work'))
  expect((await buttons(ui)).some(b => b.props.label === '👍')).toBe(false)
  await press($, ui, /\[ react \]/, 'a1')
  await ui.unmount()
  ui = await $.ui.mount(reply('nice work'))
  await press($, ui, /^👍$/, 'a1') // the picker
  await ui.unmount()
  ui = await $.ui.mount(reply('nice work'))
  const shown = (await buttons(ui)).filter(b => b.props.label === '👍')
  expect(shown.length).toBe(1) // the reaction, picker closed
  expect(shown[0].props.dimColor).toBeFalsy()
  expect(JSON.stringify(store['reactions:sess-1234'])).toContain('👍') // survives a restart
  await press($, ui, /^👍$/, 'a1')
  await ui.unmount()
  ui = await $.ui.mount(reply('nice work'))
  expect((await buttons(ui)).some(b => b.props.label === '👍')).toBe(false)
  await ui.unmount()
})

test('quote-reply quotes the selection in this reply above the draft; with no selection, the first lines', async ($, on) => {
  const { box } = machine(on, { selection: { text: 'step two', requestId: 'a1' } })
  await start($)
  box.text = 'why?'
  const ui = await $.ui.mount(reply('step one\nstep two\nstep three'))
  await press($, ui, /\[ reply \]/, 'a1')
  expect(box.text).toBe('> step two\n\nwhy?')
  await ui.unmount()
  const other = await $.ui.mount(reply('alpha\n\nbeta', 'a2')) // the selection is in another row
  box.text = ''
  await press($, other, /\[ reply \]/, 'a2')
  expect(box.text).toBe('> alpha\n>\n> beta\n\n')
  await other.unmount()
})

test('read receipts: your latest prompt shows ✓ until Claude starts on it, then ✓✓', async ($, on) => {
  machine(on)
  await start($)
  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })
  const receipt = async () => {
    const ui = await $.ui.mount(you('hello'))
    const t = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string).find(x => /^ ✓✓?$/.test(x))
    await ui.unmount()
    return t
  }
  expect(await receipt()).toBe(' ✓')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await receipt()).toBe(' ✓✓')
})

test('unreadPrompts: your prompt stays grey with a blinking dot until Claude starts on it', { options: { unreadPrompts: true } }, async ($, on) => {
  machine(on)
  await start($)
  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })
  const look = async () => {
    const ui = await $.ui.mount(you('hello'))
    const all = (await ui.findAll({ type: 'Text' })) as any[]
    const r = { dot: all.map(x => x.text).find(x => /^ (●| ?)$|^  $/.test(x)), grey: all.find(x => x.text === 'hello')?.props.dimColor === true, ticks: all.some(x => /✓/.test(x.text)) }
    await ui.unmount()
    return r
  }
  const before = await look()
  expect(before.grey).toBe(true)
  expect(before.ticks).toBe(false)
  expect(before.dot).toBe(Math.floor(NOW / 500) % 2 ? ' ●' : '  ')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  const after = await look()
  expect(after.grey).toBe(false)
  expect(after.ticks).toBe(true)
})

test('while Claude works: Claude Code\'s own line with the tool count, no bubble of our own', async ($, on) => {
  machine(on)
  await start($)
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  for (const c of ['a', 'b']) await $.tool.call({ tool: 'Bash', command: c })
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'Spinner', requestId: 's', props: { word: 'Baking', message: null, suffix: '…', mode: 'tool-use' } })
  expect(await ui.find({ type: 'Text', text: 'LINE Baking · 2 tools' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /is (typing|thinking|working)/ })).toBeUndefined()
  expect(((await ui.findAll({ type: 'Box' })) as any[]).some(b => b.props.borderStyle)).toBe(false)
  await ui.unmount()
})

const band = { plugin: P, surface: 'terminal' as const, component: 'AbovePrompt' as const, requestId: 'band', props: { hasSurvey: false, isWorking: false, maxRows: 6 } }

test('quick replies show once Claude has answered and send as you', async ($, on) => {
  const { sent } = machine(on)
  await start($)
  let ui = await $.ui.mount(band as any)
  expect((await buttons(ui)).length).toBe(0) // nothing answered yet
  await ui.unmount()
  await $.prompt.submit({ text: 'plan it', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  ui = await $.ui.mount(band as any)
  await press($, ui, /\[ Go ahead \]/, 'band')
  expect(sent.at(-1)).toEqual({ text: 'Go ahead', asUser: true })
  await ui.unmount()
  const busy = await $.ui.mount({ ...band, props: { ...band.props, isWorking: true } } as any)
  expect((await buttons(busy)).length).toBe(0) // hidden while Claude works
  await busy.unmount()
})

test('a quick reply is drawn as your own bubble, not a plugin notice', async ($, on) => {
  machine(on)
  await start($)
  const ui = await $.ui.mount({ ...you('Go ahead'), props: { text: 'Go ahead', origin: { kind: 'plugin', name: 'undertone', asUser: true }, isExpanded: false } })
  expect((await ui.findAll({ type: 'Box' })).some((b: any) => b.key === 'bubble')).toBe(true)
  await ui.unmount()
})

test('quick replies: custom list, and off', { options: { quickReplies: 'Ship it | Tests?' } }, async ($, on) => {
  machine(on)
  await start($)
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  const ui = await $.ui.mount(band as any)
  expect((await buttons(ui)).map(b => b.props.label)).toEqual(['[ Ship it ]', '[ Tests? ]'])
  await ui.unmount()
})

for (const [label, clock, want] of [
  ['day (3:41 PM)', NOW, 'gruvbox-light'],
  ['night (11:41 PM)', NOW + 8 * 3_600_000, 'gruvbox'],
] as const) test(`light by day, dark by night: ${label}`, { options: { theme: 'gruvbox', dayNight: true, dayHours: '7-19' } }, async ($, on) => {
  machine(on, { clock })
  await start($)
  const out = JSON.stringify(await $.command.run({ command: 'undertone-doctor', args: '', ...CMD }))
  expect(out).toContain(`theme: ${want}`)
})
