import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const pkg = JSON.parse(read("package.json"));

describe("project setup", () => {
  it("AC2 (#7): next.config is a static export and there are no API routes", () => {
    expect(read("next.config.ts")).toMatch(/output:\s*"export"/);
    expect(existsSync(join(root, "src/app/api"))).toBe(false);
  });

  it("AC5 (#7): no Tailwind or UI library; styles are CSS Modules plus a global stylesheet", () => {
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");
    expect(deps).not.toMatch(
      /tailwind|@mui|chakra|antd|bootstrap|@radix-ui|mantine|styled-components/,
    );
    expect(existsSync(join(root, "src/app/globals.css"))).toBe(true);
    expect(existsSync(join(root, "src/app/page.module.css"))).toBe(true);
  });

  it("AC10 (#7): lint, typecheck, test and build scripts exist and Prettier is configured", () => {
    for (const s of ["lint", "typecheck", "test", "build"]) expect(pkg.scripts[s]).toBeTruthy();
    expect(existsSync(join(root, ".prettierrc.json"))).toBe(true);
  });

  it("AC1 (#12): .nvmrc contains exactly 26", () => {
    expect(read(".nvmrc").trim()).toBe("26");
  });

  it("AC2 (#12): package.json engines.node is 26.x", () => {
    expect(pkg.engines.node).toBe("26.x");
  });

  it("AC11 (#12): README states Node 26 and how Vercel deploys main and pull requests", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/Node 26/);
    expect(readme).toMatch(/Production is deployed from `main`/);
    expect(readme).toMatch(/each pull request gets a preview URL/);
  });

  it("AC14 (#7): the only runtime dependencies are Next.js and React", () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["next", "react", "react-dom"]);
  });

  it("AC11 (#27): runtime dependencies are only Next.js and React; no Tailwind or UI library", () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["next", "react", "react-dom"]);
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ")).not.toMatch(
      /tailwind|@mui|chakra|antd|bootstrap|@radix-ui|mantine|styled-components/,
    );
  });

  it("AC12 (#27): colours come from the design-token stylesheet; system font stack", () => {
    const tokens = read("src/app/tokens.css");
    expect(tokens).toMatch(/--accent:/);
    expect(tokens).toMatch(/--font-sans:\s*system-ui/);
    expect(read("src/app/globals.css")).toMatch(/@import "\.\/tokens\.css"/);
    const sheets = ["src/app/globals.css", "src/app/page.module.css"];
    for (const dir of ["src/components"]) {
      for (const f of readdirSync(join(root, dir))) {
        if (f.endsWith(".module.css")) sheets.push(`${dir}/${f}`);
      }
    }
    for (const sheet of sheets) {
      expect(read(sheet), sheet).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    }
  });

  it("AC15 (#27): the light theme is always used; no dark mode styles", () => {
    const css = [read("src/app/tokens.css"), read("src/app/globals.css")].join("\n");
    expect(css).toMatch(/color-scheme:\s*light;/);
    expect(css).not.toMatch(/prefers-color-scheme|color-scheme:[^;]*dark/);
  });

  it("AC15 (#7): no deployment config and no end-to-end tests", () => {
    const names = readdirSync(root);
    expect(names).not.toContain("vercel.json");
    expect(names).not.toContain("netlify.toml");
    expect(names).not.toContain("Dockerfile");
    expect(names.some((n) => /^(playwright|cypress)/.test(n))).toBe(false);
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ")).not.toMatch(
      /playwright|cypress/,
    );
  });
});
