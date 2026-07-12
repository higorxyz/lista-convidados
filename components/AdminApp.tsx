"use client";

import { useEffect, useState } from "react";
import { AttendanceStatus, DashboardStats, HistoryEntry, Invite, Person } from "@/lib/types";

type Tab = "dashboard" | "invites";

function formatWhatsapp(digits: string): string {
  if (!digits) return "";
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return digits;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function parsePeopleTextarea(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

const STATUS_TEXT: Record<AttendanceStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Não vai"
};

export default function AdminApp() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>("dashboard");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [newResponsible, setNewResponsible] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newPeople, setNewPeople] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<Invite | null>(null);
  const [editResponsible, setEditResponsible] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Invite | null>(null);
  const [addPersonTarget, setAddPersonTarget] = useState<Invite | null>(null);
  const [addPersonName, setAddPersonName] = useState("");
  const [removePersonTarget, setRemovePersonTarget] = useState<{ invite: Invite; person: Person } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Invite | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function checkSession() {
    setCheckingSession(true);
    try {
      const res = await fetch("/api/admin/session", { cache: "no-store" });
      const data = await res.json();
      setIsAdmin(!!data.isAdmin);
      if (data.isAdmin) await loadAll();
    } finally {
      setCheckingSession(false);
    }
  }

  async function loadAll() {
    setLoadingData(true);
    try {
      const [statsRes, invitesRes] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/invites", { cache: "no-store" })
      ]);
      const statsData = await statsRes.json();
      const invitesData = await invitesRes.json();
      setStats(statsData.stats || null);
      setInvites(invitesData.invites || []);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin() {
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        setLoginError("Senha incorreta. Tente novamente.");
        return;
      }
      setIsAdmin(true);
      await loadAll();
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAdmin(false);
    setPassword("");
  }

  async function handleCreateInvite() {
    const peopleNames = parsePeopleTextarea(newPeople);
    if (!newResponsible.trim()) {
      setFormError("Informe o nome do responsável.");
      return;
    }
    if (newWhatsapp.replace(/\D/g, "").length < 10) {
      setFormError("Informe um WhatsApp válido, com DDD.");
      return;
    }
    if (peopleNames.length === 0) {
      setFormError("Adicione ao menos uma pessoa (um nome por linha).");
      return;
    }
    setFormError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibleName: newResponsible, whatsapp: newWhatsapp, peopleNames })
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Não foi possível criar o convite.");
        return;
      }
      setNewResponsible("");
      setNewWhatsapp("");
      setNewPeople("");
      await loadAll();
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(invite: Invite) {
    setEditTarget(invite);
    setEditResponsible(invite.responsibleName);
    setEditWhatsapp(formatWhatsapp(invite.whatsapp));
    setEditError("");
  }

  async function saveEdit() {
    if (!editTarget) return;
    if (!editResponsible.trim()) {
      setEditError("Informe o nome do responsável.");
      return;
    }
    if (editWhatsapp.replace(/\D/g, "").length < 10) {
      setEditError("Informe um WhatsApp válido, com DDD.");
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/invites/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibleName: editResponsible, whatsapp: editWhatsapp })
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Não foi possível salvar.");
        return;
      }
      setEditTarget(null);
      await loadAll();
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/invites/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    await loadAll();
  }

  async function confirmAddPerson() {
    if (!addPersonTarget || !addPersonName.trim()) return;
    await fetch(`/api/admin/invites/${addPersonTarget.id}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addPersonName })
    });
    setAddPersonTarget(null);
    setAddPersonName("");
    await loadAll();
  }

  async function confirmRemovePerson() {
    if (!removePersonTarget) return;
    await fetch(`/api/admin/invites/${removePersonTarget.invite.id}/people/${removePersonTarget.person.id}`, {
      method: "DELETE"
    });
    setRemovePersonTarget(null);
    await loadAll();
  }

  async function overridePersonStatus(invite: Invite, person: Person, status: AttendanceStatus) {
    if (person.status === status) return;
    await fetch(`/api/admin/invites/${invite.id}/people/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await loadAll();
  }

  async function openHistory(invite: Invite) {
    setHistoryTarget(invite);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/invites/${invite.id}/history`, { cache: "no-store" });
      const data = await res.json();
      setHistory(data.history || []);
    } finally {
      setLoadingHistory(false);
    }
  }

  if (checkingSession) {
    return <div className="loading">Carregando…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 6px", color: "var(--wine-deep)" }}>
            Área dos noivos
          </h3>
          <p className="hint" style={{ marginBottom: 18 }}>
            Entre com a senha para gerenciar os convites e acompanhar as confirmações.
          </p>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          {loginError && <div className="error-msg">{loginError}</div>}
          <button className="btn btn-primary" onClick={handleLogin} disabled={loggingIn}>
            {loggingIn ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    );
  }

  const confirmedPct = stats && stats.totalPeople > 0 ? Math.round((stats.confirmed / stats.totalPeople) * 100) : 0;

  return (
    <>
      <div className="admin-bar">
        <div>Área dos noivos · Marcia &amp; Matheus</div>
        <button onClick={handleLogout}>Sair</button>
      </div>

      <div className="wrap-wide admin-panel" style={{ paddingTop: 30 }}>
        <div className="tabs">
          <button className={`tab-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
            Dashboard
          </button>
          <button className={`tab-btn ${tab === "invites" ? "active" : ""}`} onClick={() => setTab("invites")}>
            Convites
          </button>
        </div>

        {loadingData && <div className="loading">Carregando…</div>}

        {!loadingData && tab === "dashboard" && stats && (
          <div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Total de pessoas</div>
                <div className="stat-value">{stats.totalPeople}</div>
              </div>
              <div className="stat-card confirmed">
                <div className="stat-label">Confirmados</div>
                <div className="stat-value">{stats.confirmed}</div>
              </div>
              <div className="stat-card pending">
                <div className="stat-label">Pendentes</div>
                <div className="stat-value">{stats.pending}</div>
              </div>
              <div className="stat-card declined">
                <div className="stat-label">Não irão</div>
                <div className="stat-value">{stats.declined}</div>
              </div>
            </div>
            <div className="card">
              <div className="section-note" style={{ marginBottom: 4 }}>
                {stats.totalInvites} convite{stats.totalInvites !== 1 ? "s" : ""} cadastrado
                {stats.totalInvites !== 1 ? "s" : ""} · {confirmedPct}% confirmado
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${confirmedPct}%` }} />
              </div>
            </div>
          </div>
        )}

        {!loadingData && tab === "invites" && (
          <div>
            <div className="admin-form">
              <h3>Novo convite</h3>
              <div className="form-row">
                <div className="field">
                  <label>Responsável pela confirmação</label>
                  <input type="text" placeholder="Nome completo" value={newResponsible} onChange={(e) => setNewResponsible(e.target.value)} />
                </div>
                <div className="field">
                  <label>WhatsApp cadastrado</label>
                  <input type="text" placeholder="(11) 99999-9876" value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Pessoas vinculadas (uma por linha)</label>
                <textarea
                  placeholder={"Maria Souza\nJoão Silva\nAna Silva"}
                  value={newPeople}
                  onChange={(e) => setNewPeople(e.target.value)}
                  style={{ minHeight: 90 }}
                />
              </div>
              {formError && <div className="error-msg">{formError}</div>}
              <button className="btn btn-primary" onClick={handleCreateInvite} disabled={creating} style={{ width: "auto" }}>
                {creating ? "Criando…" : "Criar convite"}
              </button>
            </div>

            {invites.length === 0 && <div className="empty">Nenhum convite cadastrado ainda.</div>}

            <div className="admin-list">
              {invites.map((invite) => (
                <div className="admin-item" key={invite.id}>
                  <div className="admin-item-top">
                    <div className="admin-item-main">
                      <div className="name">{invite.responsibleName}</div>
                      <div className="desc">{formatWhatsapp(invite.whatsapp)}</div>
                    </div>
                    <div className="admin-item-actions">
                      <button className="btn btn-ghost" onClick={() => openEditModal(invite)}>
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setAddPersonTarget(invite);
                          setAddPersonName("");
                        }}
                      >
                        + Pessoa
                      </button>
                      <button className="btn btn-ghost" onClick={() => openHistory(invite)}>
                        Histórico
                      </button>
                      <button className="btn btn-danger" onClick={() => setDeleteTarget(invite)}>
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="admin-people-list">
                    {invite.people.map((person) => (
                      <div className="admin-person-row" key={person.id}>
                        <span className="p-name">{person.name}</span>
                        <div className="p-actions">
                          <span className={`status-badge ${person.status}`}>{STATUS_TEXT[person.status]}</span>
                          <button className="mini-btn" onClick={() => overridePersonStatus(invite, person, "confirmed")}>
                            Confirmar
                          </button>
                          <button className="mini-btn" onClick={() => overridePersonStatus(invite, person, "declined")}>
                            Não vai
                          </button>
                          <button className="mini-btn" onClick={() => overridePersonStatus(invite, person, "pending")}>
                            Pendente
                          </button>
                          <button className="mini-btn danger" onClick={() => setRemovePersonTarget({ invite, person })}>
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEditTarget(null)}>
          <div className="modal">
            <button className="close-x" onClick={() => setEditTarget(null)}>
              &times;
            </button>
            <h3>Editar convite</h3>
            <div className="field">
              <label>Responsável</label>
              <input type="text" value={editResponsible} onChange={(e) => setEditResponsible(e.target.value)} />
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <input type="text" value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} />
            </div>
            {editError && <div className="error-msg">{editError}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addPersonTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setAddPersonTarget(null)}>
          <div className="modal">
            <button className="close-x" onClick={() => setAddPersonTarget(null)}>
              &times;
            </button>
            <h3>Adicionar pessoa</h3>
            <p className="hint">Convite de {addPersonTarget.responsibleName}</p>
            <div className="field">
              <label>Nome completo</label>
              <input
                type="text"
                value={addPersonName}
                onChange={(e) => setAddPersonName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAddPerson()}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setAddPersonTarget(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={confirmAddPerson}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {removePersonTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setRemovePersonTarget(null)}>
          <div className="modal">
            <button className="close-x" onClick={() => setRemovePersonTarget(null)}>
              &times;
            </button>
            <h3>Remover pessoa</h3>
            <p className="hint">
              &ldquo;{removePersonTarget.person.name}&rdquo; será removida do convite de {removePersonTarget.invite.responsibleName}.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRemovePersonTarget(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmRemovePerson}>
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal">
            <button className="close-x" onClick={() => setDeleteTarget(null)}>
              &times;
            </button>
            <h3>Excluir convite</h3>
            <p className="hint">
              O convite de &ldquo;{deleteTarget.responsibleName}&rdquo; e todas as pessoas vinculadas serão removidos definitivamente.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {historyTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setHistoryTarget(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <button className="close-x" onClick={() => setHistoryTarget(null)}>
              &times;
            </button>
            <h3>Histórico</h3>
            <p className="hint">Convite de {historyTarget.responsibleName}</p>
            {loadingHistory && <div className="loading">Carregando…</div>}
            {!loadingHistory && history.length === 0 && <div className="empty">Nenhuma alteração registrada ainda.</div>}
            {!loadingHistory && history.length > 0 && (
              <div className="timeline">
                {history.map((entry) => (
                  <div className="timeline-entry" key={entry.id}>
                    <div className="timeline-date">{formatDate(entry.at)}</div>
                    <div className="timeline-text">{entry.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
