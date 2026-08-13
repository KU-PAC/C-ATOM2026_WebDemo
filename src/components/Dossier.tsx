import '../dossier.css';

/* ------------------------------------------------------------------ */
/* 出典（セクションF）— 本文からは上付き番号でここへアンカーする          */
/* ------------------------------------------------------------------ */

type Ref = { n: number; title: string; site: string; url: string };

const REFS: Ref[] = [
  {
    n: 1,
    title: 'Intel RealSense D435f 製品仕様（750 nm IR パスフィルタ・FOV・理想レンジ・寸法）',
    site: 'realsenseai.com',
    url: 'https://www.realsenseai.com/products/d435f-3/',
  },
  {
    n: 2,
    title: 'スイッチサイエンス — RealSense D435f 国内価格 ¥84,799（税込・在庫限り）',
    site: 'switch-science.com',
    url: 'https://www.switch-science.com/products/8250',
  },
  {
    n: 3,
    title: 'MediaPipe Hand Landmarker（21 点・レイテンシ・Palm detection 精度）',
    site: 'developers.google.com',
    url: 'https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker',
  },
  {
    n: 4,
    title: 'librealsense Projection — rs2_deproject_pixel_to_point の定義',
    site: 'github.com',
    url: 'https://github.com/realsenseai/librealsense/wiki/Projection-in-RealSense-SDK-2.0',
  },
  {
    n: 5,
    title: 'Open3D RGBD Integration — TSDF voxel_length 4.0/512・sdf_trunc 0.04 m',
    site: 'open3d.org',
    url: 'https://www.open3d.org/docs/release/tutorial/pipelines/rgbd_integration.html',
  },
  {
    n: 6,
    title: 'Open3D Surface Reconstruction — Poisson オクツリー深さ 9・density トリム',
    site: 'open3d.org',
    url: 'https://www.open3d.org/docs/release/tutorial/geometry/surface_reconstruction.html',
  },
  {
    n: 7,
    title: 'OpenArm 2.0 ハードウェア仕様（片腕 7 DOF・全関節 QDD・CAN-FD・可搬）',
    site: 'docs.openarm.dev',
    url: 'https://docs.openarm.dev/hardware/openarm-2.0/general/',
  },
  {
    n: 8,
    title: 'OpenArm 2.0 双腕完成品 $6,500（WowRobo ストア）',
    site: 'shop.wowrobo.com',
    url: 'https://shop.wowrobo.com/products/openarm-2',
  },
  {
    n: 9,
    title: 'Leptrino 6軸力覚センサ 製品一覧（定格・価格 ¥98,000）',
    site: 'leptrino.co.jp',
    url: 'https://www.leptrino.co.jp/product/6axis-force-sensor',
  },
  {
    n: 10,
    title: 'Leptrino 力覚センサ カタログ PDF（分解能・サンプリングレート・外形）',
    site: 'jsme-hs.jp',
    url: 'https://jsme-hs.jp/materials/161397152162701.pdf',
  },
  {
    n: 11,
    title: 'モータ電流による手先力推定 RMSE 1.945 N（6軸 F/T 使用時 2.004 N）',
    site: 'sciencedirect.com',
    url: 'https://sciencedirect.com/science/article/abs/pii/S0967066126003837',
  },
  {
    n: 12,
    title: '関節トルク推定の比較 — トルクセンサ 0.0317 Nm vs モータ電流 0.1638 Nm',
    site: 'arxiv.org',
    url: 'https://arxiv.org/html/2510.10843',
  },
  {
    n: 13,
    title: 'SMC 真空パッドカタログ — F = P × A × 0.1、安全率 水平 4 倍／垂直 8 倍',
    site: 'smcworld.com',
    url: 'https://www.smcworld.com/upfiles/item/311/pdf1-S100-76B-ZP2pad.pdf',
  },
  {
    n: 14,
    title: '日医工 インタビューフォーム — 湿布 10 × 14 cm・ライナー材質 PET',
    site: 'nichiiko.co.jp',
    url: 'https://www.nichiiko.co.jp/medicine/file/00400/interview/00400_interview.pdf',
  },
];

function Sup({ n }: { n: number }) {
  return (
    <sup className="dsr-sup">
      <a href={`#dsr-ref-${n}`}>{n}</a>
    </sup>
  );
}

