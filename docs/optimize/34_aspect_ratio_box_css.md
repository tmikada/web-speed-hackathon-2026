# 34. AspectRatioBox を CSS aspect-ratio に置換

## 目的

`AspectRatioBox` が JS + リサイズリスナー + `setTimeout(500)` でアスペクト比を計算していた。CSS の `aspect-ratio` プロパティで同等の機能を実現し、TBT・CLS・LCP を改善する。

## 原因

```ts
// 修正前
useEffect(() => {
  function calcStyle() {
    const clientWidth = ref.current?.clientWidth ?? 0;
    setClientHeight((clientWidth / aspectWidth) * aspectHeight);
  }
  setTimeout(() => calcStyle(), 500);  // 500ms 遅延
  window.addEventListener("resize", calcStyle, { passive: false });  // ブロッキング
  ...
}, [aspectHeight, aspectWidth]);

// 高さが計算できるまで子要素を非表示
{clientHeight !== 0 ? <div className="absolute inset-0">{children}</div> : null}
```

問題点：
- `passive: false` のリサイズリスナーがメインスレッドをブロック
- マウント後 500ms 間、子要素（波形SVGなど）が非表示になる → LCP/CLS に悪影響
- 不要な `useState` + `useEffect` + `useRef` のコスト

## 変更内容

### `application/client/src/components/foundation/AspectRatioBox.tsx`

```tsx
// 修正後
export const AspectRatioBox = ({ aspectHeight, aspectWidth, children }: Props) => {
  return (
    <div className="relative w-full" style={{ aspectRatio: `${aspectWidth} / ${aspectHeight}` }}>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
};
```

CSS の `aspect-ratio` プロパティはすべてのモダンブラウザ（Chrome 88+, Firefox 89+, Safari 15+）でサポート済み。

## 効果

| 指標 | 修正前 | 修正後 |
|------|--------|--------|
| リサイズリスナー | passive:false（ブロッキング） | なし |
| 子要素の表示タイミング | マウントから500ms後 | 即時 |
| JS実行コスト | useState + useEffect + setTimeout | 0 |
| CLS | 高さが後から確定するためずれが発生 | レイアウト確定済み |
