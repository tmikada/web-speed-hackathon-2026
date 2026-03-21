# 37. Button Invoker Commands API ポリフィル

## 問題

スコアリングツール（Playwright 1.56.0）の DM フロー計測で、「新しくDMを始める」ボタンをクリックしてもモーダルが開かず、タイムアウトエラーが発生していた。

```
ERROR  locator.waitFor: Timeout 10000ms exceeded.
waiting for getByRole('heading', { name: '新しくDMを始める' }) to be visible
新しくDMを始めるモーダルの表示に失敗しました
```

## 根本原因

`DirectMessageListPage.tsx` の「新しくDMを始める」ボタンは、HTML Invoker Commands API の `command`/`commandfor` 属性を使って `<dialog>` を開く実装になっていた。

```tsx
<Button command="show-modal" commandfor={newDmModalId}>
  新しくDMを始める
</Button>
```

この API は **Chrome 135+（2025年4月）** から対応しているが、Playwright 1.56.0 がバンドルする Chromium は **~v131** であり、ネイティブサポートがない。そのため、ボタンをクリックしても `showModal()` が呼ばれずモーダルが開かなかった。

### 既存の正常動作との比較

`NavigationItem.tsx` では同じ `commandfor` props を受け取り、明示的な `onClick` ハンドラで `el.showModal()` を呼ぶ JS 実装になっていたため正常動作していた。

```tsx
// NavigationItem.tsx（動作していた）
onClick={() => {
  if (commandfor) {
    const el = document.getElementById(commandfor) as HTMLDialogElement | null;
    if (el && !el.open) el.showModal();
  }
}}
```

## 修正内容

`Button.tsx` に `command`/`commandfor` を検知して `showModal()` / `close()` を呼ぶポリフィルを追加した。

**修正ファイル**: `application/client/src/components/foundation/Button.tsx`

```tsx
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  const command = (props as Record<string, unknown>)["command"] as string | undefined;
  const commandfor = (props as Record<string, unknown>)["commandfor"] as string | undefined;
  if (commandfor) {
    const el = document.getElementById(commandfor) as HTMLDialogElement | null;
    if (el) {
      if (command === "show-modal" && !el.open) el.showModal();
      else if (command === "close" && el.open) el.close();
    }
  }
  onClick?.(e);
};
```

## 影響範囲

`<Button command="..." commandfor="...">` を使っている全箇所が一括修正される:

| ファイル | command | 用途 |
|---|---|---|
| `DirectMessageListPage.tsx` | `show-modal` | 新規DM開始モーダル |
| `NewDirectMessageModalPage.tsx` | `close` | DM開始モーダルを閉じる |
| `CoveredImage.tsx` | `show-modal` / `close` | 画像拡大モーダル |
| `Navigation.tsx` / `CrokGate.tsx` / `DirectMessageGate.tsx` | `show-modal` | 認証モーダル・新規投稿モーダル |

## 効果

- スコアリングの DM フローが正常に計測できるようになった（操作スコア 250点 中の対象）
- `command`/`commandfor` を使う全ての Button が Chromium 131 以降で動作するようになった
