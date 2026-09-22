// Resize · Compress · Convert (spec, Phase A). Resize is the only real tab —
// Compress and Convert are genuine <button disabled> elements, not styled
// divs standing in for them: real disabled state, aria-disabled for
// redundancy with AT that doesn't infer it from the native attribute alone,
// and title="Coming soon" for a mouse-hover hint. Visibly muted, never
// hidden — the whole point of this phase is that the shell has a place for
// them already.
//
// No active-tab prop yet: there's nothing behind Compress/Convert to switch
// to, so a real tab-switching state machine has nothing to manage until
// Phase B adds one. Resize's selected state is hardcoded here on purpose.
function ToolTabs() {
  return (
    <div role="tablist" aria-label="Tool" className="flex border-b border-rule">
      <button
        type="button"
        role="tab"
        id="tab-resize"
        aria-selected="true"
        aria-controls="panel-resize"
        className="border-b-2 border-ink px-4 py-2 text-body text-ink"
      >
        Resize
      </button>
      <button
        type="button"
        role="tab"
        aria-selected="false"
        aria-disabled="true"
        disabled
        title="Coming soon"
        className="border-b-2 border-transparent px-4 py-2 text-body text-ink-muted disabled:cursor-not-allowed"
      >
        Compress
      </button>
      <button
        type="button"
        role="tab"
        aria-selected="false"
        aria-disabled="true"
        disabled
        title="Coming soon"
        className="border-b-2 border-transparent px-4 py-2 text-body text-ink-muted disabled:cursor-not-allowed"
      >
        Convert
      </button>
    </div>
  );
}

export default ToolTabs;
