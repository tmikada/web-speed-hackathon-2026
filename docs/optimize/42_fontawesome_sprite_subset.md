# 42. Font Awesome SVG スプライト サブセット化

## 概要

Font Awesome SVG スプライトファイルが全アイコン（約1,175個）を含んでいたため、実際に使用している18アイコンのためだけに約1.2MBをダウンロードさせていた。使用アイコンのみに絞ったスプライトに置き換えた。

## 問題

| ファイル | サイズ | アイコン数 |
|---|---|---|
| `solid.svg` | 638.6 KB | 648個 |
| `regular.svg` | 107.0 KB | 159個 |
| `brands.svg` | 458.3 KB | 368個 |
| **合計** | **1.2 MB** | **1,175個** |

Lighthouse のシミュレーテッドスロットル（~1.6Mbps 相当）では、1.2MB のダウンロードが約6秒かかり、FCP/LCP に影響していた。

## 使用アイコン調査

`FontAwesomeIcon` コンポーネントの全使用箇所を調査した結果:

| スタイル | 使用アイコン |
|---|---|
| solid | arrow-down, arrow-right, balance-scale, circle-notch, edit, envelope, exclamation-circle, home, images, music, paper-plane, pause, play, search, sign-in-alt, user, video |
| regular | calendar-alt |
| brands | **未使用** |

## 対応

`application/scripts/subset-fa-sprites.mjs` スクリプトを作成し、各スプライトから必要なシンボルのみを抽出して上書き保存。

```bash
cd application
node scripts/subset-fa-sprites.mjs
```

## 結果

| ファイル | Before | After | 削減率 |
|---|---|---|---|
| `solid.svg` | 638.6 KB | 7.4 KB | **-98.8%** |
| `regular.svg` | 107.0 KB | 1.2 KB | **-98.9%** |
| `brands.svg` | 458.3 KB | 0.3 KB | **-99.9%** |
| **合計** | **1.2 MB** | **~9 KB** | **-99.2%** |

## 変更ファイル

- `application/scripts/subset-fa-sprites.mjs`（新規：サブセット化スクリプト）
- `application/public/sprites/font-awesome/solid.svg`（638KB → 7KB）
- `application/public/sprites/font-awesome/regular.svg`（107KB → 1KB）
- `application/public/sprites/font-awesome/brands.svg`（458KB → 空）
