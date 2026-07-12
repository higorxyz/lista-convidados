"use client";

import { useRef, useState } from "react";
import { AttendanceStatus, GuestInviteView, Person } from "@/lib/types";

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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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
      setStep("checklist");
    } catch (e) {
      console.error(e);
      setActionError("Não foi possível carregar seu convite. Tente novamente.");
    } finally {
      setLoadingInvite(false);
    }
  }

  async function updateStatus(person: Person, status: AttendanceStatus) {
    if (!token || !invite) return;
    if (person.status === status) return;
    setUpdatingId(person.id);
    setActionError("");
    try {
      const res = await fetch("/api/rsvp/invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ personId: person.id, status })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Não foi possível salvar agora. Tente novamente.");
        return;
      }
      setInvite(data.invite);
    } catch (e) {
      console.error(e);
      setActionError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setUpdatingId(null);
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
                    <span className={`status-badge ${person.status}`}>{STATUS_TEXT[person.status]}</span>
                  </div>
                  {!invite.deadlinePassed && (
                    <div className="person-actions">
                      <button
                        className={`pill ${person.status === "confirmed" ? "active-confirmed" : ""}`}
                        onClick={() => updateStatus(person, "confirmed")}
                        disabled={updatingId === person.id}
                      >
                        Confirmar
                      </button>
                      <button
                        className={`pill ${person.status === "declined" ? "active-declined" : ""}`}
                        onClick={() => updateStatus(person, "declined")}
                        disabled={updatingId === person.id}
                      >
                        Não vai
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!invite.deadlinePassed && (
              <div className="deadline-note">Alterações permitidas até {invite.deadline}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
