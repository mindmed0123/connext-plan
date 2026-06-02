import { useState, useEffect, useCallback } from "react";

/**
 * Persiste estado de formulário no localStorage para sobreviver à troca de aba/rota.
 * Use `clearDraft()` após salvar com sucesso para limpar o rascunho.
 */
export function useDraftState<T>(key: string, defaultValue: T) {
  const storageKey = `draft_${key}`;

  const [state, setStateRaw] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore quota / serialization errors
    }
  }, [state, storageKey]);

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateRaw(value);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setStateRaw(defaultValue);
  }, [storageKey, defaultValue]);

  return [state, setState, clearDraft] as const;
}
