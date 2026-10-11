// Estrae i fotogrammi di ogni scena dalle riprese: tagli, accelerazioni, 30 fps.
// Uso: node extract.js [id-scena...]   -> frames/<id>/00001.jpg ... + counts.json
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FF = 'C:/Users/giuse/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const CAP = path.join(__dirname, '..', 'captures', 'nocchiero');
const { scenes } = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenes.json'), 'utf8'));
const only = process.argv.slice(2);
const countsFile = path.join(__dirname, 'counts.json');
const counts = fs.existsSync(countsFile) ? JSON.parse(fs.readFileSync(countsFile, 'utf8')) : {};

for (const s of scenes) {
  if (only.length && !only.includes(s.id)) continue;
  // Velocità scalate perché la scena duri "target" secondi
  const natural = s.seg.reduce((a, [i, o, v]) => a + (o - i) / v, 0);
  const k = natural / s.target;
  const parts = s.seg.map(([i, o, v], n) =>
    `[0:v]trim=start=${i}:end=${o},setpts=(PTS-STARTPTS)/${(v * k).toFixed(4)}[p${n}]`);
  const concat = s.seg.map((_, n) => `[p${n}]`).join('') + `concat=n=${s.seg.length}:v=1:a=0[c]`;
  const fix = s.fix ? ',crop=386:839:0:0,scale=390:844' : '';
  const graph = [...parts, concat, `[c]fps=30${fix}[out]`].join(';');
  const dir = path.join(__dirname, 'frames', s.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(FF, ['-y', '-v', 'error', '-i', path.join(CAP, s.src + '.mkv'), '-filter_complex', graph,
    '-map', '[out]', '-q:v', '2', path.join(dir, '%05d.jpg')], { stdio: ['ignore', 'inherit', 'pipe'] });
  counts[s.id] = fs.readdirSync(dir).length;
  console.log(`${s.id}: ${counts[s.id]} fotogrammi (${(counts[s.id] / 30).toFixed(1)} s, accelerazione x${k.toFixed(2)})`);
}
fs.writeFileSync(countsFile, JSON.stringify(counts, null, 1));
