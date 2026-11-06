import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("a demo user logs bodyweight and sees the saved entry after reload", async ({
  app,
  browser,
  screen,
}) => {
  await app.open("/#/home/bodyweight");
  await expect(
    screen.getByRole("heading", "Log body weight", { exact: true, level: 3 }),
  ).toBeVisible();
  const slider = screen.getByRole("group", "Weight in kg").getByRole("slider");
  const initial = await slider.getAttribute("aria-valuenow");
  const weight = String(Number((Number(initial) + 0.1).toFixed(1)));
  await screen.getByRole("button", "plus 0.1 kg", { exact: true }).tap();
  await expect(slider).toHaveAttribute("aria-valuenow", weight);
  await screen.getByRole("button", "Save", { exact: true }).tap();
  await expect(screen.getByText("Weight saved", { exact: true })).toBeVisible();
  await browser.goto("/#/home/bodyweight");
  await expect(screen.getByRole("heading", "Recent weigh-ins", { exact: true })).toBeVisible();
  await expect(screen.getByText(`${weight} kg`, { exact: true }).last()).toBeVisible();
  await browser.reload();
  await expect(screen.getByRole("heading", "Recent weigh-ins", { exact: true })).toBeVisible();
  await expect(screen.getByText(`${weight} kg`, { exact: true }).last()).toBeVisible();
  await expect(screen.getByRole("group", "Weight in kg").getByRole("slider")).toHaveAttribute(
    "aria-valuenow",
    weight!,
  );
});
