import "./globals.css";

export const metadata = {
  title: "Agenda Pro",
  description: "Agendamento simples para negócios locais",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
