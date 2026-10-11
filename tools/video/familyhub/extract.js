// Estrae i fotogrammi di ogni scena dalle riprese di Family Hub.
// Velocità "intelligente": dove la schermata si muove (scorrimenti, finestre, testo digitato) si resta quasi
// a velocità reale; nelle pause si tiene un attimo l'immagine ferma e poi si accelera.
// Uso: node extract.js [id-scena...]   -> frames/<id>/00001.jpg ... + counts.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FF = 'C:/Users/giuse/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const CAP = path.join(__dirname, '..', 'captures', 'familyhub');
const { scenes } = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenes.json'), 'utf8'));
const only = process.argv.slice(2);
const countsFile = path.join(__dirname, 'counts.json');
const counts = fs.existsSync(countsFile) ? JSON.parse(fs.readFileSync(countsFile, 'utf8')) : {};

for (const s of scenes) {
  if (only.length && !only.includes(s.id)) continue;
  const src = path.join(CAP, s.src + '.mkv');
  const raw = path.join(__dirname, 'raw', s.id);
  fs.rmSync(raw, { recursive: true, force: true }); fs.mkdirSync(raw, { recursive: true });
  const trim = ['-ss', String(s.in), '-to', String(s.out)];
  // Tutti i fotogrammi del tratto, a 30 fps
  execFileSync(FF, ['-y', '-v', 'error', ...trim, '-i', src, '-vf', 'fps=30', '-q:v', '2', path.join(raw, '%05d.jpg')]);
  // Movimento fotogramma per fotogramma
  const meta = path.join(raw, 'motion.txt').replace(/\\/g, '/').replace(/^([A-Z]):/, '$1\\:');
  execFileSync(FF, ['-y', '-v', 'error', ...trim, '-i', src, '-vf', `fps=30,scale=130:282,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file='${meta}'`, '-f', 'null', '-']);
  const yavg = [0, ...fs.readFileSync(path.join(raw, 'motion.txt'), 'utf8').match(/YAVG=[\d.]+/g).map(v => Number(v.slice(5)))];
  const N = fs.readdirSync(raw).filter(f => f.endsWith('.jpg')).length;
  const moving = Array.from({ length: N }, (_, i) => (yavg[i] || 0) > (s.thr ?? 1.0));
  // Dilata il movimento di qualche fotogramma, per non tagliare gli ultimi istanti delle animazioni
  const dil = moving.map((_, i) => moving.slice(Math.max(0, i - 3), i + 5).some(Boolean));
  const move = s.move ?? 1.15, keep = Math.round((s.keep ?? 0.7) * 30), hold = s.hold ?? 6;
  const pick = [];
  for (let i = 0; i < N;) {
    let j = i; while (j < N && dil[j] === dil[i]) j++;
    const L = j - i;
    if (dil[i]) { for (let p = i; p < j; p += move) pick.push(Math.floor(p)); }
    else {
      const isLast = j === N;
      const kk = isLast ? Math.round((s.tail ?? 0.9) * 30) : (i === 0 ? Math.round((s.lead ?? 0.6) * 30) : keep);
      const outLen = Math.min(L, Math.round(kk + Math.max(0, L - kk) / hold));
      for (let k = 0; k < outLen; k++) pick.push(i + Math.floor(k * L / outLen));
    }
    i = j;
  }
  const dir = path.join(__dirname, 'frames', s.id);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  pick.forEach((f, n) => fs.copyFileSync(path.join(raw, String(f + 1).padStart(5, '0') + '.jpg'), path.join(dir, String(n + 1).padStart(5, '0') + '.jpg')));
  counts[s.id] = pick.length;
  console.log(`${s.id}: ${N} → ${pick.length} fotogrammi (${(pick.length / 30).toFixed(1)} s)`);
}
fs.writeFileSync(countsFile, JSON.stringify(counts, null, 1));
fs.writeFileSync(path.join(__dirname, 'counts.js'), 'const COUNTS = ' + JSON.stringify(counts) + ';\n');
