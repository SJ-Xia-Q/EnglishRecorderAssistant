$ErrorActionPreference = 'Stop'

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceDirectory = Join-Path $repositoryRoot 'extension'
$distributionDirectory = Join-Path $repositoryRoot 'dist'
$archivePath = Join-Path $distributionDirectory 'english-recording-assistant.zip'

if (-not (Test-Path -LiteralPath (Join-Path $sourceDirectory 'manifest.json') -PathType Leaf)) {
    throw "Extension manifest was not found at $sourceDirectory"
}

New-Item -ItemType Directory -Force -Path $distributionDirectory | Out-Null
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

Push-Location $sourceDirectory
try {
    Compress-Archive -Path '*' -DestinationPath $archivePath -CompressionLevel Optimal
}
finally {
    Pop-Location
}

Write-Output $archivePath
