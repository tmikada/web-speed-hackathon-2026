# 40. タイムライン翻訳ボタンのナビゲーション誤遷移修正

## 問題

タイムライン上の「Show Translation」ボタンをクリックすると、翻訳される代わりに投稿詳細ページ (`/posts/:postId`) に遷移してしまっていた。

**原因:**
`TimelineItem` は `<article onClick={handleClick}>` で投稿全体をクリック可能にしており、ボタン/リンクのクリックは `isClickedAnchorOrButton()` で除外している。しかし `TranslatableText.handleClick` がイベントオブジェクトを受け取っておらず `e.stopPropagation()` を呼んでいないため、クリックイベントが `article` まで伝播し、ナビゲーションが実行されていた。

## 対応

`TranslatableText.tsx` の `handleClick` にイベント引数を追加し、`e.stopPropagation()` を呼ぶように修正。

```tsx
// 変更前
const handleClick = useCallback(() => {
  switch (state.type) { ... }
}, [state]);

// 変更後
const handleClick = useCallback((e: { stopPropagation(): void }) => {
  e.stopPropagation();
  switch (state.type) { ... }
}, [state]);
```

型は `React.MouseEvent` ではなく最小限の構造型 `{ stopPropagation(): void }` を使用し、`import React` を不要にした（バンドルへの影響ゼロ）。

## 変更ファイル

| ファイル | 変更 |
|----------|------|
| `application/client/src/components/post/TranslatableText.tsx` | `handleClick` に `e.stopPropagation()` 追加 |

## 確認項目

- タイムラインで「Show Translation」をクリック → ページ遷移しない
- 翻訳テキストが表示される
- 「Show Original」をクリック → 元テキストに戻る
- 投稿の他の箇所をクリック → 投稿詳細ページに遷移する（既存動作を維持）
