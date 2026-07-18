// Ports mpBuildAdCard from marketplace.js. Each ad unit gets its own
// sandboxed same-origin-free iframe via srcdoc, with its own isolated
// `atOptions` + invoke.js — same reasoning as the original: two ad units
// loaded directly in the parent page would clobber each other's global
// atOptions, and this also keeps the ad network's own iframe styling
// from leaking into the page. These are the same live ad-network unit
// keys/URLs already embedded in the original production site — carried
// over unchanged, not new third-party embeds introduced by this port.
const AD_UNITS = {
  rect: {
    key: "02d530955f964bb754200c047d5cab26",
    width: 300,
    height: 250,
    invokeSrc: "https://beavercolourfuldelinquent.com/02d530955f964bb754200c047d5cab26/invoke.js",
  },
  banner: {
    key: "837d8d50ffa851dddd18e0f1d01833aa",
    width: 320,
    height: 50,
    invokeSrc: "https://beavercolourfuldelinquent.com/837d8d50ffa851dddd18e0f1d01833aa/invoke.js",
  },
} as const;

export default function AdSlot({ kind }: { kind: "rect" | "banner" }) {
  const unit = AD_UNITS[kind];
  const srcDoc =
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    "<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style>" +
    "</head><body>" +
    "<script>atOptions = " +
    JSON.stringify({ key: unit.key, format: "iframe", height: unit.height, width: unit.width, params: {} }) +
    ";<" +
    "/script>" +
    '<script src="' +
    unit.invokeSrc +
    '"><' +
    "/script>" +
    "</body></html>";

  return (
    <div className={"sr-ad-slot" + (kind === "banner" ? " sr-ad-banner" : "")}>
      <iframe
        width={unit.width}
        height={unit.height}
        scrolling="no"
        title="Advertisement"
        loading="lazy"
        srcDoc={srcDoc}
        style={{ border: "none" }}
      />
    </div>
  );
}
