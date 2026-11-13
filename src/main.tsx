import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { GameAudioProvider } from "./GameAudio";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GameAudioProvider><App /></GameAudioProvider>
  </React.StrictMode>,
);
