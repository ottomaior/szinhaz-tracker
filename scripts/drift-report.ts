/**
 * How a drift count is printed, shared by the app's counter and the landing's.
 *
 * `scripts/drift.ts` walks React Native style objects and `scripts/drift-landing.ts`
 * walks CSS declarations; they find different things in different languages and
 * agree on nothing except what a finding is — a file, a line, the literal that
 * should have been a token, and which axis it drifted on. Keeping the printing
 * here is what lets the two numbers be read side by side, and what stops a
 * `--md` report written by one being shaped differently from the other's.
 */

export type Hit<C extends string = string> = {
  file: string;
  line: number;
  literal: string;
  category: C;
};

export type ReportOptions = {
  /** Emit the Markdown report rather than the terminal summary. */
  md?: boolean;
  /** The `# ` heading of the Markdown report. */
  title: string;
  /** Completes "N literals …" — say what they are outside of. */
  subject: string;
  /** Print every hit under the summary, for a run that named its targets. */
  verbose?: boolean;
};

export function report<C extends string>(hits: Hit<C>[], opts: ReportOptions): void {
  const byCat = new Map<C, Hit<C>[]>();
  for (const h of hits) byCat.set(h.category, [...(byCat.get(h.category) ?? []), h]);
  const byFile = new Map<string, number>();
  for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);

  if (opts.md) {
    console.log(`# ${opts.title}\n\n${hits.length} literals ${opts.subject} across ${byFile.size} files.\n`);
    console.log("| Category | Count |\n|---|---|");
    for (const [c, l] of byCat) console.log(`| ${c} | ${l.length} |`);
    console.log("\n| File | Count |\n|---|---|");
    for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`| ${f} | ${n} |`);
    console.log("\n| File | Line | Literal | Category |\n|---|---|---|---|");
    for (const h of hits) console.log(`| ${h.file} | ${h.line} | \`${h.literal}\` | ${h.category} |`);
    return;
  }

  for (const [c, l] of byCat) console.log(`${c.padEnd(10)} ${l.length}`);
  console.log(`total      ${hits.length}   (${byFile.size} files)`);
  if (opts.verbose) for (const h of hits) console.log(`  ${h.file}:${h.line}  ${h.literal}`);
}
