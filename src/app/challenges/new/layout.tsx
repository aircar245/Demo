import { AdminAccess } from '@/components/layout/AdminAccess';

export default function ChallengeEditorLayout({ children }: { children: React.ReactNode }) {
  return <AdminAccess>{children}</AdminAccess>;
}
