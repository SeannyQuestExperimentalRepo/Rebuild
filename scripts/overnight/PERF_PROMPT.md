# Performance Optimization Task

You are in a Next.js 16 app. Your ONLY job is to make ONE small change to an EXISTING source file in src/ that reduces bundle size or improves performance.

## STRICT RULES

- ONLY modify files inside src/
- DO NOT create Dockerfiles, docker-compose files, or config files
- DO NOT create new scripts or utility files
- DO NOT touch files outside src/
- Make exactly ONE optimization to ONE existing file
- Run npm run build after your change
- If build fails, undo your change immediately

## WHAT TO CHANGE (pick ONE)

1. Add next/dynamic with ssr false to lazy-load a heavy component in a page.tsx file.
2. In any src/app/api route.ts, convert Prisma include to select with only needed fields.
3. Find a src/lib ts file over 300 lines and convert broad imports to specific imports.
4. In src/components tsx, add dynamic imports for heavy libraries.
5. Remove unused imports or dead code in src/lib ts files.

## OUTPUT

After making your change, write a one-line summary of what you changed.
