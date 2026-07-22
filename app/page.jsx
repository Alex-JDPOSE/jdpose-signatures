"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import SignaturePad from "../components/SignaturePad";
import jsPDF from "jspdf";

const LOGO_URL = "https://hzpgkwyeglxggwcqxdfo.supabase.co/storage/v1/object/public/photos/logo-JDPOSE.png";

export default function Home() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newClientNom, setNewClientNom] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [pastSignatures, setPastSignatures] = useState([]);

  const [bonIntervention, setBonIntervention] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientNomComplet, setClientNomComplet] = useState("");
  const [technicienNom, setTechnicienNom] = useState("");
  const [typeIntervention, setTypeIntervention] = useState("depannage");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const clientSigRef = useRef(null);
  const technicienSigRef = useRef(null);

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
    setClientNomComplet("");
    setTechnicienNom("");
    setTypeIntervention("depannage");
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

  // Compresse une signature PNG en JPEG léger avec fond blanc
  const compressSignature = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = Math.round(img.height * (400 / img.width));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = dataUrl;
    });
  };

  const loadImageAsBase64 = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 200;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const buildPdf = async (dateStr, location, clientSigDataUrl, technicienSigDataUrl) => {
    const doc = new jsPDF();
    const pageW = 210;
    const marginX = 15;
    const blueBg = [214, 228, 245];
    const blueText = [12, 68, 124];

    try {
      const logoBase64 = await loadImageAsBase64(LOGO_URL);
      doc.addImage(logoBase64, "JPEG", marginX, 12, 30, 30);
    } catch (e) {}

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("14 Rue de la Sablière", marginX, 48);
    doc.text("38070 Saint-Quentin-Fallavier", marginX, 53);
    doc.text("contact@jdpose.fr", marginX, 58);
    doc.text("04 28 35 00 40", marginX, 63);

    const lieuX = 115;
    const lieuY = 15;
    const lieuW = 80;
    doc.setFillColor(...blueBg);
    doc.rect(lieuX, lieuY, lieuW, 7, "F");
    doc.setTextColor(...blueText);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("LIEU D'INTERVENTION", lieuX + lieuW / 2, lieuY + 5, { align: "center" });
    doc.setFont(undefined, "normal");
    doc.setDrawColor(180, 180, 180);
    doc.rect(lieuX, lieuY + 7, lieuW, 22);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(selectedClient.nom, lieuX + 3, lieuY + 14);

    let y = 75;
    doc.setFillColor(...blueBg);
    doc.rect(marginX, y, pageW - 2 * marginX, 7, "F");
    doc.setTextColor(...blueText);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("FICHE D'INTERVENTION", pageW / 2, y + 5, { align: "center" });
    doc.setFont(undefined, "normal");
    y += 7;

    const col1W = (pageW - 2 * marginX) / 3;
    doc.setDrawColor(180, 180, 180);
    doc.rect(marginX, y, col1W, 14);
    doc.rect(marginX + col1W, y, col1W, 14);
    doc.rect(marginX + col1W * 2, y, col1W, 14);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.text("Dépannage", marginX + col1W / 2, y + 5, { align: "center" });
    doc.text("Suivant devis", marginX + col1W * 1.5, y + 5, { align: "center" });
    doc.text("Date", marginX + col1W * 2.5, y + 5, { align: "center" });

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.text(typeIntervention === "depannage" ? "X" : "", marginX + col1W / 2, y + 11, { align: "center" });
    doc.text(typeIntervention === "devis" ? "X" : "", marginX + col1W * 1.5, y + 11, { align: "center" });
    doc.setFontSize(10);
    doc.text(dateStr, marginX + col1W * 2.5, y + 11, { align: "center" });

    y += 20;

    doc.setFillColor(...blueBg);
    doc.rect(marginX, y, pageW - 2 * marginX, 7, "F");
    doc.setTextColor(...blueText);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("DÉSIGNATION DES TRAVAUX RÉALISÉS", pageW / 2, y + 5, { align: "center" });
    doc.setFont(undefined, "normal");
    y += 7;

    doc.setDrawColor(180, 180, 180);
    const travauxH = 100;
    doc.rect(marginX, y, pageW - 2 * marginX, travauxH);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(bonIntervention, pageW - 2 * marginX - 6);
    doc.text(lines, marginX + 3, y + 6);

    y += travauxH + 8;

    const halfW = (pageW - 2 * marginX) / 2 - 3;

    doc.setFillColor(...blueBg);
    doc.rect(marginX, y, halfW, 7, "F");
    doc.setTextColor(...blueText);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("VISA DU TECHNICIEN", marginX + halfW / 2, y + 5, { align: "center" });
    doc.setFont(undefined, "normal");
    doc.setDrawColor(180, 180, 180);
    doc.rect(marginX, y + 7, halfW, 45);
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.text("Nom + Signature", marginX + halfW / 2, y + 12, { align: "center" });
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.text(technicienNom, marginX + 3, y + 18);
    if (technicienSigDataUrl) {
      doc.addImage(technicienSigDataUrl, "JPEG", marginX + 3, y + 20, halfW - 6, 28);
    }

    const visaClientX = marginX + halfW + 6;
    doc.setFillColor(...blueBg);
    doc.rect(visaClientX, y, halfW, 7, "F");
    doc.setTextColor(...blueText);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("VISA DU CLIENT", visaClientX + halfW / 2, y + 5, { align: "center" });
    doc.setFont(undefined, "normal");
    doc.setDrawColor(180, 180, 180);
    doc.rect(visaClientX, y + 7, halfW, 45);
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.text("Nom + Signature", visaClientX + halfW / 2, y + 12, { align: "center" });
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.text(clientNomComplet, visaClientX + 3, y + 18);
    if (clientSigDataUrl) {
      doc.addImage(clientSigDataUrl, "JPEG", visaClientX + 3, y + 20, halfW - 6, 28);
    }

    y = 278;
    doc.setDrawColor(180, 180, 180);
    doc.line(marginX, y, pageW - marginX, y);
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.text(
      "EURL AU CAPITAL DE 5000 Euros — RCS Vienne 484 684 675 — Siret 484 684 675 00032 D — N° TVA : FR 78484684675",
      pageW / 2,
      y + 4,
      { align: "center" }
    );
    if (location) {
      doc.text(
        `Signé le ${dateStr} — Localisation : ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
        pageW / 2,
        y + 9,
        { align: "center" }
      );
    } else {
      doc.text(`Signé le ${dateStr}`, pageW / 2, y + 9, { align: "center" });
    }

    return doc;
  };

  const handleValidate = async () => {
    if (!selectedClient) return;
    if (!bonIntervention.trim()) return setMessage("Merci de remplir la désignation des travaux.");
    if (!technicienNom.trim()) return setMessage("Merci de renseigner le nom du technicien.");
    if (!clientNomComplet.trim()) return setMessage("Merci de renseigner le nom complet du client.");
    if (technicienSigRef.current.isEmpty()) return setMessage("La signature du technicien est vide.");
    if (clientSigRef.current.isEmpty()) return setMessage("La signature du client est vide.");
    if (!clientEmail.trim()) return setMessage("Merci de renseigner l'email du client.");

    setSaving(true);
    setMessage("");

    try {
      const location = await getLocation();
      const dateStr = new Date().toLocaleDateString("fr-FR");

      // Compresse les signatures pour le PDF
      const clientSigCompressed = await compressSignature(clientSigRef.current.getDataUrl());
      const technicienSigCompressed = await compressSignature(technicienSigRef.current.getDataUrl());

      // Upload les versions PNG originales pour l'archivage
      const clientBlob = await (await fetch(clientSigRef.current.getDataUrl())).blob();
      const technicienBlob = await (await fetch(technicienSigRef.current.getDataUrl())).blob();
      const ts = Date.now();

      const { data: cUpload, error: cErr } = await supabase.storage
        .from("signatures")
        .upload(`${selectedClient.id}-client-${ts}.png`, clientBlob, { contentType: "image/png" });
      if (cErr) throw cErr;

      const { data: tUpload, error: tErr } = await supabase.storage
        .from("signatures")
        .upload(`${selectedClient.id}-tech-${ts}.png`, technicienBlob, { contentType: "image/png" });
      if (tErr) throw tErr;

      const clientUrl = supabase.storage.from("signatures").getPublicUrl(cUpload.path).data.publicUrl;
      const techUrl = supabase.storage.from("signatures").getPublicUrl(tUpload.path).data.publicUrl;

      const { error: insertError } = await supabase.from("signatures").insert({
        client_id: selectedClient.id,
        bon_intervention: bonIntervention.trim(),
        signature_url: clientUrl,
        technicien_nom: technicienNom.trim(),
        technicien_signature_url: techUrl,
        client_email: clientEmail.trim(),
        latitude: location?.lat || null,
        longitude: location?.lng || null,
      });
      if (insertError) throw insertError;

      await supabase.from("signature_clients").update({ email: clientEmail.trim() }).eq("id", selectedClient.id);

      // Génère le PDF avec les signatures compressées
      const pdfDoc = await buildPdf(dateStr, location, clientSigCompressed, technicienSigCompressed);
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
      if (!res.ok) throw new Error("Échec de l'envoi");

      setMessage("Bon d'intervention signé et envoyé par email ✅");
      setBonIntervention("");
      setClientNomComplet("");
      setTechnicienNom("");
      clientSigRef.current.clear();
      technicienSigRef.current.clear();
      await loadPastSignatures(selectedClient.id);
    } catch (err) {
      console.error(err);
      setMessage("Erreur lors de l'enregistrement ou de l'envoi ❌");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePast = async (sig) => {
    if (!window.confirm("Supprimer ce bon d'intervention ?")) return;
    try {
      const cFile = sig.signature_url?.split("/signatures/").pop();
      const tFile = sig.technicien_signature_url?.split("/signatures/").pop();
      if (cFile) await supabase.storage.from("signatures").remove([cFile]);
      if (tFile) await supabase.storage.from("signatures").remove([tFile]);
      await supabase.from("signatures").delete().eq("id", sig.id);
      setPastSignatures((prev) => prev.filter((s) => s.id !== sig.id));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  };

  const Logo = () => <img src={LOGO_URL} alt="JDPOSE" style={styles.logo} />;

  if (selectedClient) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
        <Logo />
        <button onClick={() => setSelectedClient(null)} style={styles.backBtn}>
          ← Retour aux dossiers
        </button>
        <h1 style={styles.title}>{selectedClient.nom}</h1>

        <label style={styles.label}>Type d'intervention</label>
        <div style={{ display: "flex", gap: 12 }}>
          <label style={styles.radioRow}>
            <input type="radio" checked={typeIntervention === "depannage"} onChange={() => setTypeIntervention("depannage")} />
            Dépannage
          </label>
          <label style={styles.radioRow}>
            <input type="radio" checked={typeIntervention === "devis"} onChange={() => setTypeIntervention("devis")} />
            Suivant devis
          </label>
        </div>

        <label style={styles.label}>Désignation des travaux réalisés</label>
        <textarea
          value={bonIntervention}
          onChange={(e) => setBonIntervention(e.target.value)}
          placeholder="Décrivez précisément l'intervention réalisée..."
          rows={7}
          style={styles.textarea}
        />

        <label style={styles.label}>Nom du technicien</label>
        <input type="text" value={technicienNom} onChange={(e) => setTechnicienNom(e.target.value)} placeholder="Nom du technicien" style={styles.input} />

        <label style={styles.label}>Signature du technicien</label>
        <SignaturePad ref={technicienSigRef} />

        <label style={styles.label}>Nom complet du client (Nom + Prénom)</label>
        <input type="text" value={clientNomComplet} onChange={(e) => setClientNomComplet(e.target.value)} placeholder="Nom et prénom" style={styles.input} />

        <label style={styles.label}>Email du client</label>
        <input type="email" name="email" autoComplete="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@exemple.fr" style={styles.input} />

        <label style={styles.label}>Signature du client</label>
        <SignaturePad ref={clientSigRef} />

        <button onClick={handleValidate} disabled={saving} style={styles.validateBtn}>
          {saving ? "Envoi en cours..." : "Valider et envoyer par email"}
        </button>
        {message && <p style={styles.message}>{message}</p>}

        {pastSignatures.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <h2 style={{ fontSize: 18 }}>Bons précédents</h2>
            {pastSignatures.map((s) => (
              <div key={s.id} style={styles.pastItem}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                    {new Date(s.created_at).toLocaleDateString("fr-FR")} — {s.client_email}
                  </p>
                  <button onClick={() => handleDeletePast(s)} style={styles.deleteBtn} title="Supprimer">✕</button>
                </div>
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
        <input type="text" placeholder="Nom du client / chantier" value={newClientNom} onChange={(e) => setNewClientNom(e.target.value)} style={styles.input} />
        <button onClick={handleCreateClient} style={styles.addBtn}>+ Nouveau dossier</button>
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
  radioRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 14 },
  newClientRow: { display: "flex", gap: 8 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" },
  addBtn: { padding: "10px 16px", borderRadius: 8, border: "none", background: "#2f6fed", color: "#fff", fontWeight: 600, cursor: "pointer" },
  clientCard: { textAlign: "left", padding: "14px 16px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 16 },
  backBtn: { background: "none", border: "none", color: "#2f6fed", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 12 },
  validateBtn: { marginTop: 16, width: "100%", padding: "12px 20px", borderRadius: 8, border: "none", background: "#2f6fed", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  message: { marginTop: 10, fontSize: 14 },
  pastItem: { border: "1px solid #ddd", borderRadius: 8, padding: 10, marginBottom: 10 },
  pastThumb: { width: 200, marginTop: 6, border: "1px solid #eee", borderRadius: 4 },
  deleteBtn: { background: "rgba(255,255,255,0.9)", border: "1px solid #e0a0a0", color: "#a12626", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 },
};
