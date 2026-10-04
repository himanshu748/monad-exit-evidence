import { lazy, Suspense, useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import type { Api } from "./types";

const Workbench = lazy(() => import("./App"));
export function viewForHash(hash: string) {
  return ["#workbench", "#activity", "#evidence"].includes(hash)
    ? "workbench"
    : "overview";
}
function focusTarget(hash: string) {
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  target.setAttribute("tabindex", "-1");
  target.scrollIntoView?.({ block: "start", behavior: "auto" });
  target.focus({ preventScroll: true });
}
function WorkbenchRoute({ hash }: { hash: string }) {
  useEffect(() => focusTarget(hash), [hash]);
  return <Workbench />;
}
export default function Site({ api }: { api?: Pick<Api, "activity"> }) {
  const [hash, setHash] = useState(() => window.location.hash);
  const view = viewForHash(hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    document.title =
      view === "workbench"
        ? "Exit evidence · Monad workbench"
        : "Exit evidence · Follow the evidence on Monad";
    if (view === "overview" && hash) focusTarget(hash);
  }, [hash, view]);
  return view === "overview" ? (
    <LandingPage api={api} />
  ) : (
    <Suspense
      fallback={
        <main className="route-loading" role="status">
          <p>Opening the workbench…</p>
          <a href="#overview">Return to overview</a>
        </main>
      }
    >
      <WorkbenchRoute hash={hash} />
    </Suspense>
  );
}
