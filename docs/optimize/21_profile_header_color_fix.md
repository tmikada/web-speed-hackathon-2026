# 21. プロフィールヘッダー色抽出の修正

## 問題

ユーザープロフィールページ上部のヘッダーが、ユーザーサムネイル画像から抽出した色にならない問題。

## 原因

`UserProfileHeader.tsx` で動的な Tailwind クラスを使用していた:

```tsx
className={`h-32 ${averageColor ? `bg-[${averageColor}]` : "bg-cax-surface-subtle"}`}
```

Tailwind v4 はビルド時にソースコードをスキャンしてCSSを生成する。`bg-[${averageColor}]` のようにランタイムで決まる文字列を含むクラス名は、ビルド時に静的解析できないためCSSが生成されず、色が適用されない。

## 対応

動的 Tailwind クラスをインラインスタイルに変更する。

**ファイル**: `application/client/src/components/user_profile/UserProfileHeader.tsx`

```tsx
// Before
<div
  className={`h-32 ${averageColor ? `bg-[${averageColor}]` : "bg-cax-surface-subtle"}`}
></div>

// After
<div
  className={`h-32 ${!averageColor ? "bg-cax-surface-subtle" : ""}`}
  style={averageColor ? { backgroundColor: averageColor } : undefined}
></div>
```

## 影響範囲

- `application/client/src/components/user_profile/UserProfileHeader.tsx` のみ
- レギュレーション違反なし（見た目の復元のみ）
- VRT に影響あり（修正前は色が出ていなかったため、修正後に通るようになる）

## 検証

- プロフィールページ（例: `/users/o6yq16leo`）でヘッダー色が変わることを確認
- E2E: `application/e2e/src/user-profile.test.ts` の「ページ上部がユーザーサムネイル画像の色を抽出した色になっている」テストが通ることを確認
