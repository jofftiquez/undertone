// 0.25: code colours know each language's comments, strings and keywords.
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
const BASE = { foldLines: 200, buttons: 'inline' }
const reply = ($: any, text: string) => $.ui.mount({ plugin: P, surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text, isFirstOfReply: true }, viewport: { columns: 100, rows: 60 } } as any)
const texts = async (ui: any) => ((await ui.findAll({ type: 'Text' })) as any[])
const labels = async (ui: any) => ((await ui.findAll({ type: 'Button' })) as any[]).map(b => b.props.label as string)
const opts = (o: object) => ({ options: { ...BASE, ...o } })
const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'
const INK = { codeCommandColor: '#c00001', codeFlagColor: '#c00002', codeStringColor: '#c00003', codeCommentColor: '#c00004' }
const KIND: Record<string, string> = { '#c00001': 'command', '#c00002': 'keyword', '#c00003': 'string', '#c00004': 'comment' }
// [language, code, [token, how it should colour]...]
const CASES: [string, string, [string, string][]][] = [
  ['php', '<?php echo $name; // hi', [['echo', 'keyword'], ['// hi', 'comment']]],
  ['php', '# old style', [['# old style', 'comment']]],
  ['python', 'x = a // b  # floor', [['# floor', 'comment']]],
  ['python', 'def f(): return "s"', [['def', 'keyword'], ['"s"', 'string']]],
  ['ruby', 'puts "hi" # say', [['puts', 'keyword'], ['# say', 'comment']]],
  ['go', 'func main() { fmt.Println("x") } // go', [['func', 'keyword'], ['"x"', 'string'], ['// go', 'comment']]],
  ['rust', "fn f<'a>(x: &'a str) -> usize { 0 } // r", [['fn', 'keyword'], ['// r', 'comment']]],
  ['java', 'public final int n = 1; /* note */ int m;', [['public', 'keyword'], ['final', 'keyword'], ['/* note */', 'comment']]],
  ['csharp', 'using System; // cs', [['using', 'keyword'], ['// cs', 'comment']]],
  ['kotlin', 'val x = listOf(1) // kt', [['val', 'keyword'], ['listOf', 'command'], ['// kt', 'comment']]],
  ['swift', 'guard let x = y else { return }', [['guard', 'keyword'], ['let', 'keyword']]],
  ['cpp', 'std::vector<int> v; // c++', [['int', 'keyword'], ['// c++', 'comment']]],
  ['sql', 'SELECT name FROM users -- all', [['SELECT', 'keyword'], ['FROM', 'keyword'], ['-- all', 'comment']]],
  ['lua', 'local x = 1 -- lua', [['local', 'keyword'], ['-- lua', 'comment']]],
  ['haskell', 'main = putStrLn "hi" -- hs', [['"hi"', 'string'], ['-- hs', 'comment']]],
  ['clojure', '(defn f [x] x) ; clj', [['defn', 'keyword'], ['; clj', 'comment']]],
  ['erlang', '-module(m). % erl', [['% erl', 'comment']]],
  ['html', '<div class="a"><!-- note --></div>', [['"a"', 'string'], ['<!-- note -->', 'comment']]],
  ['css', 'a { color: red; } /* css */', [['/* css */', 'comment']]],
  ['yaml', 'name: "x" # y', [['"x"', 'string'], ['# y', 'comment']]],
  ['dockerfile', 'FROM node:20 # base', [['FROM', 'keyword'], ['# base', 'comment']]],
  ['vb', "Dim x As Integer ' vb", [['Dim', 'keyword'], ["' vb", 'comment']]],
  ['fortran', 'program hello ! f90', [['program', 'keyword'], ['! f90', 'comment']]],
  ['ocaml', 'let rec f x = x (* ml *)', [['let', 'keyword'], ['(* ml *)', 'comment']]],
  ['matlab', 'x = 1; % matlab', [['% matlab', 'comment']]],
  ['bash', 'git commit --amend # sh', [['git', 'command'], ['--amend', 'keyword'], ['# sh', 'comment']]],
]
for (const [lang, code, want] of CASES) test(`code colours: ${lang}`, opts(INK), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, fence(lang, code))
  const got = new Map((await texts(ui)).filter(t => KIND[t.props.color]).map(t => [t.text as string, KIND[t.props.color]!]))
  for (const [tok, kind] of want) expect(`${tok} → ${got.get(tok)}`).toBe(`${tok} → ${kind}`)
  await ui.unmount()
})

test('code colours: block comments and triple-quoted strings run across lines', opts(INK), async ($, on) => {
  machine(on); await start($)
  const ui = await reply($, fence('java', '/**\n * Docs.\n */\nint x;') + '\n\n' + fence('python', '"""\nDoc.\n"""\nx = 1'))
  const got = new Map((await texts(ui)).filter(t => KIND[t.props.color]).map(t => [t.text as string, KIND[t.props.color]!]))
  expect([got.get(' * Docs.'), got.get(' */'), got.get('int'), got.get('Doc.')]).toEqual(['comment', 'comment', 'keyword', 'string'])
  await ui.unmount()
})
