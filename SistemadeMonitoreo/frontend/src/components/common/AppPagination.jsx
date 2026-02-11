import React, { useMemo } from "react";
import Pagination from "react-bootstrap/Pagination";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const buildPages = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const arr = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    const prev = arr[i - 1];
    if (i > 0 && p - prev > 1) out.push("...");
    out.push(p);
  }
  return out;
};

const AppPagination = ({ page, total, limit, disabled, onChange }) => {
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((Number(total) || 0) / (Number(limit) || 10))),
    [total, limit]
  );

  const safePage = clamp(Number(page) || 1, 1, totalPages);
  const items = useMemo(() => buildPages(safePage, totalPages), [safePage, totalPages]);

  const go = (p) => {
    const next = clamp(p, 1, totalPages);
    if (next === safePage) return;
    onChange?.(next);
  };

  return (
    <Pagination className="mb-0">
      <Pagination.First disabled={disabled || safePage === 1} onClick={() => go(1)} />
      <Pagination.Prev disabled={disabled || safePage === 1} onClick={() => go(safePage - 1)} />

      {items.map((it, idx) =>
        it === "..." ? (
          <Pagination.Ellipsis key={`e-${idx}`} disabled />
        ) : (
          <Pagination.Item
            key={it}
            active={it === safePage}
            disabled={disabled}
            onClick={() => go(it)}
          >
            {it}
          </Pagination.Item>
        )
      )}

      <Pagination.Next disabled={disabled || safePage === totalPages} onClick={() => go(safePage + 1)} />
      <Pagination.Last disabled={disabled || safePage === totalPages} onClick={() => go(totalPages)} />
    </Pagination>
  );
};

export default AppPagination;
