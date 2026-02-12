"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-secondary/60" />
    );
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
      >
        Sign in
      </Link>
    );
  }

  const { user } = session;
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary ring-1 ring-primary/30 transition-all hover:ring-primary/60"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border/60 bg-background/95 py-1 shadow-xl backdrop-blur-xl">
          <div className="border-b border-border/40 px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
            {session.user.role === "PREMIUM" && (
              <span className="mt-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                Premium
              </span>
            )}
          </div>
          {session.user.role === "PREMIUM" ? (
            <Link
              href="/pricing"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Manage Subscription
            </Link>
          ) : session.user.role !== "ADMIN" ? (
            <Link
              href="/pricing"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-secondary"
            >
              Upgrade to Premium
            </Link>
          ) : null}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
