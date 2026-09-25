const NODES = [
  { id: "analytics", cx: 130, cy: 150, label: "Analytics" },
  { id: "relationships", cx: 300, cy: 220, label: "Relationships" },
  { id: "clients", cx: 460, cy: 150, label: "Clients" },
] as const;

/**
 * Secondary network points extending the 3 main nodes down through the
 * lower half of the panel — this is what turns 3 isolated circles into a
 * continuous network, and where the gold particle wave concentrates.
 */
const NETWORK_POINTS = [
  { id: "a", x: 180, y: 275, r: 2.5, glow: false },
  { id: "b", x: 420, y: 285, r: 2.5, glow: false },
  { id: "c", x: 300, y: 330, r: 3.6, glow: true },
  { id: "d", x: 500, y: 355, r: 2, glow: false },
  { id: "e", x: 130, y: 365, r: 1.8, glow: false },
  { id: "f", x: 545, y: 405, r: 4.2, glow: true },
  { id: "g", x: 360, y: 415, r: 2.2, glow: false },
  { id: "h", x: 225, y: 440, r: 1.6, glow: false },
  { id: "i", x: 470, y: 460, r: 3.2, glow: true },
  { id: "j", x: 80, y: 430, r: 1.8, glow: false },
  { id: "k", x: 560, y: 280, r: 2, glow: false },
  { id: "l", x: 40, y: 320, r: 2, glow: false },
  { id: "m", x: 520, y: 240, r: 1.6, glow: false },
  { id: "n", x: 290, y: 470, r: 3.8, glow: true },
  { id: "o", x: 150, y: 480, r: 1.8, glow: false },
  { id: "p", x: 580, y: 460, r: 2.4, glow: false },
] as const;

type NetworkPoint = (typeof NETWORK_POINTS)[number];

function byId(id: string): { x: number; y: number } {
  const point = NETWORK_POINTS.find((p) => p.id === id);
  if (point) return point;
  const node = NODES.find((n) => n.id === id);
  if (node) return { x: node.cx, y: node.cy };
  return { x: 0, y: 0 };
}

/** [fromId, toId, opacity][] — deliberately irregular, not a full mesh. */
const CONNECTIONS: [string, string, number][] = [
  ["analytics", "a", 0.35],
  ["analytics", "e", 0.22],
  ["relationships", "c", 0.32],
  ["relationships", "b", 0.28],
  ["clients", "b", 0.32],
  ["clients", "k", 0.22],
  ["a", "c", 0.24],
  ["c", "g", 0.26],
  ["b", "d", 0.26],
  ["d", "f", 0.3],
  ["g", "h", 0.2],
  ["g", "i", 0.24],
  ["h", "j", 0.18],
  ["d", "k", 0.18],
  ["f", "i", 0.28],
  ["e", "l", 0.16],
  ["k", "m", 0.16],
  ["h", "o", 0.2],
  ["i", "n", 0.24],
  ["n", "o", 0.16],
  ["f", "p", 0.22],
  ["i", "p", 0.18],
];

function BarChartIcon() {
  return (
    <g stroke="#ecb100" strokeWidth="2.4" strokeLinecap="round">
      <path d="M-9 8v-9" />
      <path d="M0 8V-3" />
      <path d="M9 8V-9" />
    </g>
  );
}

function HandshakeIcon() {
  return (
    <g fill="none" stroke="#ecb100" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="-4" cy="0" r="6" />
      <circle cx="4" cy="0" r="6" />
    </g>
  );
}

function PeopleIcon() {
  return (
    <g fill="none" stroke="#ecb100" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="-5" cy="-4" r="3.4" />
      <circle cx="6" cy="-4" r="3.4" />
      <path d="M-11 9c0-4 3-6.5 6-6.5S1 5 1 9" />
      <path d="M0 9c0-3.6 2.6-6 6-6s6 2.4 6 6" />
    </g>
  );
}

