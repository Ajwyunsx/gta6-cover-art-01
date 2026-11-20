// Layout templates for the collage. Every template returns panels as rectangles in the unit
// square (0..1 both ways) so the same set works at 1:1, 4:5 and 16:9 without a second table.
// focusX/focusY place the default crop inside a photo (0..1); zoom how far in it starts.

const PANEL = (x, y, w, h, focusX = 0.5, focusY = 0.42, zoom = 1.06) => ({ x, y, w, h, focusX, focusY, zoom });

export const LAYOUTS = [
  {
    id: 'strips3',
    name: 'Three Strips',
    hint: 'The classic: three tall panels side by side.',
    panels: () => [
      PANEL(0, 0, 1 / 3, 1, 0.34, 0.40, 1.10),
      PANEL(1 / 3, 0, 1 / 3, 1, 0.50, 0.38, 1.14),
      PANEL(2 / 3, 0, 1 / 3, 1, 0.64, 0.42, 1.10),
    ],
  },
  {
    id: 'strips4',
    name: 'Four Strips',
    hint: 'Four narrow panels, the poster look.',
    panels: () => [
      PANEL(0, 0, 0.25, 1, 0.40, 0.38, 1.16),
      PANEL(0.25, 0, 0.25, 1, 0.48, 0.40, 1.22),
      PANEL(0.5, 0, 0.25, 1, 0.55, 0.40, 1.22),
      PANEL(0.75, 0, 0.25, 1, 0.62, 0.42, 1.16),
    ],
  },
  {
    id: 'hero3',
    name: 'Hero + Two',
    hint: 'One big portrait panel, two stacked beside it.',
    panels: () => [
      PANEL(0, 0, 0.585, 1, 0.46, 0.40, 1.04),
      PANEL(0.585, 0, 0.415, 0.5, 0.52, 0.36, 1.18),
      PANEL(0.585, 0.5, 0.415, 0.5, 0.48, 0.46, 1.18),
    ],
  },
  {
    id: 'grid5',
    name: 'Five Grid',
    hint: 'Two up top, three below — the dense poster grid.',
    panels: () => [
      PANEL(0, 0, 0.5, 0.44, 0.42, 0.38, 1.14),
      PANEL(0.5, 0, 0.5, 0.44, 0.58, 0.38, 1.14),
      PANEL(0, 0.44, 1 / 3, 0.56, 0.42, 0.42, 1.20),
      PANEL(1 / 3, 0.44, 1 / 3, 0.56, 0.50, 0.40, 1.24),
      PANEL(2 / 3, 0.44, 1 / 3, 0.56, 0.58, 0.42, 1.20),
    ],
  },
  {
    id: 'band3',
    name: 'Band + Three',
    hint: 'A wide establishing band over three uprights.',
    panels: () => [
      PANEL(0, 0, 1, 0.42, 0.50, 0.42, 1.02),
      PANEL(0, 0.42, 1 / 3, 0.58, 0.42, 0.42, 1.16),
      PANEL(1 / 3, 0.42, 1 / 3, 0.58, 0.50, 0.40, 1.20),
      PANEL(2 / 3, 0.42, 1 / 3, 0.58, 0.58, 0.42, 1.16),
    ],
  },
];

export function getLayout(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
