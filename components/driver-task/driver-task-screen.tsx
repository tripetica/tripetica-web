"use client";

import { useEffect, useState, useTransition } from "react";
import {
  advanceDriverTaskAction,
  inspectDriverTaskPublicAccessAction,
} from "@/lib/ops/driver-task-actions";
import {
  driverTaskActionLabel,
  googleMapsCoordUrl,
  yandexMapsCoordUrl,
  type DriverTaskPublicView,
} from "@/lib/ops/driver-task-fields";
import {
  nextDriverTaskStage,
  type DriverTaskProgressStage,
  type DriverTaskStage,
} from "@/lib/ops/driver-task-stages";

const PROGRESS: Array<{ stage: DriverTaskProgressStage; label: string }> = [
  { stage: "en_route", label: "Yoldayım" },
  { stage: "arrived", label: "Vardım" },
  { stage: "picked_up", label: "Aldım" },
  { stage: "completed", label: "Bıraktım" },
];

const DONE_ORDER: DriverTaskStage[] = ["en_route", "arrived", "picked_up", "completed"];

function stageReached(current: DriverTaskStage, target: DriverTaskProgressStage) {
  return DONE_ORDER.indexOf(current) >= DONE_ORDER.indexOf(target);
}

export function DriverTaskScreen({
  token,
  initial,
  embedded = false,
}: {
  token: string;
  initial: DriverTaskPublicView;
  embedded?: boolean;
}) {
  const [view, setView] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (embedded || !view.completed) {
      return;
    }
    let cancelled = false;
    async function checkAccess() {
      const result = await inspectDriverTaskPublicAccessAction(token);
      if (cancelled || result.valid) {
        return;
      }
      window.location.reload();
    }
    const intervalId = window.setInterval(() => {
      void checkAccess();
    }, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [embedded, token, view.completed]);

  function advance() {
    const requested = view.nextStage;
    if (!view.actionLabel || !requested || view.completed || pending) {
      return;
    }
    startTransition(async () => {
      const result = await advanceDriverTaskAction(token, requested);
      if (!result.ok) {
        if (result.reason === "revoked") {
          window.location.reload();
          return;
        }
        if (result.reason === "completed") {
          setView((current) => ({
            ...current,
            stage: "completed",
            nextStage: null,
            actionLabel: null,
            completed: true,
          }));
          return;
        }
        setError("Bu işlem şu anda yapılamıyor. Lütfen tekrar deneyin.");
        return;
      }
      setError(null);
      setView((current) => ({
        ...current,
        stage: result.stage,
        nextStage: nextDriverTaskStage(result.stage),
        actionLabel: driverTaskActionLabel(result.stage),
        completed: result.stage === "completed",
      }));
    });
  }

  const body = (
    <div className="driver-task-body">
      <section className="driver-task-progress" aria-label="Görev aşamaları">
        {PROGRESS.map((item, index) => {
          const done = stageReached(view.stage, item.stage);
          return (
            <span key={item.stage} className="driver-task-step">
              <span className={done ? "is-done" : ""}>{done ? "✓" : "○"} {item.label}</span>
              {index < PROGRESS.length - 1 ? <span className="driver-task-arrow">→</span> : null}
            </span>
          );
        })}
      </section>

      {view.completed ? (
        <p className="driver-task-done">GÖREV TAMAMLANDI</p>
      ) : view.actionLabel ? (
        <button
          type="button"
          className="driver-task-action"
          disabled={pending}
          onClick={advance}
        >
          {pending ? "Kaydediliyor…" : view.actionLabel}
        </button>
      ) : null}
      {error ? <p className="driver-task-error">{error}</p> : null}

      <section className="driver-task-card">
        <h2>Rezervasyon</h2>
        <dl>
          <div>
            <dt>Rezervasyon No</dt>
            <dd>{view.reservationCode}</dd>
          </div>
          {view.fields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
              {field.address ? (
                <p className="driver-task-location-address">{field.address}</p>
              ) : null}
              {field.latitude != null && field.longitude != null ? (
                <div className="driver-task-nav">
                  <a
                    href={googleMapsCoordUrl(field.latitude, field.longitude)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Navigasyon
                  </a>
                  <a
                    href={yandexMapsCoordUrl(field.latitude, field.longitude)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Yandex Navigasyon
                  </a>
                </div>
              ) : null}
            </div>
          ))}
        </dl>
        {view.note ? (
          <div className="driver-task-note">
            <h3>Not</h3>
            <p>{view.note}</p>
          </div>
        ) : null}
        {view.contact ? (
          <div className="driver-task-sensitive">
            <dl>
              {view.contact.phone ? (
                <div>
                  <dt>Telefon</dt>
                  <dd>
                    <a href={`tel:${view.contact.phone.replace(/[^\d+]/g, "")}`}>
                      {view.contact.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {view.contact.email ? (
                <div>
                  <dt>E-posta</dt>
                  <dd>{view.contact.email}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
        {view.price ? (
          <div className="driver-task-sensitive">
            <dl>
              <div>
                <dt>Nakit Tahsilat</dt>
                <dd>{view.price.selectedPrice}</dd>
              </div>
              {view.price.otherCurrencies.length > 0 ? (
                <div>
                  <dt>Yolcu farklı para birimiyle ödeme yapmak isterse</dt>
                  <dd className="driver-task-price-other">{view.price.otherCurrencies.join(" · ")}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </section>

      <section className="driver-task-card">
        <h2>Yolcular</h2>
        {view.passengers.length === 0 ? (
          <p>Yolcu bilgisi yok.</p>
        ) : (
          <ul className="driver-task-passengers">
            {view.passengers.map((passenger) => (
              <li key={passenger.sequenceNo}>
                <strong>
                  {[passenger.firstName, passenger.lastName].filter(Boolean).join(" ") || "—"}
                </strong>
                <span>
                  {[
                    passenger.nationality,
                    passenger.gender,
                    passenger.identityNumber,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <main className="driver-task-page">
      <header className="driver-task-brand">
        <p className="driver-task-logo">TRIPETICA</p>
        <h1>ŞOFÖR GÖREVİ</h1>
      </header>
      {body}
    </main>
  );
}
