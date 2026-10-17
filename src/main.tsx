import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import "./workbench.css";
import "./lighting-ui.css";
import "./polish.css";
import "./presence.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
