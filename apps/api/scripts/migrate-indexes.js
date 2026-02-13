import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/punjab_compliance";

const ensureIndex = async (collection, { name, key, options }) => {
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => index.name === name);
  const needsRebuild =
    !existing ||
    existing.unique !== Boolean(options.unique) ||
    existing.sparse !== Boolean(options.sparse);

  if (existing && needsRebuild) {
    await collection.dropIndex(name);
  }

  if (needsRebuild) {
    await collection.createIndex(key, { ...options, name });
  }
};

const run = async () => {
  console.log(`Connecting to ${mongoUri}`);
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;

  console.log("Creating indexes on 'users' collection...");
  const usersCollection = db.collection("users");
  
  const emailCleanup = await usersCollection.updateMany(
    { email: { $in: [null, ""] } },
    { $unset: { email: "" } }
  );
  const cnicCleanup = await usersCollection.updateMany(
    { cnic: { $in: [null, ""] } },
    { $unset: { cnic: "" } }
  );

  console.log("Cleanup results:", {
    email: { matched: emailCleanup.matchedCount, modified: emailCleanup.modifiedCount },
    cnic: { matched: cnicCleanup.matchedCount, modified: cnicCleanup.modifiedCount },
  });

  await ensureIndex(usersCollection, {
    name: "email_1",
    key: { email: 1 },
    options: { unique: true, sparse: true },
  });
  await ensureIndex(usersCollection, {
    name: "cnic_1",
    key: { cnic: 1 },
    options: { unique: true, sparse: true },
  });

  // Application collection indexes
  console.log("Creating indexes on 'applications' collection...");
  const applicationsCollection = db.collection("applications");
  await ensureIndex(applicationsCollection, {
    name: "tracking_id_1",
    key: { tracking_id: 1 },
    options: { unique: true },
  });
  await ensureIndex(applicationsCollection, {
    name: "status_1",
    key: { status: 1 },
    options: {},
  });
  await ensureIndex(applicationsCollection, {
    name: "created_at_1",
    key: { created_at: 1 },
    options: {},
  });
  await ensureIndex(applicationsCollection, {
    name: "description.district_1",
    key: { "description.district": 1 },
    options: {},
  });

  // HearingDate collection indexes
  console.log("Creating indexes on 'hearingdates' collection...");
  const hearingDatesCollection = db.collection("hearingdates");
  await ensureIndex(hearingDatesCollection, {
    name: "application_id_1",
    key: { application_id: 1 },
    options: {},
  });
  await ensureIndex(hearingDatesCollection, {
    name: "hearing_date_1",
    key: { hearing_date: 1 },
    options: {},
  });
  await ensureIndex(hearingDatesCollection, {
    name: "is_active_1",
    key: { is_active: 1 },
    options: {},
  });

  // AuditLog collection indexes
  console.log("Creating indexes on 'auditlogs' collection...");
  const auditLogsCollection = db.collection("auditlogs");
  await ensureIndex(auditLogsCollection, {
    name: "created_at_1",
    key: { created_at: 1 },
    options: {},
  });
  await ensureIndex(auditLogsCollection, {
    name: "user_id_1",
    key: { user_id: 1 },
    options: {},
  });
  await ensureIndex(auditLogsCollection, {
    name: "entity_type_1",
    key: { entity_type: 1 },
    options: {},
  });

  // ViolationType collection indexes
  console.log("Creating indexes on 'violationtypes' collection...");
  const violationTypesCollection = db.collection("violationtypes");
  await ensureIndex(violationTypesCollection, {
    name: "name_1",
    key: { name: 1 },
    options: { unique: true },
  });

  // Notification collection indexes
  console.log("Creating indexes on 'notifications' collection...");
  const notificationsCollection = db.collection("notifications");
  await ensureIndex(notificationsCollection, {
    name: "recipient_user_id_1",
    key: { recipient_user_id: 1 },
    options: {},
  });
  await ensureIndex(notificationsCollection, {
    name: "is_read_1",
    key: { is_read: 1 },
    options: {},
  });
  await ensureIndex(notificationsCollection, {
    name: "created_at_1",
    key: { created_at: 1 },
    options: {},
  });

  console.log("✅ All indexes created successfully!");
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Index migration failed:", error);
  process.exitCode = 1;
});