const ICONS = { Analytics: BarChartIcon, Relationships: HandshakeIcon, Clients: PeopleIcon };

/** Deterministic pseudo-random in [0,1) — stable across server/client renders. */
function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const GOLD_TONES = ["#d6a000", "#ecb100", "#f2c23a"];

type Particle = { x: number; y: number; r: number; o: number; fill: string; bright: boolean };

/**
 * Scatters particles along a curve y = yAt(t), t in [0,1] across
 * [xStart, xEnd], with jitter so it reads as a flowing stream of many
 * small dots rather than a drawn line. `density` multiplies how many
 * particles land per unit of width, so wider streams stay proportionally
 * as dense as narrow ones.
 */
function generateStream(
  xStart: number,
  xEnd: number,
  yAt: (t: number) => number,
  seed: number,
  jitter: number,
  opacityRange: [number, number],
  density = 1,
): Particle[] {
  const count = Math.round(Math.abs(xEnd - xStart) * 0.13 * density);
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(count - 1, 1);
    const x = xStart + (xEnd - xStart) * t + (rand(seed + i * 3.1) - 0.5) * 10;
    const y = yAt(t) + (rand(seed + i * 5.7) - 0.5) * jitter;
    const sizeRoll = rand(seed + i * 2.3);
    const r = sizeRoll > 0.93 ? 4 : sizeRoll > 0.8 ? 3 : sizeRoll > 0.55 ? 2 : 1.1;
    const o = opacityRange[0] + rand(seed + i * 7.9) * (opacityRange[1] - opacityRange[0]);
    const fill = GOLD_TONES[Math.floor(rand(seed + i * 4.4) * GOLD_TONES.length)];
    return { x, y, r, o, fill, bright: sizeRoll > 0.95 };
  });
}

