import * as THREE from 'three'

/**
 * Tube whose vertices are rewritten every frame from a curve, used for the
 * vacuum lines that run from each suction head back to its pump. The hoses have
 * to follow the arms, so the geometry is allocated once and swept in place.
 */
export function createTubeGeometry(segments: number, radial: number) {
  const count = (segments + 1) * (radial + 1)
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i += 1) {
    for (let j = 0; j <= radial; j += 1) uvs.push(i / segments, j / radial)
  }
  const stride = radial + 1
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * stride + j
      const b = a + stride
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10)
  geometry.userData.segments = segments
  geometry.userData.radial = radial
  return geometry
}

const _point = new THREE.Vector3()
const _next = new THREE.Vector3()
const _tangent = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _binormal = new THREE.Vector3()
const _radial = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _altUp = new THREE.Vector3(1, 0, 0)

export function updateTubeGeometry(
  geometry: THREE.BufferGeometry,
  curve: THREE.Curve<THREE.Vector3>,
  radius: number | ((t: number) => number),
) {
  const radiusAt = typeof radius === 'function' ? radius : () => radius
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute
  const radial = geometry.userData.radial as number
  const segments = geometry.userData.segments as number
  const stride = radial + 1

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    curve.getPoint(t, _point)
    curve.getPoint(Math.min(t + 0.008, 1), _next)
    _tangent.subVectors(_next, _point)
    if (_tangent.lengthSq() < 1e-10) _tangent.set(0, 1, 0)
    _tangent.normalize()
    const reference = Math.abs(_tangent.dot(_up)) > 0.92 ? _altUp : _up
    _normal.crossVectors(_tangent, reference).normalize()
    _binormal.crossVectors(_tangent, _normal).normalize()

    const r = radiusAt(t)
    for (let j = 0; j <= radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2
      _radial.copy(_normal).multiplyScalar(Math.cos(angle)).addScaledVector(_binormal, Math.sin(angle)).normalize()
      const index = i * stride + j
      position.setXYZ(index, _point.x + _radial.x * r, _point.y + _radial.y * r, _point.z + _radial.z * r)
      normal.setXYZ(index, _radial.x, _radial.y, _radial.z)
    }
  }
  position.needsUpdate = true
  normal.needsUpdate = true
}
