import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Check, List } from 'lucide-react'
import ControlChart from './components/ControlChart'
import Dossier from './components/Dossier'
import ImageRevealBackground, { BG_IMAGE_STILL } from './components/ImageRevealBackground'
import IndexDrawer from './components/IndexDrawer'
import { BracketFrame, CornerBracket, GlobeWire } from './components/marks'
import { type CameraMode, PatchAssistScene, SceneLoader } from './components/PatchAssistScene'
import { DEMO_SECONDS, STAGES, demoState, telemetry } from './lib/sequence'
import {
  CameraIcon,
  CheckIcon,
  ExpandIcon,
  OrbitIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
} from './icons'

function formatTime(progress: number) {
  const seconds = Math.round(progress * DEMO_SECONDS)
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

/** 3D はどの表示モードでも同じ設定で描く。撮影用の bare モードからも使う。 */
function SceneCanvas({
  state,
  cameraMode,
  playing,
}: {
  state: ReturnType<typeof demoState>
  cameraMode: CameraMode
  playing: boolean
}) {
  return (
    <Canvas
      className="scene-canvas"
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [1.7, 1.7, 1.3], fov: 34, near: 0.05, far: 60 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        // Without a tone map the key light clips every lit surface to
        // flat white; neutral keeps the highlights rolled off in hue.
        toneMapping: NeutralToneMapping,
        toneMappingExposure: 1.12,
      }}
      onCreated={(created) => {
        if (import.meta.env.DEV) {
          ; (window as unknown as { __three?: unknown }).__three = created
        }
      }}
    >
      <Suspense fallback={<SceneLoader />}>
        <PatchAssistScene state={state} cameraMode={cameraMode} playing={playing} />
      </Suspense>
    </Canvas>
  )
}

