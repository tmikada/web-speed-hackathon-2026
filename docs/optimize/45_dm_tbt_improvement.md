# 45. DM詳細ページ TBT改善

## 問題

「DM詳細ページを開く」のTBTスコアがクラウド環境で0点（TBT > 600ms）。
ローカルでは0.69（TBT ~300ms）だが、クラウドの4xCPUスロットリングにより~1200msに膨らむ。

## 原因分析

### ページロードTBT

`loadConversation()` でAPIレスポンス取得後、`setConversation(data)` が全メッセージリストを**同期レンダリング**するため長タスクが発生する。

```tsx
// 変更前: 同期レンダリング → 長タスク → TBT増加
setConversation(data);
setConversationError(null);
```

また `sendRead()` がマウント直後にPOSTリクエストを発行し、TTIウィンドウ内でのメインスレッド作業を増やしていた。

### インタラクションTBT（補足）

`handleChange` がキーストロークごとに `sendJSON` POST を発火し、DM送信フローのTBT/INPに影響する（別途改善予定）。

## 対応内容

### 変更ファイル

`application/client/src/containers/DirectMessageContainer.tsx`

### 1. `startTransition` でメッセージリストのレンダリングを非緊急化

React 19のconcurrent modeでは `startTransition` 内の更新が5msチャンク単位に分割される。
50ms超の長タスクがTBTに計上されなくなるため、メッセージ一覧レンダリングが大幅に改善される。

```tsx
// 変更後
startTransition(() => {
  setConversation(data);
  setConversationError(null);
});
```

### 2. `sendRead` を `setTimeout(0)` で遅延実行

既読マーク送信はFCP/LCP/TTIに不要な副作用。
初期レンダリング完了後に遅延実行することでTTIウィンドウ内のタスクを削減。

```tsx
// 変更前
void sendRead();

// 変更後
setTimeout(() => {
  void sendRead();
}, 0);
```

---

### 3. `InfiniteScroll.tsx` — resize リスナーを passive に

**ファイル**: `application/client/src/components/foundation/InfiniteScroll.tsx`

**問題**:
- `resize` イベントリスナーが `passive: true` なしで登録されていた
- ブラウザはリスナーが `preventDefault()` を呼ぶ可能性があると判断し、スクロール最適化を制限

**修正**:

```ts
// Before
document.addEventListener("resize", handler);

// After
document.addEventListener("resize", handler, { passive: true });
```

**効果**: ブラウザのスクロール最適化が有効になり、resize 発火時のメインスレッドブロッキングを低減。全ページ（タイムライン・投稿詳細等）に効果あり。

---

## 期待効果まとめ

| 変更 | 効果 |
|------|------|
| `startTransition` | メッセージ一覧レンダリングを短タスク群に分割 → TBT直接削減 |
| `sendRead` 遅延 | TTIウィンドウ外に移動 → TBT間接削減 |
| `InfiniteScroll` passive resize | ブラウザスクロール最適化を有効化 → 全ページTBT改善 |

## 計測コマンド

```bash
cd scoring-tool
pnpm start --applicationUrl http://localhost:3000 --targetName 'DM詳細ページを開く'
```
