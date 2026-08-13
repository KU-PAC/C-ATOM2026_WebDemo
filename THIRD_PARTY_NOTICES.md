# Third-party notices

## OpenArm 2.0 robot description and mesh assets

- Source: <https://github.com/enactic/openarm_description>
- Copyright: Copyright 2025–2026 Enactic, Inc.
- License: Apache License 2.0
- Included assets: OpenArm 2.0 body and arm visual meshes, pinch-gripper visual meshes, and the generated bimanual URDF under `public/models/openarm/`
- Modification notice: The upstream files are copied without geometry modifications. They are loaded at runtime and their rendered materials, pose, scale, and orientation are adjusted by this application.

A copy of the license is included at `public/models/openarm/licenses/Apache-2.0.txt`.

## Intel RealSense D435 camera mesh

- Source: <https://github.com/IntelRealSense/realsense-ros> (`realsense2_description/meshes/d435.dae`)
- Copyright: Copyright Intel Corporation
- License: Apache License 2.0
- Included assets: the D435 camera body mesh at `public/models/realsense/d435.glb`
- Modification notice: The upstream Collada (231,186 triangles) was split into a body group and a
  details group, decimated with quadric error metrics to 9,000 and 3,500 triangles respectively, and
  re-exported as a single binary glTF. No geometry was added; materials are assigned by this
  application at runtime. The D435f used in this design shares the D435 housing — the difference is
  the 750 nm IR pass filter over the depth imagers — so the D435 mesh represents it dimensionally.

Copies of the license and the upstream third-party notice are included at
`public/models/realsense/licenses/`.

## Hero photograph

- Source: <https://www.pexels.com/photo/an-elderly-woman-wearing-her-necklace-6874150/>
- Photographer: Pavel Danilyuk
- License: [Pexels License](https://www.pexels.com/license/) — free for commercial use, attribution
  not required, modification permitted
- Included assets: `public/hero-photo.jpg` (faded base layer) and `public/hero-photo-full.jpg`
  (spotlight reveal layer)
- Modification notice: cropped to a 1.86:1 frame, converted to greyscale, and tone-lifted toward
  white so the black headline stays legible over it. Attribution is voluntary.
