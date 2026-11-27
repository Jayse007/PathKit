# Heat_Exchanger hardening pack (Task 18.3 follow-up)

Save as `apps/skeleton-bench/docs/hx-hardening-pack.md`.

## 1. Why

I broke the heat-exchanger code nine ways. Three breaks passed every test: moving the U-bend (`BEND_X`), moving the baffle window cut, and dropping one tube from the merged bundle. The leg length (1.18) and offset (-0.06) were typed in separately from `BEND_X`, so the legs and bends could drift apart. This step derives the leg from `BEND_X` and adds three hand-computed tests. No shape changes: the rendered model is identical.

## 2. Edit `apps/skeleton-bench/src/render/heat-exchanger-model.ts`

1. Under `export const BEND_X = 0.53;` add:

```ts
/** x of the left (tube sheet) end of every tube leg, in the tube bundle's frame. */
export const LEG_START_X = -0.65;
```

2. In `tubeBundleGeometry`, replace these two lines:

```ts
      const leg = cylinderX(TUBE_R, 1.18, 10);
      leg.translate(-0.06, y, u.z);
```

with:

```ts
      // The leg runs from LEG_START_X to the bend centre, so the legs and the bends always meet.
      const leg = cylinderX(TUBE_R, BEND_X - LEG_START_X, 10);
      leg.translate((BEND_X + LEG_START_X) / 2, y, u.z);
```

(1.18 = 0.53 - (-0.65) and -0.06 = (0.53 + -0.65) / 2, so nothing moves.)

## 3. Add three tests to `apps/skeleton-bench/test/heat-exchanger-model.test.ts`

Paste them inside the final `describe('heat exchanger model', ...)` block, after the test named "the tube bundle is exactly one Mesh and not an InstancedMesh". Change no existing test and no import.

```ts
  it('the baffle windows are cut at y = 0.08: the top-cut plate spans y -0.16 to 0.08, the bottom-cut plate -0.08 to 0.16', () => {
    // Plate radius 0.16, window cut at 25 percent of the diameter (0.08 from the axis).
    const ys = (topCut: boolean): number[] => baffleShape(topCut).getPoints(12).map((p) => p.y);
    expect(Math.max(...ys(true))).toBeCloseTo(0.08, 6);
    expect(Math.min(...ys(true))).toBeCloseTo(-0.16, 6);
    expect(Math.max(...ys(false))).toBeCloseTo(0.16, 6);
    expect(Math.min(...ys(false))).toBeCloseTo(-0.08, 6);
  });

  it('the tube bundle runs from x -0.65 to x 0.642 (bend centre 0.53 + largest bend radius 0.1 + tube radius 0.012)', () => {
    const model = buildHeatExchangerModel();
    const geometry = meshesOf(model.partsById.get('hx-tube-bundle')!)[0]!.geometry;
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.x).toBeCloseTo(-0.65, 6);
    expect(geometry.boundingBox!.max.x).toBeCloseTo(0.642, 6);
    model.dispose();
  });

  it('the merged tube bundle holds all 17 U-tubes: 4,777 vertices (each U-tube is 2 legs of 64 and 1 bend of 153 = 281)', () => {
    // Leg: cylinder with 10 sides = 11 x 2 side vertices + 2 caps of 21 = 64. Bend: torus 8 x 16 = 9 x 17 = 153.
    const model = buildHeatExchangerModel();
    const geometry = meshesOf(model.partsById.get('hx-tube-bundle')!)[0]!.geometry;
    expect(geometry.getAttribute('position').count).toBe(17 * 281);
    model.dispose();
  });
```

## 4. Kiro prompt

> Open `apps/skeleton-bench/docs/hx-hardening-pack.md`. Do not research and do not reword. Make the edit in section 2 and add the three tests in section 3, character for character. Change no other file. Add one build-notes entry. Stop and report.

I run `npm.cmd test`. Expected: Skeleton Bench 23 files, 234 passed, 0 skipped (231 + 3). Shot Rail unchanged at 29 files, 278.
