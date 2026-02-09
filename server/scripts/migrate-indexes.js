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

  const collection = mongoose.connection.db.collection("users");

  const emailCleanup = await collection.updateMany(
    { email: { $in: [null, ""] } },
    { $unset: { email: "" } }
  );
  const cnicCleanup = await collection.updateMany(
    { cnic: { $in: [null, ""] } },
    { $unset: { cnic: "" } }
  );

  console.log("Cleanup results:", {
    email: { matched: emailCleanup.matchedCount, modified: emailCleanup.modifiedCount },
    cnic: { matched: cnicCleanup.matchedCount, modified: cnicCleanup.modifiedCount },
  });

  await ensureIndex(collection, {
    name: "email_1",
    key: { email: 1 },
    options: { unique: true, sparse: true },
  });
  await ensureIndex(collection, {
    name: "cnic_1",
    key: { cnic: 1 },
    options: { unique: true, sparse: true },
  });

  const indexes = await collection.indexes();
  console.log("Indexes:", indexes.map((idx) => ({ name: idx.name, unique: idx.unique, sparse: idx.sparse, key: idx.key })));

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Index migration failed:", error);
  process.exitCode = 1;
});
