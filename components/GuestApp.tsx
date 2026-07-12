"use client";

import { useRef, useState } from "react";
import { AttendanceStatus, GuestInviteView } from "@/lib/types";

type Step = "search" | "confirm" | "checklist";

const STATUS_TEXT: Record<AttendanceStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Não vai"
};

export default function GuestApp() {
  const [step, setStep] = useState<Step>("search");
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [token, setToken] = useState<string | null>(null);
  const [responsibleName, setResponsibleName] = useState("");

  const [invite, setInvite] = useState<GuestInviteView | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [savingEdits, setSavingEdits] = useState(false);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [actionError, setActionError] = useState("");

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function handleDigitChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = clean;
      return next;
    });
    if (clean && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSearch() {
    const last4 = digits.join("");
    if (last4.length !== 4) {
      setSearchError("Digite os 4 últimos números do WhatsApp.");
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch("/api/rsvp/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last4 })
      });
      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || "Não foi possível buscar agora. Tente novamente.");
        return;
      }

      if (!data.found) {
        setSearchError(
          data.ambiguous
            ? "Não conseguimos identificar seu convite com certeza. Entre em contato com os noivos."
            : "Não encontramos nenhum convite com esse número. Verifique os dígitos e tente novamente."
        );
        return;
      }

      setToken(data.token);
      setResponsibleName(data.responsibleName);
      setStep("confirm");
    } catch (e) {
      console.error(e);
      setSearchError("Não foi possível buscar agora. Tente novamente em instantes.");
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirmIdentity(isMe: boolean) {
    if (!isMe) {
      setToken(null);
      setResponsibleName("");
      setDigits(["", "", "", ""]);
      setStep("search");
      inputRefs.current[0]?.focus();
      return;
    }

    setLoadingInvite(true);
    setActionError("");
    try {
      const res = await fetch("/api/rsvp/invite", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Não foi possível carregar seu convite. Tente novamente.");
        return;
      }
      setInvite(data.invite);
      const initialDraft: Record<string, AttendanceStatus> = {};
      for (const person of data.invite.people || []) {
        initialDraft[person.id] = person.status;
      }
      setDraftStatuses(initialDraft);
      setStep("checklist");
    } catch (e) {
      console.error(e);
      setActionError("Não foi possível carregar seu convite. Tente novamente.");
    } finally {
      setLoadingInvite(false);
    }
  }

  function selectStatus(personId: string, status: AttendanceStatus) {
    setDraftStatuses((current) => ({
      ...current,
      [personId]: status
    }));
  }

  function goBackFromChecklist() {
    setActionError("");
    setStep("confirm");
  }

  async function saveEdits() {
    if (!token || !invite || invite.deadlinePassed) return;

    const updates = invite.people
      .map((person) => ({
        personId: person.id,
        status: draftStatuses[person.id] ?? person.status,
        previousStatus: person.status
      }))
      .filter((item) => item.status !== item.previousStatus)
      .map((item) => ({ personId: item.personId, status: item.status }));

    if (updates.length === 0) {
      setActionError("");
      setShowThanksModal(true);
      return;
    }

    setSavingEdits(true);
    setActionError("");
    try {
      const res = await fetch("/api/rsvp/invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Não foi possível salvar agora. Tente novamente.");
        return;
      }

      setInvite(data.invite);
      const syncedDraft: Record<string, AttendanceStatus> = {};
      for (const person of data.invite.people || []) {
        syncedDraft[person.id] = person.status;
      }
      setDraftStatuses(syncedDraft);
      setShowThanksModal(true);
    } catch (e) {
      console.error(e);
      setActionError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSavingEdits(false);
    }
  }

  return (
    <div className="wrap" id="rsvpFlow">
      {step === "search" && (
        <div className="step-card">
          <div className="step-title">Confirmação de presença</div>
          <p className="step-text">Digite os 4 últimos números do WhatsApp cadastrado no convite.</p>
          <div className="digit-input">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
              />
            ))}
          </div>
          {searchError && <div className="error-msg" style={{ marginBottom: 16 }}>{searchError}</div>}
          <button className="btn btn-primary" onClick={handleSearch} disabled={searching} style={{ maxWidth: 260, margin: "0 auto" }}>
            {searching ? "Buscando…" : "Continuar"}
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="step-card">
          <div className="step-title">Encontramos um convite associado a este número.</div>
          <p className="step-text">O convite está cadastrado para:</p>
          <div className="identity-name">{responsibleName}</div>
          <p className="step-text" style={{ marginBottom: 22 }}>Este é você?</p>
          {actionError && <div className="error-msg" style={{ marginBottom: 16 }}>{actionError}</div>}
          <div className="identity-actions">
            <button className="btn btn-primary" onClick={() => handleConfirmIdentity(true)} disabled={loadingInvite}>
              {loadingInvite ? "Carregando…" : "Sim, sou eu"}
            </button>
            <button className="btn btn-ghost" onClick={() => handleConfirmIdentity(false)} disabled={loadingInvite}>
              Não sou eu
            </button>
          </div>
        </div>
      )}

      {step === "checklist" && invite && (
        <div>
          <div className="step-card" style={{ textAlign: "left" }}>
            <div style={{ textAlign: "center" }}>
              <div className="greeting">Olá, {invite.responsibleName} ❤️</div>
              <p className="greeting-sub">Estas são as pessoas vinculadas ao seu convite.</p>
            </div>

            {actionError && <div className="error-msg" style={{ marginBottom: 16 }}>{actionError}</div>}

            {invite.deadlinePassed ? (
              <div className="deadline-closed">
                O prazo para confirmação de presença foi encerrado.
                <br />
                Caso precise realizar alguma alteração, entre em contato com os noivos.
              </div>
            ) : null}

            <div className="checklist" style={{ marginTop: 8 }}>
              {invite.people.map((person) => (
                <div className="person-row" key={person.id}>
                  <div>
                    <div className="person-name">{person.name}</div>
                    <span className={`status-badge ${draftStatuses[person.id] ?? person.status}`}>
                      {STATUS_TEXT[draftStatuses[person.id] ?? person.status]}
                    </span>
                  </div>
                  {!invite.deadlinePassed && (
                    <div className="person-actions">
                      <button
                        className={`pill ${(draftStatuses[person.id] ?? person.status) === "confirmed" ? "active-confirmed" : ""}`}
                        onClick={() => selectStatus(person.id, "confirmed")}
                      >
                        Confirmar
                      </button>
                      <button
                        className={`pill ${(draftStatuses[person.id] ?? person.status) === "declined" ? "active-declined" : ""}`}
                        onClick={() => selectStatus(person.id, "declined")}
                      >
                        Não vai
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!invite.deadlinePassed && (
              <>
                <div className="deadline-note">Alterações permitidas até {invite.deadline}</div>
                <div className="checklist-actions">
                  <button className="btn btn-ghost" onClick={goBackFromChecklist} disabled={savingEdits}>
                    Voltar
                  </button>
                  <button className="btn btn-primary" onClick={saveEdits} disabled={savingEdits}>
                    {savingEdits ? "Salvando…" : "Confirmar edições"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showThanksModal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowThanksModal(false)}>
          <div className="modal">
            <button className="close-x" onClick={() => setShowThanksModal(false)}>
              &times;
            </button>
            <h3>Obrigado por confirmar!</h3>
            <p className="hint" style={{ marginBottom: 18 }}>
              Te esperamos no dia 19 de Setembro. Se precisar, as alterações ainda podem ser feitas até o dia 28 de agosto.
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowThanksModal(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
