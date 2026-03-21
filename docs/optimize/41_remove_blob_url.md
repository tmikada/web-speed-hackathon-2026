# 41. Blob URL 除去（画像・音声の直接配信）

## 問題

`CoveredImage.tsx` と `SoundPlayer.tsx` が、画像・音声ファイルを `fetchBinary()` でバイナリ取得してから `URL.createObjectURL()` で blob URL を生成するという不要なパターンを使っていた。

```
【変更前】
画像ID → fetch("/images/{id}.jpg") → ArrayBuffer → new Blob([data]) → URL.createObjectURL() → <img src="blob:...">
音声ID → fetch("/sounds/{id}.mp3") → ArrayBuffer → new Blob([data]) → URL.createObjectURL() → <audio src="blob:...">

【変更後】
画像ID → <img src="/images/{id}.jpg">
音声ID → <audio src="/sounds/{id}.mp3">
```

## パフォーマンスへの影響

| 問題 | 説明 |
|------|------|
| LCP 遅延 | JS バンドル実行 → fetch 完了 → Blob 生成、すべてが終わるまで画像が表示されない |
| TBT 増加 | binary fetch + ArrayBuffer → Blob 変換の JS 処理がメインスレッドをブロック |
| キャッシュ不可 | `blob:` URL はページをまたいで共有されず、HTTP キャッシュも効かない |
| プリロード不可 | ブラウザの投機的プリフェッチ・preload が効かない |

## 変更内容

### CoveredImage.tsx

- `fetchBinary`、`useFetch`、`sizeOf`（image-size）、EXIF解析関数（`readJpegImageDescription`）を削除
- IntersectionObserver による独自遅延ロード → `loading="lazy"` ネイティブ属性に置き換え
- JS による縦横比計算（`containerRatio > imageRatio` でクラス切り替え）→ `object-cover` CSS に置き換え
- alt テキスト: 「ALT を表示する」ボタンクリック時に `/api/v1/images/:id` を遅延フェッチ（ページロード時は叩かない）

### SoundPlayer.tsx

- `fetchBinary`、`useFetch`（バイナリ用）、`blobUrl` の useMemo を削除
- `isLoading || data === null || blobUrl === null` の早期 return を削除
- `<audio src={blobUrl}>` → `<audio src={getSoundPath(sound.id)}>`

### image.ts（バックエンド）

元の `CoveredImage` は JPEG バイナリを直接クライアントで取得して EXIF `ImageDescription` を読んでいた。
Blob URL 除去後は別途 ALT テキストを取得する手段が必要なため、以下を追加。

- `GET /api/v1/images/:id` を追加 — ALT テキストを返す JSON エンドポイント
  - アップロード済み画像: `UPLOAD_PATH/images/{id}.json` サイドカーファイルから取得（UTF-8 JSON）
  - シード画像: JPEG の EXIF `ImageDescription` から取得
- `POST /images` でサイドカーファイル `{imageId}.json` を生成
  - sharp が EXIF `ImageDescription` を ASCII でしか書き込めず日本語が文字化けするため、JPEG には埋め込まずサイドカーで保存

## 変更ファイル

- `application/client/src/components/foundation/CoveredImage.tsx`
- `application/client/src/components/foundation/SoundPlayer.tsx`
- `application/server/src/routes/api/image.ts`
