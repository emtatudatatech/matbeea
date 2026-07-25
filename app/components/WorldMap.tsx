"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoEqualEarth, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type D3ZoomEvent, type ZoomTransform } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';
import { CURRENCY_DICTIONARY, RISK_VAR, getRiskTone } from '@/lib/currencies';

// Fixed drawing surface. Keeping it constant (rather than measuring the container
// before drawing) means the whole map still renders server-side; the pixel scale
// below only affects where the hover card is placed.
const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 470;

const MARKER_RADIUS = 14;
const MARKER_HIT_RADIUS = 20;
/** Flag disc sits just inside the coloured risk ring, leaving a thin bezel. */
const FLAG_RADIUS = MARKER_RADIUS - 1;
const FLAG_CLIP_ID = 'world-map-flag-clip';

/**
 * Flags come from flagcdn.com, which is flagpedia.net's image CDN — the endpoint
 * flagpedia publishes for hotlinking. `w80` is 80px wide, comfortably sharp for a
 * 24px marker on a 2x display while staying well under a kilobyte per flag.
 */
const flagUrl = (code: string) => `https://flagcdn.com/w80/${code}.png`;
const TOOLTIP_WIDTH = 190;
/** Below this y (in view units) a tooltip would be clipped, so it flips underneath. */
const TOOLTIP_FLIP_THRESHOLD = 120;

export type MapMetric = { pair: string; vol: number; r: number };

type Props = {
  metrics: MapMetric[];
  baseCurrency: string;
  statusLabel: string;
};

