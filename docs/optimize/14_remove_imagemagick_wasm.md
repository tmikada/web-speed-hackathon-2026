# 14. ImageMagick WASM をクライアントから除去してサーバー側 Sharp に移行

## 背景・目的

クライアントバンドルに `@imagemagick/magick-wasm`（WASM ~8MB）が含まれており、
画像アップロード時の JPEG 変換のためだけに使われていた。
これをサーバー側の Sharp に移行することでバンドルサイズを大幅に削減する。

## 変更内容

### サーバー側

#### `application/server/package.json`
- `sharp` を dependencies に追加（既存の依存に合流）
- `exifr` を dependencies に追加（EXIF 解析）

#### `application/server/src/routes/api/image.ts`
- 変更前: JPEG のみ受け付けてそのまま保存、レスポンスは `{ id }` のみ
- 変更後:
  - 任意フォーマット（JPEG/PNG/TIFF/WebP 等）を受け付ける
  - `sharp(req.body).withMetadata().jpeg()` で JPEG に変換（EXIF 保持）
  - `exifr.parse(req.body, ["ImageDescription"])` で **変換前のオリジナルバッファ** から ImageDescription を抽出
    - ※ Sharp の TIFF→JPEG 変換で ImageDescription が失われるケースがあるため、変換前に読む
  - レスポンスを `{ id, alt }` に変更

### クライアント側

#### `application/client/package.json`
- `@imagemagick/magick-wasm` を削除
- `piexifjs` を削除（`@types/piexifjs` も削除）

#### `application/client/webpack.config.js`
- `resolve.alias` から `@imagemagick/magick-wasm/magick.wasm$` を削除
- `splitChunks.cacheGroups.heavy` から `@imagemagick` を削除

#### `application/client/src/utils/convert_image.ts`
- ファイル削除（imagemagick + piexifjs を使った画像変換ユーティリティ）

#### `application/client/src/components/new_post_modal/NewPostModalPage.tsx`
- `convertImage()` の呼び出しを削除
- `isConverting` state を削除
- 選択ファイルをそのまま state に保存（変換はサーバー側）

#### `application/client/src/components/foundation/CoveredImage.tsx`
- `piexifjs` の import を削除
- インライン JPEG EXIF パーサー (`readJpegImageDescription`) を実装（~40行、外部ライブラリ不要）
  - フェッチ済みバイナリから直接 EXIF を読む（追加ネットワークリクエストなし）
  - JPEG APP1 マーカー → TIFF IFD → tag 0x010E (ImageDescription) を解析
- `alt` prop（DB 値）をフォールバックとして受け取り、バイナリ EXIF が空の場合に使用

#### `application/client/src/components/post/ImageArea.tsx`
- `image.alt`（DB から取得済み）を `CoveredImage` の `alt` prop に渡す

## ALT 表示のデータフロー

### シード画像（`public/images/*.jpg`）
```
JPEG バイナリ取得 → インライン EXIF パーサー → ImageDescription 表示
```

### 新規投稿画像
```
[アップロード時]
元ファイル → POST /api/v1/images → exifr(元バッファ) → alt 抽出 → DB 保存
                                 → sharp → JPEG 変換 → ファイル保存

[表示時]
JPEG バイナリ取得 → インライン EXIF パーサー → 空の場合は DB alt をフォールバック
```

## 効果

- クライアントバンドルから `@imagemagick/magick-wasm`（~8MB WASM）を除去
- TIFF/PNG 等の非 JPEG フォーマットもサーバー側で変換可能に
- EXIF ImageDescription が ALT テキストとして正しく DB に保存・表示されるように

## 注意点

- `POST /api/v1/initialize` でリセットした場合、シード画像の DB `alt` は `""` のまま
  → CoveredImage のインライン EXIF パーサーが直接ファイルから読むため表示には影響しない
