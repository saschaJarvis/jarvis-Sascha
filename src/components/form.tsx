'use client';
import { useFormStatus } from 'react-dom';

export function Submit({ children, className = 'btn btn-primary', disabled, name, value }:
  { children: React.ReactNode; className?: string; disabled?: boolean; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} name={name} value={value} aria-busy={pending}>
      {pending ? 'Einen Moment …' : children}
    </button>
  );
}

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return <p role="alert" className="notice notice-bad">{error}</p>;
}

export function OkNote({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="status" className="notice notice-good">{message}</p>;
}
