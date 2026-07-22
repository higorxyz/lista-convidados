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
          Será uma alegria ter vocês conosco nesse dia tão especial! Pedimos que
          confirmem a presença de cada pessoa do convite até <strong>28 de agosto</strong>,
          para que possamos finalizar todos os preparativos.
          <br />
          <br />
          Após essa data, iniciaremos a etapa final da organização e, por isso, não
          será mais possível aceitar novas confirmações.
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
