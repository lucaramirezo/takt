// Phase 0 placeholder. Proves the takt "Precision / Takt Grid" tokens render.
// Real admin (timesheet review, irregularity inbox, forms builder) is built via Archon.

const rows = [
  { name: 'Marisol Ortega', reg: '40.0', ot: '0.0', brk: '2.5', total: '40.0', flag: 'ok' },
  { name: 'Dwayne Carter', reg: '40.0', ot: '6.5', brk: '2.0', total: '46.5', flag: 'ot' },
  { name: 'Liang Wu', reg: '32.0', ot: '0.0', brk: '1.5', total: '32.0', flag: 'edited' },
] as const

function Pill({ flag }: { flag: 'ok' | 'ot' | 'edited' }) {
  const map = {
    ok: { label: 'On track', color: 'var(--success)', bg: 'rgba(47,125,84,0.10)' },
    ot: { label: 'Overtime', color: 'var(--warning)', bg: 'rgba(232,89,12,0.10)' },
    edited: { label: 'Edited', color: 'var(--danger)', bg: 'rgba(192,57,43,0.10)' },
  }[flag]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: map.color, background: map.bg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: map.color }} />
      {map.label}
    </span>
  )
}

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          takt<span style={{ color: 'var(--accent)' }}>.</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Deskless Operations OS. Phase 0 scaffold. Keep the beat of work.
        </p>
      </header>

      <section
        className="rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <h2
          className="mb-4 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-heading)' }}
        >
          Manager timesheet · week 23
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--muted-foreground)' }}>
              <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                Employee
              </th>
              {['Reg', 'OT', 'Brk', 'Total', 'Status'].map((h) => (
                <th
                  key={h}
                  className="pb-2 text-right text-[10px] font-semibold uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ fontFamily: 'var(--font-mono)' }}>
            {rows.map((r) => (
              <tr key={r.name} style={{ borderTop: '1px solid var(--border)' }}>
                <td
                  className="py-2.5 text-left"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {r.name}
                </td>
                <td className="py-2.5 text-right tabular-nums">{r.reg}</td>
                <td
                  className="py-2.5 text-right tabular-nums"
                  style={{ color: r.ot !== '0.0' ? 'var(--accent)' : undefined }}
                >
                  {r.ot}
                </td>
                <td className="py-2.5 text-right tabular-nums">{r.brk}</td>
                <td className="py-2.5 text-right tabular-nums">{r.total}</td>
                <td className="py-2.5 text-right">
                  <Pill flag={r.flag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-8 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Run <code style={{ fontFamily: 'var(--font-mono)' }}>npx shadcn@latest init --preset luma</code>{' '}
        to layer the luma component foundation on these tokens.
      </p>
    </main>
  )
}
