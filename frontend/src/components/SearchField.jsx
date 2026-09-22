import { useCallback, useEffect, useId, useRef, useState } from 'react';

function matchBuildings(buildings, query, excludeId) {
  const q = query.trim().toLowerCase();
  const pool = buildings.filter((b) => b.id !== excludeId);
  if (!q) return [...pool].sort((a, b) => a.name.localeCompare(b.name));
  const starts = pool.filter((b) => b.name.toLowerCase().startsWith(q));
  const contains = pool.filter(
    (b) => !b.name.toLowerCase().startsWith(q) && b.name.toLowerCase().includes(q),
  );
  return [...starts, ...contains].sort((a, b) => a.name.localeCompare(b.name)).sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q);
    const bStarts = b.name.toLowerCase().startsWith(q);
    return aStarts === bStarts ? 0 : aStarts ? -1 : 1;
  });
}

export default function SearchField({ label, dotClass, buildings, value, onChange, excludeId, placeholder }) {
  const [text, setText] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef(null);
  const inputId = useId();
  const listId = useId();

  useEffect(() => {
    setText(value?.name ?? '');
  }, [value]);

  const options = matchBuildings(buildings, open ? text : '', excludeId);

  const commit = useCallback((building) => {
    onChange(building);
    setText(building ? building.name : '');
    setOpen(false);
  }, [onChange]);

  const handleInput = useCallback((e) => {
    const next = e.target.value;
    setText(next);
    setOpen(true);
    setActiveIndex(0);
    if (next.trim() === '') onChange(null);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      const exact = buildings.find((b) => b.name.toLowerCase() === text.trim().toLowerCase());
      if (exact) {
        commit(exact);
      } else if (text.trim() === '') {
        onChange(null);
      } else {
        setText(value?.name ?? '');
      }
    }, 120);
  }, [buildings, commit, onChange, text, value]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && options[activeIndex]) commit(options[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setText(value?.name ?? '');
    }
  }, [activeIndex, commit, open, options, value]);

  return (
    <div className={`search-field${open ? ' is-open' : ''}`} data-no-pan>
      <span className={`search-dot ${dotClass}`} aria-hidden="true" />
      <label htmlFor={inputId} className="search-label-visually-hidden">
        {label}
      </label>
      <input
        id={inputId}
        className="search-input"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" className="search-listbox" onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); }}>
          {options.map((b, i) => (
            <li
              key={b.id}
              id={`${listId}-${b.id}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`search-option${i === activeIndex ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => commit(b)}
            >
              {b.name}
            </li>
          ))}
        </ul>
      )}
      {open && options.length === 0 && (
        <div className="search-listbox search-empty">no match on the board</div>
      )}
    </div>
  );
}
