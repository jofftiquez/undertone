import { expect, test } from 'claude-code/testing'

const PROMPT = {
  plugin: 'undertone',
  surface: 'terminal',
  component: 'UserMessage',
  requestId: 'row-1',
  props: { text: 'hi', origin: { kind: 'composer' as const }, isExpanded: true },
} as const

const NOW = Date.UTC(2026, 10, 3, 7, 41) // 3:41 PM at UTC+8

// Everything undertone's session.start asks of the engine, so the start hook runs in full on
// every platform (an unanswered call skips the whole hook, and the UTC offset with it).
function machine(on: any) {
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'sess-1234' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.root', () => ({ value: '/work' }))
  on('env.get', (_: any, e: any) => ({ value: ({ HOME: '/home/u', TMPDIR: '/tmp' } as Record<string, string>)[e.name ?? e] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('store.get', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('state.get', (_: any, e: any) => ({ value: e.key === 'stamps' ? { value: NOW, version: 1 } : { value: undefined, version: 0 } }))
}

test('a stamped prompt shows its local time in the You header', async ($, on) => {
  machine(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PROMPT)
  expect((await ui.find({ type: 'Text', text: /3:41:00.000 PM UTC\+8/ }))?.text).toContain("3:41:00.000 PM UTC+8")
  await ui.unmount()
})

test('the time still shows when the OS timezone lookup fails', async ($, on) => {
  machine(on)
  on('process.run', () => { throw new Error('binary mid-update') })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PROMPT)
  expect((await ui.find({ type: 'Text', text: /\d{1,2}:\d\d:\d\d\.\d{3} (AM|PM) UTC/ }))?.text).toBeDefined()
  await ui.unmount()
})