function Head({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="dsr-head">
      <h2 className="dsr-h2">{title}</h2>
      <p className="dsr-lead">{lead}</p>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* A. システム構成図 — インライン SVG                                    */
/*    viewBox 1200 × 650。上段に知覚〜投影の 4 ノード（横一列）、          */
/*    中央に軌道生成のフルワイドバー、下段で真空系／力覚に分岐し、         */
/*    最下部の圧着完了へ収束させる。                                     */
/* ------------------------------------------------------------------ */

type ArchNode = {
  x: number;
  accent: 'scan' | 'intent';
  kicker: string;
  title: string;
  sub: string;
};

const NODE_W = 261;
const NODE_Y = 48;
const NODE_H = 84;

const TOP_NODES: ArchNode[] = [
  {
    x: 30,
    accent: 'scan',
    kicker: 'REALSENSE D435F',
    title: '深度センシング',
    sub: '胸部搭載 / 理想 0.3–3 m / 750 nm IR パス',
  },
  {
    x: 323,
    accent: 'scan',
    kicker: 'POINT CLOUD → TSDF',
    title: '背中メッシュの再構成',
    sub: 'voxel 7.8125 mm / Marching Cubes',
  },
  {
    x: 616,
    accent: 'intent',
    kicker: 'MEDIAPIPE HAND LANDMARKER',
    title: '指先で貼付点を指定',
    sub: '21 点 / 推論 17.12 ms (CPU)',
  },
  {
    x: 909,
    accent: 'intent',
    kicker: 'DEPTH ALIGN → DEPROJECT',
    title: '貼付点をメッシュへ投影',
    sub: 'align → 中央値 → 逆投影',
  },
];

type Chip = { label: string; value: string };

const VAC_CHIPS: Chip[] = [
  { label: 'ポンプ A（固定側）', value: '12 V / −61 kPa / 0.19 A' },
  { label: 'ポンプ B（揺動側）', value: '1.6 L/min / 63 g' },
  { label: '真空圧センサ SMC ZSE30A', value: '応答 2.5 ms 以下' },
];

const FORCE_CHIPS: Chip[] = [
  { label: '接触検知（モータ電流ベース推定）', value: '手先力 RMSE 1.945 N' },
  { label: '押付力 4 N を維持して圧着', value: 'Fz 監視' },
  { label: '案A: Leptrino PFS055（手首・任意）', value: '¥98,000 / 最小 10 g' },
];

function ArchGroup({
  x,
  accent,
  kicker,
  title,
  chips,
  footer,
}: {
  x: number;
  accent: 'vac' | 'force';
  kicker: string;
  title: string;
  chips: Chip[];
  footer: string;
}) {
  const padX = x + 22;
  const chipX = x + 18;
  const chipW = 519;
  const valueX = chipX + chipW - 12;
  return (
    <g className={`dsr-a-${accent}`}>
      <rect className="dsr-gbox" x={x} y={312} width={555} height={206} rx={0} />
      <text className="dsr-g-k" x={padX} y={336}>
        {kicker}
      </text>
      <text className="dsr-g-t" x={padX} y={362}>
        {title}
      </text>
      {chips.map((c, i) => {
        const cy = 376 + i * 36;
        return (
          <g key={c.label}>
            <rect className="dsr-chip-r" x={chipX} y={cy} width={chipW} height={32} rx={0} />
            <text className="dsr-chip-t" x={chipX + 12} y={cy + 21}>
              {c.label}
            </text>
            <text className="dsr-chip-v" x={valueX} y={cy + 21} textAnchor="end">
              {c.value}
            </text>
          </g>
        );
      })}
      <text className="dsr-g-f" x={padX} y={504}>
        {footer}
      </text>
    </g>
  );
}

function ArchitectureFigure() {
  return (
    <div className="dsr-arch-wrap">
      <svg
        className="dsr-arch-svg"
        viewBox="0 0 1200 650"
        role="img"
        aria-labelledby="dsr-arch-title dsr-arch-desc"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title id="dsr-arch-title">PatchAssist システム構成図</title>
        <desc id="dsr-arch-desc">
          RealSense D435f による深度センシングから TSDF 統合による背中メッシュ再構成、MediaPipe
          Hand Landmarker による貼付点指定、メッシュへの投影、双腕 7 自由度の逆運動学による軌道生成、
          真空系と力覚系への分岐、圧着完了までのデータフロー。
        </desc>

        <defs>
          <marker
            id="dsr-mk-scan"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path className="dsr-mk dsr-mk--scan" d="M0.5,1 L9,5 L0.5,9 Z" />
          </marker>
          <marker
            id="dsr-mk-intent"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path className="dsr-mk dsr-mk--intent" d="M0.5,1 L9,5 L0.5,9 Z" />
          </marker>
          <marker
            id="dsr-mk-green"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path className="dsr-mk dsr-mk--green" d="M0.5,1 L9,5 L0.5,9 Z" />
          </marker>
          <marker
            id="dsr-mk-vac"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path className="dsr-mk dsr-mk--vac" d="M0.5,1 L9,5 L0.5,9 Z" />
          </marker>
          <marker
            id="dsr-mk-force"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path className="dsr-mk dsr-mk--force" d="M0.5,1 L9,5 L0.5,9 Z" />
          </marker>
        </defs>

        {/* 工程ラベルと罫 */}
        <g className="dsr-a-scan">
          <text className="dsr-slabel" x={30} y={20}>
            工程 01 — 知覚・スキャン
          </text>
          <line className="dsr-srule" x1={30} y1={32} x2={584} y2={32} />
        </g>
        <g className="dsr-a-intent">
          <text className="dsr-slabel" x={616} y={20}>
            工程 02 — 意思確認
          </text>
          <line className="dsr-srule" x1={616} y1={32} x2={1170} y2={32} />
        </g>

        {/* 上段ノード */}
        {TOP_NODES.map((n) => (
          <g className={`dsr-a-${n.accent}`} key={n.kicker}>
            <rect className="dsr-n" x={n.x} y={NODE_Y} width={NODE_W} height={NODE_H} rx={0} />
            <text className="dsr-n-k" x={n.x + 18} y={70}>
              {n.kicker}
            </text>
            <text className="dsr-n-t" x={n.x + 18} y={94}>
              {n.title}
            </text>
            <text className="dsr-n-s" x={n.x + 18} y={114}>
              {n.sub}
            </text>
          </g>
        ))}

        {/* 上段の矢印 */}
        <path className="dsr-arrow dsr-a-scan" d="M291 90 H319" markerEnd="url(#dsr-mk-scan)" />
        <path className="dsr-arrow dsr-a-intent" d="M584 90 H612" markerEnd="url(#dsr-mk-intent)" />
        <path className="dsr-arrow dsr-a-intent" d="M877 90 H905" markerEnd="url(#dsr-mk-intent)" />
        <path
          className="dsr-arrow dsr-a-green"
          d="M1039.5 132 V184"
          markerEnd="url(#dsr-mk-green)"
        />

        {/* 軌道生成バー */}
        <g className="dsr-a-green">
          <rect className="dsr-bar" x={30} y={188} width={1140} height={68} rx={0} />
          <text className="dsr-bar-t" x={52} y={229}>
            軌道生成 — 双腕 7 DoF × 2 の逆運動学
          </text>
          <text className="dsr-bar-v" x={1148} y={229} textAnchor="end">
            CAN-FD / QDD 減速比 9:1–40:1 / 可搬 定格 4.1 kg
          </text>
        </g>

        {/* 分岐 */}
        <path className="dsr-arrow dsr-a-vac" d="M307.5 256 V308" markerEnd="url(#dsr-mk-vac)" />
        <path
          className="dsr-arrow dsr-a-force"
          d="M892.5 256 V308"
          markerEnd="url(#dsr-mk-force)"
        />

        <ArchGroup
          x={30}
          accent="vac"
          kicker="工程 03"
          title="真空系 — ライナー剥離と保持"
          chips={VAC_CHIPS}
          footer="φ8 パッド ×2 @ −60 kPa → 3.0 N（必要吸着力 2.4 N・推定）"
        />
        <ArchGroup
          x={615}
          accent="force"
          kicker="工程 04"
          title="力覚 — 接触検知と 4 N 圧着"
          chips={FORCE_CHIPS}
          footer="二段構え — 案2 で接触検知を成立 → 定量保証が必要なら案1を追加"
        />

        {/* 収束 */}
        <path
          className="dsr-arrow dsr-a-vac"
          d="M307.5 518 C 307.5 558, 372 592, 486 592"
          markerEnd="url(#dsr-mk-vac)"
        />
        <path
          className="dsr-arrow dsr-a-force"
          d="M892.5 518 C 892.5 558, 828 592, 714 592"
          markerEnd="url(#dsr-mk-force)"
        />

        {/* 終端 */}
        <rect className="dsr-term" x={490} y={560} width={220} height={64} rx={0} />
        <text className="dsr-term-t" x={600} y={599} textAnchor="middle">
          圧着完了
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* B. 4工程の技術詳細                                                   */
/* ------------------------------------------------------------------ */

type Spec = { k: string; v: string; ref?: number };

type Stage = {
  num: string;
  accent: 'scan' | 'intent' | 'vac' | 'force';
  title: string;
  desc: string;
  specs: Spec[];
  check: string;
};

const STAGES: Stage[] = [
  {
    num: '01',
    accent: 'scan',
    title: '背中形状のスキャンとメッシュ化',
    desc: '胸部に搭載した RealSense D435f で背中を撮影し、点群を TSDF に統合して背中メッシュを再構成する。深度 87° × 58° は距離 0.4 m で 0.76 m × 0.44 m をカバーするため、成人の背中（幅約 0.40 m）は 1 フレームに収まる。撮像素子側に 750 nm の IR パスフィルタを持ち、可視光を落として IR プロジェクタのパターンだけを拾うため、肌のような低テクスチャ面でも対応点が取りやすい。深度側はグローバルシャッターで、接近時の動きブレに強い。',
    specs: [
      { k: '深度 FOV', v: '87° × 58°', ref: 1 },
      { k: '理想レンジ', v: '0.3 – 3 m', ref: 1 },
      { k: '深度精度', v: '< 2 %（@ 2 m）', ref: 1 },
      { k: 'カラー', v: '1920 × 1080 / 30 fps / 69° × 42°', ref: 1 },
      { k: 'TSDF voxel', v: '7.8125 mm（4.0 / 512）', ref: 5 },
    ],
    check: '理想レンジ下限 0.3 m に対し作動距離は 0.4 m で、余裕は 10 cm しかない。またカラー整列後の実効視野はカラー FOV 側に律速され 0.55 m × 0.31 m（@ 0.4 m・計算値）まで狭まる。背中幅 0.40 m は収まるが、姿勢のばらつきを含めた実測が必要。',
  },
  {
    num: '02',
    accent: 'intent',
    title: '指先ジェスチャによる貼付点の指定',
    desc: 'MediaPipe Hand Landmarker で 21 点の手指ランドマークを推定し、ユーザーが指し示した指先を貼付点として取得する。カラーに整列した深度から rs2_deproject_pixel_to_point で 3D 化し、背中メッシュ上に投影して貼付姿勢を決める。',
    specs: [
      { k: 'ランドマーク', v: '21 点（3D hand-knuckle）', ref: 3 },
      { k: '推論レイテンシ', v: 'CPU 17.12 ms / GPU 12.27 ms', ref: 3 },
      { k: 'Palm detection', v: '平均精度 95.7 %', ref: 3 },
      { k: '3D 化', v: 'X = (u − cx) Z / fx', ref: 4 },
    ],
    check: 'hand_world_landmarks は原点が手の幾何中心で絶対スケールを持たない。指先は flying pixel で深度が中間値になりやすく、3×3 – 5×5 中央値フィルタを想定（この対策は推定・出典なし）。',
  },
  {
    num: '03',
    accent: 'vac',
    title: 'ライナー剥離と湿布の保持',
    desc: '湿布は 10 cm × 14 cm、ライナーは PET で質量 0.59 – 0.98 g。自重は無視でき、支配的なのは剥離力である。SMC の実務式 F = P × A × 0.1 と垂直安全率 8 倍から必要吸着力を見積もり、φ8 パッド × 2 と 12 V DC ポンプ 2 系統（固定側／揺動側）で剥離する。',
    specs: [
      { k: '湿布・ライナー', v: '10 × 14 cm / PET', ref: 14 },
      { k: '必要吸着力', v: '2.4 N（0.3 N × 安全率 8・推定）', ref: 13 },
      { k: 'φ8 パッド @ −60 kPa', v: '3.0 N（φ6 は 1.7 N で不足）' },
      { k: '真空圧センサ', v: '0 – −101.0 kPa / 応答 2.5 ms 以下' },
    ],
    check: '剥離強度 0.5 N/25 mm は推定値で一次資料がない。実サンプルをフォースゲージで実測するまで、パッド径とポンプ到達真空度は暫定。',
  },
  {
    num: '04',
    accent: 'force',
    title: '押付力 4 N での圧着',
    desc: 'OpenArm 2.0 は全関節 QDD（減速比 9:1 – 40:1）で、産業用の 100:1 – 160:1 に比べ電流→トルク換算の誤差源が構造的に小さい。まずモータ電流ベースの推定で接触検知を成立させ、圧着力の定量保証が要件化した段階で手首に 6 軸力覚センサを追加する。',
    specs: [
      { k: '目標押付力', v: '4 N（Fz 監視）' },
      { k: '手先力推定 RMSE', v: '1.945 N（電流 + LSTM）', ref: 11 },
      { k: '参照：6軸 F/T 使用時', v: '2.004 N', ref: 11 },
      { k: '関節トルク RMSE', v: '0.1638 Nm（電流） / 0.0317 Nm（センサ）', ref: 12 },
    ],
    check: '電流ベース推定は摩擦・重力モデル誤差が支配的で 6 軸分離ができない。接触検知しきい値の較正手順は未確定。',
  },
];

/* ------------------------------------------------------------------ */
/* C. ハードウェア構成とコスト                                          */
/* ------------------------------------------------------------------ */

type BomRow = {
  part: string;
  model: string;
  spec: string;
  price: string;
  estimated?: boolean;
  src: { label: string; url?: string };
};

const BOM: BomRow[] = [
  {
    part: '双腕ロボット本体',
    model: 'OpenArm 2.0（双腕・完成品）',
    spec: '片腕 7 DOF / 全関節 QDD / DAMIAO 43 シリーズ + DM-J8009P / CAN-FD / 可搬 定格 4.1 kg・ピーク 6.0 kg / HW: CERN-OHL-S-2.0・SW: Apache-2.0',
    price: '$6,500',
    src: { label: 'shop.wowrobo.com', url: 'https://shop.wowrobo.com/products/openarm-2' },
  },
  {
    part: '深度カメラ',
    model: 'Intel RealSense D435f',
    spec: '深度 87° × 58° / 1280 × 720 @ 90 fps / 理想 0.3 – 3 m / < 2 % @ 2 m / 深度側グローバルシャッター / 750 nm IR パスフィルタ + IR プロジェクタ / カラー 1920 × 1080 @ 30 fps・69° × 42° / IMU なし / 90 × 25.8 × 25 mm・約 72 g / USB-C 3.1 Gen 1',
    price: '¥84,799（税込）',
    src: { label: 'switch-science.com', url: 'https://www.switch-science.com/products/8250' },
  },
  {
    part: '12 V 真空ポンプ × 2',
    model: 'KNF NMP015KPDC-M（代替: Schwarzer SP 500 EC-LC）',
    spec: '−61 kPa 相当 / 1.6 L/min / 0.19 A / 22 × 22 × 41.5 mm / 63 g（代替は −50 kPa・1.1 L/min・36.7 g）',
    price: '価格非公開',
    estimated: true,
    src: {
      label: 'schwarzer.com（代替品）',
      url: 'https://www.schwarzer.com/en/gas-pumps/eccentric-diaphragm-pumps/sp-500-ec-lc',
    },
  },
  {
    part: '吸着パッド φ8 × 2',
    model: 'コガネイ KPA-8-N（ホルダ付）',
    spec: '−93.3 kPa で理論吸着力 4.68 N / −60 kPa 換算 3.0 N（必要吸着力 2.4 N を充足）',
    price: '¥678 / 個（計 ¥1,356）',
    src: {
      label: 'product.koganei.co.jp',
      url: 'https://product.koganei.co.jp/downloader/catalog/KP_ALL/1',
    },
  },
  {
    part: '真空圧センサ',
    model: 'SMC ZSE30A',
    spec: '0 – −101.0 kPa / DC 12 – 24 V / 40 mA 以下 / 応答 2.5 ms 以下',
    price: '¥7,000 – 13,000',
    estimated: true,
    src: {
      label: 'smcworld.com（仕様）',
      url: 'https://www.smcworld.com/upfiles/manual/ja-jp/files/PSxx-OML0002.pdf',
    },
  },
  {
    part: '真空バルブ',
    model: 'SMC VK332V',
    spec: '−101.2 kPa – 0.1 MPa / DC 12 V / 2 – 4 W / 応答 10 ms 以下 / 80 – 120 g',
    price: '¥6,158 〜',
    src: { label: 'メーカー公表仕様（URL 未取得）' },
  },
  {
    part: '6軸力覚センサ（案A・任意）',
    model: 'Leptrino PFS055YA251U6',
    spec: 'Fx/Fy/Fz ±250 N・Mx/My/Mz ±6 Nm / 分解能 ±1/2000 / 最小検出荷重 10 g / φ55 × H32 mm / USB 2.0・DC 5 V / 1.2 kHz',
    price: '¥98,000（税別）',
    src: { label: 'leptrino.co.jp', url: 'https://www.leptrino.co.jp/product/6axis-force-sensor' },
  },
];

/* ------------------------------------------------------------------ */
/* D. 力覚センサの設計判断                                              */
/* ------------------------------------------------------------------ */

type CmpRow = { axis: string; a1: string; a2: string; a3: string };

const CMP: CmpRow[] = [
  {
    axis: '追加コスト',
    a1: '¥98,000（税別）',
    a2: '¥0（既存モータのみ）',
    a3: '〜 ¥3,000',
  },
  {
    axis: '力分解能',
    a1: '±1/2000・最小検出荷重 10 g（≒ 0.098 N）',
    a2: '手先力 RMSE 1.945 N（同条件の 6軸 F/T は 2.004 N）',
    a3: 'ロードセル + HX711 は 24 bit ADC / FSR 402 は力精度 5 – 25 %',
  },
  {
    axis: '帯域',
    a1: '1.2 kHz（2.4 kHz へ変更可）',
    a2: 'モータ制御周期に追従（CAN-FD）',
    a3: 'HX711 は 10 / 80 SPS',
  },
  {
    axis: '6軸分離',
    a1: '可（力 3 軸・モーメント 3 軸）',
    a2: '不可（合力の推定のみ）',
    a3: '不可（接触の有無に近い）',
  },
  {
    axis: '主なトレードオフ',
    a1: 'φ55 × H32 の手首搭載による質量増（重量は非公開、100 – 300 g と推定）と USB 配線。EtherCAT 対応は公開情報なし',
    a2: '摩擦・重力モデルの誤差が支配的。姿勢別の較正が必須',
    a3: '分解能・帯域とも不足。気圧センサ MPL115A2 は分解能 0.15 kPa・精度 ±1 kPa',
  },
  {
    axis: '本用途適合度',
    a1: '圧着力の定量保証には必要十分（ただし現段階では過剰）',
    a2: '接触検知には十分。4 N の定量保証には不足',
    a3: '接触の有無のみ。単独では成立しない',
  },
];

/* ------------------------------------------------------------------ */
/* E. リスクと検証計画                                                  */
/* ------------------------------------------------------------------ */

type Risk = { num: string; title: string; risk: string; why: string; next: string };

const RISKS: Risk[] = [
  {
    num: 'Q1',
    title: '素肌に投影した IR パターンの潰れ',
    risk: 'D435f は IR プロジェクタと 750 nm IR パスフィルタの組みで、可視光を落としパターンだけを拾う。ただし皮膚は近赤外を強く内部散乱するため、投影したドットが表面下でにじみ、ステレオ対応点のコントラストが落ちる恐れがある。フィルタで可視光のテクスチャを捨てている以上、深度品質はプロジェクタのパターン品質だけに依存する。',
    why: '背中メッシュの質は、貼付点の投影精度と押付軌道の精度にそのまま伝播する。フィルタ付きは反復パターンや強い環境光に強い一方、素肌という散乱体に対する効きは公表資料になく、この構成の前提が未検証のまま残っている。',
    next: '同一被験者・同一照明・作動距離 0.4 m で、D435f とフィルタなしの D435 を実機比較する。背中領域の深度欠損率と TSDF 後のメッシュ平滑度（面残差 RMS）で評価し、必要ならプロジェクタ出力の引き上げか、可視光テクスチャを併用できるフィルタなし機への切り替えを判断する。',
  },
  {
    num: 'Q2',
    title: '湿布ライナーの実剥離力が未測定',
    risk: 'ライナーの剥離力に一次資料が存在しない。現状は剥離強度 0.5 N/25 mm（推定）から F_peel ≈ 0.3 N とし、垂直安全率 8 倍で必要吸着力 2.4 N としている。',
    why: 'この 2.4 N がパッド径（φ8 で 3.0 N、φ6 は 1.7 N で不足）とポンプ到達真空度（−60 kPa）を規定している。実剥離力が倍なら真空系の設計が破綻する。',
    next: '実サンプル（10 × 14 cm・PET ライナー）を 90° ピール試験でフォースゲージ実測する。あわせて φ8 / φ10 パッドで実剥離試験を行い、安全率 8 倍の妥当性を確認する。',
  },
  {
    num: 'Q3',
    title: '電流ベース力推定の較正',
    risk: 'モータ電流からのトルク／力推定は摩擦・重力モデルの誤差が支配的で、6 軸分離ができない。手先力 RMSE 1.945 N は目標押付力 4 N に対して無視できない大きさ。',
    why: '接触の有無は検出できても、圧着力の定量保証はできない。「4 N で圧着した」と言い切れるかどうかが、この判断の分岐点になる。',
    next: '姿勢別の無負荷電流マップを取得して重力・摩擦項を較正し、既知荷重（分銅）で接触検知しきい値を決める。定量保証が要件化した時点で案1（Leptrino）を手首に追加する。',
  },
  {
    num: 'Q4',
    title: '対人安全',
    risk: '押付力の上限、非常停止、皮膚状態の判断。相手は人体であり、貼付面は皮膚である。',
    why: '過大な押付や軌道の逸脱は直接の傷害につながる。ソフトウェア上の力制御だけを安全根拠にはできない。',
    next: '機構的な押付力上限（ばね／トルク上限）と 4 N のソフト上限を二重化し、力逸脱時は即時リトラクトする。非常停止は利用者が手元で握る。発赤・傷など皮膚状態の判断はシステムでは行わず、人が実施する前提を仕様に明記する。',
  },
  {
    num: 'Q5',
    title: '指先座標の絶対スケール',
    risk: 'hand_landmarks は正規化座標、hand_world_landmarks はメートル単位だが原点が手の幾何中心のため、いずれも絶対位置を与えない。指先は flying pixel で深度が中間値になりやすい。',
    why: '貼付点は指先の絶対 3D 位置そのものであり、ここでの数 cm の誤差は貼付位置の誤差に直結する。',
    next: '既知位置のマーカーで指先深度の誤差分布を測定し、中央値フィルタの窓サイズと、近傍メッシュ面へのスナップ処理を決める（現行のフィルタ案は推定・出典なし）。',
  },
];

/* ------------------------------------------------------------------ */

export default function Dossier() {
  return (
    <div className="dsr-root">
      {/* A ------------------------------------------------------------ */}
      <section className="dsr-section" id="dsr-architecture">
        <div className="dsr-inner">
          <Head
            title="システム構成"
            lead="胸部の深度カメラ 1 台から、背中メッシュの再構成・貼付点の指定・双腕の軌道生成・真空と力覚の同時制御までを 1 本のパイプラインで通す。分岐は真空系と力覚系の 2 系統のみとし、状態を持つ箇所を意図的に絞っている。"
          />
          <ArchitectureFigure />
          <p className="dsr-figcaption">
            図 1 — データフロー。工程 01 – 02 は知覚と意思確認、工程 03 – 04
            は実行にあたる。破線を用いず、すべて単方向の依存で構成している。
          </p>
        </div>
      </section>

      {/* B ------------------------------------------------------------ */}
      <section className="dsr-section" id="dsr-pipeline">
        <div className="dsr-inner">
          <Head
            title="4 工程の技術詳細"
            lead="各工程の主要諸元は一次資料から引いている。出典が取れていない値は「推定」と明記し、末尾に検証項目として残した。"
          />
          <div className="dsr-cards">
            {STAGES.map((s) => (
              <article className={`dsr-card dsr-a-${s.accent}`} key={s.num}>
                <div className="dsr-card-rule" />
                <div className="dsr-card-top">
                  <span className="dsr-card-num">{s.num}</span>
                </div>
                <h3 className="dsr-card-title">{s.title}</h3>
                <p className="dsr-card-desc">{s.desc}</p>

                <p className="dsr-spec-label">主要諸元</p>
                <dl className="dsr-spec">
                  {s.specs.map((sp) => (
                    <div className="dsr-spec-row" key={sp.k}>
                      <dt className="dsr-spec-k">{sp.k}</dt>
                      <dd className="dsr-spec-v">
                        {sp.v}
                        {sp.ref ? <Sup n={sp.ref} /> : null}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="dsr-check">
                  <span className="dsr-check-label">検証 / 未確定</span>
                  {s.check}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* C ------------------------------------------------------------ */}
      <section className="dsr-section" id="dsr-bom">
        <div className="dsr-inner">
          <Head
            title="ハードウェア構成とコスト"
            lead="調達可能な型式候補まで落とした構成。メーカーが価格を公開していない部品は単価を推定とし、その旨をバッジで示している。"
          />
          <div className="dsr-tablewrap">
            <table className="dsr-table dsr-table--bom">
              <thead>
                <tr>
                  <th scope="col">部位</th>
                  <th scope="col">型式候補</th>
                  <th scope="col">主要スペック</th>
                  <th scope="col" className="dsr-th-num">
                    概算単価
                  </th>
                  <th scope="col">出典</th>
                </tr>
              </thead>
              <tbody>
                {BOM.map((r) => (
                  <tr key={r.part}>
                    <th scope="row" className="dsr-td-part">
                      {r.part}
                    </th>
                    {/* data-label は狭い画面で表を積み上げに組み替えたときの見出しになる */}
                    <td className="dsr-td-model" data-label="型式候補">
                      {r.model}
                    </td>
                    <td className="dsr-td-spec" data-label="主要スペック">
                      {r.spec}
                    </td>
                    <td className="dsr-td-price" data-label="概算単価">
                      <span className="dsr-mono">{r.price}</span>
                      {r.estimated ? <span className="dsr-badge dsr-badge--est">推定</span> : null}
                    </td>
                    <td className="dsr-td-src" data-label="出典">
                      {r.src.url ? (
                        <a href={r.src.url} target="_blank" rel="noreferrer">
                          {r.src.label}
                        </a>
                      ) : (
                        <span className="dsr-src-none">{r.src.label}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dsr-total">
            <div className="dsr-total-main">
              <p className="dsr-total-label">合計レンジ</p>
              <p className="dsr-total-value">
                <span className="dsr-mono">$6,500</span>
                <span className="dsr-total-plus">＋</span>
                <span className="dsr-mono">¥99,799 – ¥203,799</span>
              </p>
            </div>
            <ul className="dsr-total-notes">
              <li>
                OpenArm 2.0 双腕完成品 <span className="dsr-mono">$6,500</span>
                <Sup n={8} /> は為替変動があるためドル表記のまま据え置いた。
              </li>
              <li>
                周辺の内訳：D435f <span className="dsr-mono">¥84,799</span>
                <Sup n={2} /> ＋ 真空系一式 <span className="dsr-mono">¥15,000 – 21,000</span>
                <span className="dsr-badge dsr-badge--est">推定</span>
              </li>
              <li>
                上限は力覚センサ 案A（Leptrino <span className="dsr-mono">¥98,000</span>
                <Sup n={9} />）を含めた場合。案A は任意で、初期構成には含まない。
              </li>
              <li>
                真空系はポンプ価格が非公開のためレンジ推定。エジェクタ方式（SMC ZH05DS・11 g・
                <span className="dsr-mono">¥1,400</span>・−88 kPa）は単体では有利だが圧縮エア源一式が必須のため、自律移動する対人ロボットでは DC ポンプ方式を採る。
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* D ------------------------------------------------------------ */}
      <section className="dsr-section" id="dsr-decision">
        <div className="dsr-inner">
          <Head
            title="力覚センサをどうするか"
            lead="この構成で最も高い単一部品が 6 軸力覚センサである。買うか、買わずに済ませるか、いつ買うか。3 案を同じ評価軸で並べて判断した。"
          />

          <div className="dsr-tablewrap">
            <table className="dsr-table dsr-cmp">
              <thead>
                <tr>
                  <th scope="col" className="dsr-cmp-axis">
                    評価軸
                  </th>
                  <th scope="col" className="dsr-cmp-h">
                    <span className="dsr-cmp-tag">案 1</span>
                    <span className="dsr-cmp-name">Leptrino PFS055YA251U6</span>
                    <span className="dsr-cmp-sub">6 軸力覚センサを手首に追加</span>
                  </th>
                  <th scope="col" className="dsr-cmp-h dsr-cmp-rec">
                    <span className="dsr-cmp-tag">
                      案 2<span className="dsr-badge dsr-badge--rec">推奨</span>
                    </span>
                    <span className="dsr-cmp-name">モータ電流ベースのトルク推定</span>
                    <span className="dsr-cmp-sub">追加ハードウェアなし</span>
                  </th>
                  <th scope="col" className="dsr-cmp-h">
                    <span className="dsr-cmp-tag">案 3</span>
                    <span className="dsr-cmp-name">気圧センサ / ロードセル</span>
                    <span className="dsr-cmp-sub">簡易な接触検知のみ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {CMP.map((r) => (
                  <tr key={r.axis}>
                    <th scope="row" className="dsr-cmp-axis">
                      {r.axis}
                    </th>
                    <td>{r.a1}</td>
                    <td className="dsr-cmp-rec">{r.a2}</td>
                    <td>{r.a3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dsr-why">
            <p className="dsr-why-label">なぜこの結論か</p>
            <p className="dsr-why-title">
              まず案 2（電流推定）で接触検知を成立させ、圧着力の定量保証が必要になった段階で案 1
              を手首に追加する二段構え。
            </p>
            <p className="dsr-why-body">
              OpenArm 2.0 は全関節が QDD（準ダイレクトドライブ）で、減速比は{' '}
              <span className="dsr-mono">9:1 – 40:1</span>
              <Sup n={7} />。産業用ロボットの <span className="dsr-mono">100:1 – 160:1</span>{' '}
              に比べて減速段が浅く、ハーモニックドライブ非線形性や摩擦といった電流→トルク換算の誤差源が構造的に小さい。つまり本機は、電流ベース推定がもっとも効きやすい部類のハードウェアである。実際に文献では、モータ電流からの手先力推定が RMSE{' '}
              <span className="dsr-mono">1.945 N</span>、同条件で 6 軸 F/T センサを使った場合が{' '}
              <span className="dsr-mono">2.004 N</span>
              <Sup n={11} /> と報告されており、少なくとも接触の有無を判定する用途では追加センサの優位は自明ではない。一方で{' '}
              <span className="dsr-mono">4 N</span>{' '}
              という押付力の定量保証まで踏み込むなら、この誤差は許容できず、最小検出荷重{' '}
              <span className="dsr-mono">10 g</span>・分解能{' '}
              <span className="dsr-mono">±1/2000</span> の案 1
              <Sup n={9} /> が必要になる。したがって初期構成では{' '}
              <span className="dsr-mono">¥98,000</span>{' '}
              を先送りし、定量保証が要件化した時点で手首に追加する。
            </p>
          </div>
        </div>
      </section>

      {/* E ------------------------------------------------------------ */}
      <section className="dsr-section" id="dsr-open-questions">
        <div className="dsr-inner">
          <Head
            title="リスクと検証計画"
            lead="現時点で設計を揺らしうる未確定事項。いずれも「次にどの実測を取れば潰せるか」まで落として管理している。"
          />
          <ol className="dsr-risks">
            {RISKS.map((r) => (
              <li className="dsr-risk" key={r.num}>
                <div className="dsr-risk-head">
                  <span className="dsr-risk-num">{r.num}</span>
                  <h3 className="dsr-risk-title">{r.title}</h3>
                </div>
                <div className="dsr-risk-grid">
                  <div className="dsr-risk-cell">
                    <p className="dsr-risk-label">リスク</p>
                    <p className="dsr-risk-text">{r.risk}</p>
                  </div>
                  <div className="dsr-risk-cell">
                    <p className="dsr-risk-label">なぜ効くか</p>
                    <p className="dsr-risk-text">{r.why}</p>
                  </div>
                  <div className="dsr-risk-cell dsr-risk-cell--next">
                    <p className="dsr-risk-label">次の検証アクション</p>
                    <p className="dsr-risk-text">{r.next}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* F ------------------------------------------------------------ */}
      <section className="dsr-section dsr-section--refs" id="dsr-references">
        <div className="dsr-inner">
          <Head
            title="出典"
            lead="本文の上付き番号に対応する一次資料。価格・仕様はいずれも参照時点のもの。"
          />
          <ol className="dsr-refs">
            {REFS.map((r) => (
              <li className="dsr-ref-item" id={`dsr-ref-${r.n}`} key={r.n}>
                <span className="dsr-ref-num">{String(r.n).padStart(2, '0')}</span>
                <span className="dsr-ref-body">
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                  <span className="dsr-ref-site">{r.site}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
