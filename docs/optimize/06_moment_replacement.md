# 06: moment.js の軽量代替への置き換え

## 問題

日付フォーマットに `moment` (minified: ~67KB) を使用しているが、実際の用途は日本語ロケールでの日付表示のみ。
`moment` はロケールデータを含む大きなライブラリで、この用途には過剰。

### 使用箇所

- `TimelineItem.tsx`
- `PostItem.tsx`
- `CommentItem.tsx`
- `DirectMessageListPage.tsx`
- `DirectMessagePage.tsx`
- `UserProfileHeader.tsx`

### 現在の使い方

```typescript
import moment from "moment";
import "moment/locale/ja";

moment(date).locale("ja").format("LL")  // 例: "2026年3月20日"
```

## 対応方針

ネイティブの `Intl.DateTimeFormat` API を使用する。追加パッケージ不要でバンドルサイズ削減効果が最大。

### 変更内容

```typescript
// 変更前
import moment from "moment";
import "moment/locale/ja";

const formatted = moment(date).locale("ja").format("LL");
// → "2026年3月20日"

// 変更後: Intl.DateTimeFormat を使用（ゼロバイト追加）
const formatted = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
}).format(new Date(date));
// → "2026年3月20日"
```

### ユーティリティ関数として共通化

複数コンポーネントで使用しているため、共通ユーティリティとして切り出す。

```typescript
// application/client/src/utils/format_date.ts（新規作成）
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatDate(date: string | Date): string {
  return dateFormatter.format(new Date(date));
}
```

各コンポーネントでは:

```typescript
// 変更前
import moment from "moment";
// ...
moment(post.createdAt).locale("ja").format("LL")

// 変更後
import { formatDate } from "../../utils/format_date";
// ...
formatDate(post.createdAt)
```

## 変更箇所

- [application/client/src/utils/format_date.ts](../../application/client/src/utils/format_date.ts) — 新規作成（共通ユーティリティ）
- 各コンポーネントの `moment` インポートを `formatDate` に置き換え:
  - `application/client/src/features/timeline/TimelineItem.tsx`
  - `application/client/src/features/post/PostItem.tsx`
  - `application/client/src/features/comment/CommentItem.tsx`
  - `application/client/src/features/direct-message/DirectMessageListPage.tsx`
  - `application/client/src/features/direct-message/DirectMessagePage.tsx`
  - `application/client/src/features/user/UserProfileHeader.tsx`

## 期待効果

- **バンドルサイズ削減**: ~67KB (minified) → 0 byte（ネイティブ API）
- `moment/locale/ja` も不要になり追加で削減
- **Lighthouse スコア**: TBT（JS 解析コスト削減）に貢献

## 注意事項

- `Intl.DateTimeFormat` はモダンブラウザで完全サポート（Node.js 12+, Chrome 24+, Firefox 29+）
- フォーマット結果が `moment` と完全に一致するか VRT で確認する
  - `moment("2026-03-20").locale("ja").format("LL")` → `"2026年3月20日"`
  - `new Intl.DateTimeFormat("ja-JP", {...}).format(new Date("2026-03-20"))` → `"2026年3月20日"`（一致する）
- もし別のフォーマット（"LLL" = 時刻含む など）を使用している箇所があれば個別に対応
