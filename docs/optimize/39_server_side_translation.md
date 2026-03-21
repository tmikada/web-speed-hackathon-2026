# 39. web-llm をサーバーサイド翻訳に置き換え

## 問題

投稿の「Show Translation」ボタンをクリックすると、`@mlc-ai/web-llm` がブラウザ内でLLMを実行していた。

- **巨大なJSチャンク**: `vendor-webllm` (~5.8MB) をダウンロード
- **モデル重みのダウンロード**: Gemma 2 2B モデルをCDNから数百MB〜数GB取得
- **WebGPU/WASM推論**: メインスレッドが長時間ブロックされ INP/TBT を著しく悪化させる

## 対応

### サーバーサイド翻訳APIの追加

`@vitalets/google-translate-api`（非公式Google翻訳ラッパー、APIキー不要）をサーバーに追加し、`POST /api/v1/translate` エンドポイントを実装。

**リクエスト:**
```json
{ "text": "翻訳したいテキスト", "from": "ja", "to": "en" }
```

**レスポンス:**
```json
{ "result": "Text to be translated" }
```

### クライアント側の置き換え

`create_translator.ts` から `@mlc-ai/web-llm` の dynamic import を削除し、`fetch("/api/v1/translate")` に置き換え。同じ `Translator` インターフェース（`translate()`, `[Symbol.dispose]()`）を維持。

### webpackキャッシュグループの削除

`webpack.config.js` の `webllm` cacheGroup（`@mlc-ai` 向け）を削除。参照がなくなったため自動的にバンドルから除外される。

## 変更ファイル

| ファイル | 変更 |
|----------|------|
| `application/server/src/routes/api/translate.ts` | 新規作成 |
| `application/server/src/routes/api.ts` | `translateRouter` 追加 |
| `application/server/package.json` | `@vitalets/google-translate-api` 追加 |
| `application/client/src/utils/create_translator.ts` | fetch ベースに置き換え |
| `application/client/webpack.config.js` | webllm cacheGroup 削除 |

## 期待効果

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| 翻訳クリック時のダウンロード | 数GB（モデル重み含む） | ほぼゼロ |
| バンドルサイズ | `vendor-webllm` ~5.8MB 増加 | 削減 |
| INP（翻訳操作） | 数秒〜数十秒 | 数百ms以下 |

## 注意

- 手動テスト「Show Translation をクリックすると投稿内容が英語に翻訳されること」は引き続き動作する
- Google翻訳の非公式APIのため、レート制限に達した場合は 500 を返す
