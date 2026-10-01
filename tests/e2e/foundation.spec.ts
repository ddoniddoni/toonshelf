import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home navigation shows honest unavailable state and no horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("읽은 이야기마다,나의 취향이 쌓인다.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "서재 둘러보기" }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole("heading", { name: "작품 카탈로그를 준비하고 있어요" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "작품 제목·별칭·작가 검색" })).toBeDisabled();
  await expect(page.locator(".work-card")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("theme choice survives reload and system mode remains available", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "다크 테마", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("button", { name: "다크 테마", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "시스템 테마" }).click();
  await expect(page.getByRole("button", { name: "시스템 테마" })).toHaveAttribute("aria-pressed", "true");
});

test("missing routes return 404 and preview stays noindex", async ({ page, request }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "찾으시는 이야기가 없어요" })).toBeVisible();
  const home = await request.get("/");
  expect(home.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
});

test("keyboard skip link reaches main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 바로 가기" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

for (const theme of ["라이트", "다크"]) {
  test(`@a11y ${theme} home and empty state have no automated WCAG AA violations`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `${theme} 테마`, exact: true }).click();
    for (const route of ["/", "/explore"]) {
      await page.goto(route);
      await expect(page.getByRole("button", { name: `${theme} 테마`, exact: true })).toHaveAttribute("aria-pressed", "true");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations).toEqual([]);
    }
  });
}