export default function App() {
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [bare, setBare] = useState(false)
  const frame = useRef<number | null>(null)
  const previous = useRef<number | null>(null)

  const state = useMemo(() => demoState(progress), [progress])
  const readout = useMemo(() => telemetry(state), [state])
  const completed = progress >= 0.999

  const reset = useCallback(() => {
    setProgress(0)
    setIsPlaying(false)
    setHasStarted(false)
    previous.current = null
  }, [])

  const toggle = useCallback(() => {
    setProgress((value) => (value >= 0.999 ? 0 : value))
    setHasStarted(true)
    setIsPlaying((value) => !value)
  }, [])

  const seek = useCallback((value: number) => {
    setProgress(value)
    setHasStarted(true)
    setIsPlaying(false)
  }, [])

  const scrollToDemo = useCallback(() => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      previous.current = null
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      return
    }
    const tick = (time: number) => {
      if (previous.current === null) previous.current = time
      const delta = Math.min((time - previous.current) / 1000, 0.4)
      previous.current = time
      setProgress((current) => {
        const next = Math.min(1, current + delta / DEMO_SECONDS)
        if (next >= 1) setIsPlaying(false)
        return next
      })
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [isPlaying])

  useEffect(() => {
    if (!import.meta.env.DEV) return
      ; (window as unknown as { __seek?: (value: number) => void }).__seek = (value: number) => {
        setIsPlaying(false)
        setHasStarted(true)
        setProgress(Math.max(0, Math.min(1, value)))
      }
    // ?p=0.42 lets the screenshot harness park the sequence on any instant.
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('p')
    if (requested !== null) {
      setHasStarted(true)
      setProgress(Math.max(0, Math.min(1, Number(requested))))
    }
    if (params.get('view') === 'wide') setCameraMode('wide')
    // ?bare=1 は 3D だけを全画面で出す。ヒーロー背景の 2 枚を撮るための状態。
    if (params.get('bare') === '1') setBare(true)
    const scroll = params.get('scroll')
    if (scroll !== null) window.scrollTo({ top: Number(scroll), behavior: 'instant' as ScrollBehavior })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.code === 'Space') {
        event.preventDefault()
        toggle()
      }
      if (event.key.toLowerCase() === 'r') reset()
      const index = Number(event.key) - 1
      if (index >= 0 && index < STAGES.length) seek(STAGES[index].start + 0.001)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reset, seek, toggle])

  const enterFullscreen = async () => {
    const target = document.querySelector('.simulator') as HTMLElement | null
    try {
      if (!document.fullscreenElement) await (target ?? document.documentElement).requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      // iOS Safari は要素の全画面化を持たない。押しても何も起きないだけにする。
    }
  }

  if (bare) {
    return (
      <div className="bare-shot">
        <SceneCanvas state={state} cameraMode={cameraMode} playing={false} />
      </div>
    )
  }

  return (
    <div className="app-shell font-jakarta">
      <ImageRevealBackground />

      <header className="site-header">
        <a
          className="brand font-orbitron"
          href="#top"
          aria-label="PatchAssist"
          onClick={() => setDrawerOpen(false)}
        >
          PATCHASSIST
          <span className="brand-deg">˚</span>
        </a>

        <nav className="header-nav" aria-label="ページ内リンク">
          <a href="#control-flow">制御</a>
          <a href="#dsr-pipeline">工程</a>
          <a href="#dsr-bom">構成</a>
          <a href="#dsr-decision">力覚センサ</a>
          <a href="#dsr-open-questions">検証計画</a>
          <span className="header-divider" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            className="header-index"
            onClick={() => setDrawerOpen(true)}
            aria-label="インデックスを開く"
          >
            <List strokeWidth={1.5} style={{ width: 'var(--icon)', height: 'var(--icon)' }} />
            <span className="header-badge">{completed ? '04' : state.stage.number}</span>
          </button>
        </nav>
      </header>

      <main id="top">
        {/* ---------------- ヒーロー：最初のビューポート ---------------- */}
        <section className="hero" aria-label="PatchAssist">
          <div className="hero-left">
            <CornerBracket variant="tl" className="hero-bracket" />

            <p className="hero-eyebrow font-orbitron">
              <span>CHALLENGE ATOM</span>
              <span>KYOTO</span>
            </p>

            <h1 className="hero-headline font-orbitron">
              <span className="hero-line">背中の一枚を、</span>
              <span className="hero-line">ひとりで</span>
              <span className="hero-line">貼れるように。</span>
            </h1>

            <CornerBracket variant="bl" className="hero-bracket" />

            <p className="hero-lead">
              背中を3Dスキャンし、本人に貼りたい場所を指してもらう。
              真空ポンプ2台でフィルムを剥がし、接触した力を見ながら圧着する。
              4つの工程を、OpenArm 2.0の双腕でひと続きに実行します。
            </p>

            <div className="hero-actions">
              <button
                className="cta"
                type="button"
                onClick={() => {
                  setProgress((value) => (value >= 0.999 ? 0 : value))
                  setHasStarted(true)
                  setIsPlaying(true)
                  scrollToDemo()
                }}
              >
                {completed ? 'もう一度再生' : hasStarted ? '再開' : '動作シーケンスを再生'}
                <ArrowUpRight strokeWidth={1.5} className="cta-arrow" />
              </button>
              <button className="cta-quiet" type="button" onClick={reset} disabled={!hasStarted && progress === 0}>
                最初から
              </button>
            </div>
          </div>

          <div className="hero-feature">
            <BracketFrame className="bracket-frame" />
            <GlobeWire className="hero-globe" />
            <p className="hero-tagline">
              <span>PHYSICAL AI</span>
              <span>湿布貼付支援</span>
            </p>
            <p className="hero-sim">
              <i />
              SIMULATION
            </p>
          </div>

          {/* lg 未満はスポットライトを出さず、静止画を 1 枚だけ置く */}
          <div className="hero-still lg:hidden">
            <img src={BG_IMAGE_STILL} alt="OpenArm 2.0 の双腕が湿布を背中に圧着している様子" loading="lazy" />
          </div>
        </section>

        {/* ---------------- 動作シミュレーション ---------------- */}
        <section className="demo" id="demo" aria-label="PatchAssist 動作シミュレーション">
          <div className="demo-head">
            <h2 className="demo-title">動作シーケンス</h2>
            <p className="demo-time">
              {formatTime(progress)} / {formatTime(1)}
            </p>
          </div>

          <ol className="stage-rail" aria-label="工程">
            {STAGES.map((item) => {
              const isActive = item.id === state.stage.id
              const isDone = progress > item.end - 0.001
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`stage-row${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
                    onClick={() => seek(item.start + 0.001)}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className="stage-num">{isDone ? <CheckIcon /> : item.number}</span>
                    <span className="stage-copy">
                      <strong>{item.title}</strong>
                      <em>{item.method}</em>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="simulator">
            <BracketFrame className="bracket-frame bracket-frame--sim" />
            <SceneCanvas state={state} cameraMode={cameraMode} playing={isPlaying} />

            <div className="scene-topbar">
              <div className="scene-title">
                <span>工程 {state.stage.number}</span>
                <strong>{completed ? '貼付完了' : state.stage.title}</strong>
              </div>
              <div className="scene-tools">
                <div className="segmented">
                  <button
                    type="button"
                    className={cameraMode === 'follow' ? 'is-selected' : ''}
                    onClick={() => setCameraMode('follow')}
                    title="工程に追従"
                    aria-label="工程に追従するカメラ"
                  >
                    <CameraIcon />
                  </button>
                  <button
                    type="button"
                    className={cameraMode === 'wide' ? 'is-selected' : ''}
                    onClick={() => setCameraMode('wide')}
                    title="全体を見る"
                    aria-label="全体ビュー"
                  >
                    <OrbitIcon />
                  </button>
                </div>
                <button className="icon-button" type="button" onClick={enterFullscreen} aria-label="全画面表示">
                  <ExpandIcon />
                </button>
              </div>
            </div>

            <aside className="telemetry" aria-label="テレメトリ">
              <div className="telemetry-head">{readout.heading}</div>
              <dl>
                {readout.rows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      {row.value}
                      {row.unit && <span>{row.unit}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="telemetry-state">
                <small>{readout.state.label}</small>
                <strong>{readout.state.value}</strong>
              </div>
            </aside>

            <p className="scene-hint">
              <OrbitIcon />
              ドラッグ:回転 / 右ドラッグ:平行移動 / ホイール:拡大
            </p>

            <div className="transport">
              <button className="transport-play" type="button" onClick={toggle} aria-label={isPlaying ? '一時停止' : '再生'}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <span className="timecode">{formatTime(progress)}</span>
              <div className="timeline">
                <div className="timeline-bands" aria-hidden="true">
                  {STAGES.map((item) => (
                    <i
                      key={item.id}
                      style={{
                        left: `${item.start * 100}%`,
                        width: `${(item.end - item.start) * 100}%`,
                        opacity: progress >= item.start ? 1 : 0.18,
                      }}
                    />
                  ))}
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={Math.round(progress * 1000)}
                  aria-label="再生位置"
                  onChange={(event) => seek(Number(event.target.value) / 1000)}
                />
              </div>
              <span className="timecode">{formatTime(1)}</span>
              <button className="icon-button" type="button" onClick={reset} aria-label="最初に戻る">
                <ResetIcon />
              </button>
            </div>

            <div className={`toast${completed ? ' is-complete' : ''}`} aria-live="polite">
              <span className="toast-num">{completed ? <Check strokeWidth={2} /> : state.stage.number}</span>
              <span className="toast-copy">
                <strong>{completed ? '貼付を完了し、アームを退避しました' : state.stage.summary}</strong>
              </span>
            </div>
          </div>
        </section>

        {/* ---------------- 制御フロー（SFC） ---------------- */}
        <section className="demo control-flow" id="control-flow" aria-label="制御フロー">
          <div className="demo-head">
            <h2 className="demo-title">制御フロー</h2>
            <p className="demo-time">SFC / IEC 61131-3</p>
          </div>
          <ul className="sfc-legend">
            <li>
              <b>N</b>非保持（ステップ実行中のみ）
            </li>
            <li>
              <b>S</b>セット（以降も保持）
            </li>
            <li>
              <b>R</b>リセット（解除）
            </li>
            <li>
              <b>P</b>パルス（1 回だけ）
            </li>
          </ul>
          <ControlChart state={state} onSelect={seek} />
        </section>

        <Dossier />
      </main>

      <footer className="site-footer">
        <p>
          PatchAssist — Challenge ATOM / Kyoto. 3Dモデルは Enactic, Inc. の
          <a href="https://github.com/enactic/openarm_description" target="_blank" rel="noreferrer">
            OpenArm Description
          </a>
          と Intel Corporation の
          <a href="https://github.com/IntelRealSense/realsense-ros" target="_blank" rel="noreferrer">
            realsense-ros
          </a>
          （いずれも Apache License 2.0）を同梱しています。
        </p>
        <p className="site-footer-note">
          本ページの数値は公開資料に基づく机上値です。「推定」と明記した項目は実測前の見積りです。
        </p>
      </footer>

      <IndexDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeIndex={state.stage.index}
        progress={progress}
        onSelectStage={(index) => {
          seek(STAGES[index].start + 0.001)
          scrollToDemo()
        }}
      />
    </div>
  )
}
