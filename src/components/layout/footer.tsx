export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <p className="text-sm text-muted-foreground">
          TrendLine &copy; {new Date().getFullYear()}
        </p>
        <p className="text-xs text-muted-foreground/60">
          149K+ games &middot; NFL &middot; NCAAF &middot; NCAAMB
        </p>
      </div>
    </footer>
  );
}
