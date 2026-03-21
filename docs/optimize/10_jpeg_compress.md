Get-ChildItem before\*.jpg | ForEach-Object {
  ffmpeg -i "$($_.FullName)" `
    -vf scale=1280:-2 `
    -q:v 5 `
    -map_metadata 0 `
    "after\$($_.Name)"

  exiftool -TagsFromFile "$($_.FullName)" `
    -ImageDescription `
    -overwrite_original `
    "after\$($_.Name)"
}


Get-ChildItem before\profiles\*.jpg | ForEach-Object {
  ffmpeg -i "$($_.FullName)" `
    -vf "scale=256:256:force_original_aspect_ratio=increase,crop=256:256" `
    -q:v 5 `
    -map_metadata 0 `
    "after\profiles\$($_.Name)"

  exiftool -TagsFromFile "$($_.FullName)" `
    -ImageDescription `
    -overwrite_original `
    "after\profiles\$($_.Name)"
}
