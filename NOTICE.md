# Set & Signal notices

Copyright (C) 2026 Lucas Arango and contributors.

## Project code

The server and frontend are distributed under the GNU Affero General Public
License, version 3 or later. See [LICENSE](LICENSE). Set & Signal is a
rebrand and continuation of the
[openGym project](https://gitlab.com/DuarteSantos8/opengym);
compatibility-sensitive storage and protocol identifiers remain in the source
so existing installations and exports continue to work.

## Body map

The body-path geometry in `web/src/domain/exercises/body-paths.ts` is derived from MuscleMap
by Melih Colpan and is available under the MIT License. Preserve that attribution
when reusing the geometry.

## Exercise catalogue and instructions

The exercise catalogue and instruction shards are derived from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).
Review that repository's license and attribution files before redistributing a
catalogue, instruction, or media derivative.

## Exercise images and animations

The upstream visual media is credited to Gym visual in the source dataset and is
not covered by the project's AGPL grant. The public web build references a pinned
CDN copy at runtime instead of bundling the media into this repository. Do not
mirror, package, or redistribute those files unless you have confirmed the
dataset's current terms and preserved the required attribution.

## Third-party dependencies

Dependency licenses are recorded by their respective package manifests and lock
files. When adding a dependency, keep its license compatible with AGPL-3.0-or-later
and add a notice here when it ships non-trivial content or attribution.
