import { adminDb } from "@/lib/firebaseAdmin";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";
import { createStudent, validateStudent, type StudentInput } from "@/lib/students";
import { isAdminProfile, type StudentRecord, type UserProfile } from "@/lib/types";

// Alle Studenten inkl. aktueller Passwörter (für Liste & Ausdruck)
export const GET = withErrors(async (req) => {
  await requireAdmin(req);
  const db = adminDb();
  const [users, credentials] = await Promise.all([db.collection("users").get(), db.collection("credentials").get()]);
  const creds = new Map(credentials.docs.map((d) => [d.id, d.data()]));

  const students: StudentRecord[] = users.docs
    .filter((d) => !isAdminProfile(d.data()))
    .map((d) => ({
      ...(d.data() as UserProfile),
      uid: d.id,
      password: creds.get(d.id)?.password ?? null,
      passwordIssuedAt: creds.get(d.id)?.issuedAt ?? null,
    }))
    .sort((a, b) =>
      (a.room ?? "").localeCompare(b.room ?? "", "de", { numeric: true }) ||
      (a.name ?? a.username).localeCompare(b.name ?? b.username, "de")
    );

  return Response.json({ students });
});

// Einen oder mehrere Studenten anlegen
export const POST = withErrors(async (req) => {
  await requireAdmin(req);
  const { students = [] } = await readJson<{ students?: Partial<StudentInput>[] }>(req);
  if (students.length === 0) throw new HttpError(400, "Keine Studenten angegeben");
  if (students.length > 300) throw new HttpError(400, "Maximal 300 auf einmal");

  // Erst alles prüfen, damit bei Tippfehlern im Import nichts halb angelegt wird
  const inputs = students.map((s, i) => {
    try {
      return validateStudent(s);
    } catch (e) {
      const prefix = students.length > 1 ? `Zeile ${i + 1}: ` : "";
      throw new HttpError(400, prefix + (e as Error).message);
    }
  });

  const existing = await adminDb().collection("users").get();
  const taken = new Set(existing.docs.map((d) => d.data().username as string));

  const created = [];
  const failed = [];
  for (const input of inputs) {
    try {
      created.push(await createStudent(input, taken));
    } catch (e) {
      console.error(e);
      failed.push({ name: input.name, error: (e as Error).message });
    }
  }
  return Response.json({ created, failed });
});
