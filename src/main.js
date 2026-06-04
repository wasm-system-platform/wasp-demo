import '@xterm/xterm/css/xterm.css'
import './style.css'
import createModule from './wasm-sp.js'
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit'

const catppuccinMocha = {
  foreground: '#cdd6f4',
  background: '#1e1e2e',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',

  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',

  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
}

document.querySelector('#app').innerHTML = `
  <div id="terminal"></div>
`

const terminal = new Terminal({theme: catppuccinMocha});

const fitAddon = new FitAddon()
terminal.loadAddon(fitAddon)

terminal.open(document.getElementById('terminal'));
fitAddon.fit();
window.addEventListener('resize', fitAddon.fit())

const stdinQueue = []
const encoder = new TextEncoder()

terminal.onData((data) => {
  data = data.replace(/\r/g, '\n')

  const bytes = encoder.encode(data)
  for (const byte of bytes) {
    stdinQueue.push(byte)
  }
})

function createStdoutWriter() {
  return (code) => {
    if (code === null || code === undefined) {
      return
    }

    terminal.write(new Uint8Array([code & 0xff]))
  }
}

const stdoutWriter = createStdoutWriter()

const mod = await createModule({
  noInitialRun: true,

  preRun: [function (Module) {
    Module.FS.init(
      () => {
        if (stdinQueue.length === 0) {
          return null
        }

        return stdinQueue.shift()
      },
      stdoutWriter,
      null
    )
  }],
})

await (async (Module) => {
  const kernelRes = await fetch("/kernel.wasm");
  Module.FS.writeFile("/kernel.wasm", new Uint8Array(await kernelRes.arrayBuffer()));

  const rootfsRes = await fetch("/rootfs.img");
  Module.FS.writeFile("/rootfs.img", new Uint8Array(await rootfsRes.arrayBuffer()));
})(mod);

mod.callMain(["-k", "/kernel.wasm", "-r", "/rootfs.img", "-m", "16384"]);
