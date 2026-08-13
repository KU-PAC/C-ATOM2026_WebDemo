import * as THREE from 'three'

/**
 * Parametric upper body used as the scan target.
 *
 * The demo has to show a centimetre-accurate reconstruction of a back, so the
 * back itself is generated from a closed-form surface rather than imported as
 * an opaque mesh: the same function feeds the visible skin, the simulated depth
 * point cloud, the contour overlay and the projection of the patient's chosen
 * application point. Everything therefore agrees by construction.
 *
 * Local frame: +Y up, +Z is the direction the patient faces, so the back is the
 * -Z half. The origin sits at the top of the pelvis.
 */

const SECTIONS: { y: number; halfWidth: number; halfDepth: number; exponent: number }[] = [
  { y: -0.16, halfWidth: 0.158, halfDepth: 0.118, exponent: 2.5 },
  { y: -0.05, halfWidth: 0.148, halfDepth: 0.107, exponent: 2.5 },
  { y: 0.06, halfWidth: 0.152, halfDepth: 0.106, exponent: 2.6 },
  { y: 0.17, halfWidth: 0.166, halfDepth: 0.112, exponent: 2.7 },
  { y: 0.28, halfWidth: 0.182, halfDepth: 0.117, exponent: 2.8 },
  { y: 0.38, halfWidth: 0.196, halfDepth: 0.118, exponent: 2.9 },
  { y: 0.46, halfWidth: 0.204, halfDepth: 0.112, exponent: 2.9 },
  { y: 0.52, halfWidth: 0.196, halfDepth: 0.099, exponent: 2.8 },
  { y: 0.56, halfWidth: 0.162, halfDepth: 0.085, exponent: 2.6 },
  { y: 0.585, halfWidth: 0.108, halfDepth: 0.068, exponent: 2.4 },
]

export const TORSO_BOTTOM = SECTIONS[0].y
export const TORSO_TOP = SECTIONS[SECTIONS.length - 1].y

function interpolateSection(y: number) {
  const clamped = THREE.MathUtils.clamp(y, TORSO_BOTTOM, TORSO_TOP)
  let index = 0
  while (index < SECTIONS.length - 2 && clamped > SECTIONS[index + 1].y) index += 1
  const from = SECTIONS[index]
  const to = SECTIONS[index + 1]
  const raw = (clamped - from.y) / (to.y - from.y)
  const t = raw * raw * (3 - 2 * raw)
  return {
    halfWidth: THREE.MathUtils.lerp(from.halfWidth, to.halfWidth, t),
    halfDepth: THREE.MathUtils.lerp(from.halfDepth, to.halfDepth, t),
    exponent: THREE.MathUtils.lerp(from.exponent, to.exponent, t),
  }
}

const gaussian = (value: number, width: number) => Math.exp(-(value * value) / (width * width))

/** Surface point for ring angle theta (0 = patient's left side) at height y. */
export function torsoPoint(y: number, theta: number, target = new THREE.Vector3()) {
  const { halfWidth, halfDepth, exponent } = interpolateSection(y)
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const power = 2 / exponent
  let x = halfWidth * Math.sign(cos) * Math.abs(cos) ** power
  let z = halfDepth * Math.sign(sin) * Math.abs(sin) ** power

  // Postural lean: the seated patient rounds forward slightly towards the top.
  z += 0.052 * gaussian((y - TORSO_TOP) / 0.42, 1) * (y > 0 ? 1 : 0.2)

  if (z < 0) {
    const back = -z
    const spineDepth = 0.019 * THREE.MathUtils.smoothstep(y, -0.08, 0.12) * (1 - THREE.MathUtils.smoothstep(y, 0.44, 0.56))
    const scapula = 0.011 * gaussian(y - 0.4, 0.075)
    const adjusted =
      back -
      spineDepth * gaussian(x, 0.036) +
      scapula * (gaussian(x - 0.098, 0.055) + gaussian(x + 0.098, 0.055)) -
      0.006 * gaussian(y - 0.03, 0.09) * gaussian(x, 0.15)
    z = -adjusted
  } else {
    z += 0.004 * gaussian(y - 0.3, 0.12) * gaussian(x, 0.1)
  }

  // Latissimus taper towards the arm pits.
  const pit = gaussian(y - 0.46, 0.06) * gaussian(Math.abs(x) - 0.19, 0.05)
  x *= 1 - 0.06 * pit

  return target.set(x, y, z)
}

