# Piccolo server locale per vedere il sito nel browser, senza installare nulla.
# Uso: doppio clic su "Avvia sito.cmd" oppure  powershell -File tools\serve.ps1
param([int]$Port = 4173, [switch]$NoBrowser)

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.ttf' = 'font/ttf'; '.json' = 'application/json'
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
  if ($full.StartsWith($Root) -and (Test-Path $full -PathType Leaf)) {
    $b = [IO.File]::ReadAllBytes($full)
    $c.Response.ContentType = $mime[[IO.Path]::GetExtension($full).ToLower()]
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else {
    $c.Response.StatusCode = 404
  }
  $c.Response.Close()
}
