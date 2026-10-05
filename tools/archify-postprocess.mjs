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
  /* no "Compare system roles" lens: hide its panel, and the legend is a plain key, not a button */
  #semantic-lens { display: none !important; }
  svg [data-legend-kind] { pointer-events: none; cursor: default; }
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
    // the legend stays visible as a key but can no longer be activated (it opened the lens)
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelectorAll('svg [data-legend-kind]').forEach(function (g) {
        g.removeAttribute('role'); g.removeAttribute('aria-haspopup'); g.removeAttribute('aria-controls')
        g.removeAttribute('aria-expanded'); g.removeAttribute('aria-pressed'); g.setAttribute('tabindex', '-1')
      })
    })
    function pin() {
      if (root.getAttribute('data-theme') !== 'light') root.setAttribute('data-theme', 'light')
      if (root.getAttribute('data-preset') !== 'classic') root.setAttribute('data-preset', 'classic')
    }
    pin()
    new MutationObserver(pin).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-preset'] })
    // the viewer's own shortcuts for theme (T), export (E), presentation (F), and lens (L)
    window.addEventListener('keydown', function (e) {
      var t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!e.metaKey && !e.ctrlKey && !e.altKey && /^[tTeEfFlL]$/.test(e.key)) { e.stopImmediatePropagation(); e.preventDefault() }
    }, true)

    // Smart placement for the details panel ("Semantic passport") that opens when a box is
    // selected. Archify always opens it in the same corner, where it can cover the box itself.
    // Each time the selection changes, try spots around the diagram and pick the closest one that
    // never covers the selected box, avoids its connected boxes, and covers as few others as
    // possible. A panel the visitor has dragged stays put until the next selection.
    ;(function placePassport() {
      var PAD = 12, GAP = 18
      function ready(fn) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn() }
      ready(function () {
        var chip = document.getElementById('focus-chip')
        var svg = document.querySelector('svg [data-node-id]') && document.querySelector('svg [data-node-id]').ownerSVGElement
        if (!chip || !svg) return
        var lastId = null, userMoved = false, placing = false
        function rect(el) { return el.getBoundingClientRect() }
        function overlap(a, b) {
          var w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t)
          return w > 0 && h > 0 ? w * h : 0
        }
        function box(r, ox, oy) { return { l: r.left - ox, t: r.top - oy, r: r.right - ox, b: r.bottom - oy } }
        function place() {
          var sel = svg.querySelector('g[data-node-id][aria-pressed="true"]')
          if (!sel || chip.offsetParent === null) { lastId = null; return }
          var id = sel.dataset.nodeId
          if (id === lastId && userMoved) return
          if (id !== lastId) userMoved = false
          lastId = id
          var host = chip.offsetParent
          // on short screens keep the whole panel visible; it scrolls inside instead
          var maxH = host.clientHeight - PAD * 2 + 'px'
          if (chip.style.maxHeight !== maxH) { placing = true; chip.style.maxHeight = maxH; chip.style.overflowY = 'auto'; placing = false }
          var hr = rect(host), cr = rect(chip)
          var W = host.clientWidth, H = host.clientHeight, w = cr.width, h = cr.height
          var node = box(rect(sel), hr.left, hr.top)
          var near = {}
          svg.querySelectorAll('path[marker-end][data-edge-from="' + id + '"], path[marker-end][data-edge-to="' + id + '"]').forEach(function (e) {
            near[e.dataset.edgeFrom] = true; near[e.dataset.edgeTo] = true
          })
          var others = [].map.call(svg.querySelectorAll('g[data-node-id]'), function (g) {
            return { id: g.dataset.nodeId, b: box(rect(g), hr.left, hr.top) }
          }).filter(function (o) { return o.id !== id })
          function clampX(x) { return Math.max(PAD, Math.min(W - w - PAD, x)) }
          function clampY(y) { return Math.max(PAD, Math.min(H - h - PAD, y)) }
          var xs = [PAD, W - w - PAD, node.r + GAP, node.l - w - GAP, (node.l + node.r) / 2 - w / 2].map(clampX)
          var ys = [PAD, H - h - PAD, node.t, node.b - h, node.b + GAP, node.t - h - GAP, (node.t + node.b) / 2 - h / 2].map(clampY)
          var cx = (node.l + node.r) / 2, cy = (node.t + node.b) / 2, best = null
          xs.forEach(function (x) {
            ys.forEach(function (y) {
              var c = { l: x, t: y, r: x + w, b: y + h }
              var score = overlap(c, node) * 1e6
              others.forEach(function (o) { score += overlap(c, o.b) * (near[o.id] ? 40 : 4) })
              score += Math.hypot(x + w / 2 - cx, y + h / 2 - cy)
              if (!best || score < best.score) best = { x: x, y: y, score: score }
            })
          })
          if (!best) return
          placing = true
          chip.style.left = Math.round(best.x) + 'px'
          chip.style.top = Math.round(best.y) + 'px'
          placing = false
        }
        var queued = false
        function schedule() {
          if (placing || queued) return
          queued = true
          requestAnimationFrame(function () { queued = false; place() })
        }
        new MutationObserver(schedule).observe(svg, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] })
        new MutationObserver(schedule).observe(chip, { attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'] })
        // the viewer slides the diagram to frame the selected box, and the panel grows as its
        // content fills in: re-place after either (unless the visitor dragged the panel)
        new MutationObserver(schedule).observe(svg, { attributes: true, attributeFilter: ['style', 'transform'] })
        if (window.ResizeObserver) new ResizeObserver(schedule).observe(chip)
        window.addEventListener('resize', function () { lastId = null; userMoved = false; schedule() })
        var handle = document.getElementById('btn-focus-move')
        if (handle) {
          handle.addEventListener('pointerdown', function () { userMoved = true })
          handle.addEventListener('keydown', function (e) { if (/^Arrow|Home/.test(e.key)) userMoved = true })
        }
      })
    })()

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
