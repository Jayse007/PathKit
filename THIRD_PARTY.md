# Third-party materials

Last checked: 2026-11-20. Update this file whenever something is added.

## Libraries (development only)

These are used to test the code. They are not bundled into or distributed with PathKit.

| Name | Version range | Licence | Used for | Source |
| --- | --- | --- | --- | --- |
| fast-check | ^4.0.0 (4.10.2 installed) | MIT | Property-based tests | https://github.com/dubzzz/fast-check |
| Vitest | ^3.2.0 (3.2.7 installed) | MIT | Test runner | https://github.com/vitest-dev/vitest |

Installing these two packages pulls in 52 packages in total. The `license` field of each was read on 2026-11-20:
48 MIT, 2 ISC, 1 BSD-3-Clause, 1 Apache-2.0. None has a copyleft licence.

## Methods (published algorithms, implemented from scratch)

No code was copied from the sources below. They describe methods only.

- Centripetal Catmull-Rom splines (Barry and Goldman 1988; Yuksel, Schaefer and Keyser 2011).
- Rotation-minimizing frames by the double reflection method (Wang, Juttler, Zheng and Liu 2008).
- Monotone cubic interpolation with Fritsch-Butland slopes (Fritsch and Butland 1984).

## Fonts, images, icons, sounds, datasets

None so far. Any future addition will be listed here with its licence before it is used.

## Tools and inspiration

- Kiro (AWS) is the development environment. It is a tool, not a dependency.
- The 2025 Kiroween winner InteractionKit (MIT) was studied for how it organises a template
  (steering files, hooks, setup scripts). Patterns only; no code was copied.
