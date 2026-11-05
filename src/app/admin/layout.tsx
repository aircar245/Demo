import { AdminAccess } from '@/components/layout/AdminAccess';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAccess>{children}</AdminAccess>;
}