export function SalesNetworkVisual() {
  const buildingHeights = [26, 40, 22, 55, 34, 48, 20, 60, 30, 44, 24, 52, 18, 36];

  // Six overlapping gold particle streams — hundreds of small dots, not a
  // handful of lines — that build up a flowing data-wave effect across the
  // lower half, concentrating toward the lower-right per spec.
  const streamCurveA = (t: number) => 470 - Math.pow(t, 1.3) * 90;
  const streamCurveB = (t: number) => 430 - Math.sin(t * Math.PI * 0.6) * 110;
  const streamCurveC = (t: number) => 460 - t * 95;
  const streamCurveD = (t: number) => 495 - Math.pow(t, 1.6) * 55;
  const streamCurveE = (t: number) => 405 - Math.sin((t + 0.15) * Math.PI * 0.5) * 130;

  const particleStreams = [
    generateStream(5, 598, streamCurveA, 11, 14, [0.1, 0.32], 1.6),
    generateStream(40, 590, streamCurveB, 29, 18, [0.14, 0.42], 1.7),
    generateStream(330, 600, streamCurveC, 47, 12, [0.22, 0.6], 2.4),
    generateStream(0, 470, streamCurveD, 63, 9, [0.08, 0.26], 1.3),
    generateStream(230, 600, streamCurveE, 81, 16, [0.16, 0.48], 1.8),
  ];
  const particles = particleStreams.flat();

  // A few soft curved strokes traced through the particle clouds so they
  // read as coherent flowing waves rather than a random dust of dots.
  const waveStrokes = [
    { d: "M5,455 C160,430 320,400 598,300", o: 0.14 },
    { d: "M40,400 C220,380 400,340 590,240", o: 0.12 },
    { d: "M330,468 C420,450 520,410 600,370", o: 0.2 },
    { d: "M0,470 C150,455 320,450 470,440", o: 0.1 },
  ];

  const backgroundDots = [
    [40, 60], [560, 40], [90, 480], [520, 480], [30, 250], [575, 220], [250, 30], [330, 480],
  ];

  return (
    <svg
      viewBox="0 0 600 480"
      // Anchored to the bottom so the main nodes stay clear of the headline
      // text above them on shorter windows.
      preserveAspectRatio="xMidYMax meet"
      className="h-full w-full"
      role="img"
      aria-label="Network diagram connecting analytics, relationships, and clients, flowing into a stream of data across the panel"
    >
      <defs>
        <pattern id="akani-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#1c2a63" strokeWidth="0.6" />
        </pattern>
        <radialGradient id="akani-glow" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#12225e" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#02062b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="akani-fade-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#02062b" stopOpacity="0" />
          <stop offset="70%" stopColor="#02062b" stopOpacity="0" />
          <stop offset="100%" stopColor="#02062b" stopOpacity="0.55" />
        </linearGradient>
        <filter id="akani-point-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 1. background grid + ambient glow */}
      <rect width="600" height="500" fill="url(#akani-grid)" opacity="0.5" />
      <rect width="600" height="500" fill="url(#akani-glow)" />

      {/* 2. faint blue background network */}
      <g stroke="#2c3f8a" strokeOpacity="0.3" strokeWidth="0.8">
        <line x1="20" y1="60" x2="140" y2="130" />
        <line x1="480" y1="50" x2="570" y2="150" />
        <line x1="40" y1="470" x2="150" y2="410" />
        <line x1="470" y1="470" x2="560" y2="400" />
        <line x1="250" y1="30" x2="330" y2="90" />
      </g>
      <g fill="#3b5199" opacity="0.5">
        {backgroundDots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.3" />
        ))}
      </g>

      {/* 3. faint city / business silhouette */}
      <g opacity="0.22">
        {buildingHeights.map((h, i) => (
          <rect
            key={i}
            x={i * (600 / buildingHeights.length)}
            y={478 - h}
            width={600 / buildingHeights.length - 3}
            height={h}
            fill="#12225e"
          />
        ))}
      </g>

      {/* 4a. gold data particles — hundreds of small dots forming the wave */}
      <g>
        {particles.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.fill}
            opacity={p.o}
            filter={p.bright ? "url(#akani-point-glow)" : undefined}
          />
        ))}
      </g>

      {/* 4b. soft curved strokes tying the particle clouds into visible waves */}
      <g fill="none" stroke="#ecb100" strokeWidth="1.4" strokeLinecap="round">
        {waveStrokes.map((w, i) => (
          <path key={i} d={w.d} opacity={w.o} />
        ))}
      </g>

      {/* 5. gold connection lines — main nodes extended into the network */}
      <g stroke="#ecb100" strokeWidth="1">
        {CONNECTIONS.map(([from, to, opacity], i) => {
          const a = byId(from);
          const b = byId(to);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeOpacity={opacity} />;
        })}
      </g>

      {/* 6. secondary glowing gold connection points */}
      <g>
        {NETWORK_POINTS.map((p: NetworkPoint) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="#ecb100"
            opacity="0.85"
            filter={p.glow ? "url(#akani-point-glow)" : undefined}
          >
            <animate
              attributeName="opacity"
              values="0.35;0.9;0.35"
              dur={`${3 + (p.x % 4)}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>

      {/* 7. the three main nodes, unchanged in position */}
      {NODES.map((n) => {
        const Icon = ICONS[n.label as keyof typeof ICONS];
        return (
          <g key={n.label}>
            <circle cx={n.cx} cy={n.cy} r="30" fill="#050b2e" stroke="#d6a000" strokeWidth="2" />
            <circle cx={n.cx} cy={n.cy} r="30" fill="none" stroke="#ecb100" strokeWidth="1" opacity="0.35">
              <animate attributeName="r" values="30;36;30" dur="3.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0;0.35" dur="3.5s" repeatCount="indefinite" />
            </circle>
            <g transform={`translate(${n.cx} ${n.cy})`}>
              <Icon />
            </g>
          </g>
        );
      })}

      <rect width="600" height="500" fill="url(#akani-fade-bottom)" />
    </svg>
  );
}
