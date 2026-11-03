import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 8, 0)
const THEMES = ["default", "sharp", "double", "bold", "dashed", "minimal", "terminal", "mono", "messenger", "messenger-light", "dracula", "catppuccin-mocha", "catppuccin-macchiato", "catppuccin-latte", "tokyo-night", "nord", "gruvbox", "gruvbox-light", "solarized-dark", "solarized-light", "one-dark", "monokai", "github-dark", "github-light", "rose-pine", "rose-pine-dawn", "everforest", "kanagawa", "ayu", "night-owl", "palenight", "synthwave-84", "cobalt2", "horizon", "material", "tomorrow-night", "ocean", "forest", "sunset"]
function base(on: any) {
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: '/w' }))
  on('session.root', () => ({ value: '/w' }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '' } }))
}
const you = (text = 'hello there') => ({ plugin: P, surface: 'terminal' as const, component: 'UserMessage' as const, requestId: 'u', props: { text, origin: { kind: 'composer' }, isExpanded: false } })
const claude = (text = 'a reply') => ({ plugin: P, surface: 'terminal' as const, component: 'AssistantMessage' as const, requestId: 'a', props: { text, isFirstOfReply: true } })
// The outermost bubble Box: the first Box with a width.
async function bubble(ui: any) { return (await ui.findAll({ type: 'Box' })).find((b: any) => typeof b.props.width === 'number') }

for (const style of ['preset', 'framed', 'filled'])
  for (const name of THEMES)
    test(`theme ${name} (${style}) draws both bubbles`, { options: { theme: name, bubbleStyle: style } }, async ($, on) => {
      base(on)
      for (const t of [you('hi ' + name), claude('reply ' + name)]) {
        const ui = await $.ui.mount(t)
        // the plugin's own tree drew (not the engine fallback): its text is there
        expect(await ui.find({ text: new RegExp((t.component === 'UserMessage' ? 'hi ' : 'reply ') + name) })).toBeDefined()
        expect(await bubble(ui)).toBeDefined()
        await ui.unmount()
      }
    })

test('shape overrides: sharp → single border, bar → quote, none → no border', { options: { userShape: 'sharp', claudeShape: 'none' } }, async ($, on) => {
  base(on)
  const u = await $.ui.mount(you()); expect((await bubble(u))?.props.borderStyle).toBe('single'); await u.unmount()
  const c = await $.ui.mount(claude()); expect((await bubble(c))?.props.borderStyle).toBeUndefined(); await c.unmount()
})

test('bar shape draws the left-bar style', { options: { userShape: 'bar' } }, async ($, on) => {
  base(on)
  const u = await $.ui.mount(you()); expect((await bubble(u))?.props.borderStyle).toBe('quote'); await u.unmount()
})

test('filled style paints dracula bubbles with its colours', { options: { theme: 'dracula', bubbleStyle: 'filled' } }, async ($, on) => {
  base(on)
  const u = await $.ui.mount(you()); expect((await bubble(u))?.props.backgroundColor).toBe('#BD93F9'); await u.unmount()
  const c = await $.ui.mount(claude()); expect((await bubble(c))?.props.backgroundColor).toBe('#44475A'); await c.unmount()
})

test('labels, icons, colours, alignment and padding are overridable', { options: { userLabel: 'Joff', userIcon: '◆', userColor: '#00FF88', userAlign: 'left', padding: 'roomy', userFill: '#101010' } }, async ($, on) => {
  base(on)
  const u = await $.ui.mount(you())
  const labels = await u.findAll({ type: 'Text', text: /^◆ Joff$/ })
  expect(labels.some((l: any) => l.props.color === '#00FF88')).toBe(true)
  const b = await bubble(u)
  expect(b?.props.paddingX).toBe(2)
  expect(b?.props.backgroundColor).toBe('#101010')
  const row = (await u.findAll({ type: 'Box' })).find((x: any) => x.props.justifyContent === 'flex-start')
  expect(row).toBeDefined()
  await u.unmount()
})

test('/undertone-theme lists every preset and switches', async ($, on) => {
  base(on)
  on('store.set', () => ({ value: undefined }))
  const out = JSON.stringify(await $.command.run({ command: 'undertone-theme', args: '' }))
  for (const n of THEMES) expect(out).toContain(n)
  expect(JSON.stringify(await $.command.run({ command: 'undertone-theme', args: 'tokyo-night' }))).toContain('Neon city blues')
  const u = await $.ui.mount(you()); expect((await bubble(u))?.props.borderColor).toBe('#7AA2F7'); await u.unmount()
})

test('the theme gallery draws a row per preset', async ($, on) => {
  base(on)
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'CommandOutput', requestId: 'g', props: { command: 'undertone-theme', args: '', text: 'undertone: Themes (current: default):', isErrored: false } })
  for (const n of ['dracula', 'catppuccin-latte', 'messenger', 'minimal']) expect(await ui.find({ type: 'Text', text: new RegExp(n) })).toBeDefined()
  await ui.unmount()
})

test('switching theme shows a one-line confirmation, not the gallery', async ($, on) => {
  base(on)
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>{e.props.text}</Text> })
  // args can arrive empty on the row even when a name was given
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'CommandOutput', requestId: 's', props: { command: 'undertone-theme', args: '', text: 'Theme: dracula — Purple night', isErrored: false } })
  expect(await ui.find({ type: 'Text', text: /Undertone themes/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /Theme: dracula/ }))?.text).toContain('dracula')
  await ui.unmount()
})

test('on a filled bubble the timestamp uses the bubble ink, not dim', { options: { theme: 'messenger' } }, async ($, on) => {
  base(on)
  on('state.get', (_: any, e: any) => ({ value: e.key === 'times' ? { value: { u: NOW }, version: 1 } : { value: undefined, version: 0 } }))
  const ui = await $.ui.mount(you('hi'))
  // (no session start here, so the zone is the module's own; match any time)
  const time = (await ui.findAll({ type: 'Text', text: /\d+:\d\d:\d\d\.\d{3}/ })).find((x: any) => !x.props.bold && /^\s*\d/.test(x.text))
  expect(time?.props.dimColor).toBeUndefined()
  expect(time?.props.color).toBe('#FFFFFF')
  await ui.unmount()
})
