// Next's route-level loading UI for /aitools. Generic card-list shape
// (icon-badge + heading + body cards) matching this page's general
// layout closely enough to avoid the jarring marketplace-grid mismatch,
// without needing to trace every one of its deeply nested srf-tools-*
// classes exactly.
export default function Loading() {
  return (
    <div style={{ marginTop: 92, padding: "32px 24px 80px", maxWidth: 820, margin: "92px auto 0" }}>
      <div className="skel-block" style={{ width: 180, height: 28, borderRadius: 8, marginBottom: 10 }} />
      <div className="skel-block" style={{ width: "60%", height: 14, borderRadius: 6, marginBottom: 32 }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 14, marginBottom: 18, alignItems: "flex-start" }}>
          <div className="skel-block" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skel-block" style={{ width: "40%", height: 16, borderRadius: 6, marginBottom: 8 }} />
            <div className="skel-block" style={{ width: "90%", height: 12, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
