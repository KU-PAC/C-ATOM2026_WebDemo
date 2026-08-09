# PatchAssist 3D Demo

湿布貼付支援フィジカルAIロボット「PatchAssist」のインタラクティブWebデモです。エントリーシートに記載された、湿布の認識、保護フィルムの剥離、貼付位置への移動、接触力を抑えた圧着までを、OpenArm 2.0の双腕モデルで可視化します。

双腕の姿勢はOpenArm 2.0のURDFに記載された関節軸・原点・可動域を基準にしています。搬送中の湿布と剥離フィルムは、別の見た目用軌道ではなく、毎フレーム算出される左右のグリッパー手先座標へ拘束されます。

## 起動

```bash
npm install
npm run dev
```

本番ビルドは `npm run build`、ビルド結果の確認は `npm run preview` です。

## 操作

- 「3Dデモを開始」または再生ボタンでシーケンスを再生
- タイムラインをドラッグして任意の工程へ移動
- 工程リスト、または数字キー `1`〜`4` で工程を直接選択
- `Space` で再生・一時停止、`R` でリセット
- 3Dエリアをドラッグして視点を回転
- 右上のカメラボタンで全体／接触部ビューを切り替え

## 運動学の画像検証

URDFの順運動学と同じ手先座標を使い、各工程を実ブラウザで撮影して確認しています。

- [01: 湿布の両端を把持](./docs/screenshots/01-pickup.png)
- [02: 片腕で保持し、もう片腕で保護フィルムを剥離](./docs/screenshots/02-peel.png)
- [03: 両腕で湿布を搬送](./docs/screenshots/03-transfer.png)
- [04: 左右の接触点を揃えて圧着](./docs/screenshots/04-press.png)
- [05: モバイル表示での圧着工程](./docs/screenshots/05-mobile-press.png)

## 3Dモデル

ロボットアームとピンチグリッパーは、Enactic, Inc. が公開している [OpenArm Description](https://github.com/enactic/openarm_description) のOpenArm 2.0モデルです。Apache License 2.0に基づいて同梱しています。詳細は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) と `public/models/openarm/licenses/Apache-2.0.txt` を参照してください。
