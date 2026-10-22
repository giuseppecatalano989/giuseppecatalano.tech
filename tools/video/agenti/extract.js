// Estrae i fotogrammi delle scene dalla ripresa di un agente (captures/<agente>/ripresa.mp4).
// I tagli in scenes.json si possono scrivere in secondi o come segni della ripresa (marks.json):
//   "click", "risultato:calcola_impatto#2" (il secondo risultato di quello strumento), "fine", ... con scostamento: "fine+1.5"
// Uso: node agenti/extract.js <agente> [id-scena...]   -> <agente>/frames/<id>/00001.jpg ... + <agente>/counts.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const agente = process.argv[2];
const only = process.argv.slice(3);
const FF = process.env.FFMPEG || 'ffmpeg';
const DIR = path.join(__dirname, '..', agente);
const CAP = path.join(__dirname, '..', 'captures', agente);
const marks = JSON.parse(fs.readFileSync(path.join(CAP, 'marks.json'), 'utf8'));
const { scenes } = JSON.parse(fs.readFileSync(path.join(DIR, 'scenes.json'), 'utf8'));

function tempo(x) {
  if (typeof x === 'number') return x;
  const [, ref, n, off] = x.match(/^([a-z_]+(?::[a-z_]+)?)(?:#(\d+))?([+-][\d.]+)?$/);
  const [type, nome] = ref.split(':');
  const trovati = marks.filter((m) => m.type === type && (!nome || m.nome === nome));
  const m = trovati[(Number(n) || 1) - 1];
  if (!m) throw new Error(`Segno non trovato: ${x}`);
  return m.t + Number(off || 0);
}

const countsFile = path.join(DIR, 'counts.json');
const counts = fs.existsSync(countsFile) ? JSON.parse(fs.readFileSync(countsFile, 'utf8')) : {};
for (const s of scenes) {
  if (only.length && !only.includes(s.id)) continue;
  const seg = s.seg.map(([a, b, v]) => [tempo(a), tempo(b), v || 1]);
  const parts = seg.map(([i, o, v], n) => `[0:v]trim=start=${i.toFixed(3)}:end=${o.toFixed(3)},setpts=(PTS-STARTPTS)/${v}[p${n}]`);
  const graph = [...parts, seg.map((_, n) => `[p${n}]`).join('') + `concat=n=${seg.length}:v=1:a=0[c]`, '[c]fps=30[out]'].join(';');
  const dir = path.join(DIR, 'frames', s.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(FF, ['-y', '-v', 'error', '-i', path.join(CAP, 'ripresa.mp4'), '-filter_complex', graph, '-map', '[out]', '-q:v', '2', path.join(dir, '%05d.jpg')], { stdio: ['ignore', 'inherit', 'pipe'] });
  counts[s.id] = fs.readdirSync(dir).length;
  console.log(`${s.id}: ${counts[s.id]} fotogrammi (${(counts[s.id] / 30).toFixed(1)} s) da ${seg.map(([i, o, v]) => `${i.toFixed(1)}–${o.toFixed(1)} s ×${v}`).join(', ')}`);
}
fs.writeFileSync(countsFile, JSON.stringify(counts, null, 1));
fs.writeFileSync(path.join(DIR, 'counts.js'), `const COUNTS = ${JSON.stringify(counts)};\n`);
