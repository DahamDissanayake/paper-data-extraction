import { test, expect } from '@playwright/test';
import path from 'node:path';

const PDF = path.resolve('test/fixtures/GRADE-11-HISTORY.pdf');

test('extracts questions and survives a refresh', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', PDF);

  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Step 3 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('tab', { name: /Straight/ })).toBeVisible({ timeout: 60_000 });
  const straight = page.getByRole('tab', { name: /Straight/ });
  await expect(straight).toContainText(/Straight \(\d+\)/);

  // Q1's verified answer is option 3.
  await expect(page.getByTestId('question-1-answer')).toHaveValue('3');

  // A refresh must restore the session, not reset it.
  await page.reload();
  await expect(page.getByRole('tab', { name: /Straight/ })).toBeVisible();
  await expect(page.getByTestId('question-1-answer')).toHaveValue('3');
});

test('an edit survives a refresh', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', PDF);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('question-1-stem')).toBeVisible({ timeout: 60_000 });

  await page.getByTestId('question-1-stem').fill('සංස්කරණය කළ ප්‍රශ්නය');
  await page.reload();
  await expect(page.getByTestId('question-1-stem')).toHaveValue('සංස්කරණය කළ ප්‍රශ්නය');
});

/**
 * Step 4 used to be a dead end: no Back control, and `useSessionStore`'s
 * `newSession` action had zero callers anywhere in the codebase, so the
 * spec's "ends on tab close or explicit New Session" had no explicit path.
 */
test('the review workspace can go back and start a new session', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', PDF);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('question-1-stem')).toBeVisible({ timeout: 60_000 });

  await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();

  // Back returns to step 3 with the earlier answer-sheet choice still made,
  // so Continue goes straight forward again without losing the extraction.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Step 3 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('question-1-answer')).toHaveValue('3', { timeout: 60_000 });

  // New Session clears everything and returns to the upload step.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'New Session' }).click();
  await expect(page.getByText('Step 1 of 4')).toBeVisible({ timeout: 30_000 });
});
