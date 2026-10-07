"use client";

type RevealMapProps = {
  svg: string;
  onSelect: (targetKind: "node" | "edge", targetId: string) => void;
};

function targetFromEvent(target: EventTarget | null): {
  kind: "node" | "edge";
  id: string;
} | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest("[data-node-id]");
  if (node instanceof Element) {
    const id = node.getAttribute("data-node-id");
    if (id) return { kind: "node", id };
  }
  const edge = target.closest("[data-edge-id]");
  if (edge instanceof Element) {
    const id = edge.getAttribute("data-edge-id");
    if (id) return { kind: "edge", id };
  }
  return null;
}

export function RevealMap({ svg, onSelect }: RevealMapProps) {
  return (
    <div
      className="border border-line rounded-md bg-[var(--map-bg)] p-[0.6rem] mb-[0.8rem] overflow-x-auto [&_svg]:w-full [&_svg]:h-auto [&_svg]:block [&_svg]:min-w-[360px] [&_.n:focus]:outline [&_.n:focus]:outline-2 [&_.n:focus]:outline-accent [&_.n:focus]:outline-offset-2 [&_g[data-edge-id]:focus]:outline [&_g[data-edge-id]:focus]:outline-2 [&_g[data-edge-id]:focus]:outline-accent"
      onClick={(e) => {
        const hit = targetFromEvent(e.target);
        if (hit) onSelect(hit.kind, hit.id);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const hit = targetFromEvent(e.target);
        if (!hit) return;
        e.preventDefault();
        onSelect(hit.kind, hit.id);
      }}
    >
      {/* SVG from @dekko/core renderRevealSvg; labels are XML-escaped. */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
