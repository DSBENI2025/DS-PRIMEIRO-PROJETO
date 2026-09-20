import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meu agendamento",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerAppointmentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
