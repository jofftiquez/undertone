import { expect, test } from 'claude-code/testing'

const PROMPT = {
  plugin: 'undertone',
  surface: 'terminal',
  component: 'UserMessage',
  requestId: 'row-1',
  props: { text: 'hi', origin: { kind: 'composer' as const }, isExpanded: true },
} as const

const NOW = Date.UTC(2026, 10, 3, 7, 41) // 3:41 PM at UTC+8

test('a stamped prompt shows its local time in the You header', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0800\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('state.get', (_, e) => ({ value: e.key === 'stamps' ? { value: NOW, version: 1 } : { value: undefined, version: 0 } }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PROMPT)
  expect((await ui.find({ type: 'Text', text: /3:41:00.000 PM UTC\+8/ }))?.text).toContain("3:41:00.000 PM UTC+8")
  await ui.unmount()
})

test('the time still shows when the OS timezone lookup fails', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('process.run', () => { throw new Error('binary mid-update') })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('state.get', (_, e) => ({ value: e.key === 'stamps' ? { value: NOW, version: 1 } : { value: undefined, version: 0 } }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PROMPT)
  expect((await ui.find({ type: 'Text', text: /\d{1,2}:\d\d:\d\d\.\d{3} (AM|PM) UTC/ }))?.text).toBeDefined()
  await ui.unmount()
})
