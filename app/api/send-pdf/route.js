import { Resend } from "resend";

export async function POST(request) {
  try {
    const { email, clientNom, dateStr, timeStr, pdfBase64 } = await request.json();

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: "JDPOSE <noreply@jdpose.fr>",
      to: email,
      subject: `Bon d'intervention JDPOSE - ${clientNom} - ${dateStr}`,
      html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint le bon d'intervention signé pour ${clientNom}, daté du ${dateStr} à ${timeStr}.</p><p>Cordialement,<br/>JDPOSE</p>`,
      attachments: [
        {
          filename: `bon-intervention-${dateStr.replace(/\//g, "-")}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
