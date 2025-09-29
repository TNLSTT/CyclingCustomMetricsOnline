import { redirect } from 'next/navigation';

export default function MetricsIndexPage() {
  redirect('/metrics/registry');
}
