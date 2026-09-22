import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

/**
 * A row is a button. Nothing tappable may be rendered inside one.
 *
 * `PlayRow` and `PersonRow` are `Pressable`s, which react-native-web renders
 * as `<button>`. A control placed in the row's `trailing` slot therefore
 * became a `<button>` inside a `<button>`: invalid HTML, a hydration warning
 * on every render, and a single target to a screen reader, which is what
 * T-070 reported on the list screen. Both rows have an `action` slot for
 * this — a sibling of the pressable, not a child of it — and `trailing` is
 * for content that is only read: a rank numeral, a rating, a date.
 *
 * The reason this is a test and not a convention: the fix landed on
 * `PersonRow` for the block list, and the list screen kept passing its remove
 * button through `trailing` for another day, because nothing said no. The
 * mistake is invisible at the call site — you are handing a component to a
 * prop, and the prop's name does not tell you where it will be rendered.
 */

const ROOTS = ["app", "components"];

/** Props whose contents are rendered inside a row's own pressable. */
const READ_ONLY_SLOTS = new Set(["trailing"]);

/** Anything that becomes a button, a link or a tap target of its own. */
const CONTROLS = new Set([
  "Button",
  "IconButton",
  "Pressable",
  "TouchableOpacity",
  "TouchableHighlight",
  "TouchableWithoutFeedback",
  "Chip",
  "SelectChip",
  "Switch",
  "Link",
]);

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx$/.test(name) && !name.endsWith(".test.tsx")) out.push(path);
    }
  };
  for (const root of ROOTS) walk(root);
  return out;
}

function parse(path: string) {
  const text = readFileSync(path, "utf8");
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function tagName(node: ts.JsxSelfClosingElement | ts.JsxOpeningElement): string {
  return node.tagName.getText();
}

/** Every control rendered anywhere inside this subtree. */
function controlsIn(node: ts.Node): string[] {
  const found: string[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
      const tag = tagName(n);
      if (CONTROLS.has(tag)) found.push(tag);
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

describe("rows do not nest a control inside their pressable", () => {
  it("no call site puts a control in a read-only row slot", () => {
    const offences: string[] = [];

    for (const path of sourceFiles()) {
      const file = parse(path);
      const walk = (node: ts.Node) => {
        if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && READ_ONLY_SLOTS.has(node.name.text)) {
          const value = node.initializer;
          if (value) {
            const controls = controlsIn(value);
            if (controls.length > 0) {
              const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
              offences.push(`${path}:${line} — <${controls.join(">, <")}> inside ${node.name.text}=`);
            }
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(file);
    }

    expect(
      offences,
      `A control in a row's read-only slot is a button inside a button (T-070).\n` +
        `Pass it through the row's "action" prop instead, which renders beside\n` +
        `the pressable rather than within it:\n\n${offences.join("\n")}\n`
    ).toEqual([]);
  });

  it("both row primitives offer the action slot that replaces it", () => {
    for (const path of ["components/ui/PlayRow.tsx", "components/ui/Rows.tsx"]) {
      expect(readFileSync(path, "utf8"), `${path} should take an "action" prop`).toMatch(/\baction\?:\s*ReactNode/);
    }
  });
});
