# 35. 音声波形データのサーバーサイド事前計算

## 問題

`SoundWaveSVG.tsx` がクライアントサイドで音声波形を毎回計算していた。

```typescript
// 問題のコード
async function calculate(data: ArrayBuffer): Promise<ParsedData> {
  const audioCtx = new AudioContext();
  const buffer = await audioCtx.decodeAudioData(data.slice(0));  // ← 約1900ms ブロッキング
  const leftData = Array.from(buffer.getChannelData(0), Math.abs);   // ← 大量メモリ確保
  const rightData = Array.from(buffer.getChannelData(1), Math.abs);  // ← GC圧力
  // ...
}
```

Chrome DevToolsのパフォーマンストレースで確認された問題：
- `decodeAudioData()` → **約1922ms** のメインスレッドブロッキング（TBTに直撃）
- `Array.from(Float32Array)` による大量メモリ確保 → **マイナーGC 88.5ms**
- キャッシュなし：コンポーネントマウントのたびに再計算
- `standardized-audio-context` ライブラリがバンドルに含まれていた

## 対応

サーバーサイドで ffmpeg を使って波形ピークデータを計算し、APIで返す方式に変更。

### サーバー側

**新規: `application/server/src/utils/compute_waveform.ts`**
- ffmpeg でモノラル・8kHz の RAW PCM (s16le) を出力
- 100チャンク分のピーク値を計算
- メモリキャッシュ（`Map<string, number[]>`）で再計算を防止

**変更: `application/server/src/routes/api/sound.ts`**
- `GET /api/v1/sounds/:soundId/waveform` エンドポイントを追加
- シードデータ（`public/sounds/`）・新規投稿（`upload/sounds/`）の両方に対応
- `Cache-Control: public, max-age=86400` でブラウザキャッシュも効かせる

### クライアント側

**変更: `application/client/src/components/foundation/SoundWaveSVG.tsx`**
- `soundData: ArrayBuffer` props を `peaks: number[]` に変更
- `AudioContext`・`decodeAudioData`・`getChannelData` を完全削除
- `standardized-audio-context` ライブラリへの依存もなくなった

**変更: `application/client/src/components/foundation/SoundPlayer.tsx`**
- バイナリ取得（再生用）と **並行して** `/api/v1/sounds/:id/waveform` を fetch
- `SoundWaveSVG` に `peaks` を渡す

## データフロー（変更後）

```
SoundPlayer
  ├─ useFetch(getSoundPath(sound.id), fetchBinary)              → <audio> 再生用（変更なし）
  └─ useFetch(/api/v1/sounds/:id/waveform, fetchJSON) → peaks   → SoundWaveSVG（新規・並行）
```

波形JSONはバイナリより遥かに小さいので先に返ってくる。バイナリ待ちで波形描画がブロックされない。

## 期待効果

| 指標 | 改善内容 |
|------|---------|
| TBT | `decodeAudioData` 約1900ms のブロッキング消滅 |
| メモリ | `Float32Array` 大量確保がなくなりGC圧力軽減 |
| バンドルサイズ | `standardized-audio-context` 削除で軽量化 |
| 波形表示速度 | 小さなJSONを並行fetchするため表示が早い |
