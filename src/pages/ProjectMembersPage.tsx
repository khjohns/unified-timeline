/**
 * ProjectMembersPage
 *
 * Admin page for managing project members and their roles.
 * Route: /medlemmer
 */

import { PageHeader } from '../components/PageHeader';
import { ProjectMembersContent } from '../components/ProjectMembersContent';

export function ProjectMembersPage() {
  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Prosjektmedlemmer"
        subtitle="Administrer tilgang og roller"
        maxWidth="medium"
      />
      <ProjectMembersContent />
    </div>
  );
}

export default ProjectMembersPage;
