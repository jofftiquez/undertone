// Tables in Claude's bubbles are drawn by undertone, fitted to the bubble width.
import { expect, test } from 'claude-code/testing'

const P = 'undertone'
const TABLE = [
  '| # | Item | Result |',
  '|---|---|---|',
  '| 1 | Environment variables read directly | No more shell processes started just to read `HOME`, `TMPDIR`, `TEMP` or `CLAUDE_CONFIG_DIR`. Windows is detected from the `OS` variable. |',
  '| 6 | Hover-only buttons | ☆, `[ copy ]` and the code and quote copy buttons appear only when the pointer is over the bubble. A pinned ★ stays visible. |',
  '| 7 | Plain-words tool rows | **Ran** gh pr view 12, [docs](https://x.y), 表格测试 and a verylongunbreakablewordthatmustbecutsomewhere |',
].join('\n')
const REPLY = 'All 10 are done.\n\n' + TABLE + '\n\nDone.'

// Same width rule as the mod: wide = 2 (CJK, ★ ☆, emoji), combining = 0.
const wide = (cp: number) => (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0x2605 && cp <= 0x2606) || (cp >= 0x1f300 && cp <= 0x1faff)
const width = (t: string) => [...t].reduce((n, ch) => n + (wide(ch.codePointAt(0)!) ? 2 : 1), 0)
function textOf(node: any): string { return typeof node === 'string' ? node : (node?.children ?? []).map(textOf).join('') }
function base(on: any, runs: string[] = []) {
  on('env.get', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: '/w' }))
  on('process.run', (_: any, e: any) => { runs.push(e.stdin ?? e.init?.stdin ?? ''); return { value: { exitCode: 0, stdout: '', stderr: '' } } })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.copy', (_: any, e: any) => { runs.push(e.text); return { value: { isCopied: true } } })
}
async function tableLines($: any, columns: number) {
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'r', props: { text: REPLY, isFirstOfReply: true }, viewport: { columns, rows: 50 } })
  const boxes = await ui.findAll({ type: 'Box' })
  const bubble = boxes.find((b: any) => b.key === 'bubble')!
  const tableBox = boxes.find((b: any) => b.props.marginY === 1)!
  const lines: string[] = (tableBox as any).children.map(textOf)
  // inner width: bubble width - border (2) - padding (2)
  return { ui, lines, room: (bubble.props.width as number) - 4 }
}

for (const columns of [60, 80, 120, 200])
  for (const style of ['rules', 'box', 'minimal'])
    test(`${style} table fits a ${columns}-column terminal`, { options: { tableStyle: style } }, async ($, on) => {
      base(on)
      const { ui, lines, room } = await tableLines($, columns)
      expect(lines.length).toBeGreaterThan(4)
      for (const l of lines) expect(width(l)).toBeLessThanOrEqual(room)
      if (style === 'box') {
        // a grid: every line the same width, so the borders line up
        expect(new Set(lines.map(width)).size).toBe(1)
        expect(lines[0]!.startsWith('┌')).toBe(true)
      }
      await ui.unmount()
    })

test('long cells wrap inside their column; nothing is lost', async ($, on) => {
  base(on)
  const { ui, lines } = await tableLines($, 80)
  const all = lines.join(' ').replace(/\s+/g, ' ')
  for (const word of ['CLAUDE_CONFIG_DIR', 'pinned', '表格测试', 'docs', 'Ran']) expect(all).toContain(word)
  // the unbreakable word is cut across lines, not dropped
  expect(lines.join('').replace(/[\s│·─]/g, '')).toContain('verylongunbreakablewordthatmustbecutsomewhere')
  await ui.unmount()
})

test('right / center alignment is honoured', async ($, on) => {
  base(on)
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'r2', props: { text: '| name | n |\n|:---|---:|\n| a | 7 |\n| bbbbbb | 1234 |', isFirstOfReply: true }, viewport: { columns: 100, rows: 40 } })
  const box = (await ui.findAll({ type: 'Box' })).find((b: any) => b.props.marginY === 1)!
  const lines = (box as any).children.map(textOf) as string[]
  const row = lines.find(l => l.includes(' 7'))!
  expect(row.endsWith('   7')).toBe(true) // 7 right-aligned under "1234"
  await ui.unmount()
})

test('[ copy table ] copies the original markdown', async ($, on) => {
  const runs: string[] = []
  base(on, runs)
  const { ui } = await tableLines($, 100)
  const key = (await ui.findAll({ type: 'Button' })).find((b: any) => b.props.label === '[ md ]')!.key!
  await $.ui.press({ plugin: P, key, requestId: 'r' })
  expect(runs.at(-1)).toBe(TABLE)
  await ui.unmount()
})

test('[ copy as cells ] copies tab-separated plain text for Slack and spreadsheets', async ($, on) => {
  const runs: string[] = []
  base(on, runs)
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'c', props: { text: '| Name | Notes |\n|---|---|\n| **Ann** | see [docs](https://x.y)<br>and `code` |\n| Bo | a \\| b |', isFirstOfReply: true }, viewport: { columns: 100, rows: 40 } })
  const key = (await ui.findAll({ type: 'Button' })).find((b: any) => b.props.label === '[ cells ]')!.key!
  await $.ui.press({ plugin: P, key, requestId: 'c' })
  expect(runs.at(-1)).toBe('Name\tNotes\nAnn\tsee docs and code\nBo\ta | b')
  await ui.unmount()
})

test('text that only looks like a table stays markdown', async ($, on) => {
  base(on)
  const ui = await $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'r3', props: { text: 'a | b without a rule line\nnext line', isFirstOfReply: true } })
  expect((await ui.findAll({ type: 'Box' })).some((b: any) => b.props.marginY === 1)).toBe(false)
  await ui.unmount()
})
