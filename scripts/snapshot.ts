import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config(); // fallback para .env

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const label =
    process.argv[2] ?? `auto-deploy-${new Date().toISOString().slice(0, 10)}`;

  const client = await pool.connect();
  try {
    const [
      members, plans, payments, transactions, events, registrations,
      departments, deptPermissions, userDepartments, users,
      birthdayConfig, systemConfig,
    ] = await Promise.all([
      client.query('SELECT * FROM "Member" ORDER BY registration ASC'),
      client.query('SELECT * FROM "Plan" ORDER BY name ASC'),
      client.query('SELECT * FROM "Payment" ORDER BY "createdAt" ASC'),
      client.query('SELECT * FROM "Transaction" ORDER BY date ASC'),
      client.query('SELECT * FROM "Event" ORDER BY "dateTime" ASC'),
      client.query('SELECT * FROM "EventRegistration"'),
      client.query('SELECT * FROM "Department" ORDER BY name ASC'),
      client.query('SELECT * FROM "DeptModulePermission"'),
      client.query('SELECT * FROM "UserDepartment"'),
      client.query(
        'SELECT id, name, email, role, approved, "totpEnabled", "failedLoginAttempts", "lockedUntil", "createdAt", "updatedAt" FROM "User" ORDER BY name ASC',
      ),
      client.query('SELECT * FROM "BirthdayMessageConfig"'),
      client.query('SELECT * FROM "SystemConfig"'),
    ]);

    const json = JSON.stringify({
      meta: {
        generatedAt: new Date().toISOString(),
        version: "1.0",
        system: "CRM CEF 2026",
      },
      data: {
        users: users.rows,
        departments: departments.rows,
        deptModulePermissions: deptPermissions.rows,
        userDepartments: userDepartments.rows,
        members: members.rows,
        plans: plans.rows,
        payments: payments.rows,
        transactions: transactions.rows,
        events: events.rows,
        eventRegistrations: registrations.rows,
        birthdayMessageConfig: birthdayConfig.rows,
        systemConfig: systemConfig.rows,
      },
    });

    const sizeBytes = Buffer.byteLength(json, "utf8");

    const res = await client.query(
      'INSERT INTO "Snapshot" (id, label, data, "sizeBytes", "createdAt") VALUES (gen_random_uuid()::text, $1, $2, $3, NOW()) RETURNING id, label, "sizeBytes", "createdAt"',
      [label, json, sizeBytes],
    );

    const snap = res.rows[0];
    console.log(
      `✅ Snapshot "${snap.label}" criado — ${(snap.sizeBytes / 1024).toFixed(1)} KB` +
        ` | associados: ${members.rows.length} | pagamentos: ${payments.rows.length}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Falha ao criar snapshot:", e.message);
  process.exit(1);
});
