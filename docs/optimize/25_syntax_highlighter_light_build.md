# 25. react-syntax-highlighter を light ビルドに切り替え

## 問題

`CodeBlock.tsx` で `react-syntax-highlighter` をデフォルトインポートしていた。デフォルトビルドは highlight.js の全言語(190+言語)をバンドルするため、バンドルサイズが非常に大きかった。

## 対応

`react-syntax-highlighter/dist/esm/light` (言語を含まない軽量ビルド) に切り替え、実際に使われる可能性のある言語のみを `registerLanguage` で登録する方式に変更。

### 変更ファイル

- `application/client/src/components/crok/CodeBlock.tsx`

### 登録した言語

| 登録名 | 言語 |
|--------|------|
| `javascript` | JavaScript |
| `typescript` | TypeScript |
| `python` | Python |
| `bash`, `shell` | Bash / Shell |
| `json` | JSON |
| `css` | CSS |
| `html`, `xml` | HTML / XML |
| `sql` | SQL |

未登録言語が指定された場合でも、highlight.js はハイライトなし(プレーンテキスト)でフォールバックするため表示は壊れない。

### 変更前後

```ts
// Before
import SyntaxHighlighter from "react-syntax-highlighter";

// After
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/light";
// + registerLanguage で 10言語のみ登録
```

## 効果

全言語バンドル(~1.6MB ungzip) → 登録言語のみ(~数十KB)に大幅削減。
