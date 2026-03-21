# 08: サーバーの事前コンパイル（tsx → node）

## 問題

サーバーが `tsx` インタープリタで実行されている。

```json
// application/server/package.json
"scripts": {
  "start": "tsx src/index.ts"
}
```

`tsx` は TypeScript を JIT コンパイルしながら実行するため:
- 起動時間がかかる
- リクエスト処理のオーバーヘッドがある（初回モジュールロード時）

## 対応方針

`esbuild` でサーバーコードをバンドル・コンパイルし、`node` で直接実行する。

### オプション A: esbuild でバンドル（推奨）

```bash
cd application/server
pnpm add -D esbuild
```

```json
// application/server/package.json
"scripts": {
  "build": "esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --external:better-sqlite3 --external:sequelize",
  "start": "node dist/index.js"
}
```

外部モジュール（native binding を含むもの）は `--external` で除外する必要がある。

### オプション B: tsc でコンパイル

```json
// application/server/package.json
"scripts": {
  "build": "tsc --outDir dist",
  "start": "node dist/src/index.js"
}
```

`tsconfig.json` の設定も確認が必要（`module: CommonJS`, `target: ES2022` など）。

### 推奨: オプション A（esbuild）

- esbuild は非常に高速（tsc の 10-100 倍）
- シングルファイルにバンドルできるため、起動が速い
- ただし native module（sqlite3 など）の扱いに注意

### native モジュールの扱い

`better-sqlite3` など native addon を使うモジュールはバンドルできないため `--external` で除外。

```bash
esbuild src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/index.js \
  --external:better-sqlite3 \
  --external:sequelize \
  --external:sqlite3
```

## 変更箇所

- [application/server/package.json](../../application/server/package.json)
  - `start` スクリプトを `tsx` → `node dist/index.js` に変更
  - `build` スクリプトを追加

## 期待効果

- **サーバー起動時間**: 大幅短縮（tsx の JIT コンパイルが不要）
- **リクエスト処理**: 初回モジュールロードの高速化
- **Lighthouse への影響**: TTFB（Time to First Byte）の改善 → FCP/LCP に間接的に影響

## 注意事項

- `application/pnpm-workspace.yaml` のビルドフローに組み込む必要あり
- 採点システムが `pnpm run build && pnpm run start` で動く前提のため、ルートの `build` スクリプトにサーバービルドを含めること
- 動的 `require()` や `__dirname`, `__filename` を使っている箇所は esbuild での扱いを確認
- `POST /api/v1/initialize` の DB リセット機能が引き続き動作することを確認（レギュレーション）
- native モジュールが `node_modules` に存在することが前提（`--external` で除外した場合）
