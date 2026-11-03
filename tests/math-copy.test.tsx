// 0.15: math (as text, or typeset by ratex-render), footnotes, and copying without the mouse.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const NOW = Date.UTC(2026, 10, 3, 7, 41)
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
function pngHeader(w: number, h: number) {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]
  for (const n of [w, h]) b.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255)
  return btoa(String.fromCharCode(...b))
}

function machine(on: any, opts: { renderer?: boolean; messages?: object[] } = {}) {
  const copies: string[] = []
  const runs: string[][] = []
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1234' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.root', () => ({ value: '/work' }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.messages', () => ({ value: opts.messages ?? [] }))
  on('env.get', (_: any, e: any) => ({ value: ({ HOME: '/home/u', TMPDIR: '/tmp' } as Record<string, string>)[e.name ?? e] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: { base64: pngHeader(490, 186) } }))
  on('store.get', () => ({ value: undefined }))
  const toasts: string[] = []
  on('ui.toast', (_: any, e: any) => { toasts.push(typeof e === 'string' ? e : e.text); return { value: undefined } })
  on('ui.copy', (_: any, e: any) => { copies.push(e.text); return { value: { isCopied: true } } })
  on('process.run', (_: any, e: any) => {
    const argv: string[] = e.argv ?? []
    runs.push(argv)
    const script = argv.join(' ')
    if (script.includes('command -v ratex-render')) return { value: { exitCode: opts.renderer ? 0 : 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (script.includes('ratex-render --output-dir')) return { value: { exitCode: 0, stdout: '/tmp/undertone-501/math/k/0001.png', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    return { value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE</Text> })
  return { copies, runs, toasts }
}
const start = ($: any) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
const OPTS = { foldLines: 200, buttons: 'inline' }
const mount = ($: any, text: string) => $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text, isFirstOfReply: true }, viewport: { columns: 100, rows: 60 } } as any)
const texts = async (ui: any) => ((await ui.findAll({ type: 'Text' })) as any[]).map(t => t.text as string)
const md = async (ui: any) => ((await ui.findAll({ type: 'Markdown' })) as any[]).map(m => m.props.text as string)

for (const [tex, want] of [
  ['\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', '(-b ± √(b²-4ac))/2a'],
  ['\\sum_{i=1}^{n} x_i', '∑ᵢ₌₁ⁿ xᵢ'],
  ['f: \\mathbb{R}^n \\to \\mathbb{R}', 'f: ℝⁿ → ℝ'],
  ['\\alpha \\le \\beta \\cdot \\gamma', 'α ≤ β · γ'],
  ['\\sqrt[3]{x}', '³√x'],
] as const) test(`display math as text: ${want}`, { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, `Here:\n$$${tex}$$`)
  expect(await texts(ui)).toContain(want)
  await ui.unmount()
})

test('a ```math block reads the same, with [ copy latex ] copying the source', { options: OPTS }, async ($, on) => {
  const { copies } = machine(on)
  await start($)
  const ui = await mount($, '```math\nE = mc^2\n```')
  expect(await texts(ui)).toContain('E = mc²')
  const copy = ((await ui.findAll({ type: 'Button' })) as any[]).find(b => b.props.label === '[ copy latex ]')
  await $.ui.press({ plugin: P, key: copy.key, requestId: 'a1' })
  expect(copies.at(-1)).toBe('E = mc^2')
  await ui.unmount()
})

test('with ratex-render on the PATH, display math is a typeset picture (its text as the alt)', { options: OPTS }, async ($, on) => {
  const { runs } = machine(on, { renderer: true })
  await start($)
  const ui = await mount($, '$$x^2$$')
  const pic = ((await ui.findAll({ type: 'Image' })) as any[])[0]
  expect(pic?.props.source).toEqual({ file: '/tmp/undertone-501/math/k/0001.png', format: 'png' })
  expect(pic?.props.alt).toBe('x²')
  const render = runs.find(r => r.join(' ').includes('ratex-render --output-dir'))!
  expect(render.join(' ')).toContain('umask 077')
  expect(render).toContain('x^2') // the formula goes as an argument, never into the script
  await ui.unmount()
})

test('inline $…$ math reads as italic symbols; prices stay as written', { options: OPTS }, async ($, on) => {
  machine(on)
  await start($)
  const ui = await mount($, 'So $E = mc^2$ and $\\alpha \\le 1$, for $5 or $10.')
  expect(await texts(ui)).toContain('So E = mc² and α ≤ 1, for $5 or $10.') // drawn by undertone: plain text
  expect(((await ui.findAll({ type: 'Text' })) as any[]).some(t => t.text === 'mc²' && t.props.italic)).toBe(true)
  await ui.unmount()
})

test('footnotes: superscript marks, the notes under a rule at the end', { options: OPTS }, async ($, on) => {
  const { toasts } = machine(on)
  await start($)
  const ui = await mount($, 'First[^a] and second[^b].\n\n[^a]: Note A.\n[^b]: Note B.')
  const all = await md(ui)
  expect(all).toContain('[¹](file:///footnote/1)')
  expect(all).toContain('[²](file:///footnote/2)')
  expect((await texts(ui)).join('')).toContain('First and second.')
  // (the kit reports layout props, not `hover`; a mark lighting with its note is checked live)
  const two = ((await ui.findAll({ type: 'Markdown' })) as any[]).find(m => m.props.text === '[²](file:///footnote/2)')
  await $.ui.press({ plugin: P, key: two.key, requestId: 'a1', link: { href: 'file:///footnote/2' } } as any)
  expect(toasts).toContain('² Note B.')
  expect(all).toContain('¹ Note A.')
  expect(all).toContain('² Note B.')
  expect(((await ui.findAll({ type: 'Markdown' })) as any[]).find(m => m.props.text === '² Note B.')?.props.dimColor).toBe(true)
  await ui.unmount()
})

test('clicking a footnote mark shows its note; copies keep the plain mark', { options: OPTS }, async ($, on) => {
  const { copies, toasts } = machine(on)
  await start($)
  const ui = await mount($, '- First[^a]\n- Second[^b]\n\n[^a]: Note A.\n[^b]: Note B.')
  const item = ((await ui.findAll({ type: 'Markdown' })) as any[]).find(m => m.props.text.startsWith('Second'))
  await $.ui.press({ plugin: P, key: item.key, requestId: 'a1', link: { href: 'file:///footnote/2' } } as any)
  expect(toasts).toContain('² Note B.')
  await $.ui.press({ plugin: P, key: 'copy-0', requestId: 'a1' } as any)
  expect(copies.at(-1)).toBe('- First¹\n- Second²')
  await ui.unmount()
})

test('[ copy art ] on a table copies the boxed drawing', { options: OPTS }, async ($, on) => {
  const { copies } = machine(on)
  await start($)
  const ui = await mount($, '| a | b |\n|---|---|\n| 1 | 2 |')
  const art = ((await ui.findAll({ type: 'Button' })) as any[]).find(b => b.props.label === '[ art ]')
  await $.ui.press({ plugin: P, key: art.key, requestId: 'a1' })
  expect(copies.at(-1)).toMatch(/^┌.*┐\n│ a .*│\n[├╞].*[┤╡]\n│ 1 .*│\n└.*┘$/)
  await ui.unmount()
})

test('/undertone copy and /undertone copy code, without the mouse', async ($, on) => {
  const { copies } = machine(on, { messages: [
    { role: 'user', text: 'hi', toolUses: [] },
    { role: 'assistant', text: 'Run this:\n```sh\nnpm test\n```\nThen this:\n```sh\nnpm run build\n```', toolUses: [] },
  ] })
  await start($)
  expect(JSON.stringify(await $.command.run({ command: 'undertone', args: 'copy', ...CMD }))).toContain('Copied the last reply')
  expect(copies.at(-1)).toContain('Then this:')
  expect(JSON.stringify(await $.command.run({ command: 'undertone', args: 'copy code', ...CMD }))).toContain('Copied the last code block')
  expect(copies.at(-1)).toBe('npm run build')
})
