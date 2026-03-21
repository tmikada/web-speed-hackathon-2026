# 17. Tailwind CDN の除去（ビルド時処理への移行）

## 問題

`index.html` に `@tailwindcss/browser@4.2.1` がCDNから読み込まれており、レンダリングをブロックしていた。

- **JSDelivr CDN**: 65.5 KiB、380ms のレンダリングブロッキングスクリプト
- **外部ネットワーク依存**: CDNへのラウンドトリップが発生
- **ランタイム処理**: ブラウザ上でTailwindがDOMをスキャンしCSSを生成するため、初期描画が遅延

合計推定削減時間: **710ミリ秒**（Lighthouse表示）

## 対応

`@tailwindcss/browser`（ランタイム版）を廃止し、`@tailwindcss/postcss`（ビルド時処理）へ移行。

### 変更内容

1. **`@tailwindcss/postcss` をインストール**
   - `application/client/package.json` の devDependencies に追加

2. **`tailwind.css` を新規作成** (`application/client/src/tailwind.css`)
   - `@import "tailwindcss"` ディレクティブ
   - `@source` でスキャン対象を `./`（src配下）に指定
   - `index.html` にあった `@theme`、`@layer base`、`@utility markdown` の定義を移植

3. **`postcss.config.js` を更新**
   - `postcss-preset-env` を `@tailwindcss/postcss` に置き換え
   - Tailwind v4 が内部でブラウザ互換処理を担うため `postcss-preset-env` は不要

4. **`webpack.config.js` の entry に `tailwind.css` を追加**
   - `index.css` より前に配置し、Tailwindのリセット/テーマが先に適用されるようにした

5. **`index.html` をクリーンアップ**
   - `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.2.1">` を削除
   - `<style type="text/tailwindcss">...</style>` ブロックを削除

## 期待効果

| 指標 | 変更前 | 変更後 |
|------|--------|--------|
| CDNスクリプト | 65.5 KiB（ブロッキング） | 0 |
| 外部リクエスト | JSDelivr への1往復 | なし |
| Tailwind処理 | ランタイム（ブラウザ） | ビルド時 |

- FCP / LCP の改善が見込まれる
- 外部CDNへの依存がなくなりオフライン・ネットワーク遅延の影響を受けなくなる
- 使用クラスのみのCSSが生成されるためCSSサイズも削減される可能性あり

## 影響範囲

- VRT 要確認（スタイルの視覚的変化がないことを確認）
- `@tailwindcss/postcss` は Tailwind v4 のPostCSS実装のため、v4 APIとの互換性はある
