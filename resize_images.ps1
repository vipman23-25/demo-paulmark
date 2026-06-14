Add-Type -AssemblyName System.Drawing

function ResizeImage($source, $target, $width, $height) {
    $img = [System.Drawing.Image]::FromFile($source)
    $bmp = new-object System.Drawing.Bitmap($width, $height)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.DrawImage($img, 0, 0, $width, $height)
    $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

$dir = "c:\Users\YUSUF\Documents\employee-ease-log-main\public"

ResizeImage "$dir\logo.png" "$dir\logo_small.png" 256 256
ResizeImage "$dir\apple-touch-icon.png" "$dir\apple_small.png" 192 192
ResizeImage "$dir\favicon.ico" "$dir\favicon_small.png" 32 32

Move-Item -Path "$dir\logo_small.png" -Destination "$dir\logo.png" -Force
Move-Item -Path "$dir\apple_small.png" -Destination "$dir\apple-touch-icon.png" -Force
Move-Item -Path "$dir\favicon_small.png" -Destination "$dir\favicon.ico" -Force

Get-ChildItem -Path $dir | Select-Object Name, Length
