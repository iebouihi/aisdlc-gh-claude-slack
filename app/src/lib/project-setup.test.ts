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

  it("AC12 (#7): .nvmrc and package.json engines pin Node 20", () => {
    expect(read(".nvmrc").trim()).toBe("20");
    expect(pkg.engines.node).toMatch(/^20/);
  });

  it("AC14 (#7): the only runtime dependencies are Next.js and React", () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["next", "react", "react-dom"]);
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