/** Outward unit normal, from finite differences of the surface. */
export function torsoNormal(y: number, theta: number, target = new THREE.Vector3()) {
  const eps = 0.004
  const a = torsoPoint(y, theta + eps, new THREE.Vector3())
  const b = torsoPoint(y, theta - eps, new THREE.Vector3())
  const c = torsoPoint(Math.min(y + eps, TORSO_TOP), theta, new THREE.Vector3())
  const d = torsoPoint(Math.max(y - eps, TORSO_BOTTOM), theta, new THREE.Vector3())
  const tangentTheta = a.sub(b)
  const tangentY = c.sub(d)
  // dP/dy x dP/dtheta points out of the body; the other order points into it.
  return target.crossVectors(tangentY, tangentTheta).normalize()
}

/**
 * Maps a normalised back coordinate to the surface. theta = -PI/2 is the spine.
 * u: -1 (patient's right) .. +1 (patient's left); v: 0 (waist) .. 1 (shoulders).
 */
const BACK_SPAN = 1.05

export function backTheta(u: number, span = BACK_SPAN) {
  return -Math.PI / 2 + THREE.MathUtils.clamp(u, -1.2, 1.2) * span
}

export function backHeight(v: number) {
  return THREE.MathUtils.lerp(-0.02, 0.5, THREE.MathUtils.clamp(v, 0, 1))
}

export function backSurfacePoint(u: number, v: number, target = new THREE.Vector3()) {
  return torsoPoint(backHeight(v), backTheta(u), target)
}

export function backSurfaceNormal(u: number, v: number, target = new THREE.Vector3()) {
  return torsoNormal(backHeight(v), backTheta(u), target)
}

