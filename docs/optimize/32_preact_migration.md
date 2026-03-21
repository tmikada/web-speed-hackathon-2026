# 32. Preact への移行

## 目的

`vendor-react.js` が全ページで同期読み込みされ、JavaScript の評価時間を 2,200ms 占有していた（Lighthouse "JavaScript の実行にかかる時間の低減 — 2.2 秒"）。react + react-dom (~130KB gzip) を preact + preact/compat (~13KB gzip) に置き換えてバンドルサイズと TBT を削減する。

## 変更内容

### 1. `application/client/package.json`

`preact@10.26.6` を追加。`react`/`react-dom` は react-router など外部ライブラリの peerDep 解決のために残す。

### 2. `application/client/webpack.config.js`

`resolve.alias` に preact/compat へのリダイレクトを追加。サブパス（`react-dom/client` など）はワイルドカード（`react-dom`）より先に定義することで優先マッチさせる。

```js
"react/jsx-runtime":   path.resolve(__dirname, "node_modules/preact/jsx-runtime"),
"react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/preact/jsx-runtime"),
"react-dom/test-utils": path.resolve(__dirname, "node_modules/preact/test-utils"),
"react-dom/client":    path.resolve(__dirname, "node_modules/preact/compat/client"),
"react-dom":           path.resolve(__dirname, "node_modules/preact/compat"),
"react":               path.resolve(SRC_PATH, "./shims/react-compat.js"),
```

`optimization.splitChunks.cacheGroups.react.test` を更新:

```js
// before: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/
test: /[\\/]node_modules[\\/](preact|react-router|scheduler)[\\/]/,
```

### 3. `application/client/src/shims/react-compat.js`（新規作成）

`React.use()` は React 19 限定の実験的 API で preact/compat に存在しない。react-router v7・react-helmet がこれを使用するため、`useContext` への委譲ポリフィルを実装。

**重要な発見**: preact の `createContext` は `typeof ctx === 'function'` を返す（オブジェクトではない）。`typeof resource === 'object'` だけでは context を検出できないため `|| typeof resource === 'function'` が必要。

```js
const preactCompat = require('preact/compat');

function use(resource) {
  if (resource != null && (typeof resource === 'object' || typeof resource === 'function')) {
    if ('Provider' in resource && 'Consumer' in resource) {
      return preactCompat.useContext(resource);
    }
    if (typeof resource.then === 'function') {
      throw resource;
    }
  }
  return resource;
}

module.exports = { ...preactCompat, use };
```

### 4. `application/client/src/hooks/use_ws.ts`

`useEffectEvent` は React 19 実験的 API。preact/compat に存在しないため `useRef` パターンに置き換え。

```ts
// before
const handleMessage = useEffectEvent((event: MessageEvent) => {
  onMessage(JSON.parse(event.data));
});

// after
const onMessageRef = useRef(onMessage);
onMessageRef.current = onMessage;
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    onMessageRef.current(JSON.parse(event.data) as T);
  };
  // ...
}, [url]);
```

### 5. `application/client/src/components/modal/Modal.tsx`

preact では `forwardRef` なし関数コンポーネントに `ref` を渡すと、DOM 要素ではなく内部オブジェクトが `ref.current` に入る。`<dialog>` への ref 転送のために `forwardRef` でラップ。

```tsx
export const Modal = forwardRef<HTMLDialogElement, Props>(({ className, children, ...props }, ref) => {
  return <dialog ref={ref} ...>{children}</dialog>;
});
```

## トラブルシューティング（遭遇したエラーと原因）

| エラー | 原因 | 修正 |
|--------|------|------|
| `n.use is not a function` | preact/compat が `React.use()` を export していない | react-compat.js シムで `use()` ポリフィルを追加 |
| `e.update is not a function` (1回目) | シムの context 検出が `typeof === 'object'` のみで、function 型の preact context を見逃した | `\|\| typeof resource === 'function'` を追加 |
| `e.addEventListener is not a function` | `Modal` が forwardRef を使っておらず `ref.current` が DOM 要素にならない | `forwardRef` でラップ |

## 期待効果

- `vendor-react` チャンクサイズ: ~130KB → ~13KB (gzip)
- JavaScript 評価時間: 2,200ms → 大幅削減
- TBT スコア改善 → 全9ページで得点向上
