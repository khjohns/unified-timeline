/**
 * Axe Helper for Vitest
 *
 * Custom assertion helper for jest-axe in vitest environment
 */

// Use a minimal interface compatible with both axe-core and jest-axe types
interface AxeViolation {
  id: string;
  help: string;
  description: string;
  impact?: string | null;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
  }>;
}

interface AxeResultsLike {
  violations: AxeViolation[];
}

export function expectNoA11yViolations(results: AxeResultsLike) {
  if (results.violations.length > 0) {
    const violationMessages = results.violations
      .map((violation) => {
        const nodes = violation.nodes
          .map((node) => {
            const target = node.target.join(', ');
            const html = node.html;
            return `  Target: ${target}\n  HTML: ${html}`;
          })
          .join('\n\n');

        return `[${violation.id}] ${violation.help}
  Description: ${violation.description}
  Impact: ${violation.impact}
  Help URL: ${violation.helpUrl}

  Affected nodes:
${nodes}`;
      })
      .join('\n\n---\n\n');

    throw new Error(
      `Expected no accessibility violations but found ${results.violations.length}:\n\n${violationMessages}`
    );
  }
}
