/**
 * @vitest-environment jsdom
 *
 * RTL tests for CanvasZoomControls. Covers click dispatch on each of
 * the four buttons + disabled-state at scale extremes.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CanvasZoomControls } from '../CanvasZoomControls';

function defaultProps() {
  return {
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToContent: vi.fn(),
    atMaxScale: false,
    atMinScale: false,
  };
}

describe('CanvasZoomControls', () => {
  it('renders three labeled buttons (no 1:1)', () => {
    const { getByLabelText, queryByLabelText } = render(
      <CanvasZoomControls {...defaultProps()} />
    );
    expect(getByLabelText('Zoom in')).toBeTruthy();
    expect(getByLabelText('Zoom out')).toBeTruthy();
    expect(getByLabelText('Fit to view')).toBeTruthy();
    expect(queryByLabelText('Reset zoom')).toBeNull();
  });

  it('Zoom in click invokes zoomIn', () => {
    const props = defaultProps();
    const { getByLabelText } = render(<CanvasZoomControls {...props} />);
    fireEvent.click(getByLabelText('Zoom in'));
    expect(props.zoomIn).toHaveBeenCalledTimes(1);
  });

  it('Zoom out click invokes zoomOut', () => {
    const props = defaultProps();
    const { getByLabelText } = render(<CanvasZoomControls {...props} />);
    fireEvent.click(getByLabelText('Zoom out'));
    expect(props.zoomOut).toHaveBeenCalledTimes(1);
  });

  it('Fit click invokes fitToContent', () => {
    const props = defaultProps();
    const { getByLabelText } = render(<CanvasZoomControls {...props} />);
    fireEvent.click(getByLabelText('Fit to view'));
    expect(props.fitToContent).toHaveBeenCalledTimes(1);
  });

  it('Zoom in is disabled at max scale', () => {
    const props = { ...defaultProps(), atMaxScale: true };
    const { getByLabelText } = render(<CanvasZoomControls {...props} />);
    const button = getByLabelText('Zoom in') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(props.zoomIn).not.toHaveBeenCalled();
  });

  it('Zoom out is disabled at min scale', () => {
    const props = { ...defaultProps(), atMinScale: true };
    const { getByLabelText } = render(<CanvasZoomControls {...props} />);
    const button = getByLabelText('Zoom out') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(props.zoomOut).not.toHaveBeenCalled();
  });

  it('Fit stays enabled at scale extremes', () => {
    const props = { ...defaultProps(), atMaxScale: true, atMinScale: true };
    const { getByLabelText } = render(<CanvasZoomControls {...props} />);
    expect((getByLabelText('Fit to view') as HTMLButtonElement).disabled).toBe(false);
  });
});