export function createTorsoGeometry(rings = 84, segments = 96) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const point = new THREE.Vector3()

  for (let ring = 0; ring <= rings; ring += 1) {
    const v = ring / rings
    const y = THREE.MathUtils.lerp(TORSO_BOTTOM, TORSO_TOP, v)
    for (let segment = 0; segment <= segments; segment += 1) {
      const u = segment / segments
      torsoPoint(y, u * Math.PI * 2, point)
      positions.push(point.x, point.y, point.z)
      uvs.push(u, v)
    }
  }

  const stride = segments + 1
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * stride + segment
      const b = a + stride
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  // Shoulder cap so the neck join is closed.
  const capIndex = positions.length / 3
  positions.push(0, TORSO_TOP + 0.012, 0.012)
  uvs.push(0.5, 1)
  const lastRing = rings * stride
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(lastRing + segment, capIndex, lastRing + segment + 1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Tank-top style garment: a lofted shell offset outward from the torso. */
export function createGarmentGeometry(topY = 0.2, rings = 40, segments = 72) {
  const positions: number[] = []
  const indices: number[] = []
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let ring = 0; ring <= rings; ring += 1) {
    const v = ring / rings
    const y = THREE.MathUtils.lerp(TORSO_BOTTOM - 0.02, topY, v)
    const offset = 0.011 + 0.006 * (1 - v)
    for (let segment = 0; segment <= segments; segment += 1) {
      const theta = (segment / segments) * Math.PI * 2
      torsoPoint(y, theta, point)
      torsoNormal(y, theta, normal)
      // Scalloped hem so the garment edge is not a hard ring.
      const hem = 0.014 * Math.cos(theta * 3) * THREE.MathUtils.smoothstep(v, 0.72, 1)
      point.addScaledVector(normal, offset)
      point.y += hem
      positions.push(point.x, point.y, point.z)
    }
  }

  const stride = segments + 1
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * stride + segment
      const b = a + stride
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Even coverage of the back half, as seen by a depth camera behind the patient. */
export function sampleBackCloud(count: number) {
  const positions = new Float32Array(count * 3)
  const order = new Float32Array(count)
  const jitter = new Float32Array(count)
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()
  // The back is roughly twice as tall as it is wide, so bias the grid that
  // way; an isotropic spacing keeps the cloud from reading as scan lines.
  const columns = Math.round(Math.sqrt(count * 0.52))
  const rows = Math.ceil(count / columns)
  let index = 0

  for (let row = 0; row < rows && index < count; row += 1) {
    for (let column = 0; column < columns && index < count; column += 1) {
      const staggered = (column + (row % 2) * 0.5) / columns
      const u = staggered * 2 - 1
      const v = row / (rows - 1)
      const y = THREE.MathUtils.lerp(TORSO_BOTTOM + 0.02, TORSO_TOP - 0.01, v)
      const theta = backTheta(u, 1.3)
      torsoPoint(y, theta, point)
      // Float the samples just off the skin so they are never lost to z-fighting.
      point.addScaledVector(torsoNormal(y, theta, normal), 0.006)
      positions[index * 3] = point.x
      positions[index * 3 + 1] = point.y
      positions[index * 3 + 2] = point.z
      // Scan sweeps bottom to top, so reveal order follows height.
      order[index] = v * 0.9 + Math.abs(u) * 0.08
      jitter[index] = Math.random()
      index += 1
    }
  }

  return { positions, order, jitter, count: index }
}

/** Horizontal iso-height contours, the "cm accurate model" readout. */
export function createBackContours(levels = 11, samples = 64) {
  const positions: number[] = []
  const point = new THREE.Vector3()
  for (let level = 0; level < levels; level += 1) {
    const v = level / (levels - 1)
    const y = THREE.MathUtils.lerp(TORSO_BOTTOM + 0.04, TORSO_TOP - 0.03, v)
    for (let sample = 0; sample < samples; sample += 1) {
      const u = (sample / (samples - 1)) * 2 - 1
      const theta = backTheta(u, 1.18)
      torsoPoint(y, theta, point)
      const normal = torsoNormal(y, theta, new THREE.Vector3())
      point.addScaledVector(normal, 0.004)
      positions.push(point.x, point.y, point.z)
      if (sample > 0 && sample < samples - 1) positions.push(point.x, point.y, point.z)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

/**
 * MediaPipe Hand Landmarker topology. The patient's hand mesh is built from
 * these very points, so the overlay lands exactly on the knuckles.
 */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

/** Right hand, palm facing -Z, fingers along +Y, in metres. */
export const HAND_LANDMARKS: [number, number, number][] = [
  [0, 0, 0],
  [-0.026, 0.016, 0.012], [-0.045, 0.043, 0.018], [-0.056, 0.063, 0.02], [-0.064, 0.081, 0.019],
  [-0.026, 0.083, 0.004], [-0.03, 0.117, 0.006], [-0.032, 0.139, 0.008], [-0.033, 0.157, 0.009],
  [-0.005, 0.088, 0.002], [-0.006, 0.126, 0.003], [-0.007, 0.15, 0.005], [-0.007, 0.169, 0.006],
  [0.016, 0.085, 0.003], [0.019, 0.12, 0.005], [0.021, 0.142, 0.007], [0.022, 0.16, 0.008],
  [0.035, 0.076, 0.008], [0.041, 0.104, 0.011], [0.045, 0.121, 0.013], [0.048, 0.136, 0.014],
]

export const HAND_TIP_INDEX = 8

/**
 * A flat band swept along a path, kept tangent to the body by the surface
 * normal handed in with each point. A round tube along the same path reads as a
 * cord hanging off the shoulder; a band lies on it like the strap it is.
 */
export function createBandGeometry(
  points: THREE.Vector3[],
  normals: THREE.Vector3[],
  width: number,
  segments = 72,
) {
  const path = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
  const normalPath = new THREE.CatmullRomCurve3(normals, false, 'centripetal', 0.5)
  const positions: number[] = []
  const indices: number[] = []
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const lateral = new THREE.Vector3()

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    path.getPoint(t, point)
    path.getTangent(t, tangent)
    normalPath.getPoint(t, normal).normalize()
    lateral.crossVectors(tangent, normal).normalize().multiplyScalar(width / 2)
    positions.push(point.x - lateral.x, point.y - lateral.y, point.z - lateral.z)
    positions.push(point.x + lateral.x, point.y + lateral.y, point.z + lateral.z)
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Tapered capsule chain following an arbitrary polyline. */
export function createLimbGeometry(
  points: THREE.Vector3[],
  radius: (t: number) => number,
  segments = 48,
  radial = 20,
) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
  const frames = curve.computeFrenetFrames(segments, false)
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const point = new THREE.Vector3()
  const vertex = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    curve.getPointAt(t, point)
    const r = radius(t)
    for (let j = 0; j <= radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2
      const sin = Math.sin(angle)
      const cos = -Math.cos(angle)
      normal.copy(frames.normals[i]).multiplyScalar(cos).addScaledVector(frames.binormals[i], sin).normalize()
      vertex.copy(point).addScaledVector(normal, r)
      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(normal.x, normal.y, normal.z)
    }
  }

  const stride = radial + 1
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * stride + j
      const b = a + stride
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  // Closed ends. An open tube shows a hole where it is cut, which reads as a
  // severed limb from any angle that looks into it.
  const cap = (ring: number, t: number, outward: number) => {
    const centre = curve.getPointAt(t, new THREE.Vector3())
    const tangent = curve.getTangentAt(t, new THREE.Vector3()).multiplyScalar(outward)
    const middle = positions.length / 3
    positions.push(centre.x, centre.y, centre.z)
    normals.push(tangent.x, tangent.y, tangent.z)
    for (let j = 0; j < radial; j += 1) {
      // The wall winds so that (i, j) → (i, j+1) turns anticlockwise seen from
      // outside, so the start cap keeps that order and the end cap reverses it.
      if (outward < 0) indices.push(middle, ring + j, ring + j + 1)
      else indices.push(middle, ring + j + 1, ring + j)
    }
  }
  cap(0, 0, -1)
  cap(segments * stride, 1, 1)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}

/**
 * Analytic two-bone IK. The elbow is put on the circle where both bone lengths
 * are satisfied and swung towards `pole`, so an arm always reads as an upper
 * arm plus a forearm however the wrist moves — no segment can collapse or
 * stretch. A wrist beyond reach is pulled back onto the reachable sphere
 * rather than tearing the forearm off the elbow.
 */
const _axis = new THREE.Vector3()
const _perp = new THREE.Vector3()

export function solveArm(
  shoulder: THREE.Vector3,
  wristTarget: THREE.Vector3,
  pole: THREE.Vector3,
  upper: number,
  fore: number,
  elbow: THREE.Vector3,
  wrist: THREE.Vector3,
) {
  _axis.subVectors(wristTarget, shoulder)
  const reach = _axis.length()
  const span = THREE.MathUtils.clamp(reach, Math.abs(upper - fore) + 0.02, (upper + fore) * 0.998)
  _axis.divideScalar(reach || 1)
  wrist.copy(shoulder).addScaledVector(_axis, span)

  const along = (upper * upper - fore * fore + span * span) / (2 * span)
  const out = Math.sqrt(Math.max(upper * upper - along * along, 0))
  _perp.copy(pole).addScaledVector(_axis, -pole.dot(_axis))
  if (_perp.lengthSq() < 1e-8) _perp.set(-_axis.y, _axis.x, 0)
  _perp.normalize()
  return elbow.copy(shoulder).addScaledVector(_axis, along).addScaledVector(_perp, out)
}

/**
 * Flat ribbon whose vertices are rewritten every frame from a 3D curve. Used
 * for the release liner as it is peeled away, so the film always ends exactly
 * at the moving suction cup.
 */
export function createRibbonGeometry(segments: number) {
  const positions = new Float32Array((segments + 1) * 2 * 3)
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i += 1) {
    uvs.push(i / segments, 0, i / segments, 1)
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const _tangent = new THREE.Vector3()
const _side = new THREE.Vector3()
const _sample = new THREE.Vector3()
const _next = new THREE.Vector3()

export function updateRibbonGeometry(
  geometry: THREE.BufferGeometry,
  curve: THREE.Curve<THREE.Vector3>,
  width: number,
  up = new THREE.Vector3(0, 1, 0),
) {
  const attribute = geometry.getAttribute('position') as THREE.BufferAttribute
  const segments = attribute.count / 2 - 1
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    curve.getPoint(t, _sample)
    curve.getPoint(Math.min(t + 0.01, 1), _next)
    _tangent.subVectors(_next, _sample)
    if (_tangent.lengthSq() < 1e-9) _tangent.set(1, 0, 0)
    _tangent.normalize()
    _side.crossVectors(_tangent, up)
    if (_side.lengthSq() < 1e-9) _side.set(0, 0, 1)
    _side.normalize().multiplyScalar(width / 2)
    attribute.setXYZ(i * 2, _sample.x - _side.x, _sample.y - _side.y, _sample.z - _side.z)
    attribute.setXYZ(i * 2 + 1, _sample.x + _side.x, _sample.y + _side.y, _sample.z + _side.z)
  }
  attribute.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}
