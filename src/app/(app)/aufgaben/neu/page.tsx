import { PageTitle } from '@/components/ui';
import { NewTaskForm } from './form';

export default function NewTaskPage() {
  return (
    <div>
      <PageTitle back={{ href: '/aufgaben', label: 'Aufgaben' }} title="Neue Aufgabe" />
      <NewTaskForm />
    </div>
  );
}
