# 46. DM一覧ページ TBT改善

## 問題

DM一覧ページ（/dm）の TBT スコアが低い。

## 原因分析

計測シナリオはサインイン済み状態で `/dm` に遷移する。`DirectMessageListPage` は `/api/v1/dm` でデータ取得中（`conversations === null`）の間 `return null` していたため、コンテンツが一切表示されない状態が続いていた。

```
/api/v1/dm 返却
  → setConversations(data)        ← ここで初めてコンテンツが表示（FCP）
  → 会話リスト全体をレンダリング  ← FCP直後に大きな同期タスク → TBT!
```

FCP と同じタイミングで大量の DOM 生成が走るため、TBT に計上されていた。

## 対応内容

### 変更ファイル

`application/client/src/components/direct_message/DirectMessageListPage.tsx`

### 変更内容

`conversations == null` の間もヘッダー部分を描画するスケルトン状態を導入した。

```tsx
// 変更前
if (conversations == null) {
  return null;
}
```

```tsx
// 変更後
if (conversations == null) {
  return (
    <section>
      <header className="border-cax-border flex flex-col gap-4 border-b px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold">ダイレクトメッセージ</h1>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            command="show-modal"
            commandfor={newDmModalId}
            leftItem={<FontAwesomeIcon iconType="paper-plane" styleType="solid" />}
          >
            新しくDMを始める
          </Button>
        </div>
      </header>
    </section>
  );
}
```

### 修正後のフロー

```
AppContainer マウント
  → DirectMessageListPage マウント → ヘッダー描画 ← FCP（早い）
  → /api/v1/dm 取得中...
  → 取得完了 → 会話リスト追加描画（ヘッダー下に追加のみ）
  → TTI
```

FCP がヘッダー表示時点に前倒しされ、会話リストのレンダリングが FCP〜TTI 窓の後半または窓外にずれることで TBT が削減される。

## 影響範囲

- **他ページへの影響**: ゼロ（DM一覧ページのみの変更）
- **CLS**: ヘッダーは固定、会話リストはその下に追加されるだけなので CLS は発生しない

## 計測コマンド

```bash
cd scoring-tool
pnpm start --applicationUrl http://localhost:3000 --targetName 'DM一覧ページを開く'
```
