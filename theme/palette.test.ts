import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { themes, THEME_ORDER, themeScheme, type Palette } from "./themes";

/**
 * The theme picker shipped once with nothing behind it on native, and nobody
 * noticed until a build was in a tester's hands. It failed silently and it
 * failed *plausibly*: the rows were there, the swatches were right, the
 * checkmark moved, the choice was even saved. Only the colours never changed.
 *
 * The cause is a shape that looks completely ordinary:
 *
 *     const styles = StyleSheet.create({ card: { backgroundColor: colors.bg } });
 *
 * — an object literal at module scope, holding whatever the palette said the
 * moment the file was imported. On the web that was harmless, because the value
 * it held was the string "var(--vc-bg)" and the browser did the resolving. On
 * native it is a hex code, and it is frozen for the life of the process.
 *
 * Nothing about writing that line feels like a mistake, which is exactly why it
 * needs a test rather than a convention. theme/styles.ts has the replacement.
 */

const ROOTS = ["app", "components", "hooks"];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) out.push(path);
    }
  };
  for (const root of ROOTS) walk(root);
  return out;
}

function parse(path: string) {
  const text = readFileSync(path, "utf8");
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Does this subtree name `ident` as a value (rather than as a property or a key)? */
function reads(node: ts.Node, ident: string): boolean {
  let hit = false;
  const walk = (n: ts.Node) => {
    if (hit) return;
    if (ts.isIdentifier(n) && n.text === ident) {
      const parent = n.parent;
      const isMemberName = parent && ts.isPropertyAccessExpression(parent) && parent.name === n;
      const isKey = parent && ts.isPropertyAssignment(parent) && parent.name === n;
      const isImport = parent && (ts.isImportSpecifier(parent) || ts.isImportClause(parent));
      if (!isMemberName && !isKey && !isImport) {
        hit = true;
        return;
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return hit;
}

function calls(node: ts.Node, names: string[]): boolean {
  let hit = false;
  const walk = (n: ts.Node) => {
    if (hit) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.includes(n.expression.text)) {
      hit = true;
      return;
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return hit;
}

/** Top-level function declarations and function-valued consts, with their bodies. */
function topLevelFunctions(sf: ts.SourceFile): { name: string; body: ts.Node }[] {
  const out: { name: string; body: ts.Node }[] = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.body) {
      out.push({ name: st.name?.text ?? "(default export)", body: st.body });
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const init = d.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && ts.isBlock(init.body)) {
          out.push({ name: ts.isIdentifier(d.name) ? d.name.text : "(anonymous)", body: init.body });
        }
      }
    }
  }
  return out;
}

const PALETTE_IDENTS = ["colors", "elevation"];
const SUBSCRIPTIONS = ["useStyles", "useColors"];

describe("palettes", () => {
  it("all define the same tokens", () => {
    const reference = Object.keys(themes.velvetDark).sort();
    for (const [id, palette] of Object.entries(themes)) {
      expect(Object.keys(palette as Palette).sort(), id).toEqual(reference);
    }
  });

  it("are all offered in the picker, and all take a side", () => {
    const ids = Object.keys(themes).sort();
    expect([...THEME_ORDER].sort()).toEqual(ids);
    expect(Object.keys(themeScheme).sort()).toEqual(ids);
  });
});

describe("no screen freezes a palette", () => {
  const files = sourceFiles();

  it("finds the screens to check", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("keeps every stylesheet inside a makeStyles factory", () => {
    const frozen: string[] = [];

    for (const path of files) {
      const sf = parse(path);
      for (const st of sf.statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
          const init = d.initializer;
          if (!init || !ts.isCallExpression(init)) continue;
          if (init.expression.getText(sf) !== "StyleSheet.create") continue;
          if (PALETTE_IDENTS.some((ident) => reads(init, ident))) {
            frozen.push(path + " -> " + (ts.isIdentifier(d.name) ? d.name.text : "?"));
          }
        }
      }
    }

    expect(frozen).toEqual([]);
  });

  it("keeps every other module-scope value clear of the palette", () => {
    const frozen: string[] = [];

    for (const path of files) {
      const sf = parse(path);
      for (const st of sf.statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
          const init = d.initializer;
          if (!init) continue;
          // A factory is the point: it is called once per theme, not once ever.
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) continue;
          if (ts.isCallExpression(init) && init.expression.getText(sf) === "makeStyles") continue;
          if (PALETTE_IDENTS.some((ident) => reads(init, ident))) {
            frozen.push(path + " -> " + (ts.isIdentifier(d.name) ? d.name.text : "?"));
          }
        }
      }
    }

    expect(frozen).toEqual([]);
  });

  it("subscribes every component that reads a colour", () => {
    // A component that reads the palette but never calls useStyles() or
    // useColors() renders correctly once and then never hears that the theme
    // changed. Components below one of these in the tree are covered by it
    // re-rendering; a component with no subscribing ancestor is not.
    const unsubscribed: string[] = [];

    for (const path of files) {
      const sf = parse(path);
      for (const fn of topLevelFunctions(sf)) {
        if (!/^[A-Z(]/.test(fn.name)) continue; // components only
        const readsPalette =
          PALETTE_IDENTS.some((ident) => reads(fn.body, ident)) || reads(fn.body, "typeStyle");
        if (!readsPalette) continue;
        if (calls(fn.body, SUBSCRIPTIONS)) continue;
        unsubscribed.push(path + " -> " + fn.name);
      }
    }

    expect(unsubscribed).toEqual([]);
  });
});
