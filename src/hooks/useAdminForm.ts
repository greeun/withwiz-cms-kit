'use client';

import { useState, useCallback } from 'react';

export function useAdminForm<F extends object>(initialForm: F) {
  const [tab, setTab] = useState<'list' | 'edit'>('list');
  const [form, setForm] = useState<F>(initialForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobilePv, setMobilePv] = useState(false);

  const updateField = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setForm((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const addNew = useCallback(
    (emptyForm: F) => {
      setSelectedId(null);
      setIsNew(true);
      setForm(emptyForm);
      setTab('edit');
    },
    [],
  );

  const startEdit = useCallback((id: string, emptyForm?: F) => {
    setSelectedId(id);
    if (emptyForm) setForm(emptyForm);
    setIsNew(false);
    setLoading(true);
    setTab('edit');
  }, []);

  const backToList = useCallback(() => {
    setTab('list');
    setSelectedId(null);
  }, []);

  return {
    tab,
    setTab,
    form,
    setForm,
    updateField,
    selectedId,
    setSelectedId,
    isNew,
    setIsNew,
    saving,
    setSaving,
    loading,
    setLoading,
    mobilePv,
    setMobilePv,
    addNew,
    startEdit,
    backToList,
  };
}
