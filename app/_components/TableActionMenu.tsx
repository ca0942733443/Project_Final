"use client";

import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
};

type TableActionMenuProps = {
  children: ReactNode;
  label: string;
};

export default function TableActionMenu({ children, label }: TableActionMenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isOpen = position !== null;

  const closeMenu = () => setPosition(null);

  const toggleMenu = () => {
    if (isOpen) {
      closeMenu();
      return;
    }

    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 190;
    const edgeGap = 12;
    const left = Math.min(
      window.innerWidth - menuWidth - edgeGap,
      Math.max(edgeGap, rect.right - menuWidth),
    );
    const opensUp = window.innerHeight - rect.bottom < 180 && rect.top > 180;

    setPosition(opensUp
      ? { bottom: window.innerHeight - rect.top + 6, left }
      : { left, top: rect.bottom + 6 });
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [isOpen]);

  return <>
    <button
      aria-controls={isOpen ? menuId : undefined}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      aria-label={label}
      className={`table-action-menu-trigger${isOpen ? " active" : ""}`}
      onClick={toggleMenu}
      ref={triggerRef}
      type="button"
    >
      <MoreVertical aria-hidden="true" size={19} />
    </button>
    {isOpen && typeof document !== "undefined" && createPortal(
      <div
        className="table-action-menu-popover"
        id={menuId}
        onClick={closeMenu}
        ref={menuRef}
        role="menu"
        style={position}
      >
        {children}
      </div>,
      document.body,
    )}
  </>;
}
