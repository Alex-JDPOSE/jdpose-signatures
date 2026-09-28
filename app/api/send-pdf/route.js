import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, emailSecondaire, clientNom, dateStr, timeStr, pdfBase64 } =
      await request.json();

    if (!email || !pdfBase64) {
      return NextResponse.json(
        { error: "Champs manquants (email ou pdfBase64)." },
        { status: 400 }
      );
    }

    // Liste des destinataires : email principal + email secondaire s'il est
    // renseigné. Set() pour éviter un doublon si les deux sont identiques.
    const destinataires = [
      ...new Set(
        [email, emailSecondaire]
          .map((e) => (e || "").trim())
          .filter((e) => e.length > 0)
      ),
    ];

    const { data, error } = await resend.emails.send({
      from: "JDPOSE <contact@jdpose.fr>", // doit être un domaine vérifié dans Resend
      to: destinataires,
      subject: `Bon d'intervention - ${clientNom} - ${dateStr}`,
      html: `
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-joint le bon d'intervention signé pour <strong>${clientNom}</strong>,
        réalisé le ${dateStr} à ${timeStr}.</p>
        <p>Cordialement,<br/>JDPOSE</p>
      `,
      attachments: [
        {
          filename: `bon-intervention-${dateStr.replace(/\//g, "-")}.pdf`,
          content: pdfBase64, // base64 pur, sans le préfixe data:...;base64,
        },
      ],
    });

    if (error) {
      console.error("Erreur Resend:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id, destinataires });
  } catch (err) {
    console.error("Erreur send-pdf:", err);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'envoi." },
      { status: 500 }
    );
  }
}
