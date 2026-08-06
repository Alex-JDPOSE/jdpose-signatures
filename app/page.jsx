"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import SignaturePad from "../components/SignaturePad";
import jsPDF from "jspdf";

const LOGO_URL = "https://hzpgkwyeglxggwcqxdfo.supabase.co/storage/v1/object/public/photos/logo-JDPOSE.png";

const TEXT_COLORS = [
  { label: "Noir", hex: "#1a1a1a" },
  { label: "Rouge", hex: "#d64545" },
  { label: "Bleu", hex: "#2f6fed" },
  { label: "Vert", hex: "#2f9e44" },
];

export default function Home() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newClientNom, setNewClientNom] = useState("");
  const [newClientAdresse, setNewClientAdresse] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [pastSignatures, setPastSignatures] = useState([]);
  const [editingClient, setEditingClient] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // "recent" | "alpha"
  const [dateFilter, setDateFilter] = useState("all"); // "all" | "week" | "month"
  const [signatureCounts, setSignatureCounts] = useState({});
  const [allSignatures, setAllSignatures] = useState([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [clientEmail, setClientEmail] = useState("");
  const [clientEmail2, setClientEmail2] = useState("");
  const [clientNomComplet, setClientNomComplet] = useState("");
  const [technicienNom, setTechnicienNom] = useState("");
  const [typeIntervention, setTypeIntervention] = useState("depannage");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const clientSigRef = useRef(null);
  const technicienSigRef = useRef(null);
  const editorRef = useRef(null);

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

    const { data: sigs } = await supabase
      .from("signatures")
      .select("id, client_id, created_at, technicien_nom, client_email");
    if (sigs) {
      setAllSignatures(sigs);
      const counts = {};
      sigs.forEach((s) => {
        counts[s.client_id] = (counts[s.client_id] || 0) + 1;
      });
      setSignatureCounts(counts);
    }

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
      .insert({ nom: newClientNom.trim(), adresse: newClientAdresse.trim() || null })
      .select()
      .single();
    if (!error) {
      setNewClientNom("");
      setNewClientAdresse("");
      setClients((prev) => [data, ...prev]);
    }
  };

  const handleDeleteClient = async (client, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer le dossier "${client.nom}" et tous ses bons ?`)) return;
    try {
      await supabase.from("signature_clients").delete().eq("id", client.id);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  };

  const handleEditClient = async () => {
    if (!editingClient.nom.trim()) return;
    try {
      await supabase
        .from("signature_clients")
        .update({ nom: editingClient.nom.trim(), adresse: editingClient.adresse?.trim() || null })
        .eq("id", editingClient.id);
      setClients((prev) =>
        prev.map((c) => (c.id === editingClient.id ? { ...c, nom: editingClient.nom.trim(), adresse: editingClient.adresse?.trim() || null } : c))
      );
      setEditingClient(null);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la modification");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    if (editorRef.current) editorRef.current.innerHTML = "";
    setClientNomComplet("");
    setClientEmail2("");
    setTechnicienNom("");
    setTypeIntervention("depannage");
    if (clientSigRef.current) clientSigRef.current.clear();
    if (technicienSigRef.current) technicienSigRef.current.clear();
    setMessage("");
  };

  const openClient = async (client) => {
    setSelectedClient(client);
    resetForm();
    setClientEmail(client.email || "");
    await loadPastSignatures(client.id);
  };

  const editPast = (sig) => {
    setEditingId(sig.id);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = sig.bon_intervention || "";
    }, 50);
    setClientEmail(sig.client_email || "");
    setClientEmail2("");
    setTechnicienNom(sig.technicien_nom || "");
    setClientNomComplet("");
    setMessage("Modifie ce que tu veux, refais signer, puis valide pour renvoyer le PDF.");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exec = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

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

  const loadImageAsCompressed = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = Math.round(img.height * (400 / img.width));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const htmlToSegments = (html) => {
    const container = document.createElement("div");
    container.innerHTML = html || "";
    const segments = [];

    const walk = (node, inheritedStyle) => {
      const style = { ...inheritedStyle };
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) segments.push({ text: node.textContent, bold: style.bold, color: style.color });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "b" || tag === "strong") style.bold = true;
      const inline = node.getAttribute("style") || "";
      const fontWeight = /font-weight\s*:\s*([^;]+)/i.exec(inline);
      if (fontWeight && (fontWeight[1].includes("bold") || parseInt(fontWeight[1]) >= 600)) style.bold = true;
      const colorMatch = /(^|;)\s*color\s*:\s*([^;]+)/i.exec(inline);
      if (colorMatch) style.color = colorMatch[2].trim();
      const fontColor = node.getAttribute("color");
      if (fontColor) style.color = fontColor;

      if (tag === "br") {
        segments.push({ text: "\n", bold: style.bold, color: style.color });
        return;
      }

      for (const child of node.childNodes) walk(child, style);

      if (tag === "div" || tag === "p") segments.push({ text: "\n", bold: style.bold, color: style.color });
    };

    for (const child of container.childNodes) walk(child, { bold: false, color: "#1a1a1a" });
    return segments;
  };

  const parseColor = (color) => {
    if (!color) return [26, 26, 26];
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return [r, g, b];
    }
    const rgb = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
    if (rgb) return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])];
    return [26, 26, 26];
  };

  const buildPdf = async (params) => {
    const {
      dateStr, timeStr, clientSigDataUrl, technicienSigDataUrl,
      clientNomInPdf, technicienNomInPdf, bonHtmlInPdf, typeInPdf, adresseInPdf,
    } = params;

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
    doc.text(selectedClient.nom, lieuX + 3, lieuY + 13);
    if (adresseInPdf) {
      doc.setFontSize(9);
      const adrLines = doc.splitTextToSize(adresseInPdf, lieuW - 6);
      doc.text(adrLines, lieuX + 3, lieuY + 19);
    }

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
    doc.text(typeInPdf === "depannage" ? "X" : "", marginX + col1W / 2, y + 11, { align: "center" });
    doc.text(typeInPdf === "devis" ? "X" : "", marginX + col1W * 1.5, y + 11, { align: "center" });
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

    const segments = htmlToSegments(bonHtmlInPdf);
    const usableW = pageW - 2 * marginX - 6;
    let cursorX = marginX + 3;
    let cursorY = y + 6;
    const lineH = 5;
    doc.setFontSize(10);

    for (const seg of segments) {
      if (!seg.text) continue;
      const rgb = parseColor(seg.color);
      doc.setTextColor(...rgb);
      doc.setFont(undefined, seg.bold ? "bold" : "normal");
      const parts = seg.text.split("\n");
      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi];
        if (part) {
          const words = part.split(/(\s+)/);
          for (const word of words) {
            if (!word) continue;
            const wordW = doc.getTextWidth(word);
            if (cursorX + wordW > marginX + 3 + usableW) {
              cursorY += lineH;
              cursorX = marginX + 3;
              if (cursorY > y + travauxH - 2) break;
              if (/^\s+$/.test(word)) continue;
            }
            if (cursorY > y + travauxH - 2) break;
            doc.text(word, cursorX, cursorY);
            cursorX += wordW;
          }
        }
        if (pi < parts.length - 1) {
          cursorY += lineH;
          cursorX = marginX + 3;
          if (cursorY > y + travauxH - 2) break;
        }
      }
      if (cursorY > y + travauxH - 2) break;
    }

    doc.setFont(undefined, "normal");
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
    doc.text(technicienNomInPdf, marginX + 3, y + 18);
    if (technicienSigDataUrl) doc.addImage(technicienSigDataUrl, "JPEG", marginX + 3, y + 20, halfW - 6, 28);

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
    doc.text(clientNomInPdf, visaClientX + 3, y + 18);
    if (clientSigDataUrl) doc.addImage(clientSigDataUrl, "JPEG", visaClientX + 3, y + 20, halfW - 6, 28);

    y = 278;
    doc.setDrawColor(180, 180, 180);
    doc.line(marginX, y, pageW - marginX, y);
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.text(
      "EURL AU CAPITAL DE 5000 Euros — RCS Vienne 484 684 675 — Siret 484 684 675 00032 D — N° TVA : FR 78484684675",
      pageW / 2, y + 4, { align: "center" }
    );
    doc.text(`Signé le ${dateStr} à ${timeStr}`, pageW / 2, y + 9, { align: "center" });

    return doc;
  };

  const viewPastPdf = async (sig) => {
    try {
      const clientSigCompressed = await loadImageAsCompressed(sig.signature_url);
      const techSigCompressed = sig.technicien_signature_url ? await loadImageAsCompressed(sig.technicien_signature_url) : null;
      const created = new Date(sig.created_at);
      const dateStr = created.toLocaleDateString("fr-FR");
      const timeStr = created.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

      const pdfDoc = await buildPdf({
        dateStr, timeStr,
        clientSigDataUrl: clientSigCompressed,
        technicienSigDataUrl: techSigCompressed,
        clientNomInPdf: "",
        technicienNomInPdf: sig.technicien_nom || "",
        bonHtmlInPdf: sig.bon_intervention || "",
        typeInPdf: "depannage",
        adresseInPdf: selectedClient.adresse || "",
      });

      pdfDoc.save(`bon-intervention-${dateStr.replace(/\//g, "-")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ouverture du PDF");
    }
  };

  const handleValidate = async () => {
    if (!selectedClient) return;
    const bonHtml = editorRef.current ? editorRef.current.innerHTML : "";
    const bonText = editorRef.current ? editorRef.current.innerText : "";
    if (!bonText.trim()) return setMessage("Merci de remplir la désignation des travaux.");
    if (!technicienNom.trim()) return setMessage("Merci de renseigner le nom du technicien.");
    if (!clientNomComplet.trim()) return setMessage("Merci de renseigner le nom complet du client.");
    if (technicienSigRef.current.isEmpty()) return setMessage("La signature du technicien est vide.");
    if (clientSigRef.current.isEmpty()) return setMessage("La signature du client est vide.");
    if (!clientEmail.trim()) return setMessage("Merci de renseigner l'email du client.");

    setSaving(true);
    setMessage("");

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("fr-FR");
      const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

      const clientSigCompressed = await compressSignature(clientSigRef.current.getDataUrl());
      const technicienSigCompressed = await compressSignature(technicienSigRef.current.getDataUrl());

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

      if (editingId) {
        const { error: updateError } = await supabase
          .from("signatures")
          .update({
            bon_intervention: bonHtml,
            signature_url: clientUrl,
            technicien_nom: technicienNom.trim(),
            technicien_signature_url: techUrl,
            client_email: clientEmail.trim(),
          })
          .eq("id", editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("signatures").insert({
          client_id: selectedClient.id,
          bon_intervention: bonHtml,
          signature_url: clientUrl,
          technicien_nom: technicienNom.trim(),
          technicien_signature_url: techUrl,
          client_email: clientEmail.trim(),
        });
        if (insertError) throw insertError;
      }

      await supabase.from("signature_clients").update({ email: clientEmail.trim() }).eq("id", selectedClient.id);

      const pdfDoc = await buildPdf({
        dateStr, timeStr,
        clientSigDataUrl: clientSigCompressed,
        technicienSigDataUrl: technicienSigCompressed,
        clientNomInPdf: clientNomComplet,
        technicienNomInPdf: technicienNom,
        bonHtmlInPdf: bonHtml,
        typeInPdf: typeIntervention,
        adresseInPdf: selectedClient.adresse || "",
      });
      const pdfBase64 = pdfDoc.output("datauristring").split(",")[1];

      const res = await fetch("/api/send-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: clientEmail.trim(),
          emailSecondaire: clientEmail2.trim(),
          clientNom: selectedClient.nom,
          dateStr, timeStr, pdfBase64,
        }),
      });
      if (!res.ok) throw new Error("Échec de l'envoi");

      setMessage(editingId ? "Bon modifié et renvoyé ✅" : "Bon signé et envoyé par email ✅");
      resetForm();
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
      setSignatureCounts((prev) => {
        const updated = { ...prev };
        if (updated[sig.client_id]) {
          updated[sig.client_id] = Math.max(0, updated[sig.client_id] - 1);
          if (updated[sig.client_id] === 0) delete updated[sig.client_id];
        }
        return updated;
      });
      setAllSignatures((prev) => prev.filter((s) => s.id !== sig.id));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  };

  const daysSince = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getDashboardStats = () => {
    const now = new Date();
    const thisMonthSigs = allSignatures.filter((s) => {
      const d = new Date(s.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const topClientsMap = {};
    allSignatures.forEach((s) => {
      topClientsMap[s.client_id] = (topClientsMap[s.client_id] || 0) + 1;
    });
    const topClients = Object.entries(topClientsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([clientId, count]) => {
        const client = clients.find((c) => c.id === clientId);
        return { nom: client ? client.nom : "Client supprimé", count };
      });

    let avgDays = null;
    const durations = allSignatures
      .map((s) => {
        const client = clients.find((c) => c.id === s.client_id);
        if (!client) return null;
        return daysSince(client.created_at) - daysSince(s.created_at);
      })
      .filter((d) => d !== null && d >= 0);
    if (durations.length > 0) {
      avgDays = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1);
    }

    return { thisMonthCount: thisMonthSigs.length, topClients, avgDays };
  };

  const handleExportMonth = () => {
    const now = new Date();
    const monthSigs = allSignatures.filter((s) => {
      const d = new Date(s.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    if (monthSigs.length === 0) {
      alert("Aucune intervention ce mois-ci à exporter.");
      return;
    }

    const rows = [["Client", "Date", "Technicien", "Email client"]];
    monthSigs.forEach((s) => {
      const client = clients.find((c) => c.id === s.client_id);
      rows.push([
        client ? client.nom : "Client supprimé",
        new Date(s.created_at).toLocaleDateString("fr-FR"),
        s.technicien_nom || "",
        s.client_email || "",
      ]);
    });

    const csvContent = rows.map((r) => r.map((v) => `"${(v || "").toString().replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interventions-${now.getMonth() + 1}-${now.getFullYear()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La dictée vocale n'est pas disponible sur ce navigateur.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand("insertText", false, transcript + " ");
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const getFilteredClients = () => {
    let result = [...clients];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) => c.nom.toLowerCase().includes(q) || (c.adresse || "").toLowerCase().includes(q)
      );
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const limit = new Date();
      if (dateFilter === "week") limit.setDate(now.getDate() - 7);
      if (dateFilter === "month") limit.setMonth(now.getMonth() - 1);
      result = result.filter((c) => new Date(c.created_at) >= limit);
    }

    if (sortBy === "alpha") {
      result.sort((a, b) => a.nom.localeCompare(b.nom));
    } else {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return result;
  };

  const Logo = () => <img src={LOGO_URL} alt="JDPOSE" style={styles.logo} />;

  if (showDashboard) {
    const stats = getDashboardStats();
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
        <Logo />
        <button onClick={() => setShowDashboard(false)} style={styles.backBtn}>← Retour aux dossiers</button>
        <h1 style={styles.title}>Tableau de bord</h1>

        <div style={styles.statCard}>
          <p style={styles.statLabel}>Interventions ce mois-ci</p>
          <p style={styles.statValue}>{stats.thisMonthCount}</p>
        </div>

        <div style={styles.statCard}>
          <p style={styles.statLabel}>Temps moyen création → signature</p>
          <p style={styles.statValue}>{stats.avgDays !== null ? `${stats.avgDays} j` : "—"}</p>
        </div>

        <div style={styles.statCard}>
          <p style={styles.statLabel}>Clients les plus actifs</p>
          {stats.topClients.length === 0 ? (
            <p style={{ color: "#888", fontSize: 14 }}>Pas encore de données.</p>
          ) : (
            stats.topClients.map((tc, i) => (
              <div key={i} style={styles.topClientRow}>
                <span>{tc.nom}</span>
                <span style={{ fontWeight: 600 }}>{tc.count}</span>
              </div>
            ))
          )}
        </div>

        <button onClick={handleExportMonth} style={{ ...styles.addBtn, marginTop: 12, width: "100%" }}>⬇️ Exporter le mois (Excel)</button>
      </div>
    );
  }

  if (editingClient) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
        <Logo />
        <button onClick={() => setEditingClient(null)} style={styles.backBtn}>← Annuler</button>
        <h1 style={styles.title}>Modifier le dossier</h1>

        <label style={styles.label}>Nom du client / chantier</label>
        <input type="text" value={editingClient.nom} onChange={(e) => setEditingClient({ ...editingClient, nom: e.target.value })} style={styles.input} />

        <label style={styles.label}>Adresse</label>
        <textarea value={editingClient.adresse || ""} onChange={(e) => setEditingClient({ ...editingClient, adresse: e.target.value })} placeholder="Rue, ville, code postal..." rows={3} style={styles.textarea} />

        <button onClick={handleEditClient} style={styles.validateBtn}>Enregistrer</button>
      </div>
    );
  }

  if (selectedClient) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
        <Logo />
        <button onClick={() => setSelectedClient(null)} style={styles.backBtn}>← Retour aux dossiers</button>
        <h1 style={styles.title}>{selectedClient.nom}</h1>
        {selectedClient.adresse && (
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666", whiteSpace: "pre-wrap" }}>📍 {selectedClient.adresse}</p>
        )}

        {editingId && (
          <div style={styles.editBanner}>
            ✏️ Vous modifiez un bon existant.{" "}
            <button onClick={resetForm} style={styles.cancelEditBtn}>Annuler la modification</button>
          </div>
        )}

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
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>
          Cliquez sur <b>G</b> puis tapez pour écrire en gras, ou sélectionnez du texte existant et cliquez sur <b>G</b> ou une couleur.
        </p>
        <div style={styles.richToolbar}>
          <button type="button" onClick={() => exec("bold")} style={styles.richBtn}><b>G</b></button>
          {TEXT_COLORS.map((c) => (
            <button key={c.hex} type="button" onClick={() => exec("foreColor", c.hex)} title={c.label} style={{ ...styles.colorSwatch, background: c.hex }} />
          ))}
          <button
            type="button"
            onClick={toggleDictation}
            style={isListening ? styles.micBtnActive : styles.richBtn}
            title="Dictée vocale"
          >
            {isListening ? "🔴 Écoute..." : "🎤 Dictée"}
          </button>
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning style={styles.editor} data-placeholder="Décrivez précisément l'intervention réalisée..." />

        <label style={styles.label}>Nom du technicien</label>
        <input type="text" value={technicienNom} onChange={(e) => setTechnicienNom(e.target.value)} placeholder="Nom du technicien" style={styles.input} />

        <label style={styles.label}>Signature du technicien</label>
        <SignaturePad ref={technicienSigRef} />

        <label style={styles.label}>Nom complet du client (Nom + Prénom)</label>
        <input type="text" value={clientNomComplet} onChange={(e) => setClientNomComplet(e.target.value)} placeholder="Nom et prénom" style={styles.input} />

        <label style={styles.label}>Email du client</label>
        <input type="email" name="email" autoComplete="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@exemple.fr" style={styles.input} />

        <label style={styles.label}>Email secondaire (facultatif)</label>
        <input type="email" name="email2" autoComplete="email" value={clientEmail2} onChange={(e) => setClientEmail2(e.target.value)} placeholder="autre.contact@exemple.fr (optionnel)" style={styles.input} />

        <label style={styles.label}>Signature du client</label>
        <SignaturePad ref={clientSigRef} />

        <button onClick={handleValidate} disabled={saving} style={styles.validateBtn}>
          {saving ? "Envoi en cours..." : editingId ? "Renvoyer par email" : "Valider et envoyer par email"}
        </button>
        {message && <p style={styles.message}>{message}</p>}

        {pastSignatures.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <h2 style={{ fontSize: 18 }}>Bons précédents</h2>
            {pastSignatures.map((s) => (
              <div key={s.id} style={styles.pastItem}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                    {new Date(s.created_at).toLocaleDateString("fr-FR")} — {s.client_email}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => viewPastPdf(s)} style={styles.actionBtn} title="Voir le PDF">📄 Voir</button>
                    <button onClick={() => editPast(s)} style={styles.actionBtn} title="Modifier">✏️ Modifier</button>
                    <button onClick={() => handleDeletePast(s)} style={styles.deleteBtn} title="Supprimer">✕</button>
                  </div>
                </div>
                <img src={s.signature_url} alt="signature" style={styles.pastThumb} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const filteredClients = getFilteredClients();

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
      <Logo />
      <h1 style={styles.title}>Signatures clients</h1>

      <div style={styles.newClientBlock}>
        <input type="text" placeholder="Nom du client / chantier" value={newClientNom} onChange={(e) => setNewClientNom(e.target.value)} style={styles.input} />
        <textarea placeholder="Adresse (rue, ville, code postal...)" value={newClientAdresse} onChange={(e) => setNewClientAdresse(e.target.value)} rows={2} style={{ ...styles.textarea, marginTop: 8 }} />
        <button onClick={handleCreateClient} style={{ ...styles.addBtn, marginTop: 8, width: "100%" }}>+ Nouveau dossier</button>
      </div>

      <input
        type="text"
        placeholder="🔍 Rechercher un client..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ ...styles.input, marginTop: 16 }}
      />

      <div style={styles.filterRow}>
        <button onClick={() => setDateFilter("all")} style={dateFilter === "all" ? styles.filterBtnActive : styles.filterBtn}>Tous</button>
        <button onClick={() => setDateFilter("week")} style={dateFilter === "week" ? styles.filterBtnActive : styles.filterBtn}>Cette semaine</button>
        <button onClick={() => setDateFilter("month")} style={dateFilter === "month" ? styles.filterBtnActive : styles.filterBtn}>Ce mois-ci</button>
        <button onClick={() => setSortBy(sortBy === "recent" ? "alpha" : "recent")} style={styles.filterBtn}>
          {sortBy === "recent" ? "↓ Récent" : "A→Z"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => setShowDashboard(true)} style={{ ...styles.filterBtn, flex: 1 }}>📊 Tableau de bord</button>
        <button onClick={handleExportMonth} style={{ ...styles.filterBtn, flex: 1 }}>⬇️ Exporter le mois</button>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : clients.length === 0 ? (
        <p style={{ color: "#888" }}>Aucun dossier pour l'instant.</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "#888", margin: "12px 0 8px" }}>
            {filteredClients.length} dossier{filteredClients.length > 1 ? "s" : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredClients.map((c) => (
              <div key={c.id} style={styles.clientCardRow}>
                <button onClick={() => openClient(c)} style={styles.clientCardMain}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    📁 {c.nom}
                    {signatureCounts[c.id] > 0 && (
                      <span style={styles.badgeSigned}>
                        {signatureCounts[c.id]} intervention{signatureCounts[c.id] > 1 ? "s" : ""}
                      </span>
                    )}
                    {!signatureCounts[c.id] && daysSince(c.created_at) >= 14 && (
                      <span style={styles.badgeReminder}>🕓 Créé il y a {daysSince(c.created_at)} j</span>
                    )}
                  </div>
                  {c.adresse && <span style={{ display: "block", fontSize: 12, color: "#888", marginTop: 2 }}>{c.adresse}</span>}
                </button>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setEditingClient({ ...c })} style={styles.actionBtn} title="Modifier">✏️</button>
                  <button onClick={(e) => handleDeleteClient(c, e)} style={styles.deleteBtn} title="Supprimer">✕</button>
                </div>
              </div>
            ))}
            {filteredClients.length === 0 && (
              <p style={{ color: "#888", fontSize: 14 }}>Aucun résultat pour cette recherche.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  logo: { height: 60, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
  label: { display: "block", fontSize: 14, fontWeight: 600, margin: "16px 0 6px" },
  radioRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 14 },
  newClientBlock: { padding: 12, background: "#fff", border: "1px solid #ddd", borderRadius: 10 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" },
  addBtn: { padding: "10px 16px", borderRadius: 8, border: "none", background: "#2f6fed", color: "#fff", fontWeight: 600, cursor: "pointer" },
  clientCardRow: { display: "flex", alignItems: "center", gap: 8 },
  clientCardMain: { flex: 1, textAlign: "left", padding: "14px 16px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 16 },
  backBtn: { background: "none", border: "none", color: "#2f6fed", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 12 },
  validateBtn: { marginTop: 16, width: "100%", padding: "12px 20px", borderRadius: 8, border: "none", background: "#2f6fed", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  message: { marginTop: 10, fontSize: 14 },
  pastItem: { border: "1px solid #ddd", borderRadius: 8, padding: 10, marginBottom: 10 },
  pastThumb: { width: 200, marginTop: 6, border: "1px solid #eee", borderRadius: 4 },
  actionBtn: { background: "#fff", border: "1px solid #ccc", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 },
  deleteBtn: { background: "#fff5f5", border: "1px solid #e0a0a0", color: "#a12626", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 },
  editBanner: { background: "#e6f1fb", border: "1px solid #b5d4f4", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 16 },
  cancelEditBtn: { background: "none", border: "none", color: "#2f6fed", textDecoration: "underline", cursor: "pointer", fontSize: 13, marginLeft: 8 },
  richToolbar: { display: "flex", gap: 6, alignItems: "center", marginBottom: 6, padding: "6px 8px", background: "#f5f5f5", borderRadius: 8 },
  richBtn: { padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 14 },
  colorSwatch: { width: 24, height: 24, borderRadius: "50%", cursor: "pointer", border: "1px solid #ccc" },
  editor: { minHeight: 160, padding: 12, borderRadius: 8, border: "1px solid #ccc", background: "#fff", fontSize: 15, fontFamily: "inherit", outline: "none", whiteSpace: "pre-wrap" },
  filterRow: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  filterBtn: { padding: "6px 12px", borderRadius: 20, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 13, color: "#555" },
  filterBtnActive: { padding: "6px 12px", borderRadius: 20, border: "1px solid #2f6fed", background: "#2f6fed", cursor: "pointer", fontSize: 13, color: "#fff", fontWeight: 600 },
  badgeSigned: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#e3f7e8", color: "#1e7d38" },
  badgeReminder: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#eef1f5", color: "#5a6472" },
  micBtnActive: { padding: "6px 12px", borderRadius: 6, border: "1px solid #d64545", background: "#fdeaea", color: "#a12626", cursor: "pointer", fontSize: 14 },
  statCard: { padding: 16, background: "#fff", border: "1px solid #ddd", borderRadius: 10, marginTop: 12 },
  statLabel: { fontSize: 13, color: "#888", margin: 0 },
  statValue: { fontSize: 28, fontWeight: 700, margin: "4px 0 0" },
  topClientRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 },
};
