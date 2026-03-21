# 05: React マウントの遅延解消

## 問題

`application/client/src/index.tsx` で React のマウントを `load` イベントに紐づけている。

```typescript
// 現状
window.addEventListener("load", () => {
  createRoot(document.getElementById("app")!).render(...);
});
```

`load` イベントは**ページ内の全リソース（画像・動画・フォント等）の読み込み完了後**に発火する。
これにより、HTML が届いてから React がマウントされるまでに大きなタイムラグが生じる。

**影響するメトリクス:**
- **FCP** (First Contentful Paint): React のコンテンツが遅れて表示される
- **LCP** (Largest Contentful Paint): メインコンテンツの表示が load イベント以降にずれる
- **CLS** (Cumulative Layout Shift): 遅いマウントによるレイアウトシフト

## 対応方針

`load` イベントを削除し、スクリプトが実行された時点で即座に React をマウントする。

### 変更内容

```typescript
// 変更前
window.addEventListener("load", () => {
  createRoot(document.getElementById("app")!).render(
    <Provider store={store}>
      <BrowserRouter>
        <AppContainer />
      </BrowserRouter>
    </Provider>,
  );
});

// 変更後: 即時実行
createRoot(document.getElementById("app")!).render(
  <Provider store={store}>
    <BrowserRouter>
      <AppContainer />
    </BrowserRouter>
  </Provider>,
);
```

### スクリプトタグの位置確認

即時実行にする場合、`<div id="app">` が DOM に存在している必要がある。

- スクリプトタグが `<body>` の末尾にある場合 → 問題なし（`defer` 属性でも OK）
- スクリプトタグが `<head>` にある場合 → `defer` 属性が必要

`index.html` の確認が必要:

```html
<!-- パターン1: body末尾 → そのまま即時実行OK -->
<body>
  <div id="app"></div>
  <script src="scripts/main.js"></script>
</body>

<!-- パターン2: head内 → defer を付ける -->
<head>
  <script defer src="scripts/main.js"></script>
</head>
```

## 変更箇所

- [application/client/src/index.tsx](../../application/client/src/index.tsx)
  - `window.addEventListener("load", () => { ... })` → 即時実行に変更

## 期待効果

- **FCP**: DOMContentLoaded 後すぐに React コンテンツが表示される
- **LCP**: メインコンテンツがずっと早く表示される
- Lighthouse 全 5 指標（FCP/SI/LCP/TBT/CLS）に改善効果

## 注意事項

- `document.getElementById("app")` が `null` にならないよう、DOM の準備ができた後に実行されることを確認
- 既存コードが `load` イベントのタイミングに依存していないか確認（例: `window.onload` を別途使っているコンポーネントがないか）
- VRT 実行で表示内容に変化がないことを確認
