# Piccolo server locale per vedere il sito nel browser, senza installare nulla.
# Uso: doppio clic su "Avvia sito.cmd" oppure  powershell -File tools\serve.ps1
param([int]$Port = 4173, [switch]$NoBrowser)

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.ttf' = 'font/ttf'; '.json' = 'application/json'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'
}

$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Sito attivo su http://localhost:$Port  (chiudi questa finestra per fermarlo)"
if (-not $NoBrowser) { Start-Process "http://localhost:$Port/" }

while ($l.IsListening) {
  $c = $l.GetContext()
  $p = [Uri]::UnescapeDataString($c.Request.Url.LocalPath.TrimStart('/'))
  $f = Join-Path $Root $p
  # Come su Vercel (trailingSlash): /filo -> /filo/
  if ($p -ne '' -and -not $p.EndsWith('/') -and (Test-Path $f -PathType Container)) {
    $c.Response.Redirect("/$p/"); $c.Response.Close(); continue
  }
  if (Test-Path $f -PathType Container) { $f = Join-Path $f 'index.html' }
  $full = [IO.Path]::GetFullPath($f)
  try {
    if ($full.StartsWith($Root) -and (Test-Path $full -PathType Leaf)) {
      $res = $c.Response
      $res.ContentType = $mime[[IO.Path]::GetExtension($full).ToLower()]
      $res.AddHeader('Accept-Ranges', 'bytes')
      $fs = [IO.File]::OpenRead($full)
      try {
        $size = $fs.Length; $start = 0; $end = $size - 1
        # Richieste parziali (Range): servono ai video per spostarsi in un punto qualsiasi
        $range = $c.Request.Headers['Range']
        if ($range -match '^bytes=(\d*)-(\d*)$') {
          if ($Matches[1] -ne '') { $start = [long]$Matches[1]; if ($Matches[2] -ne '') { $end = [Math]::Min([long]$Matches[2], $size - 1) } }
          elseif ($Matches[2] -ne '') { $start = [Math]::Max(0, $size - [long]$Matches[2]) }
          if ($start -gt $end) { $res.StatusCode = 416; $res.AddHeader('Content-Range', "bytes */$size"); continue }
          $res.StatusCode = 206
          $res.AddHeader('Content-Range', "bytes $start-$end/$size")
        }
        $len = $end - $start + 1
        $res.ContentLength64 = $len
        if ($c.Request.HttpMethod -ne 'HEAD') {
          $fs.Position = $start
          $buf = New-Object byte[] 262144
          while ($len -gt 0) {
            $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $len))
            if ($n -le 0) { break }
            $res.OutputStream.Write($buf, 0, $n); $len -= $n
          }
        }
      } finally { $fs.Dispose() }
    } else {
      $c.Response.StatusCode = 404
    }
  } catch {
    # Il browser ha annullato la richiesta (succede spostandosi nel video): si passa alla successiva
  } finally {
    try { $c.Response.Close() } catch {}
  }
}
