import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from './api';

export function useQuery<T>(path: string | null) {
  const { tick } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));

  useEffect(() => {
    if (!path) return;
    let cancel = false;
    api<T>(path)
      .then((value) => {
        if (!cancel) {
          setData(value);
          setError('');
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancel) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [path, tick]);

  return { data, error, loading };
}