export default function WorldMap({ metrics, baseCurrency, statusLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [countries, setCountries] = useState<FeatureCollection<Geometry> | null>(null);
  const [transform, setTransform] = useState<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const [rotation, setRotation] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  // Pixels per view unit — needed to place the HTML tooltip over the scaled SVG.
  const [pixelScale, setPixelScale] = useState({ scale: 1, offsetX: 0, offsetY: 0 });

  // Served from our own origin rather than a third-party CDN, so the map cannot be
  // taken out by an unpkg outage.
  useEffect(() => {
    let cancelled = false;
    fetch('/countries-110m.json')
      .then(response => response.json())
      .then((topology: Topology) => {
        if (cancelled) return;
        const collection = feature(
          topology,
          topology.objects.countries,
        ) as unknown as FeatureCollection<Geometry>;
        setCountries(collection);
      })
      .catch(() => { if (!cancelled) setCountries(null); });
    return () => { cancelled = true; };
  }, []);

  // Equal Earth: an equal-area projection, so a currency's country occupies a fair
  // share of the map. Mercator-style projections would inflate Russia and
  // Scandinavia and shrink Africa, which misleads on a global risk dashboard.
  const projection = useMemo(
    () => geoEqualEarth()
      .rotate([rotation, 0])
      .fitExtent([[8, 8], [VIEW_WIDTH - 8, VIEW_HEIGHT - 8]], { type: 'Sphere' }),
    [rotation],
  );

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const spherePath = useMemo(
    () => pathGenerator({ type: 'Sphere' } as GeoPermissibleObjects) ?? '',
    [pathGenerator],
  );

  const countryPaths = useMemo(() => {
    if (!countries) return [];
    return countries.features
      .map((geoFeature, index) => ({
        // Three features in world-atlas carry no id, and an id alone could collide
        // with a positional fallback, so the index guarantees uniqueness.
        key: `${geoFeature.id ?? 'unnamed'}-${index}`,
        d: pathGenerator(geoFeature as GeoPermissibleObjects) ?? '',
      }))
      .filter(entry => entry.d.length > 0);
  }, [countries, pathGenerator]);

  // Marker positions in view units, with the zoom transform already applied.
  // Markers live outside the zoomed group so they keep a constant size.
  const markers = useMemo(() => {
    return Object.keys(CURRENCY_DICTIONARY)
      .map(code => {
        const info = CURRENCY_DICTIONARY[code];
        const point = projection(info.coordinates);
        if (!point) return null;
        const x = point[0] * transform.k + transform.x;
        const y = point[1] * transform.k + transform.y;
        // Drop anything the current pan has pushed off the drawing surface.
        if (x < -40 || x > VIEW_WIDTH + 40 || y < -40 || y > VIEW_HEIGHT + 40) return null;
        return { code, info, x, y, metric: metrics.find(entry => entry.pair === code) };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [projection, transform, metrics]);

  // Render the hovered marker last so it paints above its neighbours; the tooltip
  // itself sits in an HTML layer above the whole SVG.
  const orderedMarkers = useMemo(() => {
    if (!hovered) return markers;
    const rest = markers.filter(marker => marker.code !== hovered);
    const active = markers.filter(marker => marker.code === hovered);
    return [...rest, ...active];
  }, [markers, hovered]);

  const activeMarker = useMemo(
    () => markers.find(marker => marker.code === hovered) ?? null,
    [markers, hovered],
  );

  // The zoom handler needs the current pixel scale without being torn down and
  // rebuilt on every resize, so the scale is mirrored into a ref (written from
  // the measure effect below, never during render).
  const pixelScaleRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  const zoomBehaviourRef = useRef<ReturnType<typeof d3Zoom<SVGSVGElement, unknown>> | null>(null);

  // Track how the SVG's viewBox maps onto real pixels (preserveAspectRatio
  // letterboxes it), so the tooltip lands exactly on its marker.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const scale = Math.min(width / VIEW_WIDTH, height / VIEW_HEIGHT);
      const next = {
        scale,
        offsetX: (width - VIEW_WIDTH * scale) / 2,
        offsetY: (height - VIEW_HEIGHT * scale) / 2,
      };
      pixelScaleRef.current = next;
      setPixelScale(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const behaviour = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const next: ZoomTransform = event.transform;
        // d3-zoom reports deltas in screen pixels; the group it drives is in view
        // units, so translations are converted before being applied.
        const scale = pixelScaleRef.current.scale || 1;
        setTransform({ x: next.x / scale, y: next.y / scale, k: next.k });
      });

    zoomBehaviourRef.current = behaviour;

    const selection = select(svgElement);
    selection.call(behaviour);
    // Double-click-to-zoom fights with hovering dense markers.
    selection.on('dblclick.zoom', null);

    return () => {
      selection.on('.zoom', null);
      zoomBehaviourRef.current = null;
    };
  }, []);

  const resetView = useCallback(() => {
    setRotation(0);
    setTransform({ x: 0, y: 0, k: 1 });
    const svgElement = svgRef.current;
    const behaviour = zoomBehaviourRef.current;
    // Reset through the attached behaviour so d3's own stored transform matches
    // React's; otherwise the next gesture would jump back to the old position.
    if (svgElement && behaviour) {
      select(svgElement).call(behaviour.transform, zoomIdentity);
    }
  }, []);

  const tooltipPosition = useMemo(() => {
    if (!activeMarker) return null;
    const { scale, offsetX, offsetY } = pixelScale;
    const flipBelow = activeMarker.y < TOOLTIP_FLIP_THRESHOLD;
    return {
      left: activeMarker.x * scale + offsetX,
      top: (activeMarker.y + (flipBelow ? MARKER_RADIUS + 6 : -MARKER_RADIUS - 6)) * scale + offsetY,
      flipBelow,
    };
  }, [activeMarker, pixelScale]);

  return (
    <>
      <div className="mb-6 flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-ink">
          Global Correlation vs {baseCurrency}
          <span className="text-risk-low ml-2 text-sm font-semibold">{statusLabel}</span>
        </h2>
        <div className="text-xs text-ink-muted max-w-xs sm:text-right">
          Equal Earth projection — equal-area, so regions compare fairly.
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ touchAction: 'none', overscrollBehavior: 'none', backgroundColor: 'var(--map-ocean)' }}
        className="w-full relative border border-edge rounded-2xl overflow-hidden shadow-inner flex items-center justify-center aspect-[900/470]"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--map-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--map-grid) 1px, transparent 1px)',
            backgroundSize: '4rem 4rem',
          }}
        />

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full relative cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`World map of currency volatility and correlation against ${baseCurrency}`}
        >
          <defs>
            {/* userSpaceOnUse (the default) resolves against the user space of the
                element referencing it, so this one circle clips every marker's flag
                correctly despite each marker sitting in its own translated group. */}
            <clipPath id={FLAG_CLIP_ID}>
              <circle cx={0} cy={0} r={FLAG_RADIUS} />
            </clipPath>
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            <path d={spherePath} fill="var(--map-ocean)" stroke="var(--map-border)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            {countryPaths.map(country => (
              <path
                key={country.key}
                d={country.d}
                fill="var(--map-land)"
                stroke="var(--map-border)"
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {/* Markers sit outside the zoomed group so they stay a readable size. */}
          <g>
            {orderedMarkers.map(({ code, info, x, y, metric }) => {
              const isBase = code === baseCurrency;
              const ringColor = isBase
                ? 'var(--ink)'
                : metric ? RISK_VAR[getRiskTone(metric.r, true)] : 'var(--ink-faint)';
              const isActive = hovered === code;

              return (
                <g
                  key={code}
                  transform={`translate(${x},${y})`}
                  className="cursor-pointer focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${info.name} (${code})`}
                  onMouseEnter={() => setHovered(code)}
                  onMouseLeave={() => setHovered(current => (current === code ? null : current))}
                  onFocus={() => setHovered(code)}
                  onBlur={() => setHovered(current => (current === code ? null : current))}
                >
                  <circle r={MARKER_HIT_RADIUS} fill="transparent" />
                  <circle
                    r={MARKER_RADIUS + (isActive ? 4 : 1.5)}
                    fill="var(--surface-raised)"
                    stroke={ringColor}
                    strokeWidth={isActive ? 3 : 2}
                    className="transition-all duration-150"
                  />
                  {/* A native SVG <image> rather than next/image in a foreignObject:
                      the latter emits a lazy-loaded, absolutely-positioned <img>,
                      and inside foreignObject the browser cannot resolve its box to
                      decide it is visible, so the flag never loads. */}
                  <image
                    href={flagUrl(info.flag)}
                    x={-FLAG_RADIUS}
                    y={-FLAG_RADIUS}
                    width={FLAG_RADIUS * 2}
                    height={FLAG_RADIUS * 2}
                    clipPath={`url(#${FLAG_CLIP_ID})`}
                    preserveAspectRatio="xMidYMid slice"
                    className="pointer-events-none"
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip lives above the SVG entirely, so a neighbouring flag can never
            paint over it, and it is fully opaque rather than translucent. */}
        {activeMarker && tooltipPosition && (
          <div
            role="tooltip"
            className="absolute z-30 pointer-events-none rounded-lg border border-edge-strong bg-surface-raised p-2.5 shadow-2xl"
            style={{
              left: tooltipPosition.left,
              top: tooltipPosition.top,
              width: TOOLTIP_WIDTH,
              transform: `translate(-50%, ${tooltipPosition.flipBelow ? '0' : '-100%'})`,
            }}
          >
            <div className="font-bold border-b border-edge pb-1 mb-1 text-[11px] tracking-wide text-ink flex justify-between gap-2">
              <span className="truncate">{activeMarker.info.name}</span>
              <span className="text-ink-muted font-mono text-[10px] shrink-0">{activeMarker.code}</span>
            </div>
            {activeMarker.code === baseCurrency ? (
              <div className="text-[10px] text-center text-ink-muted py-1">Current Base Anchor</div>
            ) : (
              <>
                <div className="text-[11px] flex justify-between">
                  <span className="text-ink-muted">Pearson:</span>
                  <span className={`font-mono font-bold ${activeMarker.metric ? '' : 'text-ink-faint'}`}
                        style={activeMarker.metric ? { color: RISK_VAR[getRiskTone(activeMarker.metric.r, true)] } : undefined}>
                    {activeMarker.metric ? activeMarker.metric.r : '—'}
                  </span>
                </div>
                <div className="text-[11px] flex justify-between mt-0.5">
                  <span className="text-ink-muted">Volatility:</span>
                  <span className="font-mono"
                        style={activeMarker.metric ? { color: RISK_VAR[getRiskTone(activeMarker.metric.vol)] } : undefined}>
                    {activeMarker.metric ? `${activeMarker.metric.vol}%` : '—'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Map Interaction Controls & Explainer */}
      <div className="mt-6 flex flex-col gap-4 bg-surface-sunken p-5 rounded-2xl border border-edge">
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 border-b border-edge pb-5">
          <div className="flex items-center gap-3 w-full md:w-1/2 bg-surface-raised px-4 py-2 rounded-lg border border-edge">
            <label htmlFor="rotate-longitude" className="text-[10px] text-ink-muted font-bold uppercase tracking-widest leading-tight whitespace-nowrap">
              Rotate Longitude
            </label>
            <input
              id="rotate-longitude"
              type="range"
              min="-180"
              max="180"
              step="1"
              value={rotation}
              onChange={(e) => setRotation(parseFloat(e.target.value))}
              className="w-full accent-risk-low h-1 bg-surface-sunken rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] font-mono text-ink-muted w-8 text-right bg-surface-sunken px-1 py-0.5 rounded-sm">
              {rotation.toFixed(0)}°
            </span>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <div className="text-risk-low font-mono font-bold text-sm text-right bg-surface-raised px-3 py-1.5 rounded-lg border border-edge">
              z {transform.k.toFixed(1)}x
            </div>
            <button
              onClick={resetView}
              className="text-[10px] bg-surface-raised hover:bg-surface-sunken text-ink border border-edge px-4 py-2.5 rounded-lg uppercase tracking-wider font-bold transition-colors shadow-sm"
            >
              Recenter Map
            </button>
          </div>
        </div>

        <div className="pt-1">
          <p className="text-[11.5px] text-ink-muted leading-relaxed font-medium">
            <strong className="text-risk-low uppercase tracking-widest font-black mr-1.5">Pearson Correlation (r):</strong>
            Measures the linear alignment between a currency and your Base Anchor. Ranges from <span className="text-ink font-mono">-1.0</span> (perfect inverse movement) to <span className="text-ink font-mono">1.0</span> (perfect lockstep). Values near 0 indicate low statistical correlation, offering strong diversification resilience.
            <br />
            <strong className="text-risk-mid uppercase tracking-widest font-black mr-1.5 mt-2 inline-block">Volatility (σ):</strong>
            The annualized standard deviation of daily returns. Higher percentages indicate dramatic price fluctuations and amplified exposure risk relative to the Base Anchor.
          </p>
        </div>
      </div>
    </>
  );
}
