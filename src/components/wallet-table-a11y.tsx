'use client';

import { useRef, useCallback, useEffect } from 'react';

interface WalletTableA11yOptions {
  rowCount: number;
  onRowFocus?: (index: number) => void;
  onRowActivate?: (index: number) => void;
}

export function useWalletTableA11y({
  rowCount,
  onRowFocus,
  onRowActivate,
}: WalletTableA11yOptions) {
  const tableRef = useRef<HTMLTableElement>(null);
  const focusableRowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const registerRow = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      if (node) {
        focusableRowRefs.current.set(index, node);
        node.setAttribute('tabindex', index === 0 ? '0' : '-1');
        node.setAttribute('role', 'row');
        node.setAttribute('aria-selected', index === focusedIndex ? 'true' : 'false');
      } else {
        focusableRowRefs.current.delete(index);
      }
    },
    [focusedIndex]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const rows = focusableRowRefs.current;
      const lastIndex = Math.max(...rows.keys(), 0);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.min(prev + 1, lastIndex);
            rows.get(next)?.focus();
            onRowFocus?.(next);
            return next;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            rows.get(next)?.focus();
            onRowFocus?.(next);
            return next;
          });
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0) {
            onRowActivate?.(focusedIndex);
          }
          break;
        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          rows.get(0)?.focus();
          onRowFocus?.(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusedIndex(lastIndex);
          rows.get(lastIndex)?.focus();
          onRowFocus?.(lastIndex);
          break;
      }
    },
    [focusedIndex, onRowFocus, onRowActivate]
  );

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    table.addEventListener('keydown', handleKeyDown);
    return () => table.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    tableRef,
    registerRow,
    handleKeyDown,
    focusedIndex,
  };
}

export function WalletTable({
  wallets,
  onRowActivate,
}: {
  wallets: Array<{ address: string; name: string; chain: string; balance: string }>;
  onRowActivate?: (wallet: typeof wallets[0]) => void;
}) {
  const { tableRef, registerRow, handleKeyDown } = useWalletTableA11y({
    rowCount: wallets.length,
    onRowActivate: (index) => onRowActivate?.(wallets[index]),
  });

  return (
    <table ref={tableRef} onKeyDown={handleKeyDown} className="w-full border-collapse">
      <thead>
        <tr role="row">
          <th scope="col" role="columnheader">Address</th>
          <th scope="col" role="columnheader">Name</th>
          <th scope="col" role="columnheader">Chain</th>
          <th scope="col" role="columnheader">Balance</th>
        </tr>
      </thead>
      <tbody>
        {wallets.map((wallet, index) => (
          <tr
            key={wallet.address}
            ref={registerRow(index)}
            role="row"
            tabIndex={index === 0 ? 0 : -1}
            aria-label={`Wallet ${wallet.name} on ${wallet.chain}`}
          >
            <td role="cell">{wallet.address}</td>
            <td role="cell">{wallet.name}</td>
            <td role="cell">{wallet.chain}</td>
            <td role="cell">{wallet.balance}</td蛋
          </tr>
        ))}
      </tbody>
    </table>
  );
}
