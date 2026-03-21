# 初期バンドル分析レポート

計測日: 2026-03-20
対象: 最適化前の初期状態
ツール: webpack-bundle-analyzer 5.2.0

---

## チャンク一覧

| チャンク | Stat Size | Parsed Size | Gzip Size |
|---|---|---|---|
| `scripts/main.js` | 67.7 MB | 113.0 MB | 33.6 MB |
| `scripts/chunk-a412ca41c0be7b4ae11c.js` | 6.6 KB | 27.2 KB | 8.6 KB |

main.js に全依存ライブラリが同梱されており、コード分割は実質行われていない。

---

## 主要依存ライブラリ（Stat Size 降順）

| パッケージ | Stat Size | 備考 |
|---|---|---|
| `@ffmpeg/core` + WASM | 32.2 MB | 動画処理 |
| `@imagemagick/magick-wasm` + WASM | 14.5 MB | 画像処理 |
| `@mlc-ai/web-llm` | 6.0 MB | LLM 推論 |
| `negaposi-analyzer-ja` (辞書データ) | 3.5 MB | 日本語感情分析 |
| `highlight.js` (言語定義含む) | 1.4 MB | シンタックスハイライト |
| `react-dom` | 1.1 MB | UI フレームワーク |
| `refractor` (言語定義含む) | 985 KB | コードハイライト |
| `core-js` | 873 KB | ポリフィル |
| `moment` | 705 KB | 日付処理 → 置換対象 |
| `lodash` | 660 KB | ユーティリティ → tree-shaking 対象 |
| `katex` | 634 KB | 数式描画 |
| `standardized-audio-context` | 545 KB | 音声 API |
| `react-router` | 435 KB | ルーティング |
| `react-syntax-highlighter` | 319 KB | コードハイライト |
| `kuromoji` | 308 KB | 日本語形態素解析 |

---

## アプリケーションコード

| 対象 | Stat Size |
|---|---|
| `src/` 合計 | 456 KB |
| `src/components/` | 279 KB |

アプリケーション本体はバンドル全体の 0.7% 未満。

---

## 所見・最適化候補

### 緊急度: 高
- **WASM バイナリ合計 (~46.7 MB)** — FFmpeg + ImageMagick の WASM が大半を占める。使用ページのみで遅延ロードすることで初期バンドルを大幅削減できる。
- **`@mlc-ai/web-llm` (6.0 MB)** — LLM 推論ライブラリ。使用箇所を特定して遅延ロード化。

### 緊急度: 中
- **シンタックスハイライト系 (~2.3 MB)** — `highlight.js` + `refractor` + `react-syntax-highlighter` が重複している。必要言語のみに絞った遅延ロードを検討。
- **`negaposi-analyzer-ja` 辞書 (3.5 MB)** — 感情分析辞書。遅延ロード候補。
- **`moment` (705 KB)** — `dayjs` または `date-fns` への置換で大幅削減可能（`docs/optimize/06` 参照）。
- **`lodash` (660 KB)** — named import / `lodash-es` への切り替えで tree-shaking 有効化（`docs/optimize/07` 参照）。

### 緊急度: 低
- **`core-js` (873 KB)** — ターゲットブラウザの見直しで不要なポリフィルを削減可能。
- **`katex` (634 KB)** — 数式描画。使用ページのみで遅延ロード。
- **`kuromoji` (308 KB)** — 形態素解析。使用箇所を特定して遅延ロード化。
