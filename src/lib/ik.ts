import * as THREE from 'three'
import type { URDFJoint, URDFRobot } from 'urdf-loader'

/**
 * Task-space kinematics for one OpenArm 2.0 limb.
 *
 * The demo authors every motion as a tool pose (where the suction cup has to
 * be, and which way it points) instead of hand-tuned joint angles, so the arm
 * stays glued to the patch, the film and the scanned back even while those
 * targets move. The chain is extracted once from the URDF at zero pose and
 * then evaluated with plain matrix math, which keeps the solver off the
 * three.js scene graph and cheap enough to run several iterations per frame.
 */

const _m = new THREE.Matrix4()
const _rot = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()

export interface ChainOptions {
  /** Offset from the last joint frame to the tool control point. */
  toolOffset: THREE.Vector3
}

interface JointSpec {
  joint: URDFJoint
  axis: THREE.Vector3
  local: THREE.Matrix4
  lower: number
  upper: number
  /** Preferred resting value, used to resolve the 7-DoF null space. */
  rest: number
}

export class ArmChain {
  readonly side: 'left' | 'right'
  readonly specs: JointSpec[]
  readonly toolLocal: THREE.Matrix4
  private readonly base = new THREE.Matrix4()
  private readonly frames: THREE.Matrix4[]
  private readonly axesWorld: THREE.Vector3[]
  private readonly originsWorld: THREE.Vector3[]
  readonly q: number[]
  readonly toolMatrix = new THREE.Matrix4()

  constructor(robot: URDFRobot, side: 'left' | 'right', options: ChainOptions) {
    this.side = side
    const names = Array.from({ length: 7 }, (_, index) => `openarm_${side}_joint${index + 1}`)
    const joints = names.map((name) => robot.joints[name])
    if (joints.some((joint) => !joint)) throw new Error(`missing joints for ${side} arm`)

    // Freeze the chain at zero so every fixed transform between consecutive
    // joints can be read straight off the world matrices.
    const previous = joints.map((joint) => Number(joint.angle))
    joints.forEach((joint) => joint.setJointValue(0))
    robot.updateMatrixWorld(true)

    const parentOfFirst = joints[0].parent as THREE.Object3D
    this.base.copy(parentOfFirst.matrixWorld)

    this.specs = joints.map((joint, index) => {
      const parentWorld = index === 0 ? parentOfFirst.matrixWorld : joints[index - 1].matrixWorld
      const local = new THREE.Matrix4().copy(parentWorld).invert().multiply(joint.matrixWorld)
      const limit = joint.limit as { lower?: number | { toNumber(): number }; upper?: number | { toNumber(): number } }
      const lower = Number(limit?.lower ?? -Math.PI)
      const upper = Number(limit?.upper ?? Math.PI)
      return {
        joint,
        axis: new THREE.Vector3().copy(joint.axis as THREE.Vector3).normalize(),
        local,
        lower,
        upper,
        rest: THREE.MathUtils.clamp(0, lower, upper),
      }
    })

    // toolOffset is authored in world metres; the chain runs in URDF metres, so
    // divide out the display scale the robot group applies.
    const scale = new THREE.Vector3().setFromMatrixScale(joints[6].matrixWorld).x || 1
    this.toolLocal = new THREE.Matrix4().makeTranslation(
      options.toolOffset.x / scale,
      options.toolOffset.y / scale,
      options.toolOffset.z / scale,
    )

    joints.forEach((joint, index) => joint.setJointValue(previous[index]))

    this.frames = this.specs.map(() => new THREE.Matrix4())
    this.axesWorld = this.specs.map(() => new THREE.Vector3())
    this.originsWorld = this.specs.map(() => new THREE.Vector3())
    this.q = this.specs.map((spec) => spec.rest)
  }

  /** Re-reads the base transform; call after the robot group has been placed. */
  syncBase() {
    const parentOfFirst = this.specs[0].joint.parent as THREE.Object3D
    parentOfFirst.updateWorldMatrix(true, false)
    this.base.copy(parentOfFirst.matrixWorld)
  }

  setRestPose(values: number[]) {
    this.specs.forEach((spec, index) => {
      spec.rest = THREE.MathUtils.clamp(values[index] ?? spec.rest, spec.lower, spec.upper)
    })
  }

  setJoints(values: number[]) {
    for (let i = 0; i < this.specs.length; i += 1) {
      this.q[i] = THREE.MathUtils.clamp(values[i] ?? this.q[i], this.specs[i].lower, this.specs[i].upper)
    }
  }

  /** Forward kinematics for the current joint vector. */
  forward() {
    _m.copy(this.base)
    for (let i = 0; i < this.specs.length; i += 1) {
      const spec = this.specs[i]
      _q.setFromAxisAngle(spec.axis, this.q[i])
      _rot.makeRotationFromQuaternion(_q)
      _m.multiply(spec.local).multiply(_rot)
      this.frames[i].copy(_m)
      this.originsWorld[i].setFromMatrixPosition(_m)
      _rot.extractRotation(_m)
      this.axesWorld[i].copy(spec.axis).applyMatrix4(_rot).normalize()
    }
    this.toolMatrix.copy(_m).multiply(this.toolLocal)
    return this.toolMatrix
  }

  get toolPosition() {
    return _v.setFromMatrixPosition(this.toolMatrix).clone()
  }

