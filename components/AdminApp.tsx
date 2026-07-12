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

function formatWhatsappLink(digits: string): string {
  const cleanDigits = digits.replace(/\D/g, "");
  const normalized = cleanDigits.startsWith("55") ? cleanDigits : `55${cleanDigits}`;
  return `https://wa.me/${normalized}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const STATUS_TEXT: Record<AttendanceStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Não vai"
};

type NewPersonRow = { id: string; name: string; isChild: boolean };

type NewPeopleSummary = {
  total: number;
  adults: number;
  children: number;
};

function makeRowId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeNewPeople(people: NewPersonRow[]): NewPeopleSummary {
  const summary: NewPeopleSummary = { total: 0, adults: 0, children: 0 };

  for (const person of people) {
    if (!person.name.trim()) continue;
    summary.total += 1;
    if (person.isChild) summary.children += 1;
    else summary.adults += 1;
  }

  return summary;
}

function buildStatsFromInvites(invites: Invite[]): DashboardStats {
  const stats: DashboardStats = {
    totalPeople: 0,
    totalInvites: invites.length,
    confirmed: 0,
    pending: 0,
    declined: 0,
    totalChildren: 0,
    childConfirmed: 0,
    childPending: 0,
    childDeclined: 0,
    invitesWithChildren: 0,
    averagePeoplePerInvite: 0
  };

  for (const invite of invites) {
    const hasChildren = invite.people.some((person) => person.isChild);
    if (hasChildren) stats.invitesWithChildren += 1;

    for (const person of invite.people) {
      stats.totalPeople += 1;
      if (person.isChild) {
        stats.totalChildren += 1;
        if (person.status === "confirmed") stats.childConfirmed += 1;
        else if (person.status === "declined") stats.childDeclined += 1;
        else stats.childPending += 1;
      }
      if (person.status === "confirmed") stats.confirmed += 1;
      else if (person.status === "declined") stats.declined += 1;
      else stats.pending += 1;
    }
  }

  stats.averagePeoplePerInvite = stats.totalInvites > 0 ? Number((stats.totalPeople / stats.totalInvites).toFixed(1)) : 0;

  return stats;
}

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
  const [newPeople, setNewPeople] = useState<NewPersonRow[]>([{ id: makeRowId(), name: "", isChild: false }]);
  const [draggingNewPersonId, setDraggingNewPersonId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [collapsedInvites, setCollapsedInvites] = useState<Record<string, boolean>>({});

  const [editTarget, setEditTarget] = useState<Invite | null>(null);
  const [editResponsible, setEditResponsible] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Invite | null>(null);
  const [addPersonTarget, setAddPersonTarget] = useState<Invite | null>(null);
  const [addPersonName, setAddPersonName] = useState("");
  const [addPersonIsChild, setAddPersonIsChild] = useState(false);
  const [editPersonTarget, setEditPersonTarget] = useState<{ invite: Invite; person: Person } | null>(null);
  const [editPersonName, setEditPersonName] = useState("");
  const [editPersonIsChild, setEditPersonIsChild] = useState(false);
  const [editPersonError, setEditPersonError] = useState("");
  const [savingPersonEdit, setSavingPersonEdit] = useState(false);
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

  function setInvitesAndStats(nextInvites: Invite[]) {
    setInvites(nextInvites);
    setStats(buildStatsFromInvites(nextInvites));
  }

  function mergeInvite(updatedInvite: Invite) {
    setInvites((current) => {
      const exists = current.some((invite) => invite.id === updatedInvite.id);
      const nextInvites = exists
        ? current.map((invite) => (invite.id === updatedInvite.id ? updatedInvite : invite))
        : [updatedInvite, ...current];

      setStats(buildStatsFromInvites(nextInvites));
      return nextInvites;
    });
  }

  function removeInvite(inviteId: string) {
    setInvites((current) => {
      const nextInvites = current.filter((invite) => invite.id !== inviteId);
      setStats(buildStatsFromInvites(nextInvites));
      return nextInvites;
    });
    setCollapsedInvites((current) => {
      if (!current[inviteId]) return current;
      const next = { ...current };
      delete next[inviteId];
      return next;
    });
  }

  function toggleInviteCollapse(inviteId: string) {
    setCollapsedInvites((current) => ({
      ...current,
      [inviteId]: !current[inviteId]
    }));
  }

  async function loadAll(options?: { withLoader?: boolean }) {
    const withLoader = options?.withLoader ?? true;
    if (withLoader) setLoadingData(true);
    try {
      const invitesRes = await fetch("/api/admin/invites", { cache: "no-store" });
      const invitesData = await invitesRes.json();
      setInvitesAndStats(invitesData.invites || []);
    } finally {
      if (withLoader) setLoadingData(false);
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
    if (!newResponsible.trim()) {
      setFormError("Informe o nome do responsável.");
      return;
    }
    if (newWhatsapp.replace(/\D/g, "").length < 10) {
      setFormError("Informe um WhatsApp válido, com DDD.");
      return;
    }
    const people = newPeople
      .map((person) => ({ name: person.name.trim(), isChild: person.isChild }))
      .filter((person) => person.name);

    if (people.length === 0) {
      setFormError("Adicione ao menos uma pessoa (um nome por linha).");
      return;
    }
    setFormError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibleName: newResponsible, whatsapp: newWhatsapp, people })
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Não foi possível criar o convite.");
        return;
      }
      setNewResponsible("");
      setNewWhatsapp("");
      setNewPeople([{ id: makeRowId(), name: "", isChild: false }]);
      if (data.invite) mergeInvite(data.invite);
      else await loadAll({ withLoader: false });
    } finally {
      setCreating(false);
    }
  }

  function updateNewPersonRow(id: string, patch: Partial<NewPersonRow>) {
    setNewPeople((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addNewPersonRow() {
    setNewPeople((current) => [...current, { id: makeRowId(), name: "", isChild: false }]);
  }

  function removeNewPersonRow(id: string) {
    setNewPeople((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  function moveNewPersonRow(activeId: string, overId: string) {
    setNewPeople((current) => {
      const fromIndex = current.findIndex((row) => row.id === activeId);
      const toIndex = current.findIndex((row) => row.id === overId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function shiftNewPersonRow(id: string, direction: -1 | 1) {
    setNewPeople((current) => {
      const index = current.findIndex((row) => row.id === id);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  const newPeopleSummary = summarizeNewPeople(newPeople);

  function openEditModal(invite: Invite) {
    setEditTarget(invite);
    setEditResponsible(invite.responsibleName);
    setEditWhatsapp(formatWhatsapp(invite.whatsapp));
    setEditError("");
  }

  function openPersonEditModal(invite: Invite, person: Person) {
    setEditPersonTarget({ invite, person });
    setEditPersonName(person.name);
    setEditPersonIsChild(!!person.isChild);
    setEditPersonError("");
  }

  async function savePersonEdit() {
    if (!editPersonTarget) return;
    if (!editPersonName.trim()) {
      setEditPersonError("Informe o nome da pessoa.");
      return;
    }

    setSavingPersonEdit(true);
    setEditPersonError("");
    try {
      const res = await fetch(`/api/admin/invites/${editPersonTarget.invite.id}/people/${editPersonTarget.person.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editPersonName, isChild: editPersonIsChild })
      });
      const data = await res.json();
      if (!res.ok) {
        setEditPersonError(data.error || "Não foi possível salvar a pessoa.");
        return;
      }

      setEditPersonTarget(null);
      if (data.invite) mergeInvite(data.invite);
      else await loadAll({ withLoader: false });
    } finally {
      setSavingPersonEdit(false);
    }
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
      if (data.invite) mergeInvite(data.invite);
      else await loadAll({ withLoader: false });
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    await fetch(`/api/admin/invites/${deletedId}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (historyTarget?.id === deletedId) {
      setHistoryTarget(null);
      setHistory([]);
    }
    removeInvite(deletedId);
  }

  async function confirmAddPerson() {
    if (!addPersonTarget || !addPersonName.trim()) return;
    const res = await fetch(`/api/admin/invites/${addPersonTarget.id}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addPersonName, isChild: addPersonIsChild })
    });
    const data = await res.json().catch(() => ({}));
    setAddPersonTarget(null);
    setAddPersonName("");
    setAddPersonIsChild(false);
    if (res.ok && data.invite) mergeInvite(data.invite);
    else await loadAll({ withLoader: false });
  }

  async function confirmRemovePerson() {
    if (!removePersonTarget) return;
    const res = await fetch(`/api/admin/invites/${removePersonTarget.invite.id}/people/${removePersonTarget.person.id}`, {
      method: "DELETE"
    });
    const data = await res.json().catch(() => ({}));
    setRemovePersonTarget(null);
    if (res.ok && data.invite) mergeInvite(data.invite);
    else await loadAll({ withLoader: false });
  }

  async function overridePersonStatus(invite: Invite, person: Person, status: AttendanceStatus) {
    if (person.status === status) return;
    const res = await fetch(`/api/admin/invites/${invite.id}/people/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.invite) mergeInvite(data.invite);
    else await loadAll({ withLoader: false });
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
          <a className="btn btn-ghost" href="/" style={{ display: "block", marginTop: 10, textAlign: "center", textDecoration: "none" }}>
            Voltar para a tela inicial
          </a>
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
              <div className="stat-card child">
                <div className="stat-label">Crianças</div>
                <div className="stat-value">{stats.totalChildren}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Convites com crianças</div>
                <div className="stat-value">{stats.invitesWithChildren}</div>
              </div>
            </div>
            <div className="dashboard-secondary-grid">
              <div className="card">
                <div className="section-note" style={{ marginBottom: 4 }}>
                  {stats.totalInvites} convite{stats.totalInvites !== 1 ? "s" : ""} cadastrado
                  {stats.totalInvites !== 1 ? "s" : ""} · {confirmedPct}% confirmado
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${confirmedPct}%` }} />
                </div>
              </div>
              <div className="card">
                <div className="section-note" style={{ marginBottom: 4 }}>Média de pessoas por convite</div>
                <div className="stat-value" style={{ fontSize: 36, lineHeight: 1 }}>
                  {stats.averagePeoplePerInvite.toFixed(1)}
                </div>
                <div className="section-note" style={{ marginTop: 8 }}>
                  
                </div>
              </div>
              <div className="card">
                <div className="section-note" style={{ marginBottom: 4 }}>Crianças por status</div>
                <div className="timeline" style={{ gap: 8 }}>
                  <div className="timeline-entry" style={{ padding: "6px 0" }}>
                    <div className="timeline-text">Confirmadas</div>
                    <div className="timeline-date">{stats.childConfirmed}</div>
                  </div>
                  <div className="timeline-entry" style={{ padding: "6px 0" }}>
                    <div className="timeline-text">Pendentes</div>
                    <div className="timeline-date">{stats.childPending}</div>
                  </div>
                  <div className="timeline-entry" style={{ padding: "6px 0" }}>
                    <div className="timeline-text">Não irão</div>
                    <div className="timeline-date">{stats.childDeclined}</div>
                  </div>
                </div>
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
                <label>Pessoas vinculadas</label>
                <div className="people-summary">
                  <div className="people-summary-item">
                    <span>Total</span>
                    <strong>{newPeopleSummary.total}</strong>
                  </div>
                  <div className="people-summary-item">
                    <span>Adultos</span>
                    <strong>{newPeopleSummary.adults}</strong>
                  </div>
                  <div className="people-summary-item">
                    <span>Crianças</span>
                    <strong>{newPeopleSummary.children}</strong>
                  </div>
                </div>
                <div className="people-builder">
                  {newPeople.map((person, index) => (
                      <div
                        className={`people-builder-row ${draggingNewPersonId === person.id ? "dragging" : ""}`}
                        key={person.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggingNewPersonId(person.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", person.id);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const activeId = e.dataTransfer.getData("text/plain") || draggingNewPersonId;
                          if (activeId) moveNewPersonRow(activeId, person.id);
                          setDraggingNewPersonId(null);
                        }}
                        onDragEnd={() => setDraggingNewPersonId(null)}
                      >
                        <button
                          type="button"
                          className="drag-handle"
                          aria-label="Reordenar pessoa"
                          title="Arraste para reordenar"
                          draggable
                          onDragStart={(e) => {
                            setDraggingNewPersonId(person.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", person.id);
                          }}
                          onDragEnd={() => setDraggingNewPersonId(null)}
                        >
                          ⋮⋮
                        </button>
                      <input
                        type="text"
                        placeholder={`Pessoa ${index + 1}`}
                        value={person.name}
                        onChange={(e) => updateNewPersonRow(person.id, { name: e.target.value })}
                      />
                      <label className="checkbox-row checkbox-inline">
                        <input
                          type="checkbox"
                          checked={person.isChild}
                          onChange={(e) => updateNewPersonRow(person.id, { isChild: e.target.checked })}
                        />
                        <span>Criança</span>
                      </label>
                      <div className="row-reorder-actions">
                        <button type="button" className="mini-btn" onClick={() => shiftNewPersonRow(person.id, -1)}>
                          ↑
                        </button>
                        <button type="button" className="mini-btn" onClick={() => shiftNewPersonRow(person.id, 1)}>
                          ↓
                        </button>
                      </div>
                      <button className="mini-btn danger" type="button" onClick={() => removeNewPersonRow(person.id)}>
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost" type="button" onClick={addNewPersonRow} style={{ marginTop: 10, width: "auto" }}>
                  + Adicionar pessoa
                </button>
                <div className="section-note" style={{ marginTop: 10, textTransform: "none", letterSpacing: 0, fontFamily: "var(--font-body)" }}>
                  Marque se a pessoa é criança já na criação do convite.
                </div>
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
                      <a className="desc whatsapp-link" href={formatWhatsappLink(invite.whatsapp)} target="_blank" rel="noreferrer">
                        {formatWhatsapp(invite.whatsapp)}
                      </a>
                    </div>
                    <button
                      className="invite-toggle"
                      type="button"
                      aria-label={collapsedInvites[invite.id] ? "Expandir convite" : "Recolher convite"}
                      aria-expanded={!collapsedInvites[invite.id]}
                      onClick={() => toggleInviteCollapse(invite.id)}
                    >
                      <svg
                        className={`invite-toggle-icon ${collapsedInvites[invite.id] ? "is-collapsed" : ""}`}
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                      >
                        <path d="M4 9l8 8 8-8" />
                      </svg>
                    </button>
                  </div>

                  <div className={`invite-body ${collapsedInvites[invite.id] ? "is-collapsed" : ""}`} aria-hidden={collapsedInvites[invite.id]}>
                    <div className="admin-item-actions">
                      <button className="btn btn-ghost" onClick={() => openEditModal(invite)}>
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setAddPersonTarget(invite);
                          setAddPersonName("");
                          setAddPersonIsChild(false);
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

                    <div className="admin-people-list">
                      {invite.people.map((person) => (
                        <div className="admin-person-row" key={person.id}>
                          <div className="admin-person-main">
                            <span className="p-name">{person.name}</span>
                            <div className="admin-person-badges">
                              <span className={`status-badge ${person.status}`}>{STATUS_TEXT[person.status]}</span>
                              {person.isChild && <span className="child-badge">Criança</span>}
                            </div>
                          </div>
                          <div className="p-actions">
                            <button className="mini-btn" onClick={() => openPersonEditModal(invite, person)}>
                              Editar
                            </button>
                            <button className="mini-btn" onClick={() => overridePersonStatus(invite, person, "confirmed") }>
                              Confirmar
                            </button>
                            <button className="mini-btn" onClick={() => overridePersonStatus(invite, person, "declined") }>
                              Não vai
                            </button>
                            <button className="mini-btn" onClick={() => overridePersonStatus(invite, person, "pending") }>
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
            <label className="checkbox-row">
              <input type="checkbox" checked={addPersonIsChild} onChange={(e) => setAddPersonIsChild(e.target.checked)} />
              <span>Essa pessoa é criança</span>
            </label>
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

      {editPersonTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEditPersonTarget(null)}>
          <div className="modal">
            <button className="close-x" onClick={() => setEditPersonTarget(null)}>
              &times;
            </button>
            <h3>Editar pessoa</h3>
            <p className="hint">Convite de {editPersonTarget.invite.responsibleName}</p>
            <div className="field">
              <label>Nome completo</label>
              <input type="text" value={editPersonName} onChange={(e) => setEditPersonName(e.target.value)} />
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={editPersonIsChild}
                onChange={(e) => setEditPersonIsChild(e.target.checked)}
              />
              <span>Essa pessoa é criança</span>
            </label>
            {editPersonError && <div className="error-msg">{editPersonError}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditPersonTarget(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={savePersonEdit} disabled={savingPersonEdit}>
                {savingPersonEdit ? "Salvando…" : "Salvar"}
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
