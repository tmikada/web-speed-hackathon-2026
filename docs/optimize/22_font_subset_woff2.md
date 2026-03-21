# 22. フォントサブセット化 + WOFF2変換

## 問題

`ReiNoAreMincho-Heavy.otf`（6.4MB）と `ReiNoAreMincho-Regular.otf`（6.3MB）、合計12.7MBの日本語フォントが配信されていた。

## 原因

- Source Han Serif JP ベースのCJKフォントは数万グリフを持つ
- 実際に使用しているのは `/terms`（利用規約）ページの見出し（h1/h2）のみ
- テキストは完全に静的で、使用文字数は限られている
- フォーマットが OTF で、WOFF2 より圧縮率が低い

## 対応

### 1. 使用文字の特定

利用規約ページ（`TermPage.tsx`）の見出しで使われる文字のみに絞り込んだ：

```
利用規約、第1〜16条の見出しテキスト（日本語・英数字・記号）
```

### 2. pyftsubset でサブセット化 + WOFF2 変換

```bash
pip install fonttools brotli

pyftsubset ReiNoAreMincho-Regular.otf \
  --text="利用規約第1条（適用）2（登録）3（ユーザーIDおよびパスワードの管理）4（利用料金および支払方法）5（禁止事項）6（本サービスの提供の停止等）7（著作権）8（利用制限および登録抹消）9（退会）10（保証の否認および免責事項）11（サービス内容の変更等）12（利用規約の変更）13（個人情報の取扱い）14（通知または連絡）15（権利義務の譲渡の禁止）16（準拠法・裁判管轄）" \
  --flavor=woff2 \
  --output-file=ReiNoAreMincho-Regular.subset.woff2

pyftsubset ReiNoAreMincho-Heavy.otf \
  --text="利用規約第1条（適用）2（登録）3（ユーザーIDおよびパスワードの管理）4（利用料金および支払方法）5（禁止事項）6（本サービスの提供の停止等）7（著作権）8（利用制限および登録抹消）9（退会）10（保証の否認および免責事項）11（サービス内容の変更等）12（利用規約の変更）13（個人情報の取扱い）14（通知または連絡）15（権利義務の譲渡の禁止）16（準拠法・裁判管轄）" \
  --flavor=woff2 \
  --output-file=ReiNoAreMincho-Heavy.subset.woff2
```

### 3. index.css を更新

`application/client/src/index.css` の `@font-face` を WOFF2 参照に変更：

```css
src: url(/fonts/ReiNoAreMincho-Regular.subset.woff2) format("woff2");
src: url(/fonts/ReiNoAreMincho-Heavy.subset.woff2) format("woff2");
```

## 結果

| ファイル | 変更前 | 変更後 | 削減率 |
|---|---|---|---|
| Regular | 6.3MB | 24KB | 99.6% |
| Heavy | 6.4MB | 1.1KB | 99.98% |
| **合計** | **12.7MB** | **~25KB** | **99.8%** |

## 影響範囲

- 変更ファイル: `application/public/fonts/`、`application/client/src/index.css`
- フォントは `/terms` ページの見出しのみで使用（他ページへの影響なし）
- VRT で表示崩れがないことを確認
