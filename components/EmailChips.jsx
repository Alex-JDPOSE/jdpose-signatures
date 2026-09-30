"use client";

import React, { useRef } from "react";

// Champ email "façon Outlook" : chaque adresse devient une étiquette.
// On valide une adresse avec virgule, point-virgule, espace, Entrée, ou en quittant le champ.
// Retour arrière sur un champ vide = supprime la dernière étiquette.

export const EMAIL_REGEX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// Transforme "a@x.fr, b@y.fr; c@z.fr" en ["a@x.fr", "b@y.fr", "c@z.fr"]
export function splitEmails(str) {
  return (str || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export default function EmailChips({
  emails,
  setEmails,
  draft,
  setDraft,
  suggestions = [],
  autocompleteList = [],
  placeholder = "client@exemple.fr",
}) {
  const inputRef = useRef(null);

  // Ajoute les adresses valides en étiquettes, laisse les invalides dans le champ
  const commit = (text) => {
    const parts = splitEmails(text);
    if (parts.length === 0) {
      setDraft("");
      return;
    }
    const valid = parts.filter((p) => EMAIL_REGEX.test(p));
    const invalid = parts.filter((p) => !EMAIL_REGEX.test(p));
    if (valid.length) {
      setEmails((prev) => [...new Set([...prev, ...valid])]);
    }
    setDraft(invalid.join(", "));
  };

  const handleChange = (e) => {
    const value = e.target.value;
    // Dès qu'on tape un séparateur, on transforme ce qui précède en étiquette
    if (/[,;\s]$/.test(value)) {
      commit(value);
    } else {
      setDraft(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (/[,;\s]/.test(text.trim())) {
      e.preventDefault();
      commit(draft + " " + text);
    }
  };

  const removeEmail = (email) => setEmails((prev) => prev.filter((x) => x !== email));

  const visibleSuggestions = suggestions.filter((s) => !emails.includes(s));

  return (
    <div>
      <div style={styles.box} onClick={() => inputRef.current && inputRef.current.focus()}>
        {emails.map((email) => (
          <span key={email} style={styles.chip}>
            {email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(email);
              }}
              style={styles.chipRemove}
              aria-label={`Retirer ${email}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          list="email-chips-autocomplete"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => commit(draft)}
          placeholder={emails.length === 0 ? placeholder : "Ajouter une adresse…"}
          style={styles.input}
        />
        <datalist id="email-chips-autocomplete">
          {autocompleteList
            .filter((a) => !emails.includes(a))
            .map((a) => (
              <option key={a} value={a} />
            ))}
        </datalist>
      </div>

      <p style={styles.hint}>Sépare les adresses par une virgule pour en mettre plusieurs.</p>

      {visibleSuggestions.length > 0 && (
        <div style={styles.suggestRow}>
          <span style={styles.suggestLabel}>Déjà utilisées pour ce client :</span>
          {visibleSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setEmails((prev) => [...new Set([...prev, s])])}
              style={styles.suggestBtn}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  box: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    width: "100%",
    minHeight: 44,
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#fff",
    boxSizing: "border-box",
    cursor: "text",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 4px 4px 10px",
    borderRadius: 16,
    background: "#e6f1fb",
    border: "1px solid #b5d4f4",
    color: "#1a3f7a",
    fontSize: 14,
    maxWidth: "100%",
    wordBreak: "break-all",
  },
  chipRemove: {
    border: "none",
    background: "transparent",
    color: "#1a3f7a",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
    padding: "0 6px",
  },
  input: {
    flex: 1,
    minWidth: 160,
    border: "none",
    outline: "none",
    fontSize: 15,
    padding: "6px 4px",
    background: "transparent",
  },
  hint: { fontSize: 12, color: "#888", margin: "4px 0 0" },
  suggestRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  suggestLabel: { fontSize: 12, color: "#888" },
  suggestBtn: {
    padding: "4px 10px",
    borderRadius: 16,
    border: "1px dashed #b5d4f4",
    background: "#fff",
    color: "#2f6fed",
    fontSize: 13,
    cursor: "pointer",
  },
};
