# 33. InfiniteScroll の Array(2^18) バグ修正

## 目的

Lighthouse の「メインスレッド処理の最小化」で **Garbage Collection が 805ms** 計測されていた。原因は `InfiniteScroll.tsx` 内のスクロール判定ロジックで、スクロールイベントのたびに 2^18 = 262,144 要素の配列を生成・破棄していたため。

## 原因

```ts
// 修正前
const hasReached = Array.from(Array(2 ** 18), () => {
  return window.innerHeight + Math.ceil(window.scrollY) >= document.body.offsetHeight;
}).every(Boolean);
```

262,144 要素すべてが同じ値を返す（スクロール位置は1回の呼び出し中に変わらない）ため、配列生成は完全に無意味。`wheel` / `touchmove` / `scroll` イベントのたびに実行されるため、スクロール中は連続してGCが走る。

また、イベントリスナーがすべて `{ passive: false }` だったため、ブラウザがスクロールを開始する前にハンドラの完了を待つ必要があり、スクロール性能も低下していた。

## 変更内容

### `application/client/src/components/foundation/InfiniteScroll.tsx`

```ts
// 修正後
const hasReached = window.innerHeight + Math.ceil(window.scrollY) >= document.body.offsetHeight;
```

```ts
// イベントリスナーを passive: true に変更
document.addEventListener("wheel", handler, { passive: true });
document.addEventListener("touchmove", handler, { passive: true });
document.addEventListener("resize", handler);
document.addEventListener("scroll", handler, { passive: true });
```

## 効果

| 指標 | 修正前 | 修正後（期待値） |
|------|--------|---------------|
| Garbage Collection | ~805ms | ~0ms |
| メインスレッド処理合計 | ~3.8秒 | ~3.0秒以下 |
| スクロール性能 | passive:false（ブロッキング） | passive:true（ノンブロッキング） |
