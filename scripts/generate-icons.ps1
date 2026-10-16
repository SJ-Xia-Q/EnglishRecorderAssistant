$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$outputDirectory = Join-Path $PSScriptRoot '..\extension\icons'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

function New-RoundedRectanglePath {
    param(
        [System.Drawing.RectangleF]$Bounds,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($Bounds.X, $Bounds.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($Bounds.Right - $diameter, $Bounds.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($Bounds.Right - $diameter, $Bounds.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($Bounds.X, $Bounds.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

$masterSize = 512
$master = [System.Drawing.Bitmap]::new($masterSize, $masterSize)
$master.SetResolution(96, 96)
$graphics = [System.Drawing.Graphics]::FromImage($master)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$backgroundBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#14232d'))
$faceBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#fffdf8'))
$accentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#d84a3f'))
$inkPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#14232d'), 34)
$inkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$inkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

$backgroundPath = New-RoundedRectanglePath ([System.Drawing.RectangleF]::new(12, 12, 488, 488)) 116
$graphics.FillPath($backgroundBrush, $backgroundPath)
$graphics.FillEllipse($faceBrush, 94, 112, 324, 324)
$graphics.FillRectangle($accentBrush, 218, 62, 76, 72)
$graphics.DrawLine($inkPen, 256, 274, 256, 173)
$graphics.DrawLine($inkPen, 256, 274, 330, 316)
$graphics.FillEllipse($accentBrush, 227, 245, 58, 58)

foreach ($size in 16, 32, 48, 128) {
    $icon = [System.Drawing.Bitmap]::new($size, $size)
    $icon.SetResolution(96, 96)
    $iconGraphics = [System.Drawing.Graphics]::FromImage($icon)
    $iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $iconGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $iconGraphics.DrawImage($master, 0, 0, $size, $size)
    $icon.Save(
        (Join-Path $outputDirectory "icon$size.png"),
        [System.Drawing.Imaging.ImageFormat]::Png
    )
    $iconGraphics.Dispose()
    $icon.Dispose()
}

$backgroundPath.Dispose()
$backgroundBrush.Dispose()
$faceBrush.Dispose()
$accentBrush.Dispose()
$inkPen.Dispose()
$graphics.Dispose()
$master.Dispose()
