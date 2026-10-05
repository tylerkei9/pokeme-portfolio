/**
 * Runs after Archify compiles the architecture diagram (public/architecture/index.html).
 * Archify's viewer always ships a theme toggle, a visual-style picker, an Export menu, source
 * badges on every box, and a node index under the diagram, and it follows the visitor's system
 * theme. For the portfolio we want one look: Classic, light, just the diagram, with no export.
 * This injects a small override into <head>. Safe to run more than once.
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
    // the viewer's own shortcuts for theme (T) and export (E)
    window.addEventListener('keydown', function (e) {
      var t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!e.metaKey && !e.ctrlKey && !e.altKey && /^[tTeE]$/.test(e.key)) { e.stopImmediatePropagation(); e.preventDefault() }
    }, true)
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
