import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminForm } from '@withwiz/pms/hooks/useAdminForm';

interface TestForm {
  title: string;
  content: string;
}

const emptyForm: TestForm = { title: '', content: '' };

describe('useAdminForm hook', () => {
  it('PMS-UF-01: 초기 상태 - tab=list, selectedId=null', () => {
    const { result } = renderHook(() => useAdminForm(emptyForm));
    expect(result.current.tab).toBe('list');
    expect(result.current.selectedId).toBeNull();
  });

  it('PMS-UF-02: addNew() → isNew=true, tab=edit, selectedId=null', () => {
    const { result } = renderHook(() => useAdminForm(emptyForm));
    act(() => {
      result.current.addNew({ title: '', content: '' });
    });
    expect(result.current.isNew).toBe(true);
    expect(result.current.tab).toBe('edit');
    expect(result.current.selectedId).toBeNull();
  });

  it('PMS-UF-03: startEdit(id) → isNew=false, loading=true, selectedId=id', () => {
    const { result } = renderHook(() => useAdminForm(emptyForm));
    act(() => {
      result.current.startEdit('test-id');
    });
    expect(result.current.isNew).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(result.current.selectedId).toBe('test-id');
    expect(result.current.tab).toBe('edit');
  });

  it('PMS-UF-04: backToList() → tab=list, selectedId=null', () => {
    const { result } = renderHook(() => useAdminForm(emptyForm));
    act(() => {
      result.current.startEdit('test-id');
    });
    act(() => {
      result.current.backToList();
    });
    expect(result.current.tab).toBe('list');
    expect(result.current.selectedId).toBeNull();
  });

  it('PMS-UF-05: updateField(title, new) → form.title 변경', () => {
    const { result } = renderHook(() => useAdminForm(emptyForm));
    act(() => {
      result.current.updateField('title', 'New Title');
    });
    expect(result.current.form.title).toBe('New Title');
  });

  it('PMS-UF-06: updateField 동일 값 → 참조 동일 (리렌더 방지)', () => {
    const { result } = renderHook(() => useAdminForm(emptyForm));
    act(() => {
      result.current.updateField('title', 'Same');
    });
    const formRef = result.current.form;
    act(() => {
      result.current.updateField('title', 'Same');
    });
    expect(result.current.form).toBe(formRef);
  });

  it('PMS-UF-07: mobilePv 초기값 false, setMobilePv 동작', () => {
    const { result } = renderHook(() => useAdminForm(emptyForm));
    expect(result.current.mobilePv).toBe(false);
    act(() => {
      result.current.setMobilePv(true);
    });
    expect(result.current.mobilePv).toBe(true);
  });
});
