import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/punjab_compliance";

const run = async () => {
  console.log(`Connecting to ${mongoUri}`);
  await mongoose.connect(mongoUri);

  const users = mongoose.connection.db.collection("users");
  const applications = mongoose.connection.db.collection("applications");

  const userMigrateResult = await users.updateMany(
    {
      district: { $exists: false },
      division: { $exists: true, $nin: [null, ""] },
    },
    [
      {
        $set: {
          district: "$division",
        },
      },
    ]
  );

  const userCleanupResult = await users.updateMany(
    { division: { $exists: true } },
    { $unset: { division: "" } }
  );

  const applicationMigrateResult = await applications.updateMany(
    {
      "description.district": { $exists: false },
      "description.division": { $exists: true, $nin: [null, ""] },
    },
    [
      {
        $set: {
          "description.district": "$description.division",
        },
      },
    ]
  );

  const applicationCleanupResult = await applications.updateMany(
    { "description.division": { $exists: true } },
    { $unset: { "description.division": "" } }
  );

  console.log("Migration results:", {
    userDistrictFromDivision: {
      matched: userMigrateResult.matchedCount,
      modified: userMigrateResult.modifiedCount,
    },
    userDivisionUnset: {
      matched: userCleanupResult.matchedCount,
      modified: userCleanupResult.modifiedCount,
    },
    applicationDistrictFromDivision: {
      matched: applicationMigrateResult.matchedCount,
      modified: applicationMigrateResult.modifiedCount,
    },
    applicationDivisionUnset: {
      matched: applicationCleanupResult.matchedCount,
      modified: applicationCleanupResult.modifiedCount,
    },
  });

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("District migration failed:", error);
  process.exitCode = 1;
});
