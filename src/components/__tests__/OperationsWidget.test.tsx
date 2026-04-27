/**
 * @vitest-environment jsdom
 *
 * RTL tests for OperationsWidget. Visibility gating, popover toggle,
 * categorized item rendering, enable/disable, click dispatch.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { OperationsWidget, type OperationsCategory } from '../OperationsWidget';

function makeCategories(overrides?: {
  convertEnabled?: boolean;
  minimizeEnabled?: boolean;
}): {
  categories: OperationsCategory[];
  onConvert: ReturnType<typeof vi.fn>;
  onMinimize: ReturnType<typeof vi.fn>;
} {
  const onConvert = vi.fn();
  const onMinimize = vi.fn();
  const categories: OperationsCategory[] = [
    {
      id: 'conversions',
      label: 'Conversions',
      items: [
        {
          id: 'nfa-to-dfa',
          label: 'Convert NFA to DFA',
          enabled: overrides?.convertEnabled ?? true,
          onClick: onConvert,
        },
      ],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      items: [
        {
          id: 'minimize',
          label: 'Minimize DFA',
          enabled: overrides?.minimizeEnabled ?? true,
          onClick: onMinimize,
        },
      ],
    },
  ];
  return { categories, onConvert, onMinimize };
}

describe('OperationsWidget — visibility', () => {
  it('renders nothing when visible=false', () => {
    const { categories } = makeCategories();
    const { queryByLabelText } = render(
      <OperationsWidget visible={false} categories={categories} />
    );
    expect(queryByLabelText('Operations')).toBeNull();
  });

  it('renders the trigger button when visible=true', () => {
    const { categories } = makeCategories();
    const { getByLabelText } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    expect(getByLabelText('Operations')).toBeTruthy();
  });
});

describe('OperationsWidget — popover', () => {
  it('starts closed', () => {
    const { categories } = makeCategories();
    const { queryByRole } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    expect(queryByRole('menu')).toBeNull();
  });

  it('opens on trigger click; closes on second click', () => {
    const { categories } = makeCategories();
    const { getByLabelText, queryByRole } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    fireEvent.click(getByLabelText('Operations'));
    expect(queryByRole('menu')).toBeTruthy();
    fireEvent.click(getByLabelText('Operations'));
    expect(queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    const { categories } = makeCategories();
    const { getByLabelText, queryByRole } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    fireEvent.click(getByLabelText('Operations'));
    expect(queryByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByRole('menu')).toBeNull();
  });

  it('closes on outside click', () => {
    const { categories } = makeCategories();
    const { getByLabelText, queryByRole } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    fireEvent.click(getByLabelText('Operations'));
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    fireEvent.mouseDown(outside);
    expect(queryByRole('menu')).toBeNull();
  });
});

describe('OperationsWidget — items', () => {
  it('renders one button per item with the right label', () => {
    const { categories } = makeCategories();
    const { getByLabelText, getByText } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    fireEvent.click(getByLabelText('Operations'));
    expect(getByText('Convert NFA to DFA')).toBeTruthy();
    expect(getByText('Minimize DFA')).toBeTruthy();
  });

  it('renders category headers', () => {
    const { categories } = makeCategories();
    const { getByLabelText, getByText } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    fireEvent.click(getByLabelText('Operations'));
    expect(getByText('Conversions')).toBeTruthy();
    expect(getByText('Analysis')).toBeTruthy();
  });

  it('disabled items render as disabled buttons', () => {
    const { categories } = makeCategories({ convertEnabled: false });
    const { getByLabelText, getByText } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    fireEvent.click(getByLabelText('Operations'));
    const button = getByText('Convert NFA to DFA').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('clicking an enabled item dispatches its onClick and closes the popover', () => {
    const { categories, onConvert } = makeCategories();
    const { getByLabelText, getByText, queryByRole } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    fireEvent.click(getByLabelText('Operations'));
    fireEvent.click(getByText('Convert NFA to DFA'));
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(queryByRole('menu')).toBeNull();
  });

  it('clicking a disabled item does NOT dispatch its onClick', () => {
    const { categories, onConvert } = makeCategories({ convertEnabled: false });
    const { getByLabelText, getByText } = render(
      <OperationsWidget visible={true} categories={categories} />
    );
    fireEvent.click(getByLabelText('Operations'));
    fireEvent.click(getByText('Convert NFA to DFA'));
    expect(onConvert).not.toHaveBeenCalled();
  });

  it('skips empty categories', () => {
    const onlyEmpty: OperationsCategory[] = [
      { id: 'empty', label: 'Empty', items: [] },
    ];
    const { getByLabelText, getByText, queryByText } = render(
      <OperationsWidget visible={true} categories={onlyEmpty} />
    );
    fireEvent.click(getByLabelText('Operations'));
    expect(getByText('No operations available for the current automaton.')).toBeTruthy();
    expect(queryByText('Empty')).toBeNull();
  });
});
