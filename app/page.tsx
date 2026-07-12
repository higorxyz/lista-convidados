import GuestApp from "@/components/GuestApp";

export default function HomePage() {
  return (
    <>
      <div className="hero">
        <div className="save-date">Save The Date · 19.09.2026</div>
        <h1 className="names">
          Marcia <span className="amp">&amp;</span> Matheus
        </h1>
        <div className="eyebrow">Vão se casar</div>
        <p className="subtitle">Confirmação de presença</p>
        <div className="divider" />
        <p className="intro">
          Ficaremos muito felizes em ter vocês com a gente nesse dia. Para organizar tudo com carinho, pedimos que
          confirmem a presença de cada pessoa do convite até 28 de agosto.
        </p>
      </div>

      <GuestApp />

      <footer>
        <div>Feito com carinho para o grande dia de Marcia &amp; Matheus.</div>
        <div style={{ marginTop: 10 }}>
          <a className="admin-link" href="/admin">
            Área dos noivos
          </a>
        </div>
      </footer>
    </>
  );
}
