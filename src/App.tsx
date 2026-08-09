import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PatchAssistScene, SceneLoader } from './components/PatchAssistScene'
import {
  ArrowIcon,
  CameraIcon,
  CheckIcon,
  ExpandIcon,
  InfoIcon,
  OrbitIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
} from './icons'

const DEMO_SECONDS = 22

const phases = [
  {
    id: '01',
    start: 0,
    label: '認識',
    title: '湿布と貼付位置を認識',
    description: 'RGB-Dカメラから柔軟物の輪郭と肌面を同時に推定します。',
    technical: 'VLA perception',
  },
  {
    id: '02',
    start: 0.24,
    label: '剥離',
    title: '保護フィルムを両腕で剥離',
    description: '左右のピンチグリッパーで張力を保ち、湿布の変形を抑えます。',
    technical: 'Bimanual control',
  },
  {
    id: '03',
    start: 0.51,
    label: '整列',
    title: '貼付ポイントへ滑らかに移動',
    description: '人との距離を監視しながら、安全な軌道をリアルタイム生成します。',
    technical: 'Safe trajectory',
  },
  {
    id: '04',
    start: 0.76,
    label: '圧着',
    title: '力を制御しながら貼り付け',
    description: '両端の接触力を監視し、肌面へ均一に圧着します。',
    technical: 'Force control',
  },
]

type CameraMode = 'overview' | 'detail'

function getPhaseIndex(progress: number) {
  for (let index = phases.length - 1; index >= 0; index -= 1) {
    if (progress >= phases[index].start) return index
  }
  return 0
}

function formatTime(progress: number) {
  const seconds = Math.round(progress * DEMO_SECONDS)
  return `00:${seconds.toString().padStart(2, '0')}`
}

function LogoMark() {
  return (
    <div className="logo-mark" aria-hidden="true">
      <span />
      <span />
    </div>
  )
}

