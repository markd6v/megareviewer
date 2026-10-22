import "../styles/tokens.css";
import "../styles/base.css";
import "./app.css";
import { type ComponentType, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import type { PlaygroundModules } from "./PlaygroundPage.tsx";
import { bootstrapSessionToken } from "./token.ts";

// A constant in production builds, so the glob and the playgrounds drop out of the bundle.
const playgrounds: PlaygroundModules | null = import.meta.env.DEV
  ? import.meta.glob<{ default: ComponentType }>("../**/playground.tsx")
  : null;

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App
        token={bootstrapSessionToken(window)}
        fetch={window.fetch.bind(window)}
        playgrounds={playgrounds}
      />
    </ErrorBoundary>
  </StrictMode>,
);
