# 11. サーバーサイドffmpeg変換によるクライアントバンドル削減

## 問題

動画・音声のアップロード時にクライアント側で `@ffmpeg/ffmpeg`（WebAssembly）を使って変換していた。

- `@ffmpeg/core`（WASM）+ `@ffmpeg/ffmpeg`（ESM）合計で数十MBのバンドルサイズ
- ユーザーがファイルを添付するたびにWASMをロードするため、TBT（Total Blocking Time）が増大
- fly.io本番環境にはsystem ffmpegが入っていないため、サーバーサイドへの移行にはnpmパッケージが必要

## 対応内容

### 1. `ffmpeg-static` をサーバーに追加

`ffmpeg-static` はプラットフォーム対応の静的ffmpegバイナリをnpmパッケージとして同梱する。Dockerfileの変更不要でfly.io環境でも動作する。

```
pnpm add ffmpeg-static --filter @web-speed-hackathon-2026/server
```

`pnpm-workspace.yaml` の `allowBuilds` に `ffmpeg-static: true` を追加してバイナリDLを許可。

### 2. サーバーサイドで変換処理を実行

**`server/src/routes/api/movie.ts`**
- クライアントから受け取ったraw動画バッファをtempファイルに書き出し
- `child_process.execFile` + `ffmpeg-static` のバイナリパスでGIF変換
  - 先頭5秒、10fps、正方形クロップ、音声なし
- 変換後のGIFを保存し、tempファイルを削除
- 入力時のファイルタイプ検証を削除（変換前なのでGIFでないため）

**`server/src/routes/api/sound.ts`**
- クライアントから受け取ったraw音声バッファをtempファイルに書き出し
- `encoding-japanese` でメタデータ取得後、ffmpeg-staticでMP3変換
- 変換後のMP3を保存し、tempファイルを削除
- 入力時のファイルタイプ検証を削除

### 3. クライアントから変換処理を削除

**`client/src/components/new_post_modal/NewPostModalPage.tsx`**
- `convertMovie` / `convertSound` の呼び出しを削除
- ファイル選択時にraw fileをそのままstateにセット（変換処理なし）
- `convertImage`（Canvas APIを使用）は引き続きクライアントで実行

### 4. webpack設定から ffmpeg 関連を削除

**`client/webpack.config.js`**
- `@ffmpeg/ffmpeg$` / `@ffmpeg/core$` / `@ffmpeg/core/wasm$` のaliasを削除
- `vendor-heavy` チャンクの test パターンから `@ffmpeg` を除外
- `ignoreWarnings` の `@ffmpeg` エントリを削除

### 5. Shift_JIS メタデータの文字化け対応

**`server/src/utils/extract_metadata_from_sound.ts`**

`music-metadata` はRIFF INFOチャンクの高バイト（0x80以上）を正しく保持しないため、文字化けが発生していた（各バイトから0x80が引かれる）。

対策として、WAVファイルの場合はRIFF LIST/INFOチャンクを直接バイナリパースし、`encoding-japanese` のAUTO検出でShift_JIS→Unicodeに変換。MP3等その他フォーマットはmusic-metadataで取得し、latin1デコードされた文字列を再デコードする `fixEncoding` 関数を適用。

`encoding-japanese` と `@types/encoding-japanese` をサーバー依存に追加。

## 期待効果

- `@ffmpeg/ffmpeg` + `@ffmpeg/core`（WASM）がクライアントバンドルから完全に除去
- `vendor-heavy` チャンクのサイズが大幅に削減（数十MB削減）
- TBT・FCP・SI の改善 → Lighthouseスコア向上
- ファイル選択後すぐに投稿可能（WASMロード待ち不要）

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `application/pnpm-workspace.yaml` | `ffmpeg-static: true` を allowBuilds に追加 |
| `application/server/package.json` | `ffmpeg-static`, `encoding-japanese`, `@types/encoding-japanese` を追加 |
| `application/server/src/routes/api/movie.ts` | サーバーサイドGIF変換に変更 |
| `application/server/src/routes/api/sound.ts` | サーバーサイドMP3変換に変更 |
| `application/server/src/utils/extract_metadata_from_sound.ts` | RIFF直接パース + Shift_JIS対応 |
| `application/client/src/components/new_post_modal/NewPostModalPage.tsx` | クライアント変換処理を削除 |
| `application/client/webpack.config.js` | ffmpeg関連alias・chunk設定を削除 |
