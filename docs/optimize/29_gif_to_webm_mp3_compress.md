# 29. GIF→WebM変換 & MP3圧縮

## 概要

`public/movies/`（GIF）と`public/sounds/`（MP3）のメディアファイルが合計247MBと非常に大きく、LCP・SI・FCPのスコアを大幅に下げていた。GIFをWebMに変換し、クライアントの描画方法も`<video>`要素に変更することで転送量と描画コストを削減した。

## 問題点

- GIFファイル: 15ファイル、合計180MB（最大26MB/ファイル）
- MP3ファイル: 15ファイル、合計67MB（最大8.7MB/ファイル）
- GIFは`gifler`ライブラリでクライアントサイドデコード + canvasレンダリングしており、**全バイナリを取得してからでないと表示されない**
- GIFはRangeリクエスト非対応の使われ方のため、ブラウザのプリロードも効果なし

## 対応内容

### 1. GIF → WebM変換

ffmpegでVP9コーデックのWebMに変換。

```bash
for f in application/public/movies/*.gif; do
  id=$(basename "$f" .gif)
  ffmpeg -i "$f" -c:v libvpx-vp9 -crf 33 -b:v 0 -an -y \
    "application/public/movies/${id}.webm"
done
```

### 2. PausableMovieコンポーネントの書き換え

`gifler` + `omggif` + `canvas` → `<video>` 要素に変更。

- **変更前**: バイナリ全体をfetchしてcanvasにデコード描画
- **変更後**: `<video src={src}>` でブラウザネイティブデコード（Rangeリクエスト自動対応）
- `loop` / `muted` / `playsInline` / `autoPlay` 属性で元のGIF挙動を再現
- `prefers-reduced-motion` 対応は `autoPlay={!reducedMotion}` で維持
- クリックでplay/pause切り替えも維持

対象ファイル: `application/client/src/components/foundation/PausableMovie.tsx`

### 3. パス変更

`getMoviePath()` の返り値を `.gif` → `.webm` に変更。

対象ファイル: `application/client/src/utils/get_path.ts`

### 4. サーバーのアップロード処理変更

新規動画アップロード時もWebMで保存するよう変更。

対象ファイル: `application/server/src/routes/api/movie.ts`

```
EXTENSION: "gif" → "webm"
tmpOut: `.gif` → `.webm`
ffmpegオプション追加: -c:v libvpx-vp9 -crf 33 -b:v 0
```

### 5. MP3 ビットレート削減

元のビットレート（192kbps前後）を128kbpsに再エンコード。

```bash
for f in application/public/sounds/*.mp3; do
  id=$(basename "$f" .mp3)
  ffmpeg -i "$f" -codec:a libmp3lame -b:a 128k -y "/tmp/${id}.mp3"
  mv "/tmp/${id}.mp3" "$f"
done
```

クライアント側（`SoundPlayer.tsx` / `SoundWaveSVG.tsx`）は変更なし。
波形SVGは `peak/max` の相対値で正規化されているため、ビットレート変更による見た目への影響は最小限。

## 結果

| 種別 | 変換前 | 変換後 | 削減率 |
|------|--------|--------|--------|
| GIF → WebM (movies) | 180MB | 43MB | **76%削減** |
| MP3 (sounds) | 67MB | 36MB | **46%削減** |
| **合計** | **247MB** | **79MB** | **68%削減** |

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `application/public/movies/*.webm` | GIFから変換した新規WebMファイル（15本） |
| `application/public/sounds/*.mp3` | 128kbpsで再エンコード（15本） |
| `application/client/src/utils/get_path.ts` | `.gif` → `.webm` |
| `application/client/src/components/foundation/PausableMovie.tsx` | canvas+gifler → `<video>`要素に書き換え |
| `application/server/src/routes/api/movie.ts` | アップロード変換をWebMに変更 |

## 注意事項

- 元の`.gif`ファイルは`public/movies/`に残っているが、参照されていないため削除可能
- VRTで波形SVGの差異が検出された場合はMP3の変更を切り戻す
