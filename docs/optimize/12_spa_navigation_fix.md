# 12. SPAナビゲーション修正（Linkコンポーネント）

## 問題

`application/client/src/components/foundation/Link.tsx` のカスタム `Link` コンポーネントが、クリック時のデフォルトブラウザ動作（ページ遷移）を止めていなかった。

```tsx
// 修正前: <a href={href}> をクリックするとフルページリロードが発生
export const Link = forwardRef<HTMLAnchorElement, Props>(({ to, ...props }, ref) => {
  const href = useHref(to);
  return <a ref={ref} href={href} {...props} />;
});
```

## 影響

- アプリ内の全リンク（タイムライン日付、ユーザー名、ナビゲーションなど）をクリックするたびにフルページリロードが発生
- JSバンドルを毎回再読み込みするため、遷移後に白画面が表示される
- SPAとして機能せず、ページ遷移ごとにネットワークコストが発生
- Lighthouse の TBT・INP・FCP などすべてのメトリクスに悪影響

## 修正

`onClick` ハンドラで `e.preventDefault()` を呼び、`useNavigate()` でクライアントサイドナビゲーションを行うよう変更。

```tsx
// 修正後: クライアントサイドナビゲーション（SPAとして正常動作）
export const Link = forwardRef<HTMLAnchorElement, Props>(({ to, onClick, ...props }, ref) => {
  const href = useHref(to);
  const navigate = useNavigate();
  return (
    <a
      ref={ref}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
        navigate(to);
      }}
      {...props}
    />
  );
});
```

## 変更ファイル

- `application/client/src/components/foundation/Link.tsx`

## 期待効果

- ページ遷移がSPAナビゲーションになりフルリロード不要
- JSバンドルの再読み込みがなくなり遷移が高速化
- FCP・LCP・TBT・INPすべてのスコア改善が期待できる