  /** Writes the solved joint vector back onto the URDF robot. */
  apply() {
    for (let i = 0; i < this.specs.length; i += 1) this.specs[i].joint.setJointValue(this.q[i])
  }

  /**
   * Damped least squares solve towards a full tool pose. Returns the residual
   * position error in metres so callers can surface convergence in the HUD.
   */
  solve(targetPosition: THREE.Vector3, targetQuaternion: THREE.Quaternion, iterations = 8) {
    const n = this.specs.length
    const error = new Array<number>(6).fill(0)
    const jacobian: number[][] = Array.from({ length: 6 }, () => new Array<number>(n).fill(0))
    const toolPos = new THREE.Vector3()
    const toolQuat = new THREE.Quaternion()
    const deltaQuat = new THREE.Quaternion()
    const arm = new THREE.Vector3()
    const cross = new THREE.Vector3()
    let residual = 0

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      this.forward()
      toolPos.setFromMatrixPosition(this.toolMatrix)
      _rot.extractRotation(this.toolMatrix)
      toolQuat.setFromRotationMatrix(_rot)

      error[0] = targetPosition.x - toolPos.x
      error[1] = targetPosition.y - toolPos.y
      error[2] = targetPosition.z - toolPos.z
      residual = Math.hypot(error[0], error[1], error[2])

      deltaQuat.copy(targetQuaternion).multiply(toolQuat.invert())
      if (deltaQuat.w < 0) {
        deltaQuat.x = -deltaQuat.x
        deltaQuat.y = -deltaQuat.y
        deltaQuat.z = -deltaQuat.z
        deltaQuat.w = -deltaQuat.w
      }
      const sinHalf = Math.hypot(deltaQuat.x, deltaQuat.y, deltaQuat.z)
      const angle = 2 * Math.atan2(sinHalf, deltaQuat.w)
      const scale = sinHalf > 1e-6 ? angle / sinHalf : 2
      error[3] = deltaQuat.x * scale
      error[4] = deltaQuat.y * scale
      error[5] = deltaQuat.z * scale

      clampVector3(error, 0, 0.14)
      clampVector3(error, 3, 0.5)

      for (let i = 0; i < n; i += 1) {
        arm.subVectors(toolPos, this.originsWorld[i])
        cross.crossVectors(this.axesWorld[i], arm)
        jacobian[0][i] = cross.x
        jacobian[1][i] = cross.y
        jacobian[2][i] = cross.z
        jacobian[3][i] = this.axesWorld[i].x
        jacobian[4][i] = this.axesWorld[i].y
        jacobian[5][i] = this.axesWorld[i].z
      }

      const delta = damped(jacobian, error, n, 0.06)

      // Null-space drift back towards the authored rest pose keeps the redundant
      // 7th joint from wandering into visually odd elbow configurations.
      for (let i = 0; i < n; i += 1) {
        const spec = this.specs[i]
        const pull = (spec.rest - this.q[i]) * 0.035
        this.q[i] = THREE.MathUtils.clamp(this.q[i] + delta[i] + pull, spec.lower, spec.upper)
      }
    }

    this.forward()
    return residual
  }
}

function clampVector3(values: number[], offset: number, max: number) {
  const length = Math.hypot(values[offset], values[offset + 1], values[offset + 2])
  if (length <= max || length === 0) return
  const factor = max / length
  values[offset] *= factor
  values[offset + 1] *= factor
  values[offset + 2] *= factor
}

/**
 * dq = Jᵀ (J Jᵀ + λ²I)⁻¹ e, with the 6×6 system solved by Gauss-Jordan.
 */
function damped(jacobian: number[][], error: number[], n: number, lambda: number) {
  const m = 6
  const a: number[][] = Array.from({ length: m }, () => new Array<number>(m + 1).fill(0))
  for (let r = 0; r < m; r += 1) {
    for (let c = 0; c < m; c += 1) {
      let sum = 0
      for (let k = 0; k < n; k += 1) sum += jacobian[r][k] * jacobian[c][k]
      a[r][c] = sum + (r === c ? lambda * lambda : 0)
    }
    a[r][m] = error[r]
  }

  for (let col = 0; col < m; col += 1) {
    let pivot = col
    for (let row = col + 1; row < m; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-9) continue
    if (pivot !== col) {
      const swap = a[pivot]
      a[pivot] = a[col]
      a[col] = swap
    }
    const diagonal = a[col][col]
    for (let c = col; c <= m; c += 1) a[col][c] /= diagonal
    for (let row = 0; row < m; row += 1) {
      if (row === col) continue
      const factor = a[row][col]
      if (factor === 0) continue
      for (let c = col; c <= m; c += 1) a[row][c] -= factor * a[col][c]
    }
  }

  const y = a.map((row) => row[m])
  const delta = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i += 1) {
    let sum = 0
    for (let r = 0; r < m; r += 1) sum += jacobian[r][i] * y[r]
    delta[i] = sum
  }
  return delta
}

/**
 * Builds a tool orientation from an approach direction (the suction cup's -Z)
 * and a reference axis that fixes the roll about it.
 */
export function toolOrientation(approach: THREE.Vector3, reference: THREE.Vector3) {
  const z = approach.clone().normalize().multiplyScalar(-1)
  let x = new THREE.Vector3().crossVectors(reference, z)
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), z)
  x.normalize()
  const y = new THREE.Vector3().crossVectors(z, x).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}
