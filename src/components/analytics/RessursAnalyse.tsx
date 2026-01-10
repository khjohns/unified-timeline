/**
 * Ressursanalyse Component
 *
 * Analysemetode: Analyse av aktører og ressursbruk
 * Bruksområde: Ressursallokering, arbeidsbelastning, teamoversikt
 */

import { Card } from '../primitives';
import { AnalyticsSection, KPICard } from './AnalyticsHelpers';
import type { ActorAnalytics } from '../../api/analytics';

interface RessursAnalyseProps {
  actors: ActorAnalytics | undefined;
}

export function RessursAnalyse({ actors }: RessursAnalyseProps) {
  const totalEvents = Object.values(actors?.by_role ?? {}).reduce((sum, role) => sum + role.events, 0);
  const totalActors = Object.values(actors?.by_role ?? {}).reduce((sum, role) => sum + role.unique_actors, 0);
  const avgEventsPerActor = totalActors > 0 ? totalEvents / totalActors : 0;

  return (
    <AnalyticsSection
      title="Ressursanalyse"
      description="Oversikt over aktører, roller og arbeidsbelastning. Brukes til ressursallokering og kapasitetsplanlegging."
    >
      {/* Summary KPIs */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Ressursoversikt</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Totalt aktører"
            value={totalActors}
            subtext="Unike personer"
            color="blue"
          />
          <KPICard
            label="Totalt hendelser"
            value={totalEvents}
            subtext="Alle roller"
            color="blue"
          />
          <KPICard
            label="Gj.snitt per aktør"
            value={avgEventsPerActor.toFixed(1)}
            subtext="Hendelser"
            color="green"
          />
          <KPICard
            label="Roller i bruk"
            value={Object.keys(actors?.by_role ?? {}).length}
            subtext="Aktive rolletyper"
            color="blue"
          />
        </div>
      </section>

      {/* Role breakdown */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Fordeling per rolle</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <Card variant="outlined" padding="md">
            <h4 className="text-body-md font-semibold mb-4">Rolleaktivitet</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(actors?.by_role ?? {}).map(([role, data]) => {
                const percentage = totalEvents > 0 ? (data.events / totalEvents) * 100 : 0;
                return (
                  <div key={role} className="text-center p-4 bg-pkt-bg-subtle rounded-lg">
                    <div className="text-3xl font-bold text-oslo-blue">{data.events}</div>
                    <div className="text-sm text-pkt-text-body-subtle mt-1">
                      {role === 'TE' ? 'Totalentreprenør' : role === 'BH' ? 'Byggherre' : role}
                    </div>
                    <div className="text-xs text-pkt-text-body-subtle mt-1">
                      {data.unique_actors} aktører ({percentage.toFixed(0)}%)
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-2 h-1 bg-pkt-grays-gray-200 rounded-full">
                      <div
                        className={`h-1 rounded-full ${role === 'TE' ? 'bg-role-te-pill-bg' : 'bg-role-bh-pill-bg'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Actor efficiency */}
          <Card variant="outlined" padding="md">
            <h4 className="text-body-md font-semibold mb-4">Effektivitet per rolle</h4>
            <div className="space-y-4">
              {Object.entries(actors?.by_role ?? {}).map(([role, data]) => {
                const avgPerActor = data.unique_actors > 0 ? data.events / data.unique_actors : 0;
                return (
                  <div key={role} className="pb-4 border-b border-pkt-border-subtle last:border-0 last:pb-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">
                        {role === 'TE' ? 'Totalentreprenør' : role === 'BH' ? 'Byggherre' : role}
                      </span>
                      <span className="text-sm text-pkt-text-body-subtle">
                        {avgPerActor.toFixed(1)} hendelser/aktør
                      </span>
                    </div>
                    <div className="h-2 bg-pkt-grays-gray-200 rounded-full">
                      <div
                        className={`h-2 rounded-full ${role === 'TE' ? 'bg-role-te-pill-bg' : 'bg-role-bh-pill-bg'}`}
                        style={{ width: `${Math.min((avgPerActor / 20) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </section>

      {/* Top actors */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Mest aktive</h3>
        <Card variant="outlined" padding="md">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top list */}
            <div>
              <h4 className="text-body-md font-semibold mb-4">Topp 10 aktører</h4>
              <div className="space-y-2">
                {actors?.top_actors.slice(0, 10).map((actor, i) => {
                  const maxEvents = actors.top_actors[0]?.events || 1;
                  const width = (actor.events / maxEvents) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 text-sm text-pkt-text-body-subtle text-right">{i + 1}.</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span>
                            {actor.name}
                            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                              actor.role === 'TE' ? 'bg-role-te-pill-bg text-role-te-text' : 'bg-role-bh-pill-bg text-role-bh-text'
                            }`}>
                              {actor.role}
                            </span>
                          </span>
                          <span className="font-medium">{actor.events}</span>
                        </div>
                        <div className="h-1.5 bg-pkt-grays-gray-200 rounded-full">
                          <div
                            className={`h-1.5 rounded-full ${actor.role === 'TE' ? 'bg-role-te-pill-bg' : 'bg-role-bh-pill-bg'}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Distribution analysis */}
            <div>
              <h4 className="text-body-md font-semibold mb-4">Arbeidsbelastning</h4>
              <div className="space-y-4">
                {/* Workload distribution */}
                {(() => {
                  if (!actors?.top_actors.length) return null;

                  const top3Events = actors.top_actors.slice(0, 3).reduce((sum, a) => sum + a.events, 0);
                  const top3Percentage = totalEvents > 0 ? (top3Events / totalEvents) * 100 : 0;

                  return (
                    <>
                      <div className="p-4 bg-pkt-bg-subtle rounded-lg">
                        <div className="text-sm text-pkt-text-body-subtle mb-1">Topp 3 aktører står for</div>
                        <div className="text-2xl font-bold text-oslo-blue">{top3Percentage.toFixed(0)}%</div>
                        <div className="text-xs text-pkt-text-body-subtle">av alle hendelser</div>
                      </div>

                      <div className="p-4 bg-pkt-bg-subtle rounded-lg">
                        <div className="text-sm text-pkt-text-body-subtle mb-1">Mest aktive</div>
                        <div className="text-lg font-semibold">{actors.top_actors[0]?.name ?? '-'}</div>
                        <div className="text-xs text-pkt-text-body-subtle">
                          {actors.top_actors[0]?.events ?? 0} hendelser ({actors.top_actors[0]?.role})
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Resource insights */}
      <Card variant="outlined" padding="md" className="bg-pkt-surface-light-beige">
        <h4 className="text-body-md font-semibold text-pkt-text-body-dark mb-2">Ressursinnsikt</h4>
        <div className="text-sm text-pkt-text-body-default space-y-2">
          {actors && (
            <>
              <p>
                <strong>Balanse:</strong>{' '}
                {(() => {
                  const roles = Object.entries(actors.by_role);
                  if (roles.length < 2) return 'Kun én rolle registrert.';

                  const teEvents = actors.by_role['TE']?.events ?? 0;
                  const bhEvents = actors.by_role['BH']?.events ?? 0;
                  const ratio = teEvents > 0 ? bhEvents / teEvents : 0;

                  if (ratio > 0.8 && ratio < 1.2) {
                    return 'God balanse mellom TE og BH-aktivitet.';
                  } else if (ratio < 0.5) {
                    return 'TE dominerer aktiviteten. BH kan være mer proaktiv.';
                  } else {
                    return 'BH dominerer aktiviteten. Normal i godkjenningsfaser.';
                  }
                })()}
              </p>
              <p>
                <strong>Kapasitet:</strong>{' '}
                {avgEventsPerActor > 15
                  ? 'Høy aktivitet per aktør. Vurder om kapasiteten er tilstrekkelig.'
                  : 'Moderat aktivitetsnivå per aktør.'}
              </p>
            </>
          )}
        </div>
      </Card>
    </AnalyticsSection>
  );
}
