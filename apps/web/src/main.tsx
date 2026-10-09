import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/public-sans/wght.css";
import { App } from "./App";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
