# 15. サインインモーダル表示失敗の修正

## 問題

スコア計測ツール（scoring-tool）が DM 一覧ページ・Crok ページ・ユーザー認証フローなど複数のページで「サインインモーダルの表示に失敗しました」エラーで失敗していた。

## 原因

サインインボタンのモーダル開閉に **Invoker Commands API** (`command`/`commandfor` 属性) のみを使用しており、JavaScript のフォールバックが存在しなかった。

```tsx
// NavigationItem.tsx — 変更前
<button
  command={command}       // "show-modal"
  commandfor={commandfor} // useId() が生成した ":r0:" 等のID
>
```

問題は2点：

1. **`useId()` が生成する ID に `:` が含まれる**
   React の `useId()` は `:r0:` のような形式のIDを返す。Chrome の `commandfor` 実装が内部的に CSS セレクタ形式でID検索を行う場合、`:r0:` は CSS pseudo-class として解釈されターゲット dialog が見つからない。

2. **Chrome バージョン依存**
   scoring-tool は `channel: "chrome"`（システムChrome）を使用する。Invoker Commands API は Chrome 135 以降でサポートのため、それ未満では API 自体が機能しない。

どちらの場合もボタンクリック時に何も起きないため、モーダルが開かず 10 秒タイムアウトで失敗していた。

## 対応

### 1. `useId()` を固定文字列IDに置き換え

**`application/client/src/containers/AppContainer.tsx`**

```tsx
// 変更前
const authModalId = useId();
const newPostModalId = useId();

// 変更後
const authModalId = "auth-modal";
const newPostModalId = "new-post-modal";
```

特殊文字を含まない安定したIDにすることで、`commandfor` の ID 解決問題を解消。モーダルはアプリ内で各1インスタンスのみなのでID衝突は発生しない。

### 2. `onClick` フォールバックを追加

**`application/client/src/components/application/NavigationItem.tsx`**

```tsx
// 変更後
<button
  command={command}
  commandfor={commandfor}
  onClick={() => {
    if (commandfor) {
      const el = document.getElementById(commandfor) as HTMLDialogElement | null;
      if (el && !el.open) el.showModal();
    }
  }}
>
```

Invoker Commands API が未対応のブラウザでも `showModal()` を直接呼び出すことで動作を保証。`!el.open` チェックにより、API がネイティブ動作する場合の二重呼び出しを防止。

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `application/client/src/containers/AppContainer.tsx` | `useId()` → 固定文字列ID、`useId` import 削除 |
| `application/client/src/components/application/NavigationItem.tsx` | `onClick` フォールバック追加 |
