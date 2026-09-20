export type WorkingHour = {
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

export type ProfessionalWorkingHour = WorkingHour & {
  professional_id: string;
};

export function resolveWorkingHour(args: {
  weekday: number;
  professionalId: string;
  businessHours: WorkingHour[];
  professionalHours: ProfessionalWorkingHour[];
}) {
  const custom = args.professionalHours.find(
    (item) =>
      item.professional_id === args.professionalId &&
      item.weekday === args.weekday
  );

  if (custom) return custom;

  return (
    args.businessHours.find((item) => item.weekday === args.weekday) || null
  );
}
