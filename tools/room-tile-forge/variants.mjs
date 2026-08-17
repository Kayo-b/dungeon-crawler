/**
 * The tile set the forge produces.
 *
 * Every variant is the same base preset with its openings and features flipped,
 * so tuning geometry or lighting once retunes the whole set consistently.
 */

/** Deep clone that is enough for plain JSON config objects. */
const clone = o => JSON.parse(JSON.stringify(o));

export const VARIANTS = [
    {
        id: 'corridor',
        file: 'corridor.png',
        label: 'Corridor',
        note: 'No side openings. Also serves any cell whose forward neighbour is walkable.',
        apply: c => { c.openings = { left: false, right: false }; },
    },
    {
        id: 'turnLeft',
        file: 'turn-left.png',
        label: 'Turn left',
        note: 'Opening on the viewer\'s left.',
        apply: c => { c.openings = { left: true, right: false }; },
    },
    {
        id: 'turnRight',
        file: 'turn-right.png',
        label: 'Turn right',
        note: 'Opening on the viewer\'s right.',
        apply: c => { c.openings = { left: false, right: true }; },
    },
    {
        id: 'threeWay',
        file: 'threeway.png',
        label: 'Three-way',
        note: 'Openings on both sides.',
        apply: c => { c.openings = { left: true, right: true }; },
    },
    {
        id: 'fourWay',
        file: 'fourway.png',
        label: 'Four-way',
        note: 'Identical artwork to three-way by construction: the forward cell overpaints the back wall, so a crossing and a T are indistinguishable from the viewer. Emitted as its own file so the renderer can reference it directly.',
        apply: c => { c.openings = { left: true, right: true }; },
    },
    {
        id: 'deadEnd',
        file: 'dead-end.png',
        label: 'Dead end',
        note: 'No openings, and the back wall lit as a near surface rather than a distant one.',
        apply: c => {
            c.openings = { left: false, right: false };
            c.surfaces.backWall.shadeNear = Math.max(0, c.surfaces.backWall.shadeNear - 0.22);
        },
    },
    {
        id: 'door',
        file: 'door.png',
        label: 'Door',
        note: 'Corridor cell with a door panel in the aperture.',
        apply: c => {
            c.openings = { left: false, right: false };
            c.features.door = true;
        },
    },
    {
        id: 'stairsUp',
        file: 'stairs-up.png',
        label: 'Stairs up',
        note: 'Corridor cell with a flight climbing away from the viewer.',
        apply: c => {
            c.openings = { left: false, right: false };
            c.features.stairs = 'up';
        },
    },
    {
        id: 'stairsDown',
        file: 'stairs-down.png',
        label: 'Stairs down',
        note: 'Corridor cell with a flight dropping away from the viewer.',
        apply: c => {
            c.openings = { left: false, right: false };
            c.features.stairs = 'down';
        },
    },
];

/** Build the concrete config for one variant from the base preset. */
export function configForVariant(base, variantId) {
    const variant = VARIANTS.find(v => v.id === variantId);
    if (!variant) throw new Error(`Unknown variant: ${variantId}`);
    const c = clone(base);
    c.openings = c.openings || { left: false, right: false };
    c.features = { door: false, stairs: null };
    variant.apply(c);
    return c;
}
