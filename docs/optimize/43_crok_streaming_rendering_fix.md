# 43: Crok ストリーミング描画の修正

## 問題

Crok AIチャットでストリーミング中に表示が途中で止まる問題が発生していた。

### 根本原因（複数）

1. **`key={content}` による過剰なリマウント**
   `ChatMessage.tsx` の `<Markdown key={content}>` がSSEで1文字受信するたびに Markdown コンポーネントを完全アンマウント→マウントしていた。6800文字のレスポンスで6800回フルリマウント（O(n²)の処理量）。

2. **KaTeX フォント（woff2）の遅延ダウンロード**
   `vendor-crok.css` は lazy chunk として動的ロードされるため、KaTeX フォントの取得開始が遅れていた。フォントが揃うまで `\begin{aligned}` などの数式ブロックが赤いエラーテキストで表示されていた。

3. **ストリーミング中のMarkdown/KaTeX/Syntaxハイライター描画**
   1文字ごとにMarkdownを再レンダリングすることで、KaTeX・react-syntax-highlighterが大量のDOMノード（最大166,421）を生成し、CPU 100%・JSヒープ117MBに達していた。

4. **`scheduler.postTask` による1msポーリングループ**
   `use_has_content_below.ts` で `scheduler.postTask(check, { priority: "user-blocking", delay: 1 })` が再帰的に呼ばれており、ストリーミング中ずっとメインスレッドをuser-blocking優先度でブロックしていた。TBT・INPを大幅に悪化させる要因。

## 対応

### 1. `key={content}` 削除 + プラグイン配列の固定化
**ファイル**: `application/client/src/components/crok/ChatMessage.tsx`

```tsx
// Before
<Markdown key={content} rehypePlugins={[rehypeKatex]} remarkPlugins={[remarkMath, remarkGfm]}>

// After
const REMARK_PLUGINS = [remarkMath, remarkGfm];
const REHYPE_PLUGINS = [rehypeKatex];
const MD_COMPONENTS = { pre: CodeBlock };

<Markdown components={MD_COMPONENTS} rehypePlugins={REHYPE_PLUGINS} remarkPlugins={REMARK_PLUGINS}>
```

効果: 毎文字のフルリマウントがなくなり、Reactの通常の差分更新に戻る。

### 2. KaTeX フォントのプリロード
**ファイル**: `application/client/src/index.html`

主要な8フォントを `<link rel="preload" as="font" type="font/woff2" crossorigin>` で HTML ロード時から先行取得。

```html
<link rel="preload" href="/styles/fonts/KaTeX_Main-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/styles/fonts/KaTeX_Math-Italic.woff2" as="font" type="font/woff2" crossorigin>
<!-- ... 計8フォント -->
```

効果: 数式レンダリング時にフォントが既にキャッシュ済みになる。

### 3. ストリーミング中はプレーンテキスト表示
**ファイル**: `application/client/src/components/crok/ChatMessage.tsx`, `CrokPage.tsx`

```tsx
// ChatMessage: isStreaming中はMarkdownを使わない
isStreaming ? (
  <p className="whitespace-pre-wrap text-sm">{content}</p>
) : (
  <Markdown ...>{content}</Markdown>
)

// CrokPage: 最後のメッセージにだけisStreamingを渡す
<ChatMessage isStreaming={isStreaming && index === messages.length - 1} ...>
```

効果: ストリーミング中のDOMノードが166,421 → 数百に激減。CPU・メモリ使用量が大幅改善。

### 4. `useHasContentBelow` を IntersectionObserver に置き換え
**ファイル**: `application/client/src/hooks/use_has_content_below.ts`

```typescript
// Before: 1msごとにuser-blockingで再帰ポーリング
scheduler.postTask(check, { priority: "user-blocking", delay: 1 });

// After: IntersectionObserverでネイティブ監視
const observer = new IntersectionObserver(([entry]) => {
  setHasContentBelow(entry != null && !entry.isIntersecting);
}, { ... });
observer.observe(endEl);
```

効果: メインスレッドのブロッキングがなくなり、TBT・INPが改善。

## 結果

| 指標 | 修正前 | 修正後 |
|------|--------|--------|
| DOMノード数（ストリーミング中） | 166,421 | ~200 |
| JSヒープ（ストリーミング中） | 117MB | ~15MB |
| CPU使用率（ストリーミング中） | 100% | 低下 |
| 数式の途中停止 | 発生 | 解消 |
