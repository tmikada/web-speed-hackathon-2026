# 44. React パフォーマンス最適化（CRITICAL / HIGH）

## 概要

React コンポーネント・カスタムフックのパフォーマンスボトルネックを修正。
主に TBT（Total Blocking Time）と INP（Interaction to Next Paint）への改善を狙う。

---

## 対応内容

### 🔴 CRITICAL — TBT直撃

#### 1. `use_search_params.ts` — 1msポーリング廃止

**ファイル**: `application/client/src/hooks/use_search_params.ts`

**問題**:
- `scheduler.postTask(poll, { priority: "user-blocking", delay: 1 })` が毎ミリ秒実行
- UIスレッドを常時ブロックし、TBTを大幅に悪化させていた

**修正**:
- `history.pushState` / `history.replaceState` をインターセプトして変更を検知
- `popstate` イベント（ブラウザバック/フォワード）も合わせて購読
- ポーリングを完全廃止

```ts
// Before
scheduler.postTask(poll, { priority: "user-blocking", delay: 1 });

// After
history.pushState = (...args) => { originalPushState(...args); handler(); };
history.replaceState = (...args) => { originalReplaceState(...args); handler(); };
window.addEventListener("popstate", handler);
```

> **注意**: `popstate` だけでは `navigate()` による `pushState` を検知できないため、
> `pushState`/`replaceState` のインターセプトが必要。

---

#### 2. `DirectMessagePage.tsx` — 1ms setInterval廃止

**ファイル**: `application/client/src/components/direct_message/DirectMessagePage.tsx`

**問題**:
- `setInterval(..., 1)` + `window.getComputedStyle(document.body)` が毎ミリ秒実行
- ブラウザのレイアウト計算を毎ミリ秒強制し、TBTを大幅に悪化させていた

**修正**:
- `ResizeObserver` でbodyのサイズ変化を監視する方式に置換
- `document.body.scrollHeight` で直接取得（getComputedStyle不要）

```ts
// Before
setInterval(() => {
  const height = Number(window.getComputedStyle(document.body).height.replace("px", ""));
  ...
}, 1);

// After
const observer = new ResizeObserver(() => {
  const height = document.body.scrollHeight;
  ...
});
observer.observe(document.body);
```

---

### 🟠 HIGH — 再レンダリング削減

#### 3. `SoundPlayer.tsx` — timeupdate による高頻度 setState 廃止

**ファイル**: `application/client/src/components/foundation/SoundPlayer.tsx`

**問題**:
- 音声再生中、`onTimeUpdate` が毎秒数回 `setCurrentTimeRatio()` を呼ぶ
- 毎回 React の再レンダリングが発生し、INP・TBT を悪化させていた

**修正**:
- `currentTimeRatio` stateを削除
- オーバーレイdivに `overlayRef` を付与
- `handleTimeUpdate` 内で直接 `style.left` を更新（React外のDOM操作）

```tsx
// Before
const [currentTimeRatio, setCurrentTimeRatio] = useState(0);
setCurrentTimeRatio(el.currentTime / el.duration);
// JSX: style={{ left: `${currentTimeRatio * 100}%` }}

// After
const overlayRef = useRef<HTMLDivElement>(null);
overlayRef.current.style.left = `${ratio * 100}%`;
// JSX: ref={overlayRef} style={{ left: "0%" }}
```

---

#### 4. `InfiniteScroll.tsx` — fetchMore依存によるリスナー再登録を抑制

**ファイル**: `application/client/src/components/foundation/InfiniteScroll.tsx`

**問題**:
- `useEffect` のdepsに `fetchMore` が含まれていた
- データフェッチのたびに親コンポーネントが再レンダリングされ `fetchMore` の参照が変わる
- その結果、wheel/touchmove/resize/scroll の4つのリスナーが毎回登録し直されていた

**修正**:
- `fetchMoreRef` を導入し最新の `fetchMore` を常にrefで保持
- `useEffect` のdepsから `fetchMore` を除外

```ts
// Before
}, [latestItem, fetchMore]);

// After
const fetchMoreRef = useRef(fetchMore);
useEffect(() => { fetchMoreRef.current = fetchMore; }, [fetchMore]);
// 内部で fetchMoreRef.current() を呼ぶ
}, [latestItem]); // fetchMore除外
```

---

## 期待される効果

| 修正 | 指標 | 効果 |
|------|------|------|
| use_search_params 1msポーリング廃止 | TBT | 大幅改善（全ページ常時発生していたブロッキング解消） |
| DirectMessagePage 1ms setInterval廃止 | TBT | DM閲覧ページのブロッキング解消 |
| SoundPlayer setState廃止 | INP / TBT | 音声再生中の再レンダリング完全排除 |
| InfiniteScroll リスナー安定化 | TBT | スクロールイベント処理の軽量化 |
