/**
 * Runs after Archify compiles the architecture diagram (public/architecture/index.html).
 * Archify's viewer always ships a theme toggle, a visual-style picker, an Export menu, source
 * badges on every box, and a node index under the diagram, and it follows the visitor's system
 * theme. For the portfolio we want one look: Classic, light, just the diagram, with no export.
 * It also adds an opening reveal that builds the main path in order. This injects a small
 * override into <head>. Safe to run more than once.
 *
 *   node tools/archify-postprocess.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE = join(import.meta.dirname, '../public/architecture/index.html')
const START = '<!-- pokeme:light-only -->'
const END = '<!-- /pokeme:light-only -->'

const block = `${START}
<style>
  /* one look only: no theme toggle, no style picker, no export */
  #btn-theme, .preset-wrap, .export-wrap { display: none !important; }
  /* presentation mode does nothing useful inside the game's window */
  #btn-present { display: none !important; }
  /* with every control hidden, drop the empty toolbar frame too */
  .toolbar { display: none !important; }
  /* no Path, Lens, search, or zoom controls: the diagram is read, not operated */
  .diagram-nav { display: none !important; }
  /* opening reveal: main path appears box by box, then everything else fills in */
  html.pk-reveal svg [data-node-id], html.pk-reveal svg [data-edge-id] { opacity: 0; transition: opacity 0.8s ease; }
  html.pk-reveal svg .pk-on { opacity: 1; }
  /* just the diagram: no node index under it */
  #node-outline, #reader-rail { display: none !important; }
  /* source badges stay out of the first view; clicking a box still shows its verified sources */
  .source-evidence-beacon { display: none !important; }
</style>
<script>
  (function () {
    var root = document.documentElement
    try { localStorage.setItem('archify-theme', 'light') } catch (e) {}
    function pin() {
      if (root.getAttribute('data-theme') !== 'light') root.setAttribute('data-theme', 'light')
      if (root.getAttribute('data-preset') !== 'classic') root.setAttribute('data-preset', 'classic')
    }
    pin()
    new MutationObserver(pin).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-preset'] })
    // the viewer's own shortcuts for theme (T), export (E), and presentation (F)
    window.addEventListener('keydown', function (e) {
      var t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!e.metaKey && !e.ctrlKey && !e.altKey && /^[tTeEfF]$/.test(e.key)) { e.stopImmediatePropagation(); e.preventDefault() }
    }, true)

    // Opening reveal. The main path (1 to 5) appears one box at a time, each arrow drawing
    // itself to the next box; then every remaining box and arrow fades in together. Skipped
    // when the visitor prefers reduced motion.
    var MAIN = [['node', 'main'], ['edge', 'mount'], ['node', 'app'], ['edge', 'boot'], ['node', 'engine'],
      ['edge', 'build-world'], ['node', 'world'], ['edge', 'render'], ['node', 'three']]
    var STEP = 750
    if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      root.classList.add('pk-reveal')
      window.addEventListener('load', function () {
        var svg = document.querySelector('svg [data-node-id]') && document.querySelector('svg [data-node-id]').ownerSVGElement
        if (!svg) { root.classList.remove('pk-reveal'); return }
        function show(sel) { svg.querySelectorAll(sel).forEach(function (el) { el.classList.add('pk-on') }) }
        function draw(id) {
          show('[data-edge-id="' + id + '"]')
          svg.querySelectorAll('path[data-edge-id="' + id + '"][marker-end]').forEach(function (path) {
            var len = path.getTotalLength ? path.getTotalLength() : 0
            if (!len || path.getAttribute('stroke-dasharray')) return
            path.style.transition = 'none'
            path.style.strokeDasharray = len
            path.style.strokeDashoffset = len
            path.getBoundingClientRect()
            path.style.transition = 'stroke-dashoffset ' + (STEP - 100) + 'ms ease-in-out'
            path.style.strokeDashoffset = '0'
            setTimeout(function () { path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; path.style.transition = '' }, STEP)
          })
        }
        MAIN.forEach(function (step, i) {
          setTimeout(function () { step[0] === 'node' ? show('[data-node-id="' + step[1] + '"]') : draw(step[1]) }, 400 + i * STEP)
        })
        var rest = 400 + MAIN.length * STEP
        setTimeout(function () { show('[data-node-id], [data-edge-id]') }, rest)
        // hand styling back to the viewer once everything is visible
        setTimeout(function () {
          root.classList.remove('pk-reveal')
          svg.querySelectorAll('.pk-on').forEach(function (el) { el.classList.remove('pk-on') })
        }, rest + 1000)
      })
    }
  })()
</script>
${END}`

let html = readFileSync(FILE, 'utf8')
const i = html.indexOf(START)
if (i >= 0) html = html.slice(0, i) + block + html.slice(html.indexOf(END) + END.length)
else {
  const head = html.indexOf('<head>')
  if (head < 0) throw new Error('no <head> in ' + FILE)
  html = html.slice(0, head + 6) + '\n' + block + html.slice(head + 6)
}
writeFileSync(FILE, html)
console.log('pinned Classic light, removed theme/style/export controls:', FILE)
