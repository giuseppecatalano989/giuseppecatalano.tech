// Monta il video finale di un agente: fotogrammi (out16, out45) + musica, più le locandine.
// Uso: node agenti/monta.js <agente> <cartella-vetrina> [secondo-locandina]
//   es. node agenti/monta.js vedetta ../../vedetta 10
// Scrive <vetrina>/video/presentazione-16x9.mp4/.jpg e presentazione-4x5.mp4/.jpg
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const [agente, vetrinaRel, locandinaSec = '10'] = process.argv.slice(2);
const FF = process.env.FFMPEG || 'ffmpeg';
const DIR = path.join(__dirname, '..', agente);
const OUT = path.resolve(process.cwd(), vetrinaRel, 'video'); // relativo alla cartella da cui si lancia
fs.mkdirSync(OUT, { recursive: true });

const musica = path.join(DIR, 'musica.wav');
for (const [fmt, nome] of [['16', 'presentazione-16x9'], ['45', 'presentazione-4x5']]) {
  const frames = path.join(DIR, 'out' + fmt);
  if (!fs.existsSync(frames)) { console.log(`Manca ${frames}: salto il formato ${fmt}`); continue; }
  const mp4 = path.join(OUT, nome + '.mp4');
  execFileSync(FF, ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(frames, 'f%05d.jpg'), '-i', musica,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', mp4], { stdio: 'inherit' });
  const n = String(Math.round(Number(locandinaSec) * 30)).padStart(5, '0');
  execFileSync(FF, ['-y', '-v', 'error', '-i', path.join(frames, `f${n}.jpg`), '-q:v', '3', path.join(OUT, nome + '.jpg')], { stdio: 'inherit' });
  console.log(`${mp4}: ${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB`);
}
