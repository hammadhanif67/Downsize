import { useRef } from 'react';

export type Tool = 'resize' | 'compress';

interface ToolTabsProps {
  active: Tool;
  onChange: (tool: Tool) => void;
}

const TABS: Array<{ id: Tool; label: string }> = [
  { id: 'resize', label: 'Resize' },
  { id: 'compress', label: 'Compress' },
];

export function tabId(tool: Tool): string {
  return `tool-tab-${tool}`;
}

export function panelId(tool: Tool): string {
  return `tool-panel-${tool}`;
}

// A real tablist, unlike the preset picker.
//
// The distinction is whether "nothing selected" is a state the control
// needs to express. The platform accordion opens with nothing open, which
// a tablist cannot represent — so that one is buttons with aria-expanded.
// Here one tool is always active, which is exactly what a tablist is for.
//
// Automatic activation (arrow keys switch the panel, not just the focus)
// per the APG's guidance for panels that are cheap to show: both panels
// are already-rendered settings, so there is nothing to wait for.
//
// Only two tabs, and both do something. No Convert, no AI Assist, not even
// disabled — a greyed-out tab for work that does not exist is a promise
// the UI has no business making.
function ToolTabs({ active, onChange }: ToolTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const last = TABS.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    const target = TABS[next];
    if (!target) return;
    onChange(target.id);
    refs.current[next]?.focus();
  }

  return (
    // The inactive tabs' bottom border forms the strip's baseline, so the
    // grid needs no rule of its own. --rule, not --rule-strong: the label
    // is the affordance here, and losing the line would cost tidiness,
    // not the ability to operate anything.
    <div role="tablist" aria-label="Tool" className="grid grid-cols-2">
      {TABS.map((tab, index) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            id={tabId(tab.id)}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId(tab.id)}
            // Roving tabindex: one stop for the whole strip, then arrows
            // move within it. Tabbing past a tablist should not mean
            // tabbing through every tab in it.
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`focus-ring flex min-h-11 items-center justify-center border-b-2 text-body transition-colors duration-[120ms] ${
              isActive ? 'border-b-accent text-ink' : 'border-b-rule text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default ToolTabs;
