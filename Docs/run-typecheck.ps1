$ErrorActionPreference = "Continue"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$errorsPath = Join-Path $PSScriptRoot "errors.txt"

function Invoke-Typecheck {
  param(
    [string]$Label,
    [string[]]$Args
  )

  $output = & bunx @Args 2>&1
  if (-not $output -or $output.Count -eq 0) {
    $output = @("No type errors.")
  }

  return @(
    "## $Label",
    $output,
    ""
  )
}

$sections = @()
$sections += Invoke-Typecheck -Label "Client typecheck" -Args @("tsc", "-p", (Join-Path $root "client/tsconfig.json"), "--noEmit")
$sections += Invoke-Typecheck -Label "Server typecheck" -Args @("tsc", "-p", (Join-Path $root "server/tsconfig.build.json"), "--noEmit")

Set-Content -Encoding UTF8 -Path $errorsPath -Value ($sections -join "`n")
