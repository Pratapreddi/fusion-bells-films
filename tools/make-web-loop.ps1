# Trim + downscale a 4K master into a small silent web loop using Windows'
# own signed MediaTranscoder, because Smart App Control blocks ffmpeg.exe.
param(
  [Parameter(Mandatory=$true)][string]$InPath,
  [Parameter(Mandatory=$true)][string]$OutPath,
  [double]$StartSeconds = 12,
  [double]$DurationSeconds = 20,
  [int]$Bitrate = 2800000
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

[Windows.Media.Transcoding.MediaTranscoder,Windows.Media,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.MediaProperties.MediaEncodingProfile,Windows.Media,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFolder,Windows.Storage,ContentType=WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

function Await($op, $type) {
  $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $t.Wait(-1) | Out-Null
  $t.Result
}

# TranscodeAsync returns IAsyncActionWithProgress<double>, which needs the
# other AsTask overload — its .Status is not readable from PowerShell 5.1.
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' })[0]

function AwaitAction($op, $progressType) {
  $t = $asTaskAction.MakeGenericMethod($progressType).Invoke($null, @($op))
  $t.Wait(-1) | Out-Null
  if ($t.IsFaulted) { throw $t.Exception.InnerException }
}

$inFull  = [System.IO.Path]::GetFullPath($InPath)
$outFull = [System.IO.Path]::GetFullPath($OutPath)
$outDir  = [System.IO.Path]::GetDirectoryName($outFull)
$outName = [System.IO.Path]::GetFileName($outFull)
if (Test-Path $outFull) { Remove-Item $outFull -Force }

$src    = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($inFull)) ([Windows.Storage.StorageFile])
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($outDir)) ([Windows.Storage.StorageFolder])
$dst    = Await ($folder.CreateFileAsync($outName, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])

$profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateMp4(
             [Windows.Media.MediaProperties.VideoEncodingQuality]::HD1080p)
$profile.Video.Bitrate = $Bitrate
$profile.Video.FrameRate.Numerator   = 25    # halve 50fps -> big saving, invisible here
$profile.Video.FrameRate.Denominator = 1
$profile.Audio = $null                        # strip audio entirely

$transcoder = New-Object Windows.Media.Transcoding.MediaTranscoder
$transcoder.TrimStartTime = [TimeSpan]::FromSeconds($StartSeconds)
$transcoder.TrimStopTime  = [TimeSpan]::FromSeconds($StartSeconds + $DurationSeconds)

$prep = Await ($transcoder.PrepareFileTranscodeAsync($src, $dst, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
if (-not $prep.CanTranscode) { throw "Cannot transcode: $($prep.FailureReason)" }

AwaitAction ($prep.TranscodeAsync()) ([double])

if (-not (Test-Path $outFull) -or (Get-Item $outFull).Length -lt 10000) {
  throw "Transcode produced no usable output"
}

$mb = [math]::Round((Get-Item $outFull).Length / 1MB, 2)
"OK  $outName  ${mb} MB"
