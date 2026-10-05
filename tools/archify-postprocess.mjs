/**
 * Runs after Archify compiles the architecture diagram (public/architecture/index.html).
 * Archify's viewer always ships a theme toggle, a visual-style picker, an Export menu, source
 * badges on every box, and a node index under the diagram, and it follows the visitor's system
 * theme. For the portfolio we want one look: Classic, light, just the diagram, with no export.
 * It also adds an opening reveal that builds the main path in order, then grows the branches. This injects a small
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
  /* opening reveal: boxes rise and settle in, arrows draw themselves, labels follow */
  html.pk-reveal svg [data-node-id] {
    opacity: 0; transform: translateY(10px) scale(0.92); transform-box: fill-box; transform-origin: center;
    transition: opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1), transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), filter 1.1s ease;
  }
  html.pk-reveal svg [data-node-id].pk-on { opacity: 1; transform: none; }
  html.pk-reveal svg [data-node-id].pk-glow { filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.55)); }
  html.pk-reveal svg [data-edge-id] { opacity: 0; transition: opacity 0.45s ease; }
  html.pk-reveal svg [data-edge-id].pk-on { opacity: 1; }
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

    // Opening reveal. The main path (1 to 5) builds one box at a time: each box rises into place
    // with a brief glow, then its arrow draws itself to the next box and the arrowhead and label
    // appear when the line arrives. After box 5 the remaining boxes grow outward along their own
    // arrows, branch by branch, in parallel. Skipped when the visitor prefers reduced motion.
    var EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'
    var MAIN = [['main', 'mount', 'app'], ['app', 'boot', 'engine'], ['engine', 'build-world', 'world'], ['world', 'render', 'three']]
    var NODE_MS = 650, DRAW_MS = 700
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }
    if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      root.classList.add('pk-reveal')
      window.addEventListener('load', async function () {
        var first = document.querySelector('svg [data-node-id]')
        var svg = first && first.ownerSVGElement
        if (!svg) { root.classList.remove('pk-reveal'); return }
        var shown = {}
        function node(id) {
          if (shown[id]) return
          shown[id] = true
          var g = svg.querySelector('[data-node-id="' + id + '"]')
          if (!g) return
          g.classList.add('pk-on', 'pk-glow')
          setTimeout(function () { g.classList.remove('pk-glow') }, 700)
        }
        function draw(edgeId) {
          var els = svg.querySelectorAll('[data-edge-id="' + edgeId + '"]')
          var line = svg.querySelector('path[data-edge-id="' + edgeId + '"][marker-end]')
          var labels = svg.querySelectorAll('g[data-detail][data-edge-id="' + edgeId + '"]')
          els.forEach(function (el) { if (!el.matches('g[data-detail]')) el.classList.add('pk-on') })
          // dashed lines can't be drawn with a dash offset (it would show them solid), so they just fade in
          var dashed = line && getComputedStyle(line).strokeDasharray !== 'none'
          if (line && line.getTotalLength && !dashed) {
            var len = line.getTotalLength(), marker = line.getAttribute('marker-end')
            line.removeAttribute('marker-end')
            line.style.transition = 'none'
            line.style.strokeDasharray = len + ' ' + len
            line.style.strokeDashoffset = len
            line.getBoundingClientRect()
            line.style.transition = 'stroke-dashoffset ' + DRAW_MS + 'ms ' + EASE
            line.style.strokeDashoffset = '0'
            setTimeout(function () {
              line.setAttribute('marker-end', marker)
              line.style.transition = ''; line.style.strokeDasharray = ''; line.style.strokeDashoffset = ''
            }, DRAW_MS)
          }
          setTimeout(function () { labels.forEach(function (l) { l.classList.add('pk-on') }) }, DRAW_MS * 0.6)
          return wait(DRAW_MS * 0.85)
        }
        // grow a branch: draw the arrow from an already-visible box, then reveal the box it reaches
        async function grow(edge) {
          var line = svg.querySelector('path[data-edge-id="' + edge + '"][marker-end]')
          if (!line) return
          await draw(edge)
          node(line.dataset.edgeTo)
          await wait(NODE_MS * 0.6)
          var next = [].slice.call(svg.querySelectorAll('path[data-edge-from="' + line.dataset.edgeTo + '"][marker-end]'))
            .filter(function (l) { return !shown[l.dataset.edgeTo] }).map(function (l) { return l.dataset.edgeId })
          await Promise.all(next.map(grow))
        }
        await wait(350)
        for (var i = 0; i < MAIN.length; i++) {
          node(MAIN[i][0])
          await wait(NODE_MS * 0.7)
          await draw(MAIN[i][1])
        }
        node('three')
        await wait(NODE_MS)
        // remaining branches, outward from the main path, all at once
        var main = {}; MAIN.forEach(function (m) { main[m[1]] = true })
        var branches = [].slice.call(svg.querySelectorAll('path[data-edge-id][marker-end]'))
          .filter(function (l) { return !main[l.dataset.edgeId] && shown[l.dataset.edgeFrom] && !shown[l.dataset.edgeTo] })
          .map(function (l) { return l.dataset.edgeId })
        await Promise.all(branches.map(function (b, k) { return wait(k * 120).then(function () { return grow(b) }) }))
        // anything not reached by an arrow, then hand styling back to the viewer
        svg.querySelectorAll('[data-node-id], [data-edge-id]').forEach(function (el) { el.classList.add('pk-on') })
        await wait(900)
        root.classList.remove('pk-reveal')
        svg.querySelectorAll('.pk-on').forEach(function (el) { el.classList.remove('pk-on') })
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
