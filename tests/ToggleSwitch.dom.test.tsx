import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@withwiz/cms-kit/components/toggle-switch.css', () => ({}));

import ToggleSwitch from '@withwiz/cms-kit/components/ToggleSwitch';

describe('ToggleSwitch 컴포넌트', () => {
  it('CMS-TS-01: checked=true → .on 클래스 보유', () => {
    const { container } = render(
      <ToggleSwitch checked={true} onChange={vi.fn()} />,
    );
    const track = container.querySelector('.admin-toggle-track');
    expect(track?.classList.contains('on')).toBe(true);
  });

  it('CMS-TS-02: checked=false → .on 클래스 없음', () => {
    const { container } = render(
      <ToggleSwitch checked={false} onChange={vi.fn()} />,
    );
    const track = container.querySelector('.admin-toggle-track');
    expect(track?.classList.contains('on')).toBe(false);
  });

  it('CMS-TS-03: 클릭 시 onChange 호출', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('CMS-TS-04: label 제공 시 렌더링', () => {
    render(
      <ToggleSwitch checked={false} onChange={vi.fn()} label="공개" />,
    );
    expect(screen.getByText('공개')).toBeDefined();
  });

  it('CMS-TS-05: label 미제공 시 label 요소 없음', () => {
    const { container } = render(
      <ToggleSwitch checked={false} onChange={vi.fn()} />,
    );
    const labelEl = container.querySelector('.admin-toggle-label');
    expect(labelEl).toBeNull();
  });

  it('CMS-TS-06: 커스텀 className 적용', () => {
    const { container } = render(
      <ToggleSwitch checked={false} onChange={vi.fn()} className="my-class" />,
    );
    const label = container.querySelector('.admin-toggle');
    expect(label?.classList.contains('my-class')).toBe(true);
  });
});
