# 38. サインインフロー失敗デバッグ

## 問題

スコアリングツール実行時に「サインインに失敗しました」エラーが発生。
`calculate_post_flow_action.ts:71` で `getByRole('link', { name: 'マイページ' })` の waitFor が 10 秒タイムアウト。

## 調査ログ

### 試した修正①: bcrypt 非同期化（効果なし）

**仮説**: `auth.ts` で `bcrypt.compareSync`（同期）を使用していたため、Lighthouse + Playwright 負荷時にイベントループをブロックしてサインイン API レスポンスが遅延する。

**修正内容**: `application/server/src/routes/api/auth.ts`
```typescript
// 変更前
const isValid = user.validPassword(req.body.password); // bcrypt.compareSync 使用

// 変更後
const isValid = await bcrypt.compare(req.body.password, user.getDataValue("password"));
```

**結果**: 効果なし。根本原因は別にある。

### 調査結果

- DB の `o6yq16leo` のパスワードは `$2b$08$...` で bcrypt ハッシュ済み ✓
- `initializeSequelize` は既存 SQLite ファイルをコピーするだけ（bulkCreate はここでは呼ばれない）✓
- 手動ブラウザ操作ではサインインが正常に動作し `マイページ` リンクが表示される ✓
- 問題は Playwright 自動操作に特有

### 試した修正②: toggle イベントハンドラの修正（未検証で中断）

**仮説**: `AuthModalContainer` のダイアログ `toggle` イベントハンドラが、ダイアログを「開く」ときにもフォームをリセットしており、Playwright のタイピングと競合している。

**問題の流れ**:
1. Playwright が「サインイン」ナビボタンをクリック → `showModal()` → ダイアログが同期で開く
2. Playwright の `waitFor` がヘッダー「サインイン」を検出 → resolve
3. **この直後に** `toggle` イベントが非同期で発火 → `setResetKey(key+1)` → `AuthModalPage` がリマウント → フォームが空にリセット
4. Playwright がユーザー名の入力を開始するが、入力欄がデタッチ済み or リセット済み
5. React ステート（username, password）が正しく更新されない → バリデーション失敗 → API が呼ばれない
6. `マイページ` リンクが出ない → 10 秒タイムアウト → 「サインインに失敗しました」

**修正内容**: `application/client/src/containers/AuthModalContainer.tsx`
```typescript
// 変更前: 開閉両方でリセット
const handleToggle = () => {
  setResetKey((key) => key + 1);
};

// 変更後: ダイアログが「閉じた」ときのみリセット
const handleToggle = () => {
  if (!element.open) {
    setResetKey((key) => key + 1);
  }
};
```

**状態**: 実装済みだが、スコアリングツールでの検証前に中断。

## 現在の状態

| 修正 | ファイル | 状態 |
|------|----------|------|
| bcrypt 非同期化 | `server/src/routes/api/auth.ts` | 適用済み（効果なし） |
| toggle ハンドラ修正 | `client/src/containers/AuthModalContainer.tsx` | 適用済み・**検証完了・解決** |

## Chrome DevTools MCP 検証結果（2026-03-21）

### toggle イベントの挙動確認
- `showModal()` 後に toggle イベントが発火: `{ dialogOpen: true, newState: "open", oldState: "closed" }`
- `element.open === true` → `if (!element.open)` の条件が false → `setResetKey` は呼ばれない ✓
- フォームは再マウントされず、入力内容がリセットされない ✓

### サインインフロー全体の動作確認
1. モーダルを開く → toggle イベントで reset なし ✓
2. ユーザー名 `o6yq16leo` をキーボード入力 → DOM 値・React state 正確 ✓
3. パスワード `wsh-2026` をキーボード入力 → DOM 値・React state 正確 ✓
4. submit ボタンをクリック → `POST /api/v1/signin [200]` ✓
5. ナビゲーションに「マイページ」リンクが表示される ✓

**結論: toggle fix により問題は解決済み。スコアリングツールでの動作確認を推奨。**

## 参考: スコアリングツールのサインインフロー

```typescript
// calculate_post_flow_action.ts
await signinButton.click();                                          // モーダル開く
await dialog.getByRole("heading", { name: "サインイン" }).waitFor(); // 表示待ち
await usernameInput.pressSequentially("o6yq16leo");                  // 遅延なし
await passwordInput.pressSequentially("wsh-2026");                   // 遅延なし
await submitButton.click();
await page.getByRole("link", { name: "マイページ" }).waitFor({ timeout: 10_000 });
```

`calculate_user_auth_flow_action.ts` では `{ delay: 10 }` が指定されているが、`calculate_post_flow_action.ts` では指定なし（遅延 0ms）。
