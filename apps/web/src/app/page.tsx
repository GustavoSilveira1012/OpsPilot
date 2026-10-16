import { ApiStatus } from '@/components/api-status';
import Link from 'next/link';

const capabilities = [
  {
    number: '01',
    title: 'Know what needs attention',
    description: 'Bring active incidents, impact, and ownership into one clear view.',
  },
  {
    number: '02',
    title: 'Keep response coordinated',
    description: 'Give responders a shared timeline for updates, decisions, and next steps.',
  },
  {
    number: '03',
    title: 'Learn after recovery',
    description: 'Turn incident follow-up into trackable engineering work.',
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <Link aria-label="OpsPilot home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            O
          </span>
          <span>OpsPilot</span>
        </Link>
        <span className="topbar-label">ENGINEERING OPERATIONS</span>
      </header>

      <section aria-labelledby="hero-title" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A clearer path through the unexpected</p>
          <h1 id="hero-title">Keep engineering incidents moving.</h1>
          <p className="hero-description">
            OpsPilot gives response teams one place to understand impact, coordinate action, and
            carry what they learn into the work ahead.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#capabilities">
              Explore the platform <span aria-hidden="true">→</span>
            </a>
            <span className="release-label">SPRINT 1 FOUNDATION</span>
          </div>
        </div>

        <div aria-label="API connection status" className="status-card">
          <div className="status-card-heading">
            <div>
              <p className="card-overline">SYSTEM STATUS</p>
              <h2>Platform connection</h2>
            </div>
            <span aria-hidden="true" className="pulse-dot" />
          </div>
          <ApiStatus />
          <div className="status-card-footer">
            <span>OpsPilot API</span>
            <span>v1</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="capabilities-title" className="capabilities" id="capabilities">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Built for the full response cycle</p>
            <h2 id="capabilities-title">Clarity for every handoff.</h2>
          </div>
          <p>From first signal to follow-through, the response stays connected.</p>
        </div>

        <div className="capability-grid">
          {capabilities.map((capability) => (
            <article className="capability-card" key={capability.number}>
              <span className="capability-number">{capability.number}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="page-footer">
        <span>OpsPilot</span>
        <span>Designed for resilient engineering teams.</span>
      </footer>
    </main>
  );
}