export default function App() {
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview')
  const [showAbout, setShowAbout] = useState(false)
  const animationFrame = useRef<number | null>(null)
  const previousTime = useRef<number | null>(null)
  const phaseIndex = getPhaseIndex(progress)
  const completed = progress >= 0.999

  const reset = useCallback(() => {
    setProgress(0)
    setIsPlaying(false)
    setHasStarted(false)
    setCameraMode('overview')
    previousTime.current = null
  }, [])

  const togglePlayback = useCallback(() => {
    if (progress >= 0.999) setProgress(0)
    setHasStarted(true)
    setIsPlaying((value) => !value)
  }, [progress])

  useEffect(() => {
    if (!isPlaying) {
      previousTime.current = null
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
      return
    }

    const tick = (time: number) => {
      if (previousTime.current === null) previousTime.current = time
      const delta = Math.min((time - previousTime.current) / 1000, 0.5)
      previousTime.current = time
      setProgress((current) => {
        const next = Math.min(1, current + delta / DEMO_SECONDS)
        if (next >= 1) setIsPlaying(false)
        return next
      })
      animationFrame.current = requestAnimationFrame(tick)
    }

    animationFrame.current = requestAnimationFrame(tick)
    return () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    }
  }, [isPlaying])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlayback()
      }
      if (event.key.toLowerCase() === 'r') reset()
      const phase = Number(event.key) - 1
      if (phase >= 0 && phase < phases.length) {
        setProgress(phases[phase].start)
        setHasStarted(true)
        setIsPlaying(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reset, togglePlayback])

  const metrics = useMemo(() => {
    const forceRamp = Math.min(1, Math.max(0, (progress - 0.78) / 0.1)) * 4.2
    const release = Math.min(1, Math.max(0, (progress - 0.97) / 0.03))
    const force = forceRamp * (1 - release) + 0.4 * release
    const confidence = 96.4 + Math.sin(progress * 8) * 1.1
    return {
      force: force.toFixed(1),
      confidence: confidence.toFixed(1),
      latency: Math.round(42 + Math.sin(progress * 10) * 3),
    }
  }, [progress])

  const enterFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
    else await document.exitFullscreen()
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="PatchAssist ホーム">
          <LogoMark />
          <span className="brand-copy">
            <strong>PatchAssist</strong>
            <small>Physical AI prototype</small>
          </span>
        </a>

        <div className="header-meta">
          <span className="team-name">KUPAC / KYOTO</span>
          <span className="live-badge"><i /> Simulation online</span>
          <button className="icon-button" type="button" onClick={() => setShowAbout(true)} aria-label="デモについて">
            <InfoIcon />
          </button>
        </div>
      </header>

      <main id="top" className="main-layout">
        <section className="story-panel" aria-labelledby="hero-title">
          <div className="story-intro">
            <p className="eyebrow"><span>Challenge ATOM</span><span>Concept 01</span></p>
            <h1 id="hero-title">「貼れない」を、<br /><em>ひとりでできる</em>へ。</h1>
            <p className="lead">
              背中への湿布貼付を、しなやかな双腕ロボットが支援する。
              高齢者の自立と尊厳に寄り添うフィジカルAIです。
            </p>

            <div className="primary-actions">
              <button className="primary-button" type="button" onClick={togglePlayback}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
                {completed ? 'もう一度見る' : isPlaying ? '一時停止' : hasStarted ? 'デモを再開' : '3Dデモを開始'}
                {!isPlaying && <ArrowIcon className="button-arrow" />}
              </button>
              <button className="reset-button" type="button" onClick={reset} disabled={!hasStarted && progress === 0}>
                <ResetIcon />
                リセット
              </button>
            </div>
          </div>

          <div className="phase-list" aria-label="デモの工程">
            {phases.map((phase, index) => {
              const isActive = index === phaseIndex && !completed
              const isDone = progress > (phases[index + 1]?.start ?? 1) || completed
              return (
                <button
                  type="button"
                  className={`phase-row ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                  key={phase.id}
                  onClick={() => {
                    setProgress(phase.start)
                    setHasStarted(true)
                    setIsPlaying(false)
                  }}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="phase-index">{isDone ? <CheckIcon /> : phase.id}</span>
                  <span className="phase-copy">
                    <small>{phase.label} / {phase.technical}</small>
                    <strong>{phase.title}</strong>
                  </span>
                  <span className="phase-dot" />
                </button>
              )
            })}
          </div>

          <div className="story-footnote">
            <span>OpenArm 2.0</span>
            <span>7DoF × 2</span>
            <span>VLA control</span>
          </div>
        </section>

        <section className="simulator-panel" aria-label="PatchAssist 3Dシミュレーション">
          <Canvas
            className="scene-canvas"
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [2.9, 1.25, 2.5], fov: 38, near: 0.05, far: 100 }}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.setClearColor('#d2d4cd')
              gl.toneMappingExposure = 0.62
            }}
          >
            <Suspense fallback={<SceneLoader />}>
              <PatchAssistScene progress={progress} cameraMode={cameraMode} />
            </Suspense>
          </Canvas>

          <div className="scene-topbar">
            <div className="scene-title">
              <span>Simulation / Home care cell</span>
              <strong>{completed ? '貼付完了' : phases[phaseIndex].title}</strong>
            </div>
            <div className="scene-tools" aria-label="ビュー操作">
              <div className="segmented-control">
                <button
                  className={cameraMode === 'overview' ? 'is-selected' : ''}
                  type="button"
                  onClick={() => setCameraMode('overview')}
                  aria-label="全体ビュー"
                  title="全体ビュー"
                ><OrbitIcon /></button>
                <button
                  className={cameraMode === 'detail' ? 'is-selected' : ''}
                  type="button"
                  onClick={() => setCameraMode('detail')}
                  aria-label="接触部クローズアップ"
                  title="接触部クローズアップ"
                ><CameraIcon /></button>
              </div>
              <button className="scene-tool-button" type="button" onClick={enterFullscreen} aria-label="全画面表示">
                <ExpandIcon />
              </button>
            </div>
          </div>

          <div className="telemetry-card" aria-label="リアルタイムテレメトリ">
            <div className="telemetry-heading"><i /> Live telemetry</div>
            <dl>
              <div><dt>VLA confidence</dt><dd>{metrics.confidence}<span>%</span></dd></div>
              <div><dt>Contact force</dt><dd>{metrics.force}<span>N</span></dd></div>
              <div><dt>Inference</dt><dd>{metrics.latency}<span>ms</span></dd></div>
            </dl>
            <div className="safety-state"><span className="shield-icon">✓</span><span><small>Safety state</small><strong>Nominal</strong></span></div>
          </div>

          <div className="interaction-hint"><OrbitIcon />ドラッグして視点を回転</div>

          <div className="transport-panel">
            <button className="transport-play" type="button" onClick={togglePlayback} aria-label={isPlaying ? '一時停止' : '再生'}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <span className="timecode">{formatTime(progress)}</span>
            <div className="timeline-wrap">
              <input
                aria-label="デモ再生位置"
                type="range"
                min="0"
                max="1000"
                value={Math.round(progress * 1000)}
                onChange={(event) => {
                  setProgress(Number(event.target.value) / 1000)
                  setHasStarted(true)
                  setIsPlaying(false)
                }}
                style={{ '--progress': `${progress * 100}%` } as React.CSSProperties}
              />
              <div className="timeline-markers" aria-hidden="true">
                {phases.map((phase) => <i key={phase.id} style={{ left: `${phase.start * 100}%` }} />)}
              </div>
            </div>
            <span className="timecode">00:{DEMO_SECONDS}</span>
            <button className="transport-reset" type="button" onClick={reset} aria-label="最初に戻る"><ResetIcon /></button>
          </div>

          <div className={`phase-toast ${completed ? 'is-complete' : ''}`} aria-live="polite">
            <span className="toast-number">{completed ? <CheckIcon /> : phases[phaseIndex].id}</span>
            <span>
              <small>{completed ? 'TASK COMPLETE' : phases[phaseIndex].technical}</small>
              <strong>{completed ? '湿布を安全に貼付しました' : phases[phaseIndex].description}</strong>
            </span>
          </div>
        </section>
      </main>

      {showAbout && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAbout(false)}>
          <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowAbout(false)} aria-label="閉じる">×</button>
            <p className="eyebrow">About this demo</p>
            <h2 id="about-title">湿布貼付を、身体介助の最初の一歩に。</h2>
            <p>
              PatchAssistは、VLA（Vision-Language-Action）モデルと双腕マニピュレータを組み合わせ、
              柔軟な湿布の剥離・搬送・貼付を一気通貫で行うコンセプトです。
            </p>
            <div className="about-grid">
              <div><small>Robot platform</small><strong>OpenArm 2.0</strong></div>
              <div><small>Interaction</small><strong>React + Three.js</strong></div>
              <div><small>3D model license</small><strong>Apache 2.0</strong></div>
              <div><small>Team</small><strong>KUPAC / Kyoto</strong></div>
            </div>
            <a href="https://github.com/enactic/openarm_description" target="_blank" rel="noreferrer">
              公開モデルの配布元を見る <ArrowIcon />
            </a>
          </section>
        </div>
      )}
    </div>
  )
}
