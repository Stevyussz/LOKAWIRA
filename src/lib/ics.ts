// file kalender (.ics) buat tombol "Ingatkan aku": dibuka HP jadi acara di aplikasi Kalender, lengkap dgn pengingat
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

export function downloadIcs(ev: { title: string; description?: string; place: string; startsAt: string; endsAt: string; url?: string }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LOKAWIRA//Agenda Budaya//ID",
    "BEGIN:VEVENT",
    `UID:${stamp(ev.startsAt)}-${Math.random().toString(36).slice(2)}@lokawira`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(ev.startsAt)}`,
    `DTEND:${stamp(ev.endsAt)}`,
    `SUMMARY:${esc(ev.title)}`,
    `LOCATION:${esc(ev.place)}`,
    `DESCRIPTION:${esc([ev.description, ev.url].filter(Boolean).join("\n"))}`,
    // pengingat 2 jam sebelumnya
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${ev.title.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "acara"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
