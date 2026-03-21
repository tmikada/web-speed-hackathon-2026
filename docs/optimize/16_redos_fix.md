# 16. ReDoS・正規表現パフォーマンス修正

## 概要

検索クエリ解析とパスワードバリデーションに存在する危険な正規表現を修正。
ネスト量詞（catastrophic backtracking）によるReDoSと、Unicode v-flagの集合演算コストを除去する。

## 問題箇所と修正内容

### 1. `application/client/src/search/services.ts` — `sincePattern` / `untilPattern`

**問題:** ネスト量詞 `((...)+)+` によるReDoS

```ts
// 修正前（危険）
const sincePattern = /since:((\d|\d\d|\d\d\d\d-\d\d-\d\d)+)+$/;
const untilPattern = /until:((\d|\d\d|\d\d\d\d-\d\d-\d\d)+)+$/;

// 修正後
const sincePattern = /since:(\d{4}-\d{2}-\d{2})/;
const untilPattern = /until:(\d{4}-\d{2}-\d{2})/;
```

`since:12345` のような不正入力で指数的バックトラッキングが発生していた。
`sinceMatch[1]` は後続の `extractDate()` で再度 `YYYY-MM-DD` を抽出するため、動作への影響なし。

### 2. `application/client/src/search/services.ts` — `isValidDate()`

**問題:** 変数名自体が `slowDateLike` と宣言されているネスト量詞パターン

```ts
// 修正前（危険）
const slowDateLike = /^(\d+)+-(\d+)+-(\d+)+$/;
if (!slowDateLike.test(dateStr)) return false;

// 修正後
const dateLike = /^\d+-\d+-\d+$/;
if (!dateLike.test(dateStr)) return false;
```

各セグメントの `(\d+)+` で `1111111111-1111111111-1111` のような入力で指数的バックトラッキングが発生していた。

### 3. `application/client/src/auth/validation.ts` — パスワードバリデーション

**問題①:** Unicode v-flag の集合演算（`&&`）によるパフォーマンスコスト

**問題②:** `{16,}` により16文字以上のみ記号チェックが動作していたが、仕様はすべての長さが対象

```ts
// 修正前（v-flagの集合演算、かつ16文字以上のみ対象という仕様バグ）
if (/^[^\P{Letter}&&\P{Number}]{16,}$/v.test(normalizedPassword)) {
  errors.password = "パスワードには記号を含める必要があります";
}

// 修正後（u-flagに変更、全長さを対象に）
if (normalizedPassword.length > 0 && /^[\p{Letter}\p{Number}]+$/u.test(normalizedPassword)) {
  errors.password = "パスワードには記号を含める必要があります";
}
```

パスワードポリシー:
- **全長さ**: 記号（非文字・非数字）を含む必要あり（空文字は別チェックで対応済み）

`[\p{Letter}\p{Number}]` は `[^\P{Letter}&&\P{Number}]`（v-flag集合演算）と等価だが、`u` フラグで動作するためコストが低い。

## 検証テストケース

### `parseSearchQuery()`

| 入力クエリ | 期待 `sinceDate` | 期待 `keywords` |
|---|---|---|
| `"hello since:2024-01-15 world"` | `"2024-01-15"` | `"hello world"` |
| `"since:2024-01-15"` | `"2024-01-15"` | `""` |
| `"hello world"` | `null` | `"hello world"` |
| `"since:abc"` | `null` | `""` |
| `"since:2024-01-15 until:2024-12-31 foo"` | `"2024-01-15"` / `"2024-12-31"` | `"foo"` |

### `isValidDate()`

| 入力 | 期待結果 |
|---|---|
| `"2024-01-15"` | `true` |
| `"2024-13-01"` | `false` |
| `"2024-00-01"` | `false` |
| `"2024-01-32"` | `false` |
| `"not-a-date"` | `false` |
| `""` | `false` |

### パスワードバリデーション（サインアップフォームで確認）

| パスワード | エラーが出るか |
|---|---|
| `abcdefghijklmno`（15文字、記号なし） | **出る** |
| `abcdefghijklmnop`（16文字、記号なし） | **出る** |
| `password123!!` | 出ない |
| `あいうえおかきくけこさしすせ`（14文字、Unicode文字のみ） | **出る** |
| `あいうえお！かきくけこさしす` | 出ない（`！`が記号） |
