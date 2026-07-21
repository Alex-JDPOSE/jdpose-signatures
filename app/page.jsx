"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import SignaturePad from "../components/SignaturePad";
import jsPDF from "jspdf";

export default function Home() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newClientNom, setNewClientNom] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [pastSignatures, setPastSignatures] = useState([]);

  const [bonIntervention, setBonIntervention] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [certified, setCertified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const signatureRef = useRef(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("signature_clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setClients(data || []);
    setLoading(false);
  };

  const loadPastSignatures = async (clientId) => {
    const { data, error } = await supabase
      .from("signatures")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (!error) setPastSignatures(data || []);
  };

  const handleCreateClient = async () => {
    if (!newClientNom.trim()) return;
    const { data, error } = await supabase
      .from("signature_clients")
      .insert({ nom: newClientNom.trim() })
      .select()
      .single();
    if (!error) {
      setNewClientNom("");
      setClients((prev) => [data, ...prev]);
    }
  };

  const openClient = async (client) => {
    setSelectedClient(client);
    setBonIntervention("");
    setClientEmail(client.email || "");
    setCertified(false);
    setMessage("");
    await loadPastSignatures(client.id);
  };

  const getLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  };

  const buildPdf = (dateStr, location, signatureDataUrl) => {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(47, 111, 237); // bleu JDPOSE
    doc.text("JDPOSE", 15, 20);

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`Bon d'intervention - ${dateStr}`, 15, 32);
    doc.text(`Client : ${selectedClient.nom}`, 15, 40);

    doc.setFontSize(10);
    const bonLines = doc.splitTextToSize(bonIntervention, 180);
    doc.text(bonLines, 15, 52);

    const afterTextY = 52 + bonLines.length * 5 + 10;

    doc.text("Le client certifie l'intervention conforme.", 15, afterTextY);

    if (location) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Localisation : ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
        15,
        afterTextY + 10
      );
    }

    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text("Signature du client :", 15, afterTextY + 22);
    doc.addImage(signatureDataUrl, "PNG", 15, afterTextY + 26, 90, 30);

    return doc;
  };

  const handleValidate = async () => {
    if (!selectedClient) return;
    if (!bonIntervention.trim()) {
      setMessage("Merci de remplir le bon d'intervention.");
      return;
    }
    if (!certified) {
      setMessage("Le client doit cocher la case de certification.");
      return;
    }
    if (signatureRef.current.isEmpty()) {
      setMessage("La signature est vide.");
      return;
    }
    if (!clientEmail.trim()) {
      setMessage("Merci de renseigner l'email du client.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const location = await getLocation();
      const dateStr = new Date().toLocaleDateString("fr-FR");
      const signatureDataUrl = signatureRef.current.getDataUrl();

      // Upload de l'image de signature seule
      const sigBlob = await (await fetch(signatureDataUrl)).blob();
      const fileName = `${selectedClient.id}-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(fileName, sigBlob, { contentType: "image/png" });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("signatures")
        .getPublicUrl(uploadData.path);

      // Enregistrement en base
      const { error: insertError } = await supabase.from("signatures").insert({
        client_id: selectedClient.id,
        bon_intervention: bonIntervention.trim(),
        signature_url: urlData.publicUrl,
        client_email: clientEmail.trim(),
        latitude: location?.lat || null,
        longitude: location?.lng || null,
      });
      if (insertError) throw insertError;

      // Mémorise l'email sur le dossier client pour la prochaine fois
      await supabase
        .from("signature_clients")
        .update({ email: clientEmail.trim() })
        .eq("id", selectedClient.id);

      // Génère le PDF et l'envoie par email
      const pdfDoc = buildPdf(dateStr, location, signatureDataUrl);
      const pdfBase64 = pdfDoc.output("datauristring").split(",")[1];

      const res = await fetch("/api/send-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: clientEmail.trim(),
          clientNom: selectedClient.nom,
          pdfBase64,
        }),
      });

      if (!res.ok) throw new Error("Échec de l'envoi de l'email");

      setMessage("Bon d'intervention signé et envoyé par email ✅");
      setBonIntervention("");
      setCertified(false);
      signatureRef.current.clear();
      await loadPastSignatures(selectedClient.id);
    } catch (err) {
      console.error(err);
      setMessage("Erreur lors de l'enregistrement ou de l'envoi ❌");
    } finally {
      setSaving(false);
    }
  };

  const Logo = () => (
    <img
      src="https://hzpgkwyeglxggwcqxdfo.supabase.co/storage/v1/object/public/photos/logo-JDPOSE.png"
      alt="JDPOSE"
      style={styles.logo}
    />
  );

  if (selectedClient) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
        <Logo />
        <button onClick={() => setSelectedClient(null)} style={styles.backBtn}>
          ← Retour aux dossiers
        </button>
        <h1 style={styles.title}>{selectedClient.nom}</h1>

        <label style={styles.label}>Bon d'intervention</label>
        <textarea
          value={bonIntervention}
          onChange={(e) => setBonIntervention(e.target.value)}
          placeholder="Décrivez l'intervention réalisée (matériel, travaux effectués, remarques...)"
          rows={7}
          style={styles.textarea}
        />

        <label style={styles.label}>Email du client</label>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="client@exemple.fr"
          style={styles.input}
        />

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
          />
          Je certifie l'intervention conforme
        </label>

        <label style={styles.label}>Signature du client</label>
        <SignaturePad ref={signatureRef} />

        <button onClick={handleValidate} disabled={saving} style={styles.validateBtn}>
          {saving ? "Envoi en cours..." : "Valider et envoyer par email"}
        </button>
        {message && <p style={styles.message}>{message}</p>}

        {pastSignatures.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <h2 style={{ fontSize: 18 }}>Bons précédents</h2>
            {pastSignatures.map((s) => (
              <div key={s.id} style={styles.pastItem}>
                <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                  {new Date(s.created_at).toLocaleDateString("fr-FR")} — {s.client_email}
                </p>
                <img src={s.signature_url} alt="signature" style={styles.pastThumb} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
      <Logo />
      <h1 style={styles.title}>Signatures clients</h1>

      <div style={styles.newClientRow}>
        <input
          type="text"
          placeholder="Nom du client / chantier"
          value={newClientNom}
          onChange={(e) => setNewClientNom(e.target.value)}
          style={styles.input}
        />
        <button onClick={handleCreateClient} style={styles.addBtn}>
          + Nouveau dossier
        </button>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : clients.length === 0 ? (
        <p style={{ color: "#888" }}>Aucun dossier pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
          {clients.map((c) => (
            <button key={c.id} onClick={() => openClient(c)} style={styles.clientCard}>
              📁 {c.nom}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  logo: { height: 60, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
  label: { display: "block", fontSize: 14, fontWeight: 600, margin: "16px 0 6px" },
  newClientRow: { display: "flex", gap: 8 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 15,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 15,
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  addBtn: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#2f6fed",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  clientCard: {
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    fontSize: 16,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#2f6fed",
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
    marginBottom: 12,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    margin: "16px 0",
  },
  validateBtn: {
    marginTop: 16,
    width: "100%",
    padding: "12px 20px",
    borderRadius: 8,
    border: "none",
    background: "#2f6fed",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  message: { marginTop: 10, fontSize: 14 },
  pastItem: {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  pastThumb: { width: 200, marginTop: 6, border: "1px solid #eee", borderRadius: 4 },
};
