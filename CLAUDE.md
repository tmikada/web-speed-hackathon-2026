# Web Speed Hackathon 2026 — CaX

パフォーマンス最適化競技。架空のSNSアプリ「CaX」のLighthouseスコアを最大化することが目標。

## 競技概要

- **期間**: 2026-03-20 10:30 JST – 2026-03-21 18:30 JST
- **採点**: Lighthouse ベース、最大1150点
  - ページの表示（900点）: 9ページ × (FCP×10 + SI×10 + LCP×25 + TBT×30 + CLS×25)
  - ページの操作（250点）: 5シナリオ × (TBT×25 + INP×25) — 表示で300点以上の場合のみ
- **リーダーボード**: https://web-speed-hackathon-scoring-board-2026.fly.dev/

## 技術スタック

- **サーバー**: Express 5 + SQLite (Sequelize) + `tsx` ランタイム、ポート3000
- **クライアント**: React 19 + Redux + webpack（最適化なし）、`/dist` から配信
- **ビルド**: `pnpm run build`（webpack）→ `pnpm run start`（tsx サーバー）
- **ワークスペース**: `application/client`、`application/server`、`application/e2e`

## レギュレーション（破ってはいけないこと）

- VRT（Visual Regression Tests）が通ること
- `docs/test_cases.md` の手動テスト項目が通ること
- `GET /api/v1/crok` の SSE プロトコルを変更しないこと
- `POST /api/v1/initialize` でDBを初期状態にリセットできること
- シードを変更する場合、各種IDを変更しないこと
- `fly.toml` を変更しないこと（fly.io デプロイを使う場合）

## 開発コマンド

```bash
cd application
pnpm install --frozen-lockfile
pnpm run build        # webpack クライアントビルド
pnpm run start        # サーバー起動 :3000
```

 ANALYZE=true pnpm run build
curl -s -X POST https://pr-86-web-speed-hackathon-2026.fly.dev/api/v1/initialize -H "Content-Type: application/json" -w "\nHTTP Status: %{http_code}"
 pnpm run test --workers=1
 
## ローカル計測

```bash
cd scoring-tool
pnpm install --frozen-lockfile
pnpm start --applicationUrl http://localhost:3000
# 特定の計測のみ:
pnpm start --applicationUrl http://localhost:3000 --targetName "投稿"
```
DEBUG=wsh:log pnpm start --applicationUrl http://localhost:3000 --targetName "ユーザーフロー: Crok AIチャット"

- 計測結果は `docs/scores` フォルダに格納する
- ファイル名に連番をつける
- 前回のスコアとの比較を含める

## 重要なファイル

- `application/client/webpack.config.js` — ビルド設定（主な最適化対象）
- `application/client/src/index.tsx` — React エントリーポイント
- `application/server/src/app.ts` — Express アプリ設定（ヘッダー、ミドルウェア）
- `application/server/src/routes/api.ts` — API ルーター
- `application/server/src/sequelize.ts` — DB設定
- `docs/regulation.md` — レギュレーション
- `docs/scoring.md` — 採点詳細
- `docs/test_cases.md` — 手動テスト項目

## タスクスコープ

**このプロジェクトでは最適化タスクのみを行う。**

- パフォーマンス最適化のみに集中する
- 新機能の追加や機能変更は行わない
- レギュレーション違反となる変更は行わない
- 最適化後は必ずVRTを実行して動作確認する（手動で実行する）

## 最適化ポイント
- 対応内容ごとにドキュメントに整理して対応を進める。
- ドキュメントは `docs/optimize` に格納する
- 対応する順番がわかるようにファイル名の先頭に連番を加える(01_xxxx, 02_xxxx)

## BundleAnalyzerの結果
- ドキュメントは`docs/bundleanalyzer`に格納する
- ファイル名は連番をつける
