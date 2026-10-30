import { expect, test } from '@playwright/test';

test.describe('mega menu', () => {
  test('mouse: click opens, hovering a department switches the panel, links navigate', async ({
    page,
  }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'All Categories' });
    await trigger.click();
    const menu = page.getByRole('dialog', { name: 'All categories' });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('tab')).toHaveCount(14);
    await menu.getByRole('tab', { name: 'Musical Instruments' }).hover();
    const panel = menu.getByRole('tabpanel');
    await expect(panel.getByRole('heading', { name: 'Musical Instruments' })).toBeVisible();
    await panel.getByRole('link', { name: 'Guitars & Basses' }).click();
    await expect(page).toHaveURL('/c/music/guitars-basses');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guitars & Basses');
    await expect(menu).toBeHidden();
  });

  test('mouse: hovering the trigger opens after a short delay, leaving closes it', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'All Categories' }).hover();
    const menu = page.getByRole('dialog', { name: 'All categories' });
    await expect(menu).toBeVisible();
    await page.mouse.move(700, 850);
    await expect(menu).toBeHidden();
  });

  test('keyboard: arrows, panel entry, focus trap, Esc returns focus', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'All Categories' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('dialog', { name: 'All categories' });
    await expect(menu.getByRole('tab', { name: 'Electronics' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('tab', { name: 'Home & Living' })).toBeFocused();
    await expect(menu.getByRole('tab', { name: 'Home & Living' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('End');
    await expect(menu.getByRole('tab', { name: 'Garage Sale & Misc' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('tab', { name: 'Electronics' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(menu.getByRole('link', { name: 'Shop all Electronics' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(menu.getByRole('tab', { name: 'Electronics' })).toBeFocused();
    // Tab cycles inside the open menu.
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('More lists the departments that are not in the bar', async ({ page }) => {
    await page.goto('/');
    const more = page.getByRole('button', { name: 'More' });
    await more.click();
    const list = page.locator(`#${(await more.getAttribute('aria-controls')) ?? ''}`);
    await expect(list.getByRole('link')).toHaveText([
      'Garden & Outdoor',
      'Hobbies & Collectibles',
      'Musical Instruments',
      'Auto Parts & Accessories',
      'Pet Supplies',
      'Office & Business',
      'Garage Sale & Misc',
    ]);
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
  });
});
