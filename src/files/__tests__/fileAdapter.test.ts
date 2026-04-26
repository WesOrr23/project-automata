/**
 * @vitest-environment jsdom
 *
 * Tests for the blob-download file adapter. The save path uses
 * URL.createObjectURL which jsdom mocks; we spy on it. The open path
 * uses an injected hidden <input>; we exercise it by triggering the
 * change event directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { blobDownloadAdapter } from '../fileAdapter';

describe('blobDownloadAdapter.save', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:fake');
    revokeObjectURL = vi.fn();
    (URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL = revokeObjectURL;
  });

  it('returns ok with the suggestedName', async () => {
    const result = await blobDownloadAdapter.save({
      content: '{"hello":"world"}',
      suggestedName: 'test.json',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('test.json');
  });

  it('creates and revokes the blob URL', async () => {
    await blobDownloadAdapter.save({ content: 'x', suggestedName: 'x.json' });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});

describe('blobDownloadAdapter.open', () => {
  let originalCreateElement: typeof document.createElement;
  let mountedInput: HTMLInputElement | null = null;

  beforeEach(() => {
    mountedInput = null;
    originalCreateElement = document.createElement.bind(document);
    // Intercept input element creation so we can drive its `files` and
    // change event.
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreateElement(tag) as HTMLElement;
      if (tag === 'input') {
        mountedInput = element as HTMLInputElement;
        // Stub click so the system file picker doesn't open.
        (element as HTMLInputElement).click = vi.fn();
      }
      return element;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves ok when a file is selected', async () => {
    const promise = blobDownloadAdapter.open();
    expect(mountedInput).not.toBeNull();
    const file = new File(['{"some":"json"}'], 'sample.json', { type: 'application/json' });
    Object.defineProperty(mountedInput!, 'files', { value: [file] });
    mountedInput!.dispatchEvent(new Event('change'));
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('sample.json');
    expect(result.value.content).toBe('{"some":"json"}');
  });

  it('resolves err with file-cancelled when no file selected (change with empty files)', async () => {
    const promise = blobDownloadAdapter.open();
    Object.defineProperty(mountedInput!, 'files', { value: [] });
    mountedInput!.dispatchEvent(new Event('change'));
    const result = await promise;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('file-cancelled');
  });
});
