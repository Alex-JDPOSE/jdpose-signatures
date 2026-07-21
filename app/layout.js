export const metadata = {
  title: "JDPOSE - Signatures",
  description: "Signature client et bons d'intervention",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#f0f0ee", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
